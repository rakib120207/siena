import { isReasoningModel, PRESET_MODEL_IDS } from "../../../lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-120b";
const BASE_PROMPT =
  "You are Siena, a helpful assistant. Answer clearly and concisely. Use Markdown for formatting when it helps readability.";
const MAX_MESSAGES = 60;
const MAX_CONTENT_LENGTH = 32000;
const MAX_INSTRUCTION_LENGTH = 1500;
const MAX_COMPLETION_TOKENS = 8192;

interface CleanMessage {
  role: "user" | "assistant";
  content: string;
}

interface ParsedBody {
  messages: CleanMessage[];
  model: string | null;
  effort: "low" | "medium" | "high" | null;
  about: string;
  style: string;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_INSTRUCTION_LENGTH) : "";
}

function parseBody(body: unknown): ParsedBody | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  const raw = record.messages;
  if (!Array.isArray(raw)) return null;

  const messages: CleanMessage[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const { role, content } = item as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string" || content.trim().length === 0) continue;
    messages.push({ role, content: content.slice(0, MAX_CONTENT_LENGTH) });
  }

  let recent = messages.slice(-MAX_MESSAGES);
  while (recent.length > 0 && recent[0].role !== "user") recent = recent.slice(1);
  if (recent.length === 0 || recent[recent.length - 1].role !== "user") return null;

  const model = typeof record.model === "string" ? record.model : null;
  const effort =
    record.reasoningEffort === "low" ||
    record.reasoningEffort === "medium" ||
    record.reasoningEffort === "high"
      ? record.reasoningEffort
      : null;

  return {
    messages: recent,
    model,
    effort,
    about: cleanText(record.about),
    style: cleanText(record.style),
  };
}

function buildSystemPrompt(about: string, style: string): string {
  const parts = [BASE_PROMPT];
  if (about) parts.push(`What the user wants you to know about them:\n${about}`);
  if (style) parts.push(`How the user wants you to respond:\n${style}`);
  return parts.join("\n\n");
}

function upstreamFailureMessage(status: number): { message: string; status: number } {
  if (status === 429) {
    return { message: "Groq rate limit reached. Wait a moment and try again.", status: 429 };
  }
  if (status === 401 || status === 403) {
    return { message: "Groq rejected the API key. Check GROQ_API_KEY.", status: 502 };
  }
  if (status === 404) {
    return { message: "Groq request failed. The selected model may not exist.", status: 502 };
  }
  return { message: "Groq request failed.", status: 502 };
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const parsed = parseBody(body);
  if (!parsed) {
    return jsonError("Invalid request body.", 400);
  }

  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    return jsonError("Missing GROQ_API_KEY.", 500);
  }

  const envModel = process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;
  const allowed = new Set<string>([envModel, ...PRESET_MODEL_IDS]);
  const model = parsed.model && allowed.has(parsed.model) ? parsed.model : envModel;

  const payload: Record<string, unknown> = {
    model,
    stream: true,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    messages: [
      { role: "system", content: buildSystemPrompt(parsed.about, parsed.style) },
      ...parsed.messages,
    ],
  };
  if (isReasoningModel(model)) {
    payload.reasoning_effort = parsed.effort ?? "low";
    payload.include_reasoning = false;
  }

  let upstream: Response;
  try {
    upstream = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: req.signal,
    });
  } catch {
    return jsonError("Groq request failed.", 502);
  }

  if (!upstream.ok || !upstream.body) {
    console.error(`Groq responded with status ${upstream.status} for model ${model}.`);
    await upstream.body?.cancel().catch(() => undefined);
    const failure = upstreamFailureMessage(upstream.status);
    return jsonError(failure.message, failure.status);
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform, max-age=0",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
