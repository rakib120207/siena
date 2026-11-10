export type AssistantStatus = "streaming" | "complete" | "error";
export type Feedback = "up" | "down";
export type ThemeMode = "system" | "light" | "dark";
export type ReasoningEffort = "low" | "medium" | "high";

export interface UserMessage {
  id: string;
  content: string;
  createdAt: number;
}

export interface AssistantMessage {
  id: string;
  content: string;
  createdAt: number;
  status: AssistantStatus;
  error?: string;
  feedback?: Feedback;
  thinkingMs?: number;
  truncated?: boolean;
}

export interface ChatRequest {
  id: string;
  userMessage: UserMessage;
  responses: AssistantMessage[];
  activeResponse: number;
}

export interface FloatingCard {
  id: string;
  requestId: string;
  title: string;
  x: number;
  y: number;
  z: number;
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  requests: ChatRequest[];
  floatingCards: FloatingCard[];
  pinned?: boolean;
  archived?: boolean;
  temporary?: boolean;
}

export interface Settings {
  theme: ThemeMode;
  customAbout: string;
  customStyle: string;
  model: string | null;
  reasoningEffort: ReasoningEffort;
  sidebarCollapsed: boolean;
}

export interface AppState {
  conversations: Conversation[];
  activeConversationId: string | null;
  settings: Settings;
}

export interface ApiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatPayload {
  messages: ApiMessage[];
  model?: string;
  reasoningEffort?: ReasoningEffort;
  about?: string;
  style?: string;
}
