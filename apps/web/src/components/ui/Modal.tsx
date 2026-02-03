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
    <div style={overlay} onMouseDown={onClose}>
      <div
        style={{ ...modal, width }}
        onMouseDown={(e) => e.stopPropagation()} // 바깥 클릭만 닫히게
        role="dialog"
        aria-modal="true"
      >
        <div style={header}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{title ?? "모달"}</h2>
          </div>
          <button style={closeBtn} onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <div style={body}>{children}</div>

        {footer && <div style={footerWrap}>{footer}</div>}
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 16,
};

const modal: React.CSSProperties = {
  background: "#0b0b0b",
  border: "1px solid #222",
  borderRadius: 14,
  overflow: "hidden",
  boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
};

const header: React.CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid #222",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const body: React.CSSProperties = {
  padding: 16,
};

const footerWrap: React.CSSProperties = {
  padding: 16,
  borderTop: "1px solid #222",
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
};

const closeBtn: React.CSSProperties = {
  height: 32,
  width: 32,
  borderRadius: 8,
  border: "1px solid #333",
  background: "transparent",
  color: "white",
  cursor: "pointer",
  fontSize: 14,
  display: "grid",
  placeItems: "center",
};
