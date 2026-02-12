"use client";

import React, { useMemo, useState } from "react";
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

  const disabled = useMemo(
    () => adding || !brandId || !name.trim() || !slug.trim(),
    [adding, brandId, name, slug]
  );

  return (
    <Modal
      open={open}
      title="새 가게 등록"
      onClose={adding ? () => {} : onClose}
      footer={
        <>
          <button
            className="h-9 px-4 rounded-lg border border-border bg-transparent text-foreground font-bold cursor-pointer text-[13px] hover:bg-bg-tertiary transition-colors"
            onClick={onClose}
            disabled={adding}
          >
            취소
          </button>
          <button
            className="btn-primary h-9 px-4 text-[13px]"
            onClick={() => onSubmit({ name, slug })}
            disabled={disabled}
          >
            {adding ? "저장 중..." : "저장하기"}
          </button>
        </>
      }
    >
      <div className="card p-3.5">
        <div className="text-[13px] font-extrabold mb-3 text-foreground">기본 정보</div>

        <label className="block text-xs text-text-secondary mb-1.5">가게명</label>
        <input
          className="input-field w-full"
          placeholder="예) 동탄 본점"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <label className="block text-xs text-text-secondary mb-1.5 mt-3">가게 고유 주소(URL)</label>
        <div className="flex items-center border border-border rounded-lg overflow-hidden bg-bg-secondary">
          <div className="px-2.5 h-[38px] flex items-center text-xs text-text-tertiary border-r border-border whitespace-nowrap">
            openoda.com/store/
          </div>
          <input
            className="h-[38px] px-3 border-none outline-none bg-transparent text-foreground text-[13px] flex-1"
            placeholder="예) dongtan-main"
            value={slug}
            onChange={(e) => setSlug(normalizeSlug(e.target.value))}
          />
        </div>

        <div className="mt-2.5 text-xs text-text-tertiary leading-relaxed">
          기본 정보만 먼저 생성됩니다. (상세/주소/이미지는 다음 단계에서 추가)
          <br />
          slug는 <b>영문/숫자/하이픈(-)</b>만 가능합니다.
        </div>
      </div>
    </Modal>
  );
}
