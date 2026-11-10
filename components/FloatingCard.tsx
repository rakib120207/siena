"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { FloatingCard as FloatingCardData } from "../lib/types";
import { clampPosition } from "../lib/utils";
import type { Size } from "../lib/utils";
import { CloseIcon, ExpandIcon } from "./Icons";

const FALLBACK_SIZE: Size = { width: 256, height: 96 };
const DRAG_THRESHOLD = 4;

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  x: number;
  y: number;
}

interface FloatingCardProps {
  card: FloatingCardData;
  answer: string;
  bounds: Size;
  onClose: (cardId: string) => void;
  onExpand: (requestId: string) => void;
  onBringToFront: (cardId: string) => void;
  onMove: (cardId: string, x: number, y: number) => void;
}

export default function FloatingCard({
  card,
  answer,
  bounds,
  onClose,
  onExpand,
  onBringToFront,
  onMove,
}: FloatingCardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const rafRef = useRef<number | null>(null);
  const movedRef = useRef(false);
  const [size, setSize] = useState<Size | null>(null);
  const [livePos, setLivePos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      setSize((prev) =>
        prev && prev.width === el.offsetWidth && prev.height === el.offsetHeight
          ? prev
          : { width: el.offsetWidth, height: el.offsetHeight }
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const effectiveSize = size ?? FALLBACK_SIZE;
  const resolved =
    bounds.width > 0 ? clampPosition(card.x, card.y, bounds, effectiveSize) : { x: card.x, y: card.y };
  const pos = livePos ?? resolved;
  const isDragging = livePos !== null;

  useEffect(() => {
    if (!size || bounds.width === 0 || dragRef.current) return;
    const next = clampPosition(card.x, card.y, bounds, size);
    if (next.x !== card.x || next.y !== card.y) onMove(card.id, next.x, next.y);
  }, [bounds, size, card.id, card.x, card.y, onMove]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    movedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pos.x,
      originY: pos.y,
      x: pos.x,
      y: pos.y,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!movedRef.current && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
    movedRef.current = true;

    const next = clampPosition(drag.originX + dx, drag.originY + dy, bounds, effectiveSize);
    drag.x = next.x;
    drag.y = next.y;

    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const current = dragRef.current;
        if (current) setLivePos({ x: current.x, y: current.y });
      });
    }
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // capture already released
    }
    if (movedRef.current) onMove(card.id, drag.x, drag.y);
    setLivePos(null);
  };

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={`Floating card: ${card.title}`}
      onPointerDown={() => onBringToFront(card.id)}
      style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`, zIndex: card.z }}
      className={`pointer-events-auto absolute left-0 top-0 w-64 max-w-[calc(100%-8px)] overflow-hidden rounded-2xl border bg-surface will-change-transform ${
        isDragging
          ? "select-none border-accent shadow-2xl shadow-black/40"
          : "border-line shadow-lg shadow-black/20"
      }`}
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={(event) => {
          if ((event.target as HTMLElement).closest("button")) return;
          onExpand(card.requestId);
        }}
        className={`flex touch-none select-none items-center gap-1 border-b border-line bg-elevated py-1.5 pl-3 pr-1.5 ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <span aria-hidden="true" className="text-ink3">
          ⠿
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink" title={card.title}>
          {card.title}
        </span>
        <button
          type="button"
          onClick={() => onExpand(card.requestId)}
          aria-label={`Expand floating card: ${card.title}`}
          title="Expand"
          className="rounded-md p-1 text-ink3 transition-colors hover:bg-canvas hover:text-ink"
        >
          <ExpandIcon size={14} />
        </button>
        <button
          type="button"
          onClick={() => onClose(card.id)}
          aria-label={`Close floating card: ${card.title}`}
          title="Remove card (the chat message stays)"
          className="rounded-md p-1 text-ink3 transition-colors hover:bg-canvas hover:text-danger"
        >
          <CloseIcon size={14} />
        </button>
      </div>
      <button
        type="button"
        onClick={() => onExpand(card.requestId)}
        aria-label="Open full question and answer"
        className="block w-full px-3 py-2 text-left text-xs leading-relaxed text-ink2 transition-colors hover:bg-elevated/60"
      >
        <span className="line-clamp-2 break-words">{answer.trim() || "No answer text."}</span>
      </button>
    </div>
  );
}
