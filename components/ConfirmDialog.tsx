"use client";

import { useRef } from "react";
import ModalShell from "./ModalShell";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <ModalShell
      onClose={onCancel}
      label={title}
      initialFocusRef={cancelRef}
      className="max-w-md rounded-3xl border border-line bg-surface p-6 shadow-2xl"
    >
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-2 break-words text-sm leading-relaxed text-ink2">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-elevated"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 ${
            danger ? "bg-danger text-white" : "bg-ink text-canvas"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}
