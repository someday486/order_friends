"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";

type Props = {
  open: boolean;
  brandId: string;
  onClose: () => void;
  onSubmit: (payload: { name: string; slug: string }) => Promise<void>;
  adding: boolean;
};

function normalizeSlug(v: string) {
  return v
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function AddStoreModal({ open, brandId, onClose, onSubmit, adding }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setSlug("");
    }
  }, [open]);

  const disabled = useMemo(
    () => adding || !brandId || !name.trim() || !slug.trim(),
    [adding, brandId, name, slug]
  );

  return (
    <Modal
      open={open}
      title="신규 가게 등록"
      onClose={adding ? () => {} : onClose}
      footer={
        <>
          <button style={btnGhost} onClick={onClose} disabled={adding}>
            취소
          </button>
          <button
            style={btnPrimary}
            onClick={() => onSubmit({ name, slug })}
            disabled={false}
          >
            {adding ? "저장 중..." : "저장하기"}
          </button>
        </>
      }
    >
      <div style={sectionCard}>
        <div style={sectionTitle}>기본 정보</div>

        <label style={label}>가게명</label>
        <input
          style={input}
          placeholder="예: 동탄 본점"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <label style={{ ...label, marginTop: 12 }}>가게 고유 주소(URL)</label>
        <div style={slugRow}>
          <div style={slugPrefix}>openoda.com/store/</div>
          <input
            style={slugInput}
            placeholder="예: dongtan-main"
            value={slug}
            onChange={(e) => setSlug(normalizeSlug(e.target.value))}
          />
        </div>

        <div style={helpText}>
          최소 생성 단계입니다. (상세/주소/이미지는 다음 단계에서 추가)
          <br />
          slug는 <b>소문자/숫자/하이픈(-)</b>만 가능해요.
        </div>
      </div>
    </Modal>
  );
}

// styles (기존 페이지 톤 유지)
const sectionCard: React.CSSProperties = {
  border: "1px solid #222",
  borderRadius: 12,
  background: "#0a0a0a",
  padding: 14,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  marginBottom: 12,
  color: "white",
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#aaa",
  marginBottom: 6,
};

const helpText: React.CSSProperties = {
  marginTop: 10,
  fontSize: 12,
  color: "#777",
  lineHeight: 1.5,
};

const input: React.CSSProperties = {
  height: 38,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "#060606",
  color: "white",
  fontSize: 13,
  width: "100%",
};

const slugRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  border: "1px solid #333",
  borderRadius: 10,
  overflow: "hidden",
  background: "#060606",
};

const slugPrefix: React.CSSProperties = {
  padding: "0 10px",
  height: 38,
  display: "flex",
  alignItems: "center",
  fontSize: 12,
  color: "#888",
  borderRight: "1px solid #222",
  whiteSpace: "nowrap",
};

const slugInput: React.CSSProperties = {
  height: 38,
  padding: "0 12px",
  border: "none",
  outline: "none",
  background: "transparent",
  color: "white",
  fontSize: 13,
  flex: 1,
};

const btnPrimary: React.CSSProperties = {
  height: 36,
  padding: "0 16px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "white",
  color: "#000",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 13,
};

const btnGhost: React.CSSProperties = {
  height: 36,
  padding: "0 16px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "transparent",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 13,
};
