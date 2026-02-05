"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

// ============================================================
// Types
// ============================================================

type Brand = {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  myRole: string;
  created_at: string;
  updated_at: string;
};

// ============================================================
// Constants
// ============================================================

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

// ============================================================
// Helpers
// ============================================================

async function getAccessToken() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) throw new Error("No access_token (로그인 필요)");
  return token;
}

// ============================================================
// Component
// ============================================================

export default function BrandDetailPage() {
  const params = useParams();
  const router = useRouter();
  const brandId = params?.brandId as string;

  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "", logo_url: "" });
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    const loadBrand = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = await getAccessToken();

        const res = await fetch(`${API_BASE}/customer/brands/${brandId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`브랜드 조회 실패: ${res.status}`);
        }

        const data = await res.json();
        setBrand(data);
        setFormData({
          name: data.name || "",
          description: data.description || "",
          logo_url: data.logo_url || "",
        });
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "브랜드 조회 중 오류 발생");
      } finally {
        setLoading(false);
      }
    };

    if (brandId) {
      loadBrand();
    }
  }, [brandId]);

  const handleSave = async () => {
    try {
      setSaveLoading(true);
      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/customer/brands/${brandId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        throw new Error(`브랜드 수정 실패: ${res.status}`);
      }

      const updated = await res.json();
      setBrand(updated);
      setIsEditing(false);
      alert("브랜드 정보가 수정되었습니다");
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "브랜드 수정 중 오류 발생");
    } finally {
      setSaveLoading(false);
    }
  };

  const canEdit = brand && (brand.myRole === "OWNER" || brand.myRole === "ADMIN");

  if (loading) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 32 }}>브랜드 상세</h1>
        <div>로딩 중...</div>
      </div>
    );
  }

  if (error || !brand) {
    return (
      <div>
        <button onClick={() => router.back()} style={backButton}>
          ← 뒤로 가기
        </button>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>브랜드 상세</h1>
        <div style={errorBox}>{error || "브랜드를 찾을 수 없습니다"}</div>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => router.back()} style={backButton}>
        ← 뒤로 가기
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>브랜드 상세</h1>
        {canEdit && !isEditing && (
          <button onClick={() => setIsEditing(true)} style={editButton}>
            수정하기
          </button>
        )}
      </div>

      <div style={contentBox}>
        {isEditing ? (
          <div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>브랜드명</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={inputStyle}
                placeholder="브랜드명을 입력하세요"
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>설명</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
                placeholder="브랜드 설명을 입력하세요"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>로고 URL</label>
              <input
                type="text"
                value={formData.logo_url}
                onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                style={inputStyle}
                placeholder="https://example.com/logo.png"
              />
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={handleSave} disabled={saveLoading} style={saveButton}>
                {saveLoading ? "저장 중..." : "저장"}
              </button>
              <button onClick={() => setIsEditing(false)} disabled={saveLoading} style={cancelButton}>
                취소
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              {brand.logo_url ? (
                <img
                  src={brand.logo_url}
                  alt={brand.name}
                  style={{ width: 80, height: 80, borderRadius: 12, objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 12,
                    background: "#222",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 40,
                  }}
                >
                  🏢
                </div>
              )}
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px 0" }}>{brand.name}</h2>
                <div style={{ fontSize: 14, color: "#aaa" }}>역할: {brand.myRole}</div>
              </div>
            </div>

            {brand.description && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: "#aaa", marginBottom: 8 }}>설명</div>
                <div style={{ fontSize: 15, color: "#fff", lineHeight: 1.6 }}>{brand.description}</div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginTop: 24 }}>
              <div>
                <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>등록일</div>
                <div style={{ fontSize: 14, color: "#fff" }}>{new Date(brand.created_at).toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>수정일</div>
                <div style={{ fontSize: 14, color: "#fff" }}>{new Date(brand.updated_at).toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Styles
// ============================================================

const backButton: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "transparent",
  color: "#aaa",
  fontSize: 14,
  cursor: "pointer",
  marginBottom: 24,
};

const editButton: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "#1a1a1a",
  color: "#fff",
  fontSize: 14,
  cursor: "pointer",
  fontWeight: 600,
};

const saveButton: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 8,
  border: "none",
  background: "#0070f3",
  color: "#fff",
  fontSize: 14,
  cursor: "pointer",
  fontWeight: 600,
};

const cancelButton: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "transparent",
  color: "#aaa",
  fontSize: 14,
  cursor: "pointer",
};

const contentBox: React.CSSProperties = {
  border: "1px solid #222",
  borderRadius: 12,
  padding: 24,
  background: "#0f0f0f",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "#aaa",
  marginBottom: 8,
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "#1a1a1a",
  color: "#fff",
  fontSize: 14,
  outline: "none",
};

const errorBox: React.CSSProperties = {
  border: "1px solid #ff4444",
  borderRadius: 12,
  padding: 16,
  background: "#1a0000",
  color: "#ff8888",
};
