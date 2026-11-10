"use client";

import { useEffect, useRef, useState } from "react";
import { MODEL_OPTIONS, modelLabel } from "../lib/models";
import type { ReasoningEffort, Settings } from "../lib/types";
import { CheckIcon, ChevronDownIcon } from "./Icons";

interface ModelPickerProps {
  settings: Settings;
  disabled: boolean;
  onUpdate: (patch: Partial<Settings>) => void;
}

const EFFORTS: { id: ReasoningEffort; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

export default function ModelPicker({ settings, disabled, onUpdate }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Model: ${modelLabel(settings.model)}`}
        className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-base font-semibold text-ink transition-colors hover:bg-elevated"
      >
        Siena
        <span className="hidden text-sm font-normal text-ink3 sm:inline">{modelLabel(settings.model)}</span>
        <ChevronDownIcon size={14} className="text-ink3" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Choose model"
          className="pop-in absolute left-0 top-full z-50 mt-1 w-72 rounded-2xl border border-line bg-surface p-1.5 shadow-xl"
        >
          <p className="px-3 pb-1 pt-1.5 text-xs font-medium text-ink3">Model</p>
          {MODEL_OPTIONS.map((option) => {
            const selected = settings.model === option.id;
            return (
              <button
                key={option.id ?? "default"}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => {
                  onUpdate({ model: option.id });
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-ink">{option.label}</span>
                  <span className="block text-xs text-ink3">{option.description}</span>
                </span>
                {selected && <CheckIcon size={16} className="text-ink" />}
              </button>
            );
          })}
          <div className="mt-1 border-t border-line px-3 pb-2 pt-2.5">
            <p className="mb-1.5 text-xs font-medium text-ink3">Thinking effort</p>
            <div role="radiogroup" aria-label="Thinking effort" className="flex rounded-full border border-line p-0.5">
              {EFFORTS.map((effort) => (
                <button
                  key={effort.id}
                  type="button"
                  role="radio"
                  aria-checked={settings.reasoningEffort === effort.id}
                  onClick={() => onUpdate({ reasoningEffort: effort.id })}
                  className={`flex-1 rounded-full px-2 py-1 text-xs transition-colors ${
                    settings.reasoningEffort === effort.id ? "bg-ink text-canvas" : "text-ink2 hover:text-ink"
                  }`}
                >
                  {effort.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-ink3">Higher effort is slower but better at hard problems. Applies to GPT-OSS models.</p>
          </div>
        </div>
      )}
    </div>
  );
}
