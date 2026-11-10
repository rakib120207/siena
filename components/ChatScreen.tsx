"use client";

import { useRef } from "react";
import { getAssistant } from "../lib/chat";
import type { Conversation, Feedback, Settings } from "../lib/types";
import { makeCardTitle } from "../lib/utils";
import ChatInput from "./ChatInput";
import ExpandedCardModal from "./ExpandedCardModal";
import FloatingLayer from "./FloatingLayer";
import { DownloadIcon, GhostIcon, LogoMark, SidebarIcon, SquarePenIcon } from "./Icons";
import MessageList from "./MessageList";
import ModelPicker from "./ModelPicker";

interface ChatScreenProps {
  conversation: Conversation | null;
  isStreaming: boolean;
  input: string;
  setInput: (value: string) => void;
  focusToken: number;
  expandedRequestId: string | null;
  settings: Settings;
  sidebarHidden: boolean;
  onUpdateSettings: (patch: Partial<Settings>) => void;
  onSend: () => void;
  onStop: () => void;
  onRetry: (requestId: string) => void;
  onRegenerate: (requestId: string) => void;
  onContinue: (requestId: string) => void;
  onEdit: (requestId: string, text: string) => void;
  onSetResponse: (requestId: string, index: number) => void;
  onFeedback: (requestId: string, feedback: Feedback) => void;
  onFloat: (requestId: string) => void;
  onRemoveCard: (cardId: string) => void;
  onBringToFront: (cardId: string) => void;
  onMoveCard: (cardId: string, x: number, y: number) => void;
  onOpenExpanded: (requestId: string) => void;
  onCloseExpanded: () => void;
  onNewChat: (temporary: boolean) => void;
  onOpenMobileSidebar: () => void;
  onShowSidebar: () => void;
  onExport: () => void;
}

const iconButton =
  "rounded-xl p-2 text-ink2 transition-colors hover:bg-elevated hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";

export default function ChatScreen({
  conversation,
  isStreaming,
  input,
  setInput,
  focusToken,
  expandedRequestId,
  settings,
  sidebarHidden,
  onUpdateSettings,
  onSend,
  onStop,
  onRetry,
  onRegenerate,
  onContinue,
  onEdit,
  onSetResponse,
  onFeedback,
  onFloat,
  onRemoveCard,
  onBringToFront,
  onMoveCard,
  onOpenExpanded,
  onCloseExpanded,
  onNewChat,
  onOpenMobileSidebar,
  onShowSidebar,
  onExport,
}: ChatScreenProps) {
  const boundsRef = useRef<HTMLDivElement>(null);

  const requests = conversation?.requests ?? [];
  const cards = conversation?.floatingCards ?? [];
  const isEmpty = requests.length === 0;
  const isTemporary = Boolean(conversation?.temporary);

  const expandedRequest = expandedRequestId ? requests.find((r) => r.id === expandedRequestId) ?? null : null;
  const expandedCard = expandedRequest ? cards.find((c) => c.requestId === expandedRequest.id) ?? null : null;

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col bg-canvas">
      <header className="flex h-14 shrink-0 items-center gap-1 px-2 sm:px-3">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          aria-label="Open sidebar"
          className={`${iconButton} md:hidden`}
        >
          <SidebarIcon size={20} />
        </button>
        {sidebarHidden && (
          <>
            <button
              type="button"
              onClick={onShowSidebar}
              aria-label="Open sidebar"
              title="Open sidebar"
              className={`${iconButton} hidden md:block`}
            >
              <SidebarIcon size={20} />
            </button>
            <button
              type="button"
              onClick={() => onNewChat(false)}
              aria-label="New chat"
              title="New chat"
              className={`${iconButton} hidden md:block`}
            >
              <SquarePenIcon size={20} />
            </button>
          </>
        )}
        <ModelPicker settings={settings} disabled={false} onUpdate={onUpdateSettings} />
        <div className="min-w-0 flex-1" />
        {cards.length > 0 && (
          <span className="mr-1 hidden shrink-0 rounded-full border border-line px-2.5 py-0.5 text-xs text-ink3 sm:inline">
            {cards.length} floating
          </span>
        )}
        <button
          type="button"
          onClick={onExport}
          disabled={isEmpty}
          aria-label="Export this chat as Markdown"
          title="Export chat"
          className={iconButton}
        >
          <DownloadIcon size={20} />
        </button>
        <button
          type="button"
          onClick={() => onNewChat(!isTemporary)}
          aria-pressed={isTemporary}
          aria-label={isTemporary ? "Leave temporary chat" : "Start a temporary chat"}
          title={isTemporary ? "Leave temporary chat" : "Temporary chat"}
          className={`${iconButton} ${isTemporary ? "bg-elevated text-accent" : ""}`}
        >
          <GhostIcon size={20} />
        </button>
      </header>

      {isTemporary && (
        <p className="shrink-0 border-y border-line bg-elevated/50 px-4 py-1.5 text-center text-xs text-ink2">
          Temporary chat. It isn&apos;t saved and disappears when you leave.
        </p>
      )}

      {isEmpty ? <div className="min-h-0 flex-1" /> : (
        <div ref={boundsRef} className="relative min-h-0 flex-1">
          <MessageList
            key={conversation?.id}
            requests={requests}
            floatedRequestIds={cards.map((c) => c.requestId)}
            conversationBusy={isStreaming}
            onFloat={onFloat}
            onRetry={onRetry}
            onRegenerate={onRegenerate}
            onContinue={onContinue}
            onEdit={onEdit}
            onSetResponse={onSetResponse}
            onFeedback={onFeedback}
          />
          <FloatingLayer
            key={`layer-${conversation?.id}`}
            cards={cards}
            requests={requests}
            containerRef={boundsRef}
            onClose={onRemoveCard}
            onExpand={onOpenExpanded}
            onBringToFront={onBringToFront}
            onMove={onMoveCard}
          />
        </div>
      )}

      {isEmpty && (
        <div className="shrink-0 px-4 pb-6 text-center">
          <LogoMark size={44} className="mx-auto mb-4" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {isTemporary ? "Temporary chat" : "What can I help with?"}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink3">
            When an answer finishes, use Float to pin that question and answer as a draggable card.
          </p>
        </div>
      )}

      <ChatInput
        value={input}
        onChange={setInput}
        onSend={onSend}
        onStop={onStop}
        isStreaming={isStreaming}
        focusToken={focusToken}
        placeholder="Ask anything"
      />

      {isEmpty && <div className="min-h-0 flex-1" />}

      {expandedRequest && (
        <ExpandedCardModal
          title={expandedCard?.title ?? makeCardTitle(expandedRequest.userMessage.content)}
          question={expandedRequest.userMessage.content}
          answer={getAssistant(expandedRequest).content}
          onClose={onCloseExpanded}
          onUnfloat={expandedCard ? () => onRemoveCard(expandedCard.id) : null}
        />
      )}
    </main>
  );
}
