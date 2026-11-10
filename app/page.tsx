"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ChatScreen from "../components/ChatScreen";
import ConfirmDialog from "../components/ConfirmDialog";
import SearchModal from "../components/SearchModal";
import SettingsModal from "../components/SettingsModal";
import type { SettingsTab } from "../components/SettingsModal";
import Sidebar from "../components/Sidebar";
import Toast from "../components/Toast";
import { useChat } from "../hooks/useChat";
import { getAssistant, lastCodeBlock } from "../lib/chat";
import { conversationToMarkdown } from "../lib/storage";
import type { Conversation } from "../lib/types";
import { copyText, downloadText } from "../lib/utils";

type ConfirmState =
  | { kind: "delete"; id: string; title: string }
  | { kind: "delete-all" }
  | { kind: "archive-all" }
  | null;

function safeFileName(title: string): string {
  const cleaned = title.replace(/[^\w\- ]+/g, "").trim().slice(0, 50);
  return cleaned || "chat";
}

export default function Page() {
  const chat = useChat();
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [warningDismissed, setWarningDismissed] = useState(false);

  const dismissToast = useCallback(() => setToast(null), []);

  const {
    activeConversation,
    conversations,
    settings,
    createConversation,
    selectConversation,
    deleteConversation,
    updateSettings,
    requestFocus,
    expandedRequestId,
  } = chat;

  const title = activeConversation && activeConversation.requests.length > 0 ? activeConversation.title : null;
  useEffect(() => {
    document.title = title ? `${title} · Siena` : "Siena";
  }, [title]);

  const exportConversation = useCallback((conversation: Conversation | null) => {
    if (!conversation || conversation.requests.length === 0) return;
    downloadText(
      `${safeFileName(conversation.title)}.md`,
      conversationToMarkdown(conversation),
      "text/markdown;charset=utf-8"
    );
  }, []);

  const exportAll = useCallback(() => {
    const saved = conversations.filter((c) => !c.temporary && c.requests.length > 0);
    if (saved.length === 0) return;
    downloadText(
      "siena-chats.json",
      JSON.stringify({ app: "siena", exportedAt: new Date().toISOString(), conversations: saved }, null, 2),
      "application/json"
    );
  }, [conversations]);

  const toggleSidebar = useCallback(() => {
    const desktop = typeof window.matchMedia === "function" && window.matchMedia("(min-width: 768px)").matches;
    if (desktop) updateSettings({ sidebarCollapsed: !settings.sidebarCollapsed });
    else setMobileSidebar((open) => !open);
  }, [settings.sidebarCollapsed, updateSettings]);

  const newChat = useCallback(
    (temporary: boolean) => {
      createConversation(temporary);
      setMobileSidebar(false);
    },
    [createConversation]
  );

  const modalOpen = searchOpen || settingsTab !== null || confirm !== null || expandedRequestId !== null;

  const live = useRef({
    modalOpen,
    searchOpen,
    conversation: activeConversation,
    newChat,
    toggleSidebar,
    requestFocus,
  });
  live.current = { modalOpen, searchOpen, conversation: activeConversation, newChat, toggleSidebar, requestFocus };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const state = live.current;
      const mod = event.ctrlKey || event.metaKey;

      if (event.shiftKey && !mod && event.key === "Escape") {
        if (state.modalOpen) return;
        event.preventDefault();
        state.requestFocus();
        return;
      }
      if (!mod || event.altKey) return;

      if (!event.shiftKey && event.code === "KeyK") {
        event.preventDefault();
        if (state.searchOpen) setSearchOpen(false);
        else if (!state.modalOpen) setSearchOpen(true);
        return;
      }
      if (state.modalOpen) return;

      if (!event.shiftKey && (event.key === "/" || event.code === "Slash")) {
        event.preventDefault();
        setSettingsTab("shortcuts");
        return;
      }
      if (!event.shiftKey) return;

      const conversation = state.conversation;
      switch (event.code) {
        case "KeyO":
          event.preventDefault();
          state.newChat(false);
          break;
        case "KeyS":
          event.preventDefault();
          state.toggleSidebar();
          break;
        case "KeyI":
          event.preventDefault();
          setSettingsTab("personalization");
          break;
        case "KeyC": {
          const selection = window.getSelection()?.toString() ?? "";
          if (selection) return;
          const last = conversation?.requests[conversation.requests.length - 1];
          const text = last ? getAssistant(last).content : "";
          event.preventDefault();
          if (!text) {
            setToast("Nothing to copy yet");
            break;
          }
          void copyText(text).then((ok) => setToast(ok ? "Copied last response" : "Copy failed"));
          break;
        }
        case "Semicolon": {
          event.preventDefault();
          let code: string | null = null;
          const list = conversation?.requests ?? [];
          for (let i = list.length - 1; i >= 0 && code === null; i -= 1) {
            code = lastCodeBlock(getAssistant(list[i]).content);
          }
          if (code === null) {
            setToast("No code block to copy");
            break;
          }
          void copyText(code).then((ok) => setToast(ok ? "Copied last code block" : "Copy failed"));
          break;
        }
        case "Backspace":
        case "Delete":
          if (conversation && conversation.requests.length > 0) {
            event.preventDefault();
            setConfirm({ kind: "delete", id: conversation.id, title: conversation.title });
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!chat.mounted) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-canvas text-sm text-ink3">
        Loading…
      </div>
    );
  }

  const confirmTitle =
    confirm?.kind === "delete"
      ? "Delete chat?"
      : confirm?.kind === "delete-all"
        ? "Delete all chats?"
        : "Archive all chats?";
  const confirmMessage =
    confirm?.kind === "delete"
      ? `This will delete “${confirm.title}” and its floating cards. This can’t be undone.`
      : confirm?.kind === "delete-all"
        ? "This permanently removes every chat and floating card stored in this browser."
        : "Every chat will be hidden from the sidebar. You can restore them from Settings › Data controls.";

  const runConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === "delete") deleteConversation(confirm.id);
    else if (confirm.kind === "delete-all") chat.deleteAllConversations();
    else chat.archiveAllConversations();
    setConfirm(null);
  };

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-canvas">
      {chat.storageWarning && !warningDismissed && (
        <div
          role="alert"
          className="flex shrink-0 items-center justify-between gap-3 bg-danger/15 px-4 py-2 text-sm text-danger"
        >
          <span>Browser storage is full or blocked, so recent changes may not be saved. Export or delete old chats to free space.</span>
          <button
            type="button"
            onClick={() => setWarningDismissed(true)}
            className="shrink-0 rounded-full border border-danger/40 px-3 py-0.5 text-xs font-medium hover:bg-danger/10"
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <Sidebar
          conversations={conversations}
          activeConversationId={chat.activeConversationId}
          streamingIds={chat.streamingIds}
          collapsed={settings.sidebarCollapsed}
          mobileOpen={mobileSidebar}
          onCloseMobile={() => setMobileSidebar(false)}
          onToggleCollapse={() => updateSettings({ sidebarCollapsed: true })}
          onNewChat={() => newChat(false)}
          onSearch={() => {
            setMobileSidebar(false);
            setSearchOpen(true);
          }}
          onSelect={(id) => {
            selectConversation(id);
            setMobileSidebar(false);
          }}
          onRename={chat.renameConversation}
          onTogglePin={chat.togglePin}
          onArchive={(id) => chat.setArchived(id, true)}
          onRequestDelete={(id) => {
            const target = conversations.find((c) => c.id === id);
            if (target) setConfirm({ kind: "delete", id, title: target.title });
          }}
          onOpenSettings={() => {
            setMobileSidebar(false);
            setSettingsTab("general");
          }}
        />
        <ChatScreen
          conversation={activeConversation}
          isStreaming={chat.isStreaming}
          input={chat.input}
          setInput={chat.setInput}
          focusToken={chat.focusToken}
          expandedRequestId={chat.expandedRequestId}
          settings={settings}
          sidebarHidden={settings.sidebarCollapsed}
          onUpdateSettings={updateSettings}
          onSend={chat.sendMessage}
          onStop={chat.stopStreaming}
          onRetry={chat.retryRequest}
          onRegenerate={chat.regenerate}
          onContinue={chat.continueGenerating}
          onEdit={chat.editMessage}
          onSetResponse={chat.setResponseIndex}
          onFeedback={chat.setFeedback}
          onFloat={chat.floatRequest}
          onRemoveCard={chat.removeFloatingCard}
          onBringToFront={chat.bringCardToFront}
          onMoveCard={chat.updateCardPosition}
          onOpenExpanded={chat.openExpandedCard}
          onCloseExpanded={chat.closeExpandedCard}
          onNewChat={newChat}
          onOpenMobileSidebar={() => setMobileSidebar(true)}
          onShowSidebar={() => updateSettings({ sidebarCollapsed: false })}
          onExport={() => exportConversation(activeConversation)}
        />
      </div>

      {searchOpen && (
        <SearchModal
          conversations={conversations}
          onClose={() => setSearchOpen(false)}
          onNewChat={() => {
            setSearchOpen(false);
            newChat(false);
          }}
          onSelect={(id) => {
            setSearchOpen(false);
            selectConversation(id);
          }}
        />
      )}

      {settingsTab !== null && (
        <SettingsModal
          tab={settingsTab}
          onTabChange={setSettingsTab}
          onClose={() => setSettingsTab(null)}
          settings={settings}
          onUpdate={updateSettings}
          conversations={conversations}
          activeConversation={activeConversation}
          onExportAll={exportAll}
          onExportCurrent={() => exportConversation(activeConversation)}
          onOpenChat={(id) => {
            setSettingsTab(null);
            chat.setArchived(id, false);
            selectConversation(id);
          }}
          onUnarchive={(id) => chat.setArchived(id, false)}
          onRequestDelete={(id) => {
            const target = conversations.find((c) => c.id === id);
            if (target) setConfirm({ kind: "delete", id, title: target.title });
          }}
          onRequestArchiveAll={() => setConfirm({ kind: "archive-all" })}
          onRequestDeleteAll={() => setConfirm({ kind: "delete-all" })}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirmTitle}
          message={confirmMessage}
          confirmLabel={confirm.kind === "archive-all" ? "Archive all" : "Delete"}
          danger={confirm.kind !== "archive-all"}
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      <Toast message={toast} onDismiss={dismissToast} />
    </div>
  );
}
