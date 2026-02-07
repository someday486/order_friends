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
    <div style={{ marginBottom: 20 }}>
      <label style={labelStyle}>{label}</label>

      {value ? (
        <div style={{ position: "relative", display: "inline-block" }}>
          <img
            src={value}
            alt={label}
            style={{
              width: "100%",
              maxWidth: 240,
              aspectRatio,
              objectFit: "cover",
              borderRadius: 8,
              border: "1px solid #333",
            }}
          />
          <button
            type="button"
            onClick={handleRemove}
            style={removeButton}
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
          style={{
            ...dropZone,
            borderColor: dragOver ? "#0070f3" : "#333",
            background: dragOver ? "#0a1628" : "#1a1a1a",
          }}
        >
          {uploading ? (
            <span style={{ color: "#aaa", fontSize: 14 }}>업로드 중...</span>
          ) : (
            <>
              <span style={{ fontSize: 28, marginBottom: 8 }}>+</span>
              <span style={{ color: "#aaa", fontSize: 13 }}>
                클릭 또는 드래그하여 이미지 업로드
              </span>
              <span style={{ color: "#666", fontSize: 11, marginTop: 4 }}>
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
        style={{ display: "none" }}
      />

      {error && <div style={errorText}>{error}</div>}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "#aaa",
  marginBottom: 8,
  fontWeight: 600,
};

const dropZone: React.CSSProperties = {
  width: "100%",
  maxWidth: 240,
  aspectRatio: "1/1",
  border: "2px dashed #333",
  borderRadius: 8,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "#666",
  transition: "border-color 0.2s, background 0.2s",
};

const removeButton: React.CSSProperties = {
  position: "absolute",
  top: 6,
  right: 6,
  width: 28,
  height: 28,
  borderRadius: "50%",
  border: "none",
  background: "rgba(0,0,0,0.7)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const errorText: React.CSSProperties = {
  color: "#ff6666",
  fontSize: 12,
  marginTop: 6,
};
