"use client";

import { useId, useMemo } from "react";
import type { ReactNode } from "react";
import { MAX_INSTRUCTION_LENGTH } from "../lib/chat";
import { getShortcuts } from "../lib/shortcuts";
import type { Conversation, Settings, ThemeMode } from "../lib/types";
import { isMacPlatform } from "../lib/utils";
import { CloseIcon } from "./Icons";
import ModalShell from "./ModalShell";

export type SettingsTab = "general" | "personalization" | "data" | "shortcuts";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "personalization", label: "Personalization" },
  { id: "data", label: "Data controls" },
  { id: "shortcuts", label: "Shortcuts" },
];

const THEMES: { id: ThemeMode; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

interface SettingsModalProps {
  tab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  onClose: () => void;
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
  conversations: Conversation[];
  activeConversation: Conversation | null;
  onExportAll: () => void;
  onExportCurrent: () => void;
  onOpenChat: (id: string) => void;
  onUnarchive: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onRequestArchiveAll: () => void;
  onRequestDeleteAll: () => void;
}

function Row({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        {description && <p className="mt-0.5 text-xs text-ink3">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const outlineButton =
  "rounded-full border border-line px-3.5 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

export default function SettingsModal({
  tab,
  onTabChange,
  onClose,
  settings,
  onUpdate,
  conversations,
  activeConversation,
  onExportAll,
  onExportCurrent,
  onOpenChat,
  onUnarchive,
  onRequestDelete,
  onRequestArchiveAll,
  onRequestDeleteAll,
}: SettingsModalProps) {
  const titleId = useId();
  const aboutId = useId();
  const styleId = useId();
  const shortcuts = useMemo(() => getShortcuts(isMacPlatform()), []);

  const saved = conversations.filter((c) => !c.temporary && c.requests.length > 0);
  const archived = saved.filter((c) => c.archived).sort((a, b) => b.updatedAt - a.updatedAt);
  const hasChats = saved.length > 0;
  const canArchiveAll = saved.some((c) => !c.archived);

  return (
    <ModalShell
      onClose={onClose}
      labelledBy={titleId}
      className="flex h-[min(640px,88vh)] max-w-3xl flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl md:flex-row"
    >
      <div className="flex shrink-0 flex-col border-b border-line md:w-52 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-4 py-3 md:py-4">
          <h2 id={titleId} className="text-base font-semibold text-ink">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-full p-1.5 text-ink2 transition-colors hover:bg-elevated hover:text-ink md:hidden"
          >
            <CloseIcon />
          </button>
        </div>
        <div role="tablist" aria-label="Settings sections" className="scroll-thin flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`settings-tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls={`settings-panel-${item.id}`}
              onClick={() => onTabChange(item.id)}
              className={`whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                tab === item.id ? "bg-elevated font-medium text-ink" : "text-ink2 hover:bg-elevated/60 hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="absolute right-3 top-3 hidden rounded-full p-1.5 text-ink2 transition-colors hover:bg-elevated hover:text-ink md:block"
        >
          <CloseIcon />
        </button>
        <div
          role="tabpanel"
          id={`settings-panel-${tab}`}
          aria-labelledby={`settings-tab-${tab}`}
          className="scroll-thin h-full overflow-y-auto px-5 py-4 md:px-6 md:pt-5"
        >
          {tab === "general" && (
            <div>
              <h3 className="mb-1 text-lg font-semibold text-ink">General</h3>
              <Row title="Theme" description="Choose how Siena looks on this device.">
                <div role="radiogroup" aria-label="Theme" className="flex rounded-full border border-line p-0.5">
                  {THEMES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={settings.theme === item.id}
                      onClick={() => onUpdate({ theme: item.id })}
                      className={`rounded-full px-3 py-1 text-sm transition-colors ${
                        settings.theme === item.id ? "bg-ink text-canvas" : "text-ink2 hover:text-ink"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </Row>
              <Row title="Storage" description="Chats and settings are saved only in this browser. Nothing is stored on a server.">
                <span className="text-xs text-ink3">{saved.length} saved chat{saved.length === 1 ? "" : "s"}</span>
              </Row>
            </div>
          )}

          {tab === "personalization" && (
            <div>
              <h3 className="mb-1 text-lg font-semibold text-ink">Custom instructions</h3>
              <p className="mb-4 text-sm text-ink3">Siena considers these in every new response. They are sent along with your messages.</p>
              <label htmlFor={aboutId} className="mb-1.5 block text-sm font-medium text-ink">
                What should Siena know about you?
              </label>
              <textarea
                id={aboutId}
                value={settings.customAbout}
                maxLength={MAX_INSTRUCTION_LENGTH}
                rows={4}
                onChange={(event) => onUpdate({ customAbout: event.target.value })}
                placeholder="Your role, interests, what you are working on…"
                className="scroll-thin w-full resize-y rounded-2xl border border-line bg-canvas px-4 py-3 text-sm text-ink placeholder:text-ink3 focus-visible:border-ink3"
              />
              <p className="mb-5 mt-1 text-right text-xs text-ink3">
                {settings.customAbout.length}/{MAX_INSTRUCTION_LENGTH}
              </p>
              <label htmlFor={styleId} className="mb-1.5 block text-sm font-medium text-ink">
                How should Siena respond?
              </label>
              <textarea
                id={styleId}
                value={settings.customStyle}
                maxLength={MAX_INSTRUCTION_LENGTH}
                rows={4}
                onChange={(event) => onUpdate({ customStyle: event.target.value })}
                placeholder="Tone, length, format, things to avoid…"
                className="scroll-thin w-full resize-y rounded-2xl border border-line bg-canvas px-4 py-3 text-sm text-ink placeholder:text-ink3 focus-visible:border-ink3"
              />
              <p className="mt-1 text-right text-xs text-ink3">
                {settings.customStyle.length}/{MAX_INSTRUCTION_LENGTH}
              </p>
            </div>
          )}

          {tab === "data" && (
            <div>
              <h3 className="mb-1 text-lg font-semibold text-ink">Data controls</h3>
              <Row title="Export all chats" description="Download every saved chat as a JSON file.">
                <button type="button" onClick={onExportAll} disabled={!hasChats} className={outlineButton}>
                  Export
                </button>
              </Row>
              <Row title="Export current chat" description="Download the open chat as Markdown.">
                <button
                  type="button"
                  onClick={onExportCurrent}
                  disabled={!activeConversation || activeConversation.requests.length === 0}
                  className={outlineButton}
                >
                  Export
                </button>
              </Row>
              <Row title="Archive all chats" description="Hide every chat from the sidebar without deleting it.">
                <button type="button" onClick={onRequestArchiveAll} disabled={!canArchiveAll} className={outlineButton}>
                  Archive all
                </button>
              </Row>
              <Row title="Delete all chats" description="Permanently remove every chat and floating card from this browser.">
                <button
                  type="button"
                  onClick={onRequestDeleteAll}
                  disabled={!hasChats}
                  className="rounded-full bg-danger px-3.5 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Delete all
                </button>
              </Row>

              <h4 className="mb-2 mt-6 text-sm font-medium text-ink">Archived chats</h4>
              {archived.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-ink3">
                  No archived chats
                </p>
              ) : (
                <ul className="divide-y divide-line rounded-2xl border border-line">
                  {archived.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => onOpenChat(c.id)}
                        className="min-w-0 flex-1 truncate text-left text-sm text-ink hover:underline"
                        title={`Open ${c.title}`}
                      >
                        {c.title}
                      </button>
                      <button type="button" onClick={() => onUnarchive(c.id)} className={outlineButton}>
                        Unarchive
                      </button>
                      <button
                        type="button"
                        onClick={() => onRequestDelete(c.id)}
                        aria-label={`Delete ${c.title}`}
                        className="rounded-full border border-danger/50 px-3.5 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "shortcuts" && (
            <div>
              <h3 className="mb-3 text-lg font-semibold text-ink">Keyboard shortcuts</h3>
              <ul>
                {shortcuts.map((item) => (
                  <li key={item.label} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
                    <span className="text-sm text-ink">{item.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {item.keys.map((key, i) => (
                        <kbd
                          key={`${key}-${i}`}
                          className="min-w-[1.6rem] rounded-md border border-line bg-elevated px-1.5 py-0.5 text-center font-sans text-xs text-ink2"
                        >
                          {key}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
