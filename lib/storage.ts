import type {
  AppState,
  AssistantMessage,
  ChatRequest,
  Conversation,
  FloatingCard,
  Settings,
} from "./types";
import { defaultSettings, getAssistant } from "./chat";

export const STORAGE_KEY = "siena:v1";
export const LEGACY_STORAGE_KEY = "groq-floating-chatbot:v1";

export function createDefaultState(): AppState {
  return { conversations: [], activeConversationId: null, settings: defaultSettings() };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeAssistant(value: unknown): AssistantMessage | null {
  if (!isRecord(value)) return null;
  const id = asString(value.id);
  const content = asString(value.content);
  if (!id || content === null) return null;

  let status: AssistantMessage["status"];
  let error = asString(value.error) ?? undefined;
  if (value.status === "complete") {
    status = "complete";
  } else if (value.status === "error") {
    status = "error";
  } else if (content.trim().length > 0) {
    status = "complete";
  } else {
    status = "error";
    error = "This response was interrupted. Retry to generate it again.";
  }
  if (status === "error" && !error) error = "Something went wrong.";

  const message: AssistantMessage = {
    id,
    content,
    createdAt: asNumber(value.createdAt, Date.now()),
    status,
  };
  if (status === "error") message.error = error;
  if (value.feedback === "up" || value.feedback === "down") message.feedback = value.feedback;
  if (typeof value.thinkingMs === "number" && Number.isFinite(value.thinkingMs)) {
    message.thinkingMs = value.thinkingMs;
  }
  if (value.truncated === true && status === "complete") message.truncated = true;
  if (value.status === "streaming" && content.trim().length > 0) message.truncated = true;
  return message;
}

function normalizeRequest(value: unknown): ChatRequest | null {
  if (!isRecord(value)) return null;
  const id = asString(value.id);
  const user = value.userMessage;
  if (!id || !isRecord(user)) return null;
  const userId = asString(user.id);
  const userContent = asString(user.content);
  if (!userId || userContent === null) return null;

  const responses: AssistantMessage[] = [];
  if (Array.isArray(value.responses)) {
    for (const raw of value.responses) {
      const response = normalizeAssistant(raw);
      if (response) responses.push(response);
    }
  } else {
    const legacy = normalizeAssistant(value.assistantMessage);
    if (legacy) responses.push(legacy);
  }
  if (responses.length === 0) return null;

  const activeResponse = Math.min(
    Math.max(Math.trunc(asNumber(value.activeResponse, responses.length - 1)), 0),
    responses.length - 1
  );

  return {
    id,
    userMessage: { id: userId, content: userContent, createdAt: asNumber(user.createdAt, Date.now()) },
    responses,
    activeResponse,
  };
}

function normalizeCard(value: unknown, requestIds: Set<string>): FloatingCard | null {
  if (!isRecord(value)) return null;
  const id = asString(value.id);
  const requestId = asString(value.requestId);
  if (!id || !requestId || !requestIds.has(requestId)) return null;
  return {
    id,
    requestId,
    title: asString(value.title) ?? "Untitled question",
    x: Math.max(0, asNumber(value.x, 16)),
    y: Math.max(0, asNumber(value.y, 16)),
    z: asNumber(value.z, 1),
    createdAt: asNumber(value.createdAt, Date.now()),
  };
}

function normalizeConversation(value: unknown): Conversation | null {
  if (!isRecord(value)) return null;
  const id = asString(value.id);
  if (!id || value.temporary === true) return null;

  const requests: ChatRequest[] = [];
  const requestIds = new Set<string>();
  if (Array.isArray(value.requests)) {
    for (const raw of value.requests) {
      const request = normalizeRequest(raw);
      if (request && !requestIds.has(request.id)) {
        requestIds.add(request.id);
        requests.push(request);
      }
    }
  }

  const floatingCards: FloatingCard[] = [];
  const cardIds = new Set<string>();
  const cardRequestIds = new Set<string>();
  if (Array.isArray(value.floatingCards)) {
    for (const raw of value.floatingCards) {
      const card = normalizeCard(raw, requestIds);
      if (card && !cardIds.has(card.id) && !cardRequestIds.has(card.requestId)) {
        cardIds.add(card.id);
        cardRequestIds.add(card.requestId);
        floatingCards.push(card);
      }
    }
  }

  const createdAt = asNumber(value.createdAt, Date.now());
  const conversation: Conversation = {
    id,
    title: asString(value.title)?.trim() || "New chat",
    createdAt,
    updatedAt: asNumber(value.updatedAt, createdAt),
    requests,
    floatingCards,
  };
  if (value.pinned === true) conversation.pinned = true;
  if (value.archived === true) conversation.archived = true;
  return conversation;
}

function normalizeSettings(value: unknown): Settings {
  const base = defaultSettings();
  if (!isRecord(value)) return base;
  return {
    theme: value.theme === "light" || value.theme === "dark" ? value.theme : "system",
    customAbout: (asString(value.customAbout) ?? "").slice(0, 1500),
    customStyle: (asString(value.customStyle) ?? "").slice(0, 1500),
    model: asString(value.model) || null,
    reasoningEffort:
      value.reasoningEffort === "medium" || value.reasoningEffort === "high"
        ? value.reasoningEffort
        : "low",
    sidebarCollapsed: value.sidebarCollapsed === true,
  };
}

export function parseState(raw: string | null): AppState | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.conversations)) return null;

    const conversations: Conversation[] = [];
    const seen = new Set<string>();
    for (const item of parsed.conversations) {
      const conversation = normalizeConversation(item);
      if (conversation && !seen.has(conversation.id)) {
        seen.add(conversation.id);
        conversations.push(conversation);
      }
    }

    const stored = asString(parsed.activeConversationId);
    let activeConversationId: string | null = null;
    if (stored && seen.has(stored)) {
      activeConversationId = stored;
    } else {
      const visible = conversations
        .filter((c) => !c.archived)
        .sort((a, b) => b.updatedAt - a.updatedAt);
      activeConversationId = visible.length > 0 ? visible[0].id : null;
    }

    return { conversations, activeConversationId, settings: normalizeSettings(parsed.settings) };
  } catch {
    return null;
  }
}

export function loadState(): AppState {
  if (typeof window === "undefined") return createDefaultState();
  try {
    const current = parseState(window.localStorage.getItem(STORAGE_KEY));
    if (current) return current;
    const legacy = parseState(window.localStorage.getItem(LEGACY_STORAGE_KEY));
    if (legacy) return legacy;
  } catch {
    // storage unavailable
  }
  return createDefaultState();
}

export function serializeState(state: AppState): string {
  const conversations = state.conversations.filter((c) => !c.temporary);
  const active = conversations.some((c) => c.id === state.activeConversationId)
    ? state.activeConversationId
    : null;
  return JSON.stringify({
    conversations,
    activeConversationId: active,
    settings: state.settings,
  });
}

export function saveState(state: AppState): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeState(state));
    return true;
  } catch {
    return false;
  }
}

export function conversationToMarkdown(conversation: Conversation): string {
  const lines: string[] = [`# ${conversation.title}`, ""];
  for (const request of conversation.requests) {
    const assistant = getAssistant(request);
    lines.push("## You", "", request.userMessage.content, "", "## Siena", "");
    lines.push(assistant.content || "_No response._", "");
  }
  return lines.join("\n");
}
