"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getAssistant } from "../lib/chat";
import type { ChatRequest, Feedback } from "../lib/types";
import { copyText, thoughtLabel } from "../lib/utils";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  EditIcon,
  FloatIcon,
  RetryIcon,
  ThumbDownIcon,
  ThumbUpIcon,
} from "./Icons";
import Markdown from "./Markdown";

interface RequestItemProps {
  request: ChatRequest;
  isLast: boolean;
  laterCount: number;
  isFloated: boolean;
  conversationBusy: boolean;
  onFloat: (requestId: string) => void;
  onRetry: (requestId: string) => void;
  onRegenerate: (requestId: string) => void;
  onContinue: (requestId: string) => void;
  onEdit: (requestId: string, text: string) => void;
  onSetResponse: (requestId: string, index: number) => void;
  onFeedback: (requestId: string, feedback: Feedback) => void;
}

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: ReactNode;
}

function ActionButton({ label, onClick, disabled, pressed, children }: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-ink3 transition-colors hover:bg-elevated hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink3"
    >
      {children}
    </button>
  );
}

function useCopied(): [boolean, (text: string) => Promise<void>] {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );
  const copy = async (text: string) => {
    const ok = await copyText(text);
    if (!ok) return;
    setCopied(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  };
  return [copied, copy];
}

export default function RequestItem({
  request,
  isLast,
  laterCount,
  isFloated,
  conversationBusy,
  onFloat,
  onRetry,
  onRegenerate,
  onContinue,
  onEdit,
  onSetResponse,
  onFeedback,
}: RequestItemProps) {
  const { userMessage } = request;
  const assistant = getAssistant(request);
  const isLive = assistant.status === "streaming";
  const hasContent = assistant.content.length > 0;
  const versionCount = request.responses.length;
  const versionIndex = Math.min(Math.max(request.activeResponse, 0), versionCount - 1);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(userMessage.content);
  const [userCopied, copyUser] = useCopied();
  const [answerCopied, copyAnswer] = useCopied();
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) return;
    const el = editRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  useEffect(() => {
    const el = editRef.current;
    if (!editing || !el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [draft, editing]);

  const startEdit = () => {
    setDraft(userMessage.content);
    setEditing(true);
  };

  const submitEdit = () => {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== userMessage.content) onEdit(request.id, next);
  };

  const thought = thoughtLabel(assistant.thinkingMs);

  return (
    <article className="space-y-5" aria-label="Question and answer">
      <div className="group flex flex-col items-end gap-1">
        {editing ? (
          <div className="w-full rounded-3xl border border-line bg-elevated p-3">
            <textarea
              ref={editRef}
              value={draft}
              rows={2}
              aria-label="Edit your message"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  setEditing(false);
                } else if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  submitEdit();
                }
              }}
              className="scroll-thin max-h-80 w-full resize-none bg-transparent px-2 py-1 text-[0.9375rem] leading-6 text-ink"
            />
            {laterCount > 0 && (
              <p className="px-2 pt-1 text-xs text-ink3">
                Sending removes the {laterCount} message{laterCount === 1 ? "" : "s"} after this one.
              </p>
            )}
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-full border border-line px-3.5 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-canvas"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitEdit}
                disabled={!draft.trim() || draft.trim() === userMessage.content}
                className="rounded-full bg-ink px-3.5 py-1.5 text-sm font-medium text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-3xl bg-elevated px-5 py-2.5 text-[0.9375rem] leading-7 text-ink">
              {userMessage.content}
            </div>
            <div className="flex items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
              <ActionButton
                label={userCopied ? "Copied" : "Copy message"}
                onClick={() => void copyUser(userMessage.content)}
              >
                {userCopied ? <CheckIcon /> : <CopyIcon />}
              </ActionButton>
              <ActionButton label="Edit message" onClick={startEdit} disabled={conversationBusy}>
                <EditIcon />
              </ActionButton>
            </div>
          </>
        )}
      </div>

      <div className="min-w-0">
        {isLive && !hasContent && (
          <div role="status" className="flex items-center gap-2 py-1 text-sm text-ink3">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-ink" aria-hidden="true" />
            <span className="shimmer-text">Thinking…</span>
          </div>
        )}

        {thought && hasContent && (
          <p className="mb-2 text-xs text-ink3">{thought}</p>
        )}

        {hasContent && (
          <div aria-busy={isLive}>
            <Markdown text={assistant.content} />
            {isLive && <span className="cursor-blink" aria-hidden="true" />}
          </div>
        )}

        {assistant.status === "error" && (
          <div
            role="alert"
            className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            <p className="min-w-0 flex-1 break-words">{assistant.error ?? "Something went wrong."}</p>
            <button
              type="button"
              onClick={() => onRetry(request.id)}
              disabled={conversationBusy}
              className="inline-flex items-center gap-1.5 rounded-full border border-danger/50 px-3 py-1 text-xs font-medium transition-colors hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RetryIcon size={14} />
              Retry
            </button>
          </div>
        )}

        {assistant.status === "complete" && assistant.truncated && (
          <button
            type="button"
            onClick={() => onContinue(request.id)}
            disabled={conversationBusy}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue generating
          </button>
        )}

        {assistant.status === "complete" && (
          <div className="mt-2 flex flex-wrap items-center gap-0.5">
            {versionCount > 1 && (
              <div className="mr-1 flex items-center text-xs text-ink3" role="group" aria-label="Response versions">
                <ActionButton
                  label="Previous response"
                  onClick={() => onSetResponse(request.id, versionIndex - 1)}
                  disabled={versionIndex === 0}
                >
                  <ChevronLeftIcon />
                </ActionButton>
                <span className="min-w-[2.25rem] text-center tabular-nums" aria-live="polite">
                  {versionIndex + 1}/{versionCount}
                </span>
                <ActionButton
                  label="Next response"
                  onClick={() => onSetResponse(request.id, versionIndex + 1)}
                  disabled={versionIndex === versionCount - 1}
                >
                  <ChevronRightIcon />
                </ActionButton>
              </div>
            )}
            <ActionButton
              label={answerCopied ? "Copied" : "Copy response"}
              onClick={() => void copyAnswer(assistant.content)}
            >
              {answerCopied ? <CheckIcon /> : <CopyIcon />}
            </ActionButton>
            <ActionButton
              label="Good response"
              pressed={assistant.feedback === "up"}
              onClick={() => onFeedback(request.id, "up")}
            >
              <ThumbUpIcon filled={assistant.feedback === "up"} />
            </ActionButton>
            <ActionButton
              label="Bad response"
              pressed={assistant.feedback === "down"}
              onClick={() => onFeedback(request.id, "down")}
            >
              <ThumbDownIcon filled={assistant.feedback === "down"} />
            </ActionButton>
            {isLast && (
              <ActionButton
                label="Regenerate response"
                onClick={() => onRegenerate(request.id)}
                disabled={conversationBusy}
              >
                <RetryIcon />
              </ActionButton>
            )}
            <button
              type="button"
              onClick={() => onFloat(request.id)}
              aria-label={
                isFloated
                  ? "Bring floating card to front"
                  : "Float this question and answer as a draggable card"
              }
              title={isFloated ? "Already floating. Bring to front" : "Float as a draggable card"}
              className={`ml-1 inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors hover:bg-elevated ${
                isFloated ? "text-accent" : "text-ink3 hover:text-ink"
              }`}
            >
              <FloatIcon />
              {isFloated ? "Floating" : "Float"}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
