"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UIEvent } from "react";
import type { ChatRequest, Feedback } from "../lib/types";
import { ArrowDownIcon } from "./Icons";
import RequestItem from "./RequestItem";

interface MessageListProps {
  requests: ChatRequest[];
  floatedRequestIds: string[];
  conversationBusy: boolean;
  onFloat: (requestId: string) => void;
  onRetry: (requestId: string) => void;
  onRegenerate: (requestId: string) => void;
  onContinue: (requestId: string) => void;
  onEdit: (requestId: string, text: string) => void;
  onSetResponse: (requestId: string, index: number) => void;
  onFeedback: (requestId: string, feedback: Feedback) => void;
}

const NEAR_BOTTOM_PX = 80;

export default function MessageList({
  requests,
  floatedRequestIds,
  conversationBusy,
  onFloat,
  onRetry,
  onRegenerate,
  onContinue,
  onEdit,
  onSetResponse,
  onFeedback,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    stickRef.current = true;
    scrollToBottom(false);
  }, [requests.length, scrollToBottom]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (stickRef.current) scrollToBottom(false);
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [scrollToBottom]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    stickRef.current = nearBottom;
    setShowJump((prev) => (prev === !nearBottom ? prev : !nearBottom));
  };

  return (
    <div className="relative h-full">
      <div ref={scrollRef} onScroll={handleScroll} className="scroll-thin h-full overflow-y-auto">
        <div ref={contentRef} className="mx-auto w-full max-w-3xl space-y-10 px-4 py-6">
          {requests.map((request, index) => (
            <RequestItem
              key={request.id}
              request={request}
              isLast={index === requests.length - 1}
              laterCount={requests.length - index - 1}
              isFloated={floatedRequestIds.includes(request.id)}
              conversationBusy={conversationBusy}
              onFloat={onFloat}
              onRetry={onRetry}
              onRegenerate={onRegenerate}
              onContinue={onContinue}
              onEdit={onEdit}
              onSetResponse={onSetResponse}
              onFeedback={onFeedback}
            />
          ))}
        </div>
      </div>
      {showJump && (
        <button
          type="button"
          onClick={() => {
            stickRef.current = true;
            scrollToBottom(true);
          }}
          aria-label="Scroll to bottom"
          className="absolute bottom-3 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-md transition-colors hover:bg-elevated"
        >
          <ArrowDownIcon />
        </button>
      )}
    </div>
  );
}
