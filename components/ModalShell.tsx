"use client";

import { useEffect, useRef } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode, RefObject } from "react";

const modalStack: number[] = [];
let modalCounter = 0;
let savedOverflow = "";

interface ModalShellProps {
  children: ReactNode;
  onClose: () => void;
  label?: string;
  labelledBy?: string;
  className?: string;
  placement?: "center" | "top";
  initialFocusRef?: RefObject<HTMLElement>;
}

const FOCUSABLE =
  "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export default function ModalShell({
  children,
  onClose,
  label,
  labelledBy,
  className,
  placement = "center",
  initialFocusRef,
}: ModalShellProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const pressedBackdrop = useRef(false);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const id = ++modalCounter;
    const previous = document.activeElement as HTMLElement | null;
    if (modalStack.length === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    modalStack.push(id);

    const target = initialFocusRef?.current ?? dialogRef.current;
    target?.focus();

    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || modalStack[modalStack.length - 1] !== id) return;
      event.preventDefault();
      event.stopPropagation();
      closeRef.current();
    };
    window.addEventListener("keydown", onKey, true);

    return () => {
      window.removeEventListener("keydown", onKey, true);
      const index = modalStack.indexOf(id);
      if (index >= 0) modalStack.splice(index, 1);
      if (modalStack.length === 0) document.body.style.overflow = savedOverflow;
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [initialFocusRef]);

  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const root = dialogRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null
    );
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === root)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[1000] flex justify-center bg-black/50 p-4 backdrop-blur-[2px] ${
        placement === "top" ? "items-start pt-[12vh]" : "items-center"
      }`}
      onMouseDown={(event: MouseEvent<HTMLDivElement>) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event: MouseEvent<HTMLDivElement>) => {
        if (pressedBackdrop.current && event.target === event.currentTarget) closeRef.current();
        pressedBackdrop.current = false;
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onKeyDown={trapFocus}
        className={`pop-in w-full outline-none ${className ?? ""}`}
      >
        {children}
      </div>
    </div>
  );
}
