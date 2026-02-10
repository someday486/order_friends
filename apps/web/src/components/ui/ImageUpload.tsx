"use client";

import React, { useRef, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import { apiClient } from "@/lib/api-client";

interface ImageUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  folder: string;
  label: string;
  aspectRatio?: string; // e.g. "1/1", "16/9", "3/1"
}

const PREVIEW_WIDTH = 240;

function getPreviewSize(aspectRatio: string) {
  const [w, h] = aspectRatio.split("/").map((value) => Number(value));
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return { width: PREVIEW_WIDTH, height: PREVIEW_WIDTH };
  }
  return {
    width: PREVIEW_WIDTH,
    height: Math.max(1, Math.round(PREVIEW_WIDTH * (h / w))),
  };
}

export function ImageUpload({
  value,
  onChange,
  folder,
  label,
  aspectRatio = "1/1",
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewSize = useMemo(() => getPreviewSize(aspectRatio), [aspectRatio]);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("?´ë?ì§€ ?Œì¼ë§??…ë¡œ??ê°€?¥í•©?ˆë‹¤");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("?Œì¼ ?¬ê¸°??5MB ?´í•˜ë§?ê°€?¥í•©?ˆë‹¤");
        return;
      }

      setError(null);
      setUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", folder);

        const data = await apiClient.post<{ url: string }>(
          "/upload/image",
          formData,
        );
        onChange(data.url);
      } catch (e) {
        setError(e instanceof Error ? e.message : "?…ë¡œ??ì¤??¤ë¥˜ ë°œìƒ");
      } finally {
        setUploading(false);
      }
    },
    [folder, onChange],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload],
  );

  const handleRemove = () => {
    onChange(null);
    setError(null);
  };

  return (
    <div className="mb-5">
      <label className="block text-sm text-text-secondary mb-2 font-semibold">{label}</label>

      {value ? (
        <div className="relative inline-block">
          <Image
            src={value}
            alt={label}
            width={previewSize.width}
            height={previewSize.height}
            className="w-full max-w-[240px] object-cover rounded border border-border"
            style={{ aspectRatio }}
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/70 text-white text-xs font-bold flex items-center justify-center cursor-pointer border-none hover:bg-black/90 transition-colors"
            title="?´ë?ì§€ ?? œ"
          >
            X
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`
            w-full max-w-[240px] aspect-square border-2 border-dashed rounded
            flex flex-col items-center justify-center cursor-pointer
            text-text-tertiary transition-colors duration-200
            ${dragOver
              ? "border-primary-500 bg-primary-500/10"
              : "border-border bg-bg-tertiary hover:border-text-tertiary"
            }
          `}
        >
          {uploading ? (
            <span className="text-sm text-text-secondary">?…ë¡œ??ì¤?..</span>
          ) : (
            <>
              <span className="text-[28px] mb-2">+</span>
              <span className="text-sm text-text-secondary">
                ?´ë¦­ ?ëŠ” ?œë˜ê·¸í•˜???´ë?ì§€ ?…ë¡œ??
              </span>
              <span className="text-2xs text-text-tertiary mt-1">
                JPG, PNG, WebP, GIF (ìµœë? 5MB)
              </span>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />

      {error && <div className="text-danger-500 text-xs mt-1.5">{error}</div>}
    </div>
  );
}
