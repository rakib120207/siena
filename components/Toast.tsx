"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string | null;
  onDismiss: () => void;
}

export default function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDismiss, 2600);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[1100] flex justify-center px-4">
      <div
        role="status"
        className="pop-in rounded-full bg-ink px-4 py-2 text-sm font-medium text-canvas shadow-lg"
      >
        {message}
      </div>
    </div>
  );
}
