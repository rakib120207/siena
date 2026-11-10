import type { ApiMessage, ChatPayload } from "./types";

interface StreamChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
    };
    finish_reason?: string | null;
  }>;
  error?: unknown;
}

export interface StreamHandlers {
  onDelta: (text: string) => void;
  onFinishReason?: (reason: string) => void;
}

export async function readSSEStream(
  stream: ReadableStream<Uint8Array>,
  handlers: StreamHandlers
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleLine = (rawLine: string): boolean => {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) return false;
    const data = line.slice(5).trim();
    if (!data) return false;
    if (data === "[DONE]") return true;

    let chunk: StreamChunk;
    try {
      const parsed: unknown = JSON.parse(data);
      if (typeof parsed !== "object" || parsed === null) return false;
      chunk = parsed as StreamChunk;
    } catch {
      return false;
    }

    if (chunk.error) {
      throw new Error("The model stream reported an error.");
    }

    const choice = chunk.choices?.[0];
    const delta = choice?.delta?.content;
    if (typeof delta === "string" && delta.length > 0) handlers.onDelta(delta);
    if (typeof choice?.finish_reason === "string" && handlers.onFinishReason) {
      handlers.onFinishReason(choice.finish_reason);
    }
    return false;
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (handleLine(line)) {
          await reader.cancel().catch(() => undefined);
          return;
        }
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) handleLine(buffer);
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // lock already released
    }
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();
    if (typeof data === "object" && data !== null) {
      const message = (data as { error?: unknown }).error;
      if (typeof message === "string" && message) return message;
    }
  } catch {
    // body was not JSON
  }
  if (response.status === 404) return "The chat API route was not found.";
  return `Request failed with status ${response.status}.`;
}

interface StreamChatOptions extends StreamHandlers {
  payload: ChatPayload;
  signal: AbortSignal;
}

export async function streamChat({
  payload,
  signal,
  onDelta,
  onFinishReason,
}: StreamChatOptions): Promise<void> {
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if (signal.aborted) throw err;
    throw new Error("Network error. Check your connection and try again.");
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  if (!response.body) {
    throw new Error("The server returned an empty response.");
  }

  try {
    await readSSEStream(response.body, { onDelta, onFinishReason });
  } catch (err) {
    if (signal.aborted) throw err;
    throw new Error(err instanceof Error && err.message ? err.message : "The connection was interrupted.");
  }
}

export type { ApiMessage };
