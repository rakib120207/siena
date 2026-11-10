"use client";

import { useEffect, useId, useRef, useState } from "react";
import { copyText } from "../lib/utils";
import { CheckIcon, CloseIcon, CopyIcon, FloatIcon } from "./Icons";
import Markdown from "./Markdown";
import ModalShell from "./ModalShell";

interface ExpandedCardModalProps {
  title: string;
  question: string;
  answer: string;
  onClose: () => void;
  onUnfloat: (() => void) | null;
}

type CopyTarget = "question" | "answer";

export default function ExpandedCardModal({
  title,
  question,
  answer,
  onClose,
  onUnfloat,
}: ExpandedCardModalProps) {
  const titleId = useId();
  const timerRef = useRef<number | null>(null);
  const [feedback, setFeedback] = useState<{ target: CopyTarget; ok: boolean } | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    []
  );

  const handleCopy = async (target: CopyTarget) => {
    const ok = await copyText(target === "question" ? question : answer);
    setFeedback({ target, ok });
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setFeedback(null), 2000);
  };

  const status = (target: CopyTarget): string | null => {
    if (!feedback || feedback.target !== target) return null;
    return feedback.ok ? "Copied" : "Copy failed. Select the text and copy it manually.";
  };

  const copyButton =
    "inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs font-medium text-ink transition-colors hover:bg-elevated";

  return (
    <ModalShell
      onClose={onClose}
      labelledBy={titleId}
      className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <h2 id={titleId} className="min-w-0 truncate text-sm font-semibold text-ink">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-1.5 text-ink2 transition-colors hover:bg-elevated hover:text-ink"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="scroll-thin min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <section aria-label="Question">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink3">Question</h3>
            <div className="flex items-center gap-2">
              {status("question") && (
                <span role="status" className="text-xs text-ink2">
                  {status("question")}
                </span>
              )}
              <button type="button" onClick={() => void handleCopy("question")} className={copyButton}>
                {feedback?.target === "question" && feedback.ok ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                Copy question
              </button>
            </div>
          </div>
          <p className="whitespace-pre-wrap break-words rounded-2xl bg-elevated px-4 py-3 text-[0.9375rem] leading-7 text-ink">
            {question}
          </p>
        </section>

        <section aria-label="Answer">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink3">Answer</h3>
            <div className="flex items-center gap-2">
              {status("answer") && (
                <span role="status" className="text-xs text-ink2">
                  {status("answer")}
                </span>
              )}
              <button type="button" onClick={() => void handleCopy("answer")} className={copyButton}>
                {feedback?.target === "answer" && feedback.ok ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                Copy answer
              </button>
            </div>
          </div>
          {answer.trim() ? <Markdown text={answer} /> : <p className="text-sm text-ink3">No answer text.</p>}
        </section>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
        {onUnfloat && (
          <button
            type="button"
            onClick={onUnfloat}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-elevated"
          >
            <FloatIcon size={15} />
            Unfloat
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-canvas transition-opacity hover:opacity-90"
        >
          Close
        </button>
      </div>
    </ModalShell>
  );
}
