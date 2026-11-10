"use client";

import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { getAssistant, stripMarkdown } from "../lib/chat";
import type { ChatRequest, FloatingCard as FloatingCardData } from "../lib/types";
import type { Size } from "../lib/utils";
import FloatingCard from "./FloatingCard";

interface FloatingLayerProps {
  cards: FloatingCardData[];
  requests: ChatRequest[];
  containerRef: RefObject<HTMLDivElement>;
  onClose: (cardId: string) => void;
  onExpand: (requestId: string) => void;
  onBringToFront: (cardId: string) => void;
  onMove: (cardId: string, x: number, y: number) => void;
}

export default function FloatingLayer({
  cards,
  requests,
  containerRef,
  onClose,
  onExpand,
  onBringToFront,
  onMove,
}: FloatingLayerProps) {
  const [bounds, setBounds] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      setBounds((prev) =>
        prev.width === el.clientWidth && prev.height === el.clientHeight
          ? prev
          : { width: el.clientWidth, height: el.clientHeight }
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);

  if (cards.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {cards.map((card) => {
        const request = requests.find((r) => r.id === card.requestId);
        if (!request) return null;
        return (
          <FloatingCard
            key={card.id}
            card={card}
            answer={stripMarkdown(getAssistant(request).content)}
            bounds={bounds}
            onClose={onClose}
            onExpand={onExpand}
            onBringToFront={onBringToFront}
            onMove={onMove}
          />
        );
      })}
    </div>
  );
}
