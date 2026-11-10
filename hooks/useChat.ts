"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ApiMessage,
  AppState,
  AssistantMessage,
  ChatPayload,
  ChatRequest,
  Conversation,
  Feedback,
  FloatingCard,
  Settings,
} from "../lib/types";
import {
  buildHistory,
  cleanupConversations,
  CONTINUE_PROMPT,
  getAssistant,
  pickNextActive,
} from "../lib/chat";
import {
  createDefaultState,
  loadState,
  parseState,
  saveState,
  STORAGE_KEY,
} from "../lib/storage";
import { streamChat } from "../lib/stream";
import { createId, makeCardTitle, makeConversationTitle } from "../lib/utils";

const MAX_RESPONSE_VERSIONS = 10;
const SAVE_INTERVAL_MS = 400;

interface StreamJob {
  conversationId: string;
  requestId: string;
  responseId: string;
  history: ApiMessage[];
  baseContent: string;
}

function newResponse(): AssistantMessage {
  return { id: createId(), content: "", createdAt: Date.now(), status: "streaming" };
}

function applyTheme(theme: Settings["theme"]): void {
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function useChat() {
  const [state, setState] = useState<AppState>(createDefaultState);
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState("");
  const [streamingIds, setStreamingIds] = useState<string[]>([]);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const [storageWarning, setStorageWarning] = useState(false);

  const stateRef = useRef<AppState>(state);
  const controllers = useRef<Map<string, AbortController>>(new Map());
  const saveTimer = useRef<number | null>(null);
  const skipSave = useRef(false);
  const warningRef = useRef(false);

  const commit = useCallback((updater: (current: AppState) => AppState) => {
    const next = updater(stateRef.current);
    if (next === stateRef.current) return;
    stateRef.current = next;
    setState(next);
  }, []);

  const abortConversation = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
  }, []);

  useEffect(() => {
    const loaded = loadState();
    const keep = loaded.activeConversationId;
    loaded.conversations = cleanupConversations(loaded.conversations, keep);
    stateRef.current = loaded;
    setState(loaded);
    setMounted(true);
  }, []);

  const flushSave = useCallback(() => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const ok = saveState(stateRef.current);
    if (warningRef.current === ok) {
      warningRef.current = !ok;
      setStorageWarning(!ok);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    if (saveTimer.current !== null) return;
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      flushSave();
    }, SAVE_INTERVAL_MS);
  }, [state, mounted, flushSave]);

  useEffect(() => {
    if (!mounted) return;
    const onHide = () => flushSave();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushSave();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mounted, flushSave]);

  useEffect(() => {
    if (!mounted) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || controllers.current.size > 0) return;
      const incoming = parseState(event.newValue);
      if (!incoming) return;
      skipSave.current = true;
      commit((current) => {
        const temps = current.conversations.filter((c) => c.temporary);
        const activeIsTemp = temps.some((c) => c.id === current.activeConversationId);
        const stillThere = incoming.conversations.some((c) => c.id === current.activeConversationId);
        return {
          conversations: [...temps, ...incoming.conversations],
          activeConversationId:
            activeIsTemp || stillThere ? current.activeConversationId : incoming.activeConversationId,
          settings: incoming.settings,
        };
      });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [mounted, commit]);

  useEffect(() => {
    const map = controllers.current;
    return () => {
      map.forEach((controller) => controller.abort());
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, []);

  const theme = state.settings.theme;
  useEffect(() => {
    if (!mounted) return;
    applyTheme(theme);
    if (theme !== "system" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [theme, mounted]);

  const activeConversation = useMemo<Conversation | null>(
    () => state.conversations.find((c) => c.id === state.activeConversationId) ?? null,
    [state.conversations, state.activeConversationId]
  );

  const isStreaming =
    state.activeConversationId !== null && streamingIds.includes(state.activeConversationId);

  const patchResponse = useCallback(
    (
      conversationId: string,
      requestId: string,
      responseId: string,
      patch: (response: AssistantMessage) => AssistantMessage,
      touch: boolean
    ) => {
      commit((current) => {
        let changed = false;
        const conversations = current.conversations.map((conversation) => {
          if (conversation.id !== conversationId) return conversation;
          const requests = conversation.requests.map((request) => {
            if (request.id !== requestId) return request;
            const responses = request.responses.map((response) => {
              if (response.id !== responseId) return response;
              changed = true;
              return patch(response);
            });
            return { ...request, responses };
          });
          return {
            ...conversation,
            requests,
            updatedAt: touch ? Date.now() : conversation.updatedAt,
          };
        });
        return changed ? { ...current, conversations } : current;
      });
    },
    [commit]
  );

  const runStream = useCallback(
    async (job: StreamJob) => {
      const { conversationId, requestId, responseId, history, baseContent } = job;
      if (controllers.current.has(conversationId)) return;

      const controller = new AbortController();
      controllers.current.set(conversationId, controller);
      setStreamingIds((ids) => (ids.includes(conversationId) ? ids : [...ids, conversationId]));

      let received = baseContent;
      let finishReason = "";
      let thinkingMs: number | undefined;
      const startedAt = Date.now();

      const settings = stateRef.current.settings;
      const payload: ChatPayload = {
        messages: history,
        model: settings.model ?? undefined,
        reasoningEffort: settings.reasoningEffort,
        about: settings.customAbout.trim() || undefined,
        style: settings.customStyle.trim() || undefined,
      };

      const finish = (status: "complete" | "error", error?: string, truncated?: boolean) => {
        patchResponse(
          conversationId,
          requestId,
          responseId,
          (response) => {
            const next: AssistantMessage = {
              ...response,
              content: received,
              status,
              error: status === "error" ? error : undefined,
              truncated: status === "complete" && truncated ? true : undefined,
            };
            if (thinkingMs !== undefined) next.thinkingMs = thinkingMs;
            return next;
          },
          true
        );
      };

      const settle = (failure: string | null) => {
        const stopped = controller.signal.aborted;
        if (received.trim()) {
          finish("complete", undefined, stopped || finishReason === "length" || failure !== null);
        } else if (failure) {
          finish("error", failure);
        } else if (stopped) {
          finish("error", "Generation was stopped before any text arrived.");
        } else if (finishReason === "length") {
          finish(
            "error",
            "The model ran out of tokens before answering. Try again or lower the thinking effort."
          );
        } else {
          finish("error", "The model returned an empty response. Try again.");
        }
      };

      try {
        await streamChat({
          payload,
          signal: controller.signal,
          onDelta: (delta) => {
            received += delta;
            const firstDelta = thinkingMs === undefined && baseContent === "";
            if (firstDelta) thinkingMs = Date.now() - startedAt;
            const snapshot = received;
            const measured = thinkingMs;
            patchResponse(
              conversationId,
              requestId,
              responseId,
              (response) => ({
                ...response,
                content: snapshot,
                thinkingMs: firstDelta ? measured : response.thinkingMs,
              }),
              false
            );
          },
          onFinishReason: (reason) => {
            finishReason = reason;
          },
        });
        settle(null);
      } catch (err) {
        if (controller.signal.aborted) settle(null);
        else settle(err instanceof Error && err.message ? err.message : "Something went wrong.");
      } finally {
        if (controllers.current.get(conversationId) === controller) {
          controllers.current.delete(conversationId);
        }
        setStreamingIds((ids) => ids.filter((id) => id !== conversationId));
      }
    },
    [patchResponse]
  );

  const requestFocus = useCallback(() => setFocusToken((token) => token + 1), []);

  const createConversation = useCallback(
    (temporary = false) => {
      setExpandedRequestId(null);
      setFocusToken((token) => token + 1);

      const current = stateRef.current;
      const active = current.conversations.find((c) => c.id === current.activeConversationId);
      if (active && active.requests.length === 0 && Boolean(active.temporary) === temporary) return;

      const now = Date.now();
      const conversation: Conversation = {
        id: createId(),
        title: "New chat",
        createdAt: now,
        updatedAt: now,
        requests: [],
        floatingCards: [],
      };
      if (temporary) conversation.temporary = true;

      current.conversations.forEach((c) => {
        if (c.temporary) abortConversation(c.id);
      });
      commit((s) => ({
        ...s,
        conversations: [conversation, ...cleanupConversations(s.conversations, null)],
        activeConversationId: conversation.id,
      }));
    },
    [commit, abortConversation]
  );

  const selectConversation = useCallback(
    (id: string) => {
      setExpandedRequestId(null);
      const current = stateRef.current;
      if (!current.conversations.some((c) => c.id === id)) return;
      current.conversations.forEach((c) => {
        if (c.temporary && c.id !== id) abortConversation(c.id);
      });
      commit((s) => ({
        ...s,
        conversations: cleanupConversations(s.conversations, id),
        activeConversationId: id,
      }));
    },
    [commit, abortConversation]
  );

  const deleteConversation = useCallback(
    (id: string) => {
      abortConversation(id);
      setExpandedRequestId(null);
      commit((s) => {
        const remaining = s.conversations.filter((c) => c.id !== id);
        const activeConversationId =
          s.activeConversationId === id
            ? pickNextActive(remaining, id)
            : s.activeConversationId;
        return {
          ...s,
          conversations: cleanupConversations(remaining, activeConversationId),
          activeConversationId,
        };
      });
    },
    [commit, abortConversation]
  );

  const deleteAllConversations = useCallback(() => {
    controllers.current.forEach((controller) => controller.abort());
    setExpandedRequestId(null);
    commit((s) => ({ ...s, conversations: [], activeConversationId: null }));
  }, [commit]);

  const archiveAllConversations = useCallback(() => {
    setExpandedRequestId(null);
    commit((s) => ({
      ...s,
      conversations: s.conversations.map((c) =>
        c.temporary || c.requests.length === 0 ? c : { ...c, archived: true }
      ),
      activeConversationId:
        s.conversations.find((c) => c.id === s.activeConversationId)?.temporary
          ? s.activeConversationId
          : null,
    }));
  }, [commit]);

  const renameConversation = useCallback(
    (id: string, title: string) => {
      const next = title.replace(/\s+/g, " ").trim().slice(0, 100);
      if (!next) return;
      commit((s) => ({
        ...s,
        conversations: s.conversations.map((c) => (c.id === id ? { ...c, title: next } : c)),
      }));
    },
    [commit]
  );

  const togglePin = useCallback(
    (id: string) => {
      commit((s) => ({
        ...s,
        conversations: s.conversations.map((c) => {
          if (c.id !== id) return c;
          const next = { ...c };
          if (c.pinned) delete next.pinned;
          else next.pinned = true;
          return next;
        }),
      }));
    },
    [commit]
  );

  const setArchived = useCallback(
    (id: string, archived: boolean) => {
      setExpandedRequestId(null);
      commit((s) => {
        const conversations = s.conversations.map((c) => {
          if (c.id !== id) return c;
          const next = { ...c };
          if (archived) next.archived = true;
          else delete next.archived;
          return next;
        });
        const activeConversationId =
          archived && s.activeConversationId === id
            ? pickNextActive(conversations, id)
            : s.activeConversationId;
        return { ...s, conversations, activeConversationId };
      });
    },
    [commit]
  );

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      commit((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
    },
    [commit]
  );

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    const current = stateRef.current;
    const existing = current.conversations.find((c) => c.id === current.activeConversationId) ?? null;
    if (existing && controllers.current.has(existing.id)) return;

    const now = Date.now();
    const response = newResponse();
    const request: ChatRequest = {
      id: createId(),
      userMessage: { id: createId(), content: text, createdAt: now },
      responses: [response],
      activeResponse: 0,
    };

    const history: ApiMessage[] = existing ? buildHistory(existing.requests) : [];
    history.push({ role: "user", content: text });

    let conversationId: string;
    if (existing) {
      conversationId = existing.id;
      commit((s) => ({
        ...s,
        conversations: s.conversations.map((c) =>
          c.id !== conversationId
            ? c
            : {
                ...c,
                title: c.requests.length === 0 ? makeConversationTitle(text) : c.title,
                updatedAt: now,
                requests: [...c.requests, request],
              }
        ),
      }));
    } else {
      const conversation: Conversation = {
        id: createId(),
        title: makeConversationTitle(text),
        createdAt: now,
        updatedAt: now,
        requests: [request],
        floatingCards: [],
      };
      conversationId = conversation.id;
      commit((s) => ({
        ...s,
        conversations: [conversation, ...cleanupConversations(s.conversations, null)],
        activeConversationId: conversation.id,
      }));
    }

    setInput("");
    setExpandedRequestId(null);
    void runStream({
      conversationId,
      requestId: request.id,
      responseId: response.id,
      history,
      baseContent: "",
    });
  }, [input, commit, runStream]);

  const stopStreaming = useCallback(() => {
    const id = stateRef.current.activeConversationId;
    if (id) abortConversation(id);
  }, [abortConversation]);

  const findActive = useCallback((): Conversation | null => {
    const current = stateRef.current;
    return current.conversations.find((c) => c.id === current.activeConversationId) ?? null;
  }, []);

  const retryRequest = useCallback(
    (requestId: string) => {
      const conversation = findActive();
      if (!conversation || controllers.current.has(conversation.id)) return;
      const index = conversation.requests.findIndex((r) => r.id === requestId);
      if (index < 0) return;
      const target = conversation.requests[index];
      const failed = getAssistant(target);
      if (failed.status !== "error") return;

      const history = buildHistory(conversation.requests.slice(0, index));
      history.push({ role: "user", content: target.userMessage.content });

      patchResponse(
        conversation.id,
        requestId,
        failed.id,
        (response) => ({ ...response, content: "", status: "streaming", error: undefined, truncated: undefined, feedback: undefined }),
        false
      );
      void runStream({
        conversationId: conversation.id,
        requestId,
        responseId: failed.id,
        history,
        baseContent: "",
      });
    },
    [findActive, patchResponse, runStream]
  );

  const regenerate = useCallback(
    (requestId: string) => {
      const conversation = findActive();
      if (!conversation || controllers.current.has(conversation.id)) return;
      const index = conversation.requests.findIndex((r) => r.id === requestId);
      if (index < 0 || index !== conversation.requests.length - 1) return;
      const target = conversation.requests[index];

      const history = buildHistory(conversation.requests.slice(0, index));
      history.push({ role: "user", content: target.userMessage.content });

      const response = newResponse();
      commit((s) => ({
        ...s,
        conversations: s.conversations.map((c) =>
          c.id !== conversation.id
            ? c
            : {
                ...c,
                requests: c.requests.map((r) => {
                  if (r.id !== requestId) return r;
                  const responses = [...r.responses, response].slice(-MAX_RESPONSE_VERSIONS);
                  return { ...r, responses, activeResponse: responses.length - 1 };
                }),
              }
        ),
      }));
      void runStream({
        conversationId: conversation.id,
        requestId,
        responseId: response.id,
        history,
        baseContent: "",
      });
    },
    [findActive, commit, runStream]
  );

  const continueGenerating = useCallback(
    (requestId: string) => {
      const conversation = findActive();
      if (!conversation || controllers.current.has(conversation.id)) return;
      const index = conversation.requests.findIndex((r) => r.id === requestId);
      if (index < 0) return;
      const target = conversation.requests[index];
      const partial = getAssistant(target);
      if (partial.status !== "complete" || !partial.content.trim()) return;

      const history = buildHistory(conversation.requests.slice(0, index));
      history.push({ role: "user", content: target.userMessage.content });
      history.push({ role: "assistant", content: partial.content });
      history.push({ role: "user", content: CONTINUE_PROMPT });

      patchResponse(
        conversation.id,
        requestId,
        partial.id,
        (response) => ({ ...response, status: "streaming", truncated: undefined }),
        false
      );
      void runStream({
        conversationId: conversation.id,
        requestId,
        responseId: partial.id,
        history,
        baseContent: partial.content,
      });
    },
    [findActive, patchResponse, runStream]
  );

  const editMessage = useCallback(
    (requestId: string, text: string) => {
      const next = text.trim();
      const conversation = findActive();
      if (!next || !conversation || controllers.current.has(conversation.id)) return;
      const index = conversation.requests.findIndex((r) => r.id === requestId);
      if (index < 0) return;
      const target = conversation.requests[index];
      if (target.userMessage.content === next) return;

      const history = buildHistory(conversation.requests.slice(0, index));
      history.push({ role: "user", content: next });

      const response = newResponse();
      const keptRequests = conversation.requests.slice(0, index + 1);
      const keptIds = new Set(keptRequests.map((r) => r.id));
      const shouldRetitle = index === 0 && conversation.title === makeConversationTitle(target.userMessage.content);

      setExpandedRequestId((open) => (open && !keptIds.has(open) ? null : open));
      commit((s) => ({
        ...s,
        conversations: s.conversations.map((c) => {
          if (c.id !== conversation.id) return c;
          const requests = keptRequests.map((r) =>
            r.id !== requestId
              ? r
              : {
                  ...r,
                  userMessage: { ...r.userMessage, content: next },
                  responses: [response],
                  activeResponse: 0,
                }
          );
          return {
            ...c,
            title: shouldRetitle ? makeConversationTitle(next) : c.title,
            updatedAt: Date.now(),
            requests,
            floatingCards: c.floatingCards
              .filter((card) => keptIds.has(card.requestId))
              .map((card) =>
                card.requestId === requestId ? { ...card, title: makeCardTitle(next) } : card
              ),
          };
        }),
      }));
      void runStream({
        conversationId: conversation.id,
        requestId,
        responseId: response.id,
        history,
        baseContent: "",
      });
    },
    [findActive, commit, runStream]
  );

  const patchRequestMeta = useCallback(
    (requestId: string, patch: (request: ChatRequest) => ChatRequest) => {
      commit((s) => ({
        ...s,
        conversations: s.conversations.map((c) =>
          c.id !== s.activeConversationId
            ? c
            : { ...c, requests: c.requests.map((r) => (r.id === requestId ? patch(r) : r)) }
        ),
      }));
    },
    [commit]
  );

  const setResponseIndex = useCallback(
    (requestId: string, index: number) => {
      patchRequestMeta(requestId, (request) => {
        const clamped = Math.min(Math.max(index, 0), request.responses.length - 1);
        return clamped === request.activeResponse ? request : { ...request, activeResponse: clamped };
      });
    },
    [patchRequestMeta]
  );

  const setFeedback = useCallback(
    (requestId: string, feedback: Feedback) => {
      patchRequestMeta(requestId, (request) => ({
        ...request,
        responses: request.responses.map((response, i) => {
          if (i !== request.activeResponse) return response;
          const next = { ...response };
          if (response.feedback === feedback) delete next.feedback;
          else next.feedback = feedback;
          return next;
        }),
      }));
    },
    [patchRequestMeta]
  );

  const updateActiveCards = useCallback(
    (update: (cards: FloatingCard[], conversation: Conversation) => FloatingCard[]) => {
      commit((s) => {
        const id = s.activeConversationId;
        if (!id) return s;
        let changed = false;
        const conversations = s.conversations.map((conversation) => {
          if (conversation.id !== id) return conversation;
          const next = update(conversation.floatingCards, conversation);
          if (next === conversation.floatingCards) return conversation;
          changed = true;
          return { ...conversation, floatingCards: next };
        });
        return changed ? { ...s, conversations } : s;
      });
    },
    [commit]
  );

  const floatRequest = useCallback(
    (requestId: string) => {
      updateActiveCards((cards, conversation) => {
        const request = conversation.requests.find((r) => r.id === requestId);
        if (!request || getAssistant(request).status !== "complete") return cards;

        const topZ = cards.reduce((max, card) => Math.max(max, card.z), 0);
        const existing = cards.find((card) => card.requestId === requestId);
        if (existing) {
          return cards.map((card) => (card.id === existing.id ? { ...card, z: topZ + 1 } : card));
        }
        const slot = cards.length % 8;
        const card: FloatingCard = {
          id: createId(),
          requestId,
          title: makeCardTitle(request.userMessage.content),
          x: 16 + slot * 28,
          y: 16 + slot * 28,
          z: topZ + 1,
          createdAt: Date.now(),
        };
        return [...cards, card];
      });
    },
    [updateActiveCards]
  );

  const removeFloatingCard = useCallback(
    (cardId: string) => {
      const conversation = findActive();
      const card = conversation?.floatingCards.find((c) => c.id === cardId);
      if (card) setExpandedRequestId((open) => (open === card.requestId ? null : open));
      updateActiveCards((cards) => (cards.some((c) => c.id === cardId) ? cards.filter((c) => c.id !== cardId) : cards));
    },
    [findActive, updateActiveCards]
  );

  const bringCardToFront = useCallback(
    (cardId: string) => {
      updateActiveCards((cards) => {
        const target = cards.find((c) => c.id === cardId);
        if (!target) return cards;
        const topZ = cards.reduce((max, c) => Math.max(max, c.z), 0);
        const othersAtTop = cards.some((c) => c.id !== cardId && c.z >= target.z);
        if (target.z === topZ && !othersAtTop) return cards;
        return cards.map((c) => (c.id === cardId ? { ...c, z: topZ + 1 } : c));
      });
    },
    [updateActiveCards]
  );

  const updateCardPosition = useCallback(
    (cardId: string, x: number, y: number) => {
      updateActiveCards((cards) => {
        const target = cards.find((c) => c.id === cardId);
        if (!target || (target.x === x && target.y === y)) return cards;
        return cards.map((c) => (c.id === cardId ? { ...c, x, y } : c));
      });
    },
    [updateActiveCards]
  );

  const openExpandedCard = useCallback(
    (requestId: string) => {
      const conversation = findActive();
      if (conversation?.requests.some((r) => r.id === requestId)) setExpandedRequestId(requestId);
    },
    [findActive]
  );

  const closeExpandedCard = useCallback(() => setExpandedRequestId(null), []);

  return {
    mounted,
    state,
    conversations: state.conversations,
    settings: state.settings,
    activeConversation,
    activeConversationId: state.activeConversationId,
    streamingIds,
    isStreaming,
    input,
    setInput,
    focusToken,
    requestFocus,
    storageWarning,
    createConversation,
    selectConversation,
    deleteConversation,
    deleteAllConversations,
    archiveAllConversations,
    renameConversation,
    togglePin,
    setArchived,
    updateSettings,
    sendMessage,
    stopStreaming,
    retryRequest,
    regenerate,
    continueGenerating,
    editMessage,
    setResponseIndex,
    setFeedback,
    floatRequest,
    removeFloatingCard,
    bringCardToFront,
    updateCardPosition,
    expandedRequestId,
    openExpandedCard,
    closeExpandedCard,
  };
}
