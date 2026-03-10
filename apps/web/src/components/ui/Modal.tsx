"use client";

import React, { useEffect, useId, useRef } from "react";

type ModalProps = {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
};

export default function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  width = 520,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusDialog = () => {
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = dialog.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable) {
        focusable.focus();
      } else {
        dialog.focus();
      }
    };
    // Let portal/layout paint before focus move.
    const focusTimer = window.setTimeout(focusDialog, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));

      if (focusableElements.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/55 flex items-center justify-center z-[9999] p-4"
      onMouseDown={onClose}
    >
      <div
        className="bg-bg-secondary border border-border rounded-md overflow-hidden shadow-2xl"
        style={{ width }}
        onMouseDown={(e) => e.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
      >
        <div className="px-4 py-3.5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 id={title ? titleId : undefined} className="m-0 text-base font-extrabold text-foreground">
              {title ?? "모달"}
            </h2>
          </div>
          <button
            className="h-8 w-8 rounded border border-border bg-transparent text-foreground cursor-pointer text-sm grid place-items-center hover:bg-bg-tertiary transition-colors"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="p-4">{children}</div>

        {footer && (
          <div className="p-4 border-t border-border flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
