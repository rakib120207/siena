import type {
  ApiMessage,
  AssistantMessage,
  ChatRequest,
  Conversation,
  Settings,
} from "./types";

export const MAX_INSTRUCTION_LENGTH = 1500;
export const MAX_HISTORY_MESSAGES = 40;
export const CONTINUE_PROMPT =
  "Continue exactly where you left off. Do not repeat anything you already wrote.";

export function defaultSettings(): Settings {
  return {
    theme: "system",
    customAbout: "",
    customStyle: "",
    model: null,
    reasoningEffort: "low",
    sidebarCollapsed: false,
  };
}

export function getAssistant(request: ChatRequest): AssistantMessage {
  const last = request.responses.length - 1;
  const index = Math.min(Math.max(request.activeResponse, 0), last);
  return request.responses[index];
}

export function buildHistory(requests: ChatRequest[]): ApiMessage[] {
  const history: ApiMessage[] = [];
  for (const request of requests) {
    const assistant = getAssistant(request);
    if (assistant.status !== "complete" || !assistant.content.trim()) continue;
    history.push({ role: "user", content: request.userMessage.content });
    history.push({ role: "assistant", content: assistant.content });
  }
  return history.slice(-MAX_HISTORY_MESSAGES);
}

export function cleanupConversations(
  conversations: Conversation[],
  keepId: string | null
): Conversation[] {
  return conversations.filter(
    (c) => c.id === keepId || (!c.temporary && c.requests.length > 0)
  );
}

export function isVisibleInSidebar(conversation: Conversation): boolean {
  return !conversation.archived && !conversation.temporary && conversation.requests.length > 0;
}

export function pickNextActive(conversations: Conversation[], excludeId: string | null): string | null {
  const candidates = conversations
    .filter((c) => c.id !== excludeId && isVisibleInSidebar(c))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return candidates.length > 0 ? candidates[0].id : null;
}

export interface ConversationGroup {
  label: string;
  items: Conversation[];
}

export function groupConversations(conversations: Conversation[], now: number): ConversationGroup[] {
  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  const groups: ConversationGroup[] = [];
  const push = (label: string, conversation: Conversation) => {
    let group = groups.find((g) => g.label === label);
    if (!group) {
      group = { label, items: [] };
      groups.push(group);
    }
    group.items.push(conversation);
  };

  const today = new Date(now);
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const day = 86400000;

  for (const conversation of sorted) {
    if (conversation.pinned) push("Pinned", conversation);
  }
  for (const conversation of sorted) {
    if (conversation.pinned) continue;
    const t = conversation.updatedAt;
    if (t >= startToday) push("Today", conversation);
    else if (t >= startToday - day) push("Yesterday", conversation);
    else if (t >= startToday - 7 * day) push("Previous 7 Days", conversation);
    else if (t >= startToday - 30 * day) push("Previous 30 Days", conversation);
    else {
      const date = new Date(t);
      const sameYear = date.getFullYear() === today.getFullYear();
      push(
        date.toLocaleString("en-US", sameYear ? { month: "long" } : { month: "long", year: "numeric" }),
        conversation
      );
    }
  }
  return groups;
}

export interface SearchHit {
  conversation: Conversation;
  snippet: string | null;
}

function makeSnippet(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + length + 50);
  const body = text.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${body}${end < text.length ? "…" : ""}`;
}

export function searchConversations(conversations: Conversation[], query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];
  for (const conversation of conversations) {
    if (conversation.archived || conversation.temporary) continue;
    if (conversation.title.toLowerCase().includes(q)) {
      hits.push({ conversation, snippet: null });
      continue;
    }
    let snippet: string | null = null;
    for (const request of conversation.requests) {
      const texts = [request.userMessage.content, getAssistant(request).content];
      for (const text of texts) {
        const index = text.toLowerCase().indexOf(q);
        if (index >= 0) {
          snippet = makeSnippet(text, index, q.length);
          break;
        }
      }
      if (snippet) break;
    }
    if (snippet) hits.push({ conversation, snippet });
  }
  return hits.sort((a, b) => b.conversation.updatedAt - a.conversation.updatedAt);
}

export function stripMarkdown(text: string): string {
  return text
    .replace(/```[^\n]*\n([\s\S]*?)(```|$)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/(\*\*|__|~~)(.+?)\1/g, "$2")
    .replace(/\*(.+?)\*/g, "$1")
    .trim();
}

export function lastCodeBlock(text: string): string | null {
  const pattern = /```[^\n]*\n([\s\S]*?)(?:```|$)/g;
  let last: string | null = null;
  let match: RegExpExecArray | null = pattern.exec(text);
  while (match !== null) {
    last = match[1];
    if (match[0].length === 0) pattern.lastIndex += 1;
    match = pattern.exec(text);
  }
  return last === null ? null : last.replace(/\n+$/, "");
}
