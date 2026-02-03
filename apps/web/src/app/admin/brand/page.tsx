"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { useSelectedBrand } from "@/hooks/useSelectedBrand";

// ============================================================
// Brand Select Button
// ============================================================

export function BrandSelectButton({ brandId }: { brandId: string }) {
  const router = useRouter();
  const { selectBrand } = useSelectedBrand();

  return (
    <button
      onClick={() => {
        selectBrand(brandId);
        router.push("/admin/stores");
      }}
      style={btnPrimarySmall}
    >
      선택하고 가게 관리
    </button>
  );
}

// ============================================================
// Types
// ============================================================

type Brand = {
  id: string;
  name: string;
  slug?: string | null;
  bizName?: string | null;
  bizRegNo?: string | null;
  createdAt: string;
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

export default function BrandPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 수정 모드
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editBizName, setEditBizName] = useState("");
  const [editBizRegNo, setEditBizRegNo] = useState("");
  const [saving, setSaving] = useState(false);

  // 신규 브랜드 추가
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newSlugTouched, setNewSlugTouched] = useState(false);
  const [newBizName, setNewBizName] = useState("");
  const [newBizRegNo, setNewBizRegNo] = useState("");
  const [adding, setAdding] = useState(false);
  const [autoKoreanSlug, setAutoKoreanSlug] = useState("");

  // 브랜드 목록 조회
  const fetchBrands = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/admin/brands`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`브랜드 조회 실패: ${res.status} ${text}`);
      }

      const data = (await res.json()) as Brand[];
      setBrands(data);
    } catch (e: unknown) {
      const err = e as Error;
      setError(err?.message ?? "조회 실패");
    } finally {
      setLoading(false);
    }
  };

  // 브랜드 추가
  const handleAdd = async () => {
    if (!newName.trim()) return;

    try {
      setAdding(true);

      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/admin/brands`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newName,
          slug: newSlug || null,
          bizName: newBizName || null,
          bizRegNo: newBizRegNo || null,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`추가 실패: ${res.status} ${text}`);
      }

      await fetchBrands();
      setNewName("");
      setNewSlug("");
      setNewSlugTouched(false);
      setAutoKoreanSlug("");
      setNewBizName("");
      setNewBizRegNo("");
      setShowAddForm(false);
    } catch (e: unknown) {
      const err = e as Error;
      alert(err?.message ?? "추가 실패");
    } finally {
      setAdding(false);
    }
  };

  // 수정 시작
  const startEdit = (brand: Brand) => {
    setEditingId(brand.id);
    setEditName(brand.name);
    setEditSlug(brand.slug ?? "");
    setEditBizName(brand.bizName ?? "");
    setEditBizRegNo(brand.bizRegNo ?? "");
  };

  const isKorean = (value: string) => /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(value);

  const slugifyEnglish = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

  const generateRandomSlug = (prefix = "brand-", length = 6) => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = new Uint8Array(length);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    }
    let out = "";
    for (let i = 0; i < length; i += 1) {
      out += chars[bytes[i] % chars.length];
    }
    return `${prefix}${out}`;
  };

  const getAutoSlug = (name: string) => {
    if (!name.trim()) return "";
    if (isKorean(name)) {
      if (autoKoreanSlug) return autoKoreanSlug;
      const next = generateRandomSlug();
      setAutoKoreanSlug(next);
      return next;
    }
    setAutoKoreanSlug("");
    return slugifyEnglish(name);
  };

  const handleNewNameChange = (value: string) => {
    setNewName(value);
    if (!newSlugTouched) {
      setNewSlug(getAutoSlug(value));
    }
  };

  // 수정 저장
  const handleSave = async () => {
    if (!editingId || !editName.trim()) return;

    try {
      setSaving(true);

      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/admin/brands/${editingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editName,
          slug: editSlug || null,
          bizName: editBizName || null,
          bizRegNo: editBizRegNo || null,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`수정 실패: ${res.status} ${text}`);
      }

      await fetchBrands();
      setEditingId(null);
    } catch (e: unknown) {
      const err = e as Error;
      alert(err?.message ?? "수정 실패");
    } finally {
      setSaving(false);
    }
  };

  // 삭제
  const handleDelete = async (brandId: string, brandName: string) => {
    if (!confirm(`"${brandName}" 브랜드를 삭제하시겠습니까?\n모든 가게, 상품, 주문이 삭제됩니다.`)) return;

    try {
      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/admin/brands/${brandId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`삭제 실패: ${res.status} ${text}`);
      }

      setBrands((prev) => prev.filter((b) => b.id !== brandId));
    } catch (e: unknown) {
      const err = e as Error;
      alert(err?.message ?? "삭제 실패");
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>브랜드 관리</h1>
          <p style={{ color: "#aaa", margin: "4px 0 0 0", fontSize: 13 }}>
            내 브랜드 목록
          </p>
        </div>

        <button style={btnPrimary} onClick={() => setShowAddForm(true)}>
          + 브랜드 추가
        </button>
      </div>

      {/* 추가 폼 */}
      {showAddForm && (
        <div style={formCard}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: 16 }}>새 브랜드</h3>
          <div style={formGroup}>
            <label style={label}>브랜드명 *</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => handleNewNameChange(e.target.value)}
              placeholder="브랜드 이름"
              style={input}
            />
          </div>
          <div style={formGroup}>
            <label style={label}>브랜드 URL (slug)</label>
            <input
              type="text"
              value={newSlug}
              onChange={(e) => {
                setNewSlug(e.target.value);
                setNewSlugTouched(true);
              }}
              placeholder="예) orderfriends"
              style={input}
            />
            <div style={{ color: "#666", fontSize: 11, marginTop: 4 }}>
              영어는 자동으로 소문자/하이픈 처리되고, 한글은 랜덤으로 생성됩니다.
            </div>
          </div>
          <div style={formGroup}>
            <label style={label}>사업자명</label>
            <input
              type="text"
              value={newBizName}
              onChange={(e) => setNewBizName(e.target.value)}
              placeholder="사업자명 (선택)"
              style={input}
            />
          </div>
          <div style={formGroup}>
            <label style={label}>사업자등록번호</label>
            <input
              type="text"
              value={newBizRegNo}
              onChange={(e) => setNewBizRegNo(e.target.value)}
              placeholder="000-00-00000"
              style={input}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btnPrimary} onClick={handleAdd} disabled={adding || !newName.trim()}>
              {adding ? "추가 중..." : "추가"}
            </button>
            <button style={btnGhost} onClick={() => setShowAddForm(false)}>
              취소
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && <p style={{ color: "#ff8a8a", marginBottom: 16 }}>{error}</p>}

      {/* 브랜드 목록 */}
      {loading ? (
        <p style={{ color: "#aaa" }}>불러오는 중...</p>
      ) : brands.length === 0 ? (
        <p style={{ color: "#666" }}>브랜드가 없습니다. 새 브랜드를 추가하세요.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {brands.map((brand) => (
            <div key={brand.id} style={brandCard}>
              {editingId === brand.id ? (
                // 수정 모드
                <div>
                  <div style={formGroup}>
                    <label style={label}>브랜드명</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={input}
                    />
                  </div>
                  <div style={formGroup}>
                    <label style={label}>브랜드 URL (slug)</label>
                    <input
                      type="text"
                      value={editSlug}
                      onChange={(e) => setEditSlug(e.target.value)}
                      placeholder="예) orderfriends"
                      style={input}
                    />
                  </div>
                  <div style={formGroup}>
                    <label style={label}>사업자명</label>
                    <input
                      type="text"
                      value={editBizName}
                      onChange={(e) => setEditBizName(e.target.value)}
                      style={input}
                    />
                  </div>
                  <div style={formGroup}>
                    <label style={label}>사업자등록번호</label>
                    <input
                      type="text"
                      value={editBizRegNo}
                      onChange={(e) => setEditBizRegNo(e.target.value)}
                      style={input}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={btnPrimary} onClick={handleSave} disabled={saving}>
                      {saving ? "저장 중..." : "저장"}
                    </button>
                    <button style={btnGhost} onClick={() => setEditingId(null)}>
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                // 보기 모드
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{brand.name}</div>
                    {brand.slug && (
                      <div style={{ color: "#aaa", fontSize: 12, marginTop: 4 }}>
                        슬러그: {brand.slug}
                      </div>
                    )}
                    {brand.bizName && (
                      <div style={{ color: "#aaa", fontSize: 13, marginTop: 4 }}>
                        {brand.bizName}
                        {brand.bizRegNo && ` · ${brand.bizRegNo}`}
                      </div>
                    )}
                    <div style={{ color: "#666", fontSize: 12, marginTop: 8, fontFamily: "monospace" }}>
                      ID: {brand.id}
                    </div>
                  </div>

                  {/* 우측 버튼 영역 */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <BrandSelectButton brandId={brand.id} />
                    <button style={btnSmall} onClick={() => startEdit(brand)}>
                      수정
                    </button>
                    <button
                      style={{ ...btnSmall, color: "#ef4444" }}
                      onClick={() => handleDelete(brand.id, brand.name)}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Styles
// ============================================================

const brandCard: React.CSSProperties = {
  padding: 16,
  border: "1px solid #222",
  borderRadius: 12,
  background: "#0a0a0a",
};

const formCard: React.CSSProperties = {
  padding: 20,
  marginBottom: 24,
  border: "1px solid #333",
  borderRadius: 12,
  background: "#0a0a0a",
};

const formGroup: React.CSSProperties = {
  marginBottom: 12,
};

const label: React.CSSProperties = {
  display: "block",
  color: "#aaa",
  fontSize: 12,
  marginBottom: 4,
};

const input: React.CSSProperties = {
  width: "100%",
  maxWidth: 320,
  height: 36,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "#0a0a0a",
  color: "white",
  fontSize: 13,
};

const btnPrimary: React.CSSProperties = {
  height: 36,
  padding: "0 16px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "white",
  color: "#000",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 13,
};

const btnPrimarySmall: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "white",
  color: "#000",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 12,
  whiteSpace: "nowrap",
};

const btnGhost: React.CSSProperties = {
  height: 36,
  padding: "0 16px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "transparent",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 13,
};

const btnSmall: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 6,
  border: "1px solid #333",
  background: "transparent",
  color: "white",
  fontWeight: 500,
  cursor: "pointer",
  fontSize: 12,
};
