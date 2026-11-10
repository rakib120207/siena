"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { isVisibleInSidebar, searchConversations } from "../lib/chat";
import type { Conversation } from "../lib/types";
import { SearchIcon, SquarePenIcon } from "./Icons";
import ModalShell from "./ModalShell";

interface SearchModalProps {
  conversations: Conversation[];
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onClose: () => void;
}

interface Row {
  key: string;
  title: string;
  snippet: string | null;
  action: () => void;
  isNew: boolean;
}

export default function SearchModal({ conversations, onSelect, onNewChat, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (!query.trim()) {
      out.push({ key: "new", title: "New chat", snippet: null, action: onNewChat, isNew: true });
      conversations
        .filter(isVisibleInSidebar)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 25)
        .forEach((c) =>
          out.push({ key: c.id, title: c.title, snippet: null, action: () => onSelect(c.id), isNew: false })
        );
    } else {
      searchConversations(conversations, query)
        .slice(0, 50)
        .forEach((hit) =>
          out.push({
            key: hit.conversation.id,
            title: hit.conversation.title,
            snippet: hit.snippet,
            action: () => onSelect(hit.conversation.id),
            isNew: false,
          })
        );
    }
    return out;
  }, [conversations, query, onNewChat, onSelect]);

  const safeIndex = Math.min(index, Math.max(rows.length - 1, 0));

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-row="${safeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [safeIndex]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndex(rows.length === 0 ? 0 : (safeIndex + 1) % rows.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndex(rows.length === 0 ? 0 : (safeIndex - 1 + rows.length) % rows.length);
    } else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      rows[safeIndex]?.action();
    }
  };

  return (
    <ModalShell
      onClose={onClose}
      label="Search chats"
      placement="top"
      initialFocusRef={inputRef}
      className="max-w-xl overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl"
    >
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <SearchIcon size={18} className="text-ink3" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIndex(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search chats…"
          aria-label="Search chats"
          role="combobox"
          aria-expanded="true"
          aria-controls="search-results"
          aria-activedescendant={rows[safeIndex] ? `search-row-${safeIndex}` : undefined}
          className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink3 focus-visible:outline-none sm:text-sm"
        />
      </div>
      <ul id="search-results" ref={listRef} role="listbox" className="scroll-thin max-h-[50vh] overflow-y-auto p-2">
        {rows.length === 0 ? (
          <li className="px-3 py-8 text-center text-sm text-ink3">No chats found</li>
        ) : (
          rows.map((row, i) => (
            <li
              key={row.key}
              id={`search-row-${i}`}
              data-row={i}
              role="option"
              aria-selected={i === safeIndex}
              onMouseMove={() => setIndex(i)}
              onClick={row.action}
              className={`flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 ${
                i === safeIndex ? "bg-elevated" : ""
              }`}
            >
              {row.isNew && <SquarePenIcon size={16} className="mt-0.5 text-ink2" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{row.title}</p>
                {row.snippet && <p className="mt-0.5 line-clamp-2 break-words text-xs text-ink3">{row.snippet}</p>}
              </div>
            </li>
          ))
        )}
      </ul>
    </ModalShell>
  );
}
