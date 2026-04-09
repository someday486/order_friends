"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { HelpCircle, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { useSelectedBrand } from "@/hooks/useSelectedBrand";
import { apiClient } from "@/lib/api-client";
import { parseApiErrorMessage } from "@/lib/api-error";
import { formatBusinessNumberInput } from "@/lib/format";
import {
  getAdminBrands,
  invalidateAdminBrands,
  invalidateAdminBranches,
} from "@/lib/adminDataCache";

function BrandSelectButton({ brandId }: { brandId: string }) {
  const router = useRouter();
  const { selectBrand } = useSelectedBrand();

  return (
    <button
      onClick={() => {
        selectBrand(brandId);
        router.push("/admin/stores");
      }}
      className="btn-primary whitespace-nowrap px-2.5 py-1.5 text-xs"
    >
      매장관리
    </button>
  );
}

type Brand = {
  id: string;
  name: string;
  isActive: boolean;
  slug?: string | null;
  bizName?: string | null;
  bizRegNo?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  createdAt: string;
};

function getBrandOrderUrl(slug?: string | null) {
  if (!slug) return null;
  return `/order/${encodeURIComponent(slug)}`;
}

function isKorean(value: string) {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(value);
}

function slugifyEnglish(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateRandomSlug(prefix = "brand-", length = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(length);

  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[bytes[i] % chars.length];
  }

  return `${prefix}${out}`;
}

export default function BrandPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editBizName, setEditBizName] = useState("");
  const [editBizRegNo, setEditBizRegNo] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newSlugTouched, setNewSlugTouched] = useState(false);
  const [newBizName, setNewBizName] = useState("");
  const [newBizRegNo, setNewBizRegNo] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newLogoUrl, setNewLogoUrl] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [autoKoreanSlug, setAutoKoreanSlug] = useState("");
  const [togglingBrandId, setTogglingBrandId] = useState<string | null>(null);

  const filteredBrands = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    if (!query) return brands;

    return brands.filter((brand) =>
      [brand.name, brand.slug ?? "", brand.bizName ?? "", brand.bizRegNo ?? ""].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [brands, searchInput]);

  const copyOrderUrl = async (slug: string) => {
    const url = `${window.location.origin}/order/${encodeURIComponent(slug)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("주문 URL을 복사했습니다.");
    } catch {
      toast.error("URL 복사에 실패했습니다.");
    }
  };

  const fetchBrands = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getAdminBrands();
      setBrands(data);
    } catch (e: unknown) {
      const err = e as Error;
      setError(parseApiErrorMessage(err, "브랜드 목록을 불러오지 못했습니다."));
    } finally {
      setLoading(false);
    }
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

  const handleAdd = async () => {
    if (!newName.trim()) return;

    try {
      setAdding(true);

      await apiClient.post("/admin/brands", {
        name: newName,
        slug: newSlug || null,
        bizName: newBizName || null,
        bizRegNo: newBizRegNo || null,
        address: newAddress || null,
        logoUrl: newLogoUrl,
      });

      invalidateAdminBrands();
      invalidateAdminBranches();
      await fetchBrands();
      setNewName("");
      setNewSlug("");
      setNewSlugTouched(false);
      setAutoKoreanSlug("");
      setNewBizName("");
      setNewBizRegNo("");
      setNewAddress("");
      setNewLogoUrl(null);
      setShowAddForm(false);
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(parseApiErrorMessage(err, "브랜드 추가에 실패했습니다."));
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (brand: Brand) => {
    setEditingId(brand.id);
    setEditName(brand.name);
    setEditSlug(brand.slug ?? "");
    setEditBizName(brand.bizName ?? "");
    setEditBizRegNo(brand.bizRegNo ?? "");
    setEditAddress(brand.address ?? "");
    setEditLogoUrl(brand.logoUrl ?? null);
  };

  const handleSave = async () => {
    if (!editingId || !editName.trim()) return;

    try {
      setSaving(true);

      await apiClient.patch(`/admin/brands/${editingId}`, {
        name: editName,
        slug: editSlug || null,
        bizName: editBizName || null,
        bizRegNo: editBizRegNo || null,
        address: editAddress || null,
        logoUrl: editLogoUrl,
      });

      invalidateAdminBrands();
      await fetchBrands();
      setEditingId(null);
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(parseApiErrorMessage(err, "브랜드 수정에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (
    brandId: string,
    brandName: string,
    nextIsActive: boolean,
  ) => {
    if (
      !confirm(
        nextIsActive
          ? `"${brandName}" 브랜드를 다시 활성화하시겠습니까?\n활성화하면 고객 주문 페이지에 다시 노출됩니다.`
          : `"${brandName}" 브랜드를 비활성화하시겠습니까?\n비활성화하면 고객 주문 페이지에서 숨겨지지만 기존 주문 이력은 유지됩니다.`,
      )
    ) {
      return;
    }

    try {
      setTogglingBrandId(brandId);
      await apiClient.patch(`/admin/brands/${brandId}`, {
        isActive: nextIsActive,
      });
      invalidateAdminBrands();
      invalidateAdminBranches(brandId);
      setBrands((prev) =>
        prev.map((brand) =>
          brand.id === brandId ? { ...brand, isActive: nextIsActive } : brand,
        ),
      );
      toast.success(
        nextIsActive
          ? "브랜드를 다시 활성화했습니다."
          : "브랜드를 비활성화했습니다.",
      );
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(
        parseApiErrorMessage(
          err,
          nextIsActive
            ? "브랜드 활성화에 실패했습니다."
            : "브랜드 비활성화에 실패했습니다.",
        ),
      );
    } finally {
      setTogglingBrandId(null);
    }
  };

  useEffect(() => {
    void fetchBrands();
  }, []);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="m-0 text-[22px] font-extrabold text-foreground">브랜드관리</h1>
            <div className="relative group cursor-pointer" tabIndex={0}>
              <HelpCircle
                size={16}
                className="text-text-secondary hover:text-foreground transition-colors"
                aria-label="브랜드 URL 도움말"
              />
              <div className="absolute left-6 top-1/2 z-50 w-72 -translate-y-1/2 rounded-md border border-border bg-bg-tertiary p-3 text-xs text-text-secondary opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none">
                브랜드 URL은 고객 주문 페이지 주소입니다. 브랜드명을 입력하면 자동 생성되고, 필요하면 직접 수정할 수 있습니다.
              </div>
            </div>
          </div>
          <p className="mt-1 text-[13px] text-text-secondary">
            총 {filteredBrands.length}개 / 전체 {brands.length}개 브랜드
          </p>
        </div>

        <button
          className="btn-primary h-9 px-4 text-[13px]"
          onClick={() => setShowAddForm(true)}
        >
          + 브랜드 추가
        </button>
      </div>

      <div className="mb-4 rounded-xl border border-border bg-bg-secondary p-4">
        <label className="mb-1.5 block text-xs font-semibold text-text-secondary">검색</label>
        <div className="relative w-full max-w-[360px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearchInput("");
            }}
            placeholder="브랜드명, URL, 사업자 정보 검색"
            aria-label="브랜드 검색"
            className="input-field h-10 w-full pl-10 pr-10 text-sm"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-foreground"
              aria-label="검색어 지우기"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {showAddForm && (
        <div className="card mb-6 p-5">
          <h3 className="mb-4 text-base text-foreground">새 브랜드</h3>
          <div className="grid gap-5 lg:grid-cols-[minmax(240px,320px)_1fr]">
            <div>
              <ImageUpload
                value={newLogoUrl}
                onChange={setNewLogoUrl}
                folder="brands/logos"
                label="브랜드 로고"
                aspectRatio="1/1"
              />
            </div>

            <div>
              <div className="mb-3">
                <label className="mb-1 block text-xs text-text-secondary">브랜드명 *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => handleNewNameChange(e.target.value)}
                  placeholder="브랜드 이름"
                  className="input-field max-w-[320px]"
                />
              </div>

              <div className="mb-3">
                <label className="mb-1 block text-xs text-text-secondary">브랜드 URL</label>
                <input
                  type="text"
                  value={newSlug}
                  onChange={(e) => {
                    setNewSlug(e.target.value);
                    setNewSlugTouched(true);
                  }}
                  placeholder="예: orderfriends"
                  className="input-field max-w-[320px]"
                />
                <div className="mt-1 text-[11px] text-text-tertiary">
                  고객 주문 주소로 사용됩니다. 영문과 숫자 중심으로 자동 정리되고, 한글 이름이면 임시 슬러그가 생성됩니다.
                </div>
              </div>

              <div className="mb-3">
                <label className="mb-1 block text-xs text-text-secondary">사업자명</label>
                <input
                  type="text"
                  value={newBizName}
                  onChange={(e) => setNewBizName(e.target.value)}
                  placeholder="사업자명"
                  className="input-field max-w-[320px]"
                />
              </div>

              <div className="mb-3">
                <label className="mb-1 block text-xs text-text-secondary">사업자등록번호</label>
                <input
                  type="text"
                  value={newBizRegNo}
                  onChange={(e) =>
                    setNewBizRegNo(formatBusinessNumberInput(e.target.value))
                  }
                  placeholder="000-00-00000"
                  className="input-field max-w-[320px]"
                  inputMode="numeric"
                  maxLength={12}
                />
              </div>

              <div className="mb-3">
                <label className="mb-1 block text-xs text-text-secondary">사업장 주소</label>
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="사업장 주소"
                  className="input-field max-w-[320px]"
                />
              </div>

              <div className="flex gap-2">
                <button
                  className="btn-primary h-9 px-4 text-[13px]"
                  onClick={handleAdd}
                  disabled={adding || !newName.trim()}
                >
                  {adding ? "추가 중..." : "추가"}
                </button>
                <button
                  className="h-9 rounded-lg border border-border bg-transparent px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-bg-tertiary"
                  onClick={() => setShowAddForm(false)}
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && <p className="mb-4 text-danger-500">{error}</p>}

      {loading ? (
        <p className="text-text-secondary">불러오는 중...</p>
      ) : filteredBrands.length === 0 ? (
        <p className="text-text-tertiary">
          {searchInput.trim()
            ? "검색 결과가 없습니다."
            : "브랜드가 없습니다. 새 브랜드를 추가해주세요."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredBrands.map((brand) => (
            <div key={brand.id} className="card p-4">
              {editingId === brand.id ? (
                <div className="grid gap-5 lg:grid-cols-[minmax(240px,320px)_1fr]">
                  <div>
                    <ImageUpload
                      value={editLogoUrl}
                      onChange={setEditLogoUrl}
                      folder="brands/logos"
                      label="브랜드 로고"
                      aspectRatio="1/1"
                    />
                  </div>

                  <div>
                    <div className="mb-3">
                      <label className="mb-1 block text-xs text-text-secondary">브랜드명</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="input-field max-w-[320px]"
                      />
                    </div>

                    <div className="mb-3">
                      <label className="mb-1 block text-xs text-text-secondary">브랜드 URL</label>
                      <input
                        type="text"
                        value={editSlug}
                        onChange={(e) => setEditSlug(e.target.value)}
                        placeholder="예: orderfriends"
                        className="input-field max-w-[320px]"
                      />
                    </div>

                    <div className="mb-3">
                      <label className="mb-1 block text-xs text-text-secondary">사업자명</label>
                      <input
                        type="text"
                        value={editBizName}
                        onChange={(e) => setEditBizName(e.target.value)}
                        className="input-field max-w-[320px]"
                      />
                    </div>

                    <div className="mb-3">
                      <label className="mb-1 block text-xs text-text-secondary">사업자등록번호</label>
                      <input
                        type="text"
                        value={editBizRegNo}
                        onChange={(e) =>
                          setEditBizRegNo(
                            formatBusinessNumberInput(e.target.value),
                          )
                        }
                        className="input-field max-w-[320px]"
                        inputMode="numeric"
                        maxLength={12}
                      />
                    </div>

                    <div className="mb-3">
                      <label className="mb-1 block text-xs text-text-secondary">사업장 주소</label>
                      <input
                        type="text"
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        className="input-field max-w-[320px]"
                        placeholder="사업장 주소"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        className="btn-primary h-9 px-4 text-[13px]"
                        onClick={handleSave}
                        disabled={saving}
                      >
                        {saving ? "저장 중..." : "저장"}
                      </button>
                      <button
                        className="h-9 rounded-lg border border-border bg-transparent px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-bg-tertiary"
                        onClick={() => setEditingId(null)}
                      >
                        취소
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {brand.logoUrl ? (
                      <Image
                        src={brand.logoUrl}
                        alt={brand.name}
                        width={56}
                        height={56}
                        className="h-14 w-14 rounded-lg border border-border bg-bg-tertiary object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-bg-tertiary text-lg font-bold text-text-tertiary">
                        {brand.name.slice(0, 1)}
                      </div>
                    )}

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-base font-bold text-foreground">{brand.name}</div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            brand.isActive
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {brand.isActive ? "활성" : "비활성"}
                        </span>
                      </div>

                      {brand.slug && brand.isActive && (
                        <div className="mt-2">
                          <div className="mb-1 text-xs text-text-secondary">고객 주문 URL</div>
                          <div className="flex flex-wrap items-center gap-2">
                            <code className="rounded bg-bg-tertiary px-2 py-1 text-[12px] text-foreground">
                              {getBrandOrderUrl(brand.slug)}
                            </code>
                            <button
                              type="button"
                              className="rounded-md border border-border bg-transparent px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-bg-tertiary"
                              onClick={() => copyOrderUrl(brand.slug ?? "")}
                            >
                              URL 복사
                            </button>
                          </div>
                        </div>
                      )}

                      {!brand.isActive && (
                        <div className="mt-2 text-[12px] text-text-secondary">
                          비활성화된 브랜드는 고객 주문 페이지에 노출되지 않습니다.
                        </div>
                      )}

                      {brand.bizName && (
                        <div className="mt-1 text-[13px] text-text-secondary">
                          {brand.bizName}
                          {brand.bizRegNo && ` / ${brand.bizRegNo}`}
                        </div>
                      )}

                      <div className="mt-2 font-mono text-xs text-text-tertiary">
                        ID: {brand.id}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <BrandSelectButton brandId={brand.id} />
                    <button
                      className="rounded-md border border-border bg-transparent px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-bg-tertiary"
                      onClick={() => startEdit(brand)}
                    >
                      수정
                    </button>
                    <button
                      className={`rounded-md border border-border bg-transparent px-2.5 py-1 text-xs font-medium transition-colors hover:bg-bg-tertiary ${
                        brand.isActive ? "text-danger-500" : "text-foreground"
                      }`}
                      onClick={() =>
                        handleToggleActive(brand.id, brand.name, !brand.isActive)
                      }
                      disabled={togglingBrandId === brand.id}
                    >
                      {togglingBrandId === brand.id
                        ? brand.isActive
                          ? "비활성화 중..."
                          : "활성화 중..."
                        : brand.isActive
                          ? "비활성화"
                          : "재활성화"}
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
