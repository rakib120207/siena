"use client";

import { useEffect, useRef } from "react";
import { ArrowUpIcon, StopIcon } from "./Icons";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  focusToken: number;
  placeholder: string;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  focusToken,
  placeholder,
}: ChatInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0 && !isStreaming;

  useEffect(() => {
    const finePointer =
      typeof window.matchMedia === "function" && window.matchMedia("(pointer: fine)").matches;
    if (focusToken === 0 && !finePointer) return;
    ref.current?.focus();
  }, [focusToken]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  return (
    <div className="shrink-0 px-4 pb-3 pt-2">
      <form
        className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-[1.75rem] border border-line bg-elevated/60 py-2 pl-5 pr-2 shadow-sm transition-colors focus-within:border-ink3"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSend) onSend();
        }}
      >
        <textarea
          ref={ref}
          value={value}
          rows={1}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (canSend) onSend();
            }
          }}
          placeholder={placeholder}
          aria-label="Message Siena"
          className="scroll-thin max-h-[220px] min-h-[36px] flex-1 resize-none bg-transparent py-2 text-base leading-6 text-ink placeholder:text-ink3 sm:text-[0.9375rem]"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            title="Stop generating"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-canvas transition-opacity hover:opacity-80"
          >
            <StopIcon size={14} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send message"
            title="Send message"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accentink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-elevated disabled:text-ink3 disabled:opacity-100"
          >
            <ArrowUpIcon size={18} />
          </button>
        )}
      </form>
      <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-ink3">
        Siena can make mistakes. Check important information.
      </p>
    </div>
  );
}
