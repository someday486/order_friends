"use client";

import React, { useRef, useState, useCallback } from "react";

interface ImageUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  folder: string;
  label: string;
  aspectRatio?: string; // e.g. "1/1", "16/9", "3/1"
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

async function getAccessToken() {
  const { createClient } = await import("@/lib/supabaseClient");
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("No access_token");
  return token;
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

  const handleUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("이미지 파일만 업로드 가능합니다");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("파일 크기는 5MB 이하만 가능합니다");
        return;
      }

      setError(null);
      setUploading(true);

      try {
        const token = await getAccessToken();
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", folder);

        const res = await fetch(`${API_BASE}/upload/image`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `업로드 실패: ${res.status}`);
        }

        const data = await res.json();
        onChange(data.url);
      } catch (e) {
        setError(e instanceof Error ? e.message : "업로드 중 오류 발생");
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
          <img
            src={value}
            alt={label}
            className="w-full max-w-[240px] object-cover rounded border border-border"
            style={{ aspectRatio }}
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/70 text-white text-xs font-bold flex items-center justify-center cursor-pointer border-none hover:bg-black/90 transition-colors"
            title="이미지 삭제"
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
            <span className="text-sm text-text-secondary">업로드 중...</span>
          ) : (
            <>
              <span className="text-[28px] mb-2">+</span>
              <span className="text-sm text-text-secondary">
                클릭 또는 드래그하여 이미지 업로드
              </span>
              <span className="text-2xs text-text-tertiary mt-1">
                JPG, PNG, WebP, GIF (최대 5MB)
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
