"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { groupConversations, isVisibleInSidebar } from "../lib/chat";
import type { Conversation } from "../lib/types";
import {
  ArchiveIcon,
  CloseIcon,
  EditIcon,
  LogoMark,
  MoreIcon,
  PinIcon,
  SearchIcon,
  SettingsIcon,
  SidebarIcon,
  SpinnerIcon,
  SquarePenIcon,
  TrashIcon,
} from "./Icons";

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  streamingIds: string[];
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onToggleCollapse: () => void;
  onNewChat: () => void;
  onSearch: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onTogglePin: (id: string) => void;
  onArchive: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onOpenSettings: () => void;
}

interface MenuState {
  id: string;
  x: number;
  y: number;
}

const MENU_WIDTH = 208;
const MENU_HEIGHT = 176;

export default function Sidebar({
  conversations,
  activeConversationId,
  streamingIds,
  collapsed,
  mobileOpen,
  onCloseMobile,
  onToggleCollapse,
  onNewChat,
  onSearch,
  onSelect,
  onRename,
  onTogglePin,
  onArchive,
  onRequestDelete,
  onOpenSettings,
}: SidebarProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const renameDone = useRef(false);

  const groups = useMemo(
    () => groupConversations(conversations.filter(isVisibleInSidebar), Date.now()),
    [conversations]
  );

  const menuConversation = menu ? conversations.find((c) => c.id === menu.id) ?? null : null;

  useEffect(() => {
    if (!menu) return;
    const onDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      if (menuRef.current && menuRef.current.contains(event.target)) return;
      if (event.target.closest("[aria-haspopup='menu']")) return;
      setMenu(null);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    const close = () => setMenu(null);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [menu]);

  useEffect(() => {
    if (menu) menuRef.current?.querySelector<HTMLElement>("button")?.focus();
  }, [menu]);

  useEffect(() => {
    if (renamingId) {
      renameDone.current = false;
      renameRef.current?.focus();
      renameRef.current?.select();
    }
  }, [renamingId]);

  const openMenuAt = (id: string, x: number, y: number) => {
    const left = Math.min(Math.max(8, x), window.innerWidth - MENU_WIDTH - 8);
    const top = Math.min(Math.max(8, y), window.innerHeight - MENU_HEIGHT - 8);
    setMenu({ id, x: left, y: top });
  };

  const startRename = (conversation: Conversation) => {
    setMenu(null);
    setDraft(conversation.title);
    setRenamingId(conversation.id);
  };

  const finishRename = (save: boolean) => {
    if (renameDone.current) return;
    renameDone.current = true;
    if (save && renamingId) onRename(renamingId, draft);
    setRenamingId(null);
  };

  const onRenameKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finishRename(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      finishRename(false);
    }
  };

  const rowButton =
    "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink transition-colors hover:bg-elevated";

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={onCloseMobile} aria-hidden="true" />
      )}
      <aside
        aria-label="Sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r border-line bg-sidebar transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "md:hidden" : ""}`}
      >
        <div className="flex items-center justify-between px-3 pb-1 pt-3">
          <div className="flex items-center gap-2 px-1">
            <LogoMark size={26} />
            <span className="text-base font-semibold tracking-tight text-ink">Siena</span>
          </div>
          <div className="flex items-center">
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Close sidebar"
              title="Close sidebar"
              className="hidden rounded-lg p-2 text-ink2 transition-colors hover:bg-elevated hover:text-ink md:block"
            >
              <SidebarIcon size={18} />
            </button>
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close sidebar"
              className="rounded-lg p-2 text-ink2 transition-colors hover:bg-elevated hover:text-ink md:hidden"
            >
              <CloseIcon size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-0.5 px-2 pb-2 pt-1">
          <button type="button" onClick={onNewChat} className={rowButton}>
            <SquarePenIcon size={18} />
            New chat
          </button>
          <button type="button" onClick={onSearch} className={rowButton}>
            <SearchIcon size={18} />
            <span className="flex-1 text-left">Search chats</span>
          </button>
        </div>

        <nav aria-label="Chats" className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {groups.length === 0 ? (
            <div className="mx-2 mt-6 rounded-2xl border border-dashed border-line px-4 py-8 text-center">
              <p className="text-sm text-ink2">No chats yet</p>
              <p className="mt-1 text-xs text-ink3">Start a conversation and it will show up here.</p>
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.label} className="mt-3 first:mt-1" aria-label={group.label}>
                <h3 className="px-3 pb-1 text-xs font-medium text-ink3">{group.label}</h3>
                <ul>
                  {group.items.map((conversation) => {
                    const active = conversation.id === activeConversationId;
                    const busy = streamingIds.includes(conversation.id);
                    const renaming = renamingId === conversation.id;
                    const menuOpen = menu?.id === conversation.id;
                    return (
                      <li
                        key={conversation.id}
                        className="group relative"
                        onContextMenu={(event) => {
                          event.preventDefault();
                          openMenuAt(conversation.id, event.clientX, event.clientY);
                        }}
                      >
                        {renaming ? (
                          <input
                            ref={renameRef}
                            value={draft}
                            maxLength={100}
                            aria-label="Rename chat"
                            onChange={(event) => setDraft(event.target.value)}
                            onKeyDown={onRenameKey}
                            onBlur={() => finishRename(true)}
                            className="w-full rounded-xl border border-accent bg-canvas px-3 py-2 text-sm text-ink"
                          />
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => onSelect(conversation.id)}
                              aria-current={active ? "page" : undefined}
                              title={conversation.title}
                              className={`flex w-full items-center gap-2 rounded-xl py-2 pl-3 pr-9 text-left text-sm transition-colors ${
                                active ? "bg-elevated text-ink" : "text-ink hover:bg-elevated/70"
                              }`}
                            >
                              {conversation.pinned && <PinIcon size={13} className="text-ink3" />}
                              <span className="min-w-0 flex-1 truncate">{conversation.title}</span>
                              {busy && <SpinnerIcon size={14} className="text-ink3" />}
                            </button>
                            <button
                              type="button"
                              aria-label={`Options for ${conversation.title}`}
                              aria-haspopup="menu"
                              aria-expanded={menuOpen}
                              onClick={(event) => {
                                const rect = event.currentTarget.getBoundingClientRect();
                                if (menuOpen) setMenu(null);
                                else openMenuAt(conversation.id, rect.left, rect.bottom + 4);
                              }}
                              className={`absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink2 transition hover:bg-canvas hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100 ${
                                active || menuOpen ? "opacity-100" : "opacity-0"
                              }`}
                            >
                              <MoreIcon size={16} />
                            </button>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </nav>

        <div className="border-t border-line p-2">
          <button type="button" onClick={onOpenSettings} className={rowButton}>
            <SettingsIcon size={18} />
            Settings
          </button>
        </div>
      </aside>

      {menu && menuConversation && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Options for ${menuConversation.title}`}
          style={{ left: menu.x, top: menu.y, width: MENU_WIDTH }}
          className="pop-in fixed z-[900] rounded-2xl border border-line bg-surface p-1.5 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => startRename(menuConversation)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink transition-colors hover:bg-elevated"
          >
            <EditIcon size={16} />
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(null);
              onTogglePin(menuConversation.id);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink transition-colors hover:bg-elevated"
          >
            <PinIcon size={16} />
            {menuConversation.pinned ? "Unpin chat" : "Pin chat"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(null);
              onArchive(menuConversation.id);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink transition-colors hover:bg-elevated"
          >
            <ArchiveIcon size={16} />
            Archive
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(null);
              onRequestDelete(menuConversation.id);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-danger transition-colors hover:bg-danger/10"
          >
            <TrashIcon size={16} />
            Delete
          </button>
        </div>
      )}
    </>
  );
}
