"use client";

import React, { useEffect } from "react";

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
  // ESC 닫기
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
        role="dialog"
        aria-modal="true"
      >
        <div className="px-4 py-3.5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="m-0 text-base font-extrabold text-foreground">{title ?? "모달"}</h2>
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
