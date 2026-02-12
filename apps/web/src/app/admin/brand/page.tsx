"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api-client";
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
      className="btn-primary py-1.5 px-2.5 text-xs whitespace-nowrap"
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

// ============================================================
// Helpers
// ============================================================

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

      const data = await apiClient.get<Brand[]>("/admin/brands");
      setBrands(data);
    } catch (e: unknown) {
      const err = e as Error;
      setError(err?.message ?? "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // ??? ??
  const handleAdd = async () => {
    if (!newName.trim()) return;

    try {
      setAdding(true);

      await apiClient.post("/admin/brands", {
        name: newName,
        slug: newSlug || null,
        bizName: newBizName || null,
        bizRegNo: newBizRegNo || null,
      });

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
      toast.error(err?.message ?? "브랜드 추가에 실패했습니다.");
    } finally {
      setAdding(false);
    }
  };

  // ?? ??
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

      await apiClient.patch("/admin/brands/" + editingId, {
        name: editName,
        slug: editSlug || null,
        bizName: editBizName || null,
        bizRegNo: editBizRegNo || null,
      });

      await fetchBrands();
      setEditingId(null);
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err?.message ?? "브랜드 수정에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // ??
  const handleDelete = async (brandId: string, brandName: string) => {
    if (!confirm(`"${brandName}" 브랜드를 삭제하시겠습니까?\n관련 매장, 상품, 주문이 함께 삭제됩니다.`)) return;

    try {
      await apiClient.delete("/admin/brands/" + brandId);
      setBrands((prev) => prev.filter((b) => b.id !== brandId));
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err?.message ?? "브랜드 삭제에 실패했습니다.");
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-extrabold m-0 text-foreground">브랜드 관리</h1>
          <p className="text-text-secondary mt-1 text-[13px]">
            내 브랜드 목록
          </p>
        </div>

        <button className="btn-primary h-9 px-4 text-[13px]" onClick={() => setShowAddForm(true)}>
          + 브랜드 추가
        </button>
      </div>

      {/* 추가 폼 */}
      {showAddForm && (
        <div className="card p-5 mb-6">
          <h3 className="m-0 mb-4 text-base text-foreground">새 브랜드</h3>
          <div className="mb-3">
            <label className="block text-text-secondary text-xs mb-1">브랜드명 *</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => handleNewNameChange(e.target.value)}
              placeholder="브랜드 이름"
              className="input-field max-w-[320px]"
            />
          </div>
          <div className="mb-3">
            <label className="block text-text-secondary text-xs mb-1">브랜드 URL (slug)</label>
            <input
              type="text"
              value={newSlug}
              onChange={(e) => {
                setNewSlug(e.target.value);
                setNewSlugTouched(true);
              }}
              placeholder="예) orderfriends"
              className="input-field max-w-[320px]"
            />
            <div className="text-text-tertiary text-[11px] mt-1">
              영어는 자동으로 소문자/하이픈 처리되고, 한글은 랜덤으로 생성됩니다.
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-text-secondary text-xs mb-1">사업자명</label>
            <input
              type="text"
              value={newBizName}
              onChange={(e) => setNewBizName(e.target.value)}
              placeholder="사업자명 (선택)"
              className="input-field max-w-[320px]"
            />
          </div>
          <div className="mb-3">
            <label className="block text-text-secondary text-xs mb-1">사업자등록번호</label>
            <input
              type="text"
              value={newBizRegNo}
              onChange={(e) => setNewBizRegNo(e.target.value)}
              placeholder="000-00-00000"
              className="input-field max-w-[320px]"
            />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary h-9 px-4 text-[13px]" onClick={handleAdd} disabled={adding || !newName.trim()}>
              {adding ? "추가 중..." : "추가"}
            </button>
            <button
              className="h-9 px-4 rounded-lg border border-border bg-transparent text-foreground font-semibold cursor-pointer text-[13px] hover:bg-bg-tertiary transition-colors"
              onClick={() => setShowAddForm(false)}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && <p className="text-danger-500 mb-4">{error}</p>}

      {/* 브랜드 목록 */}
      {loading ? (
        <p className="text-text-secondary">불러오는 중...</p>
      ) : brands.length === 0 ? (
        <p className="text-text-tertiary">브랜드가 없습니다. 새 브랜드를 추가하세요.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {brands.map((brand) => (
            <div key={brand.id} className="card p-4">
              {editingId === brand.id ? (
                // 수정 모드
                <div>
                  <div className="mb-3">
                    <label className="block text-text-secondary text-xs mb-1">브랜드명</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input-field max-w-[320px]"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="block text-text-secondary text-xs mb-1">브랜드 URL (slug)</label>
                    <input
                      type="text"
                      value={editSlug}
                      onChange={(e) => setEditSlug(e.target.value)}
                      placeholder="예) orderfriends"
                      className="input-field max-w-[320px]"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="block text-text-secondary text-xs mb-1">사업자명</label>
                    <input
                      type="text"
                      value={editBizName}
                      onChange={(e) => setEditBizName(e.target.value)}
                      className="input-field max-w-[320px]"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="block text-text-secondary text-xs mb-1">사업자등록번호</label>
                    <input
                      type="text"
                      value={editBizRegNo}
                      onChange={(e) => setEditBizRegNo(e.target.value)}
                      className="input-field max-w-[320px]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-primary h-9 px-4 text-[13px]" onClick={handleSave} disabled={saving}>
                      {saving ? "저장 중..." : "저장"}
                    </button>
                    <button
                      className="h-9 px-4 rounded-lg border border-border bg-transparent text-foreground font-semibold cursor-pointer text-[13px] hover:bg-bg-tertiary transition-colors"
                      onClick={() => setEditingId(null)}
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                // 보기 모드
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-base text-foreground">{brand.name}</div>
                    {brand.slug && (
                      <div className="text-text-secondary text-xs mt-1">
                        슬러그: {brand.slug}
                      </div>
                    )}
                    {brand.bizName && (
                      <div className="text-text-secondary text-[13px] mt-1">
                        {brand.bizName}
                        {brand.bizRegNo && ` · ${brand.bizRegNo}`}
                      </div>
                    )}
                    <div className="text-text-tertiary text-xs mt-2 font-mono">
                      ID: {brand.id}
                    </div>
                  </div>

                  {/* 우측 버튼 영역 */}
                  <div className="flex gap-2 flex-wrap justify-end">
                    <BrandSelectButton brandId={brand.id} />
                    <button
                      className="py-1 px-2.5 rounded-md border border-border bg-transparent text-foreground font-medium cursor-pointer text-xs hover:bg-bg-tertiary transition-colors"
                      onClick={() => startEdit(brand)}
                    >
                      수정
                    </button>
                    <button
                      className="py-1 px-2.5 rounded-md border border-border bg-transparent text-danger-500 font-medium cursor-pointer text-xs hover:bg-bg-tertiary transition-colors"
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
