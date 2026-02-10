"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { apiClient } from "@/lib/api-client";
import { ImageUpload } from "@/components/ui/ImageUpload";

// ============================================================
// Types
// ============================================================

type Brand = {
  id: string;
  name: string;
  biz_name: string | null;
  biz_reg_no: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  thumbnail_url: string | null;
  myRole: string;
  created_at: string;
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

export default function BrandDetailPage() {
  const params = useParams();
  const router = useRouter();
  const brandId = params?.brandId as string;

  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    biz_name: "",
    biz_reg_no: "",
    logo_url: null as string | null,
    cover_image_url: null as string | null,
    thumbnail_url: null as string | null,
  });
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    const loadBrand = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await apiClient.get<Brand>(`/customer/brands/${brandId}`);
        setBrand(data);
        setFormData({
          name: data.name || "",
          biz_name: data.biz_name || "",
          biz_reg_no: data.biz_reg_no || "",
          logo_url: data.logo_url || null,
          cover_image_url: data.cover_image_url || null,
          thumbnail_url: data.thumbnail_url || null,
        });
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "??? ?? ? ?? ??");
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

      const updatedBrand = await apiClient.patch<Brand>(`/customer/brands/${brandId}`, formData);
      setBrand(updatedBrand);
      setIsEditing(false);
      alert("??? ??? ???????.");
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "??? ?? ? ?? ??");
    } finally {
      setSaveLoading(false);
    }
  };

  const canEdit = brand && (brand.myRole === "OWNER" || brand.myRole === "ADMIN");

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold mb-8 text-foreground">브랜드 상세</h1>
        <div className="text-text-secondary">로딩 중...</div>
      </div>
    );
  }

  if (error || !brand) {
    return (
      <div>
        <button onClick={() => router.back()} className="py-2 px-4 rounded-lg border border-border bg-transparent text-text-secondary text-sm cursor-pointer mb-6 hover:bg-bg-tertiary transition-colors">
          ← 뒤로 가기
        </button>
        <h1 className="text-2xl font-extrabold mb-4 text-foreground">브랜드 상세</h1>
        <div className="border border-danger-500 rounded-xl p-4 bg-danger-500/10 text-danger-500">
          {error || "브랜드를 찾을 수 없습니다"}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => router.back()} className="py-2 px-4 rounded-lg border border-border bg-transparent text-text-secondary text-sm cursor-pointer mb-6 hover:bg-bg-tertiary transition-colors">
        ← 뒤로 가기
      </button>

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-extrabold m-0 text-foreground">브랜드 상세</h1>
        {canEdit && !isEditing && (
          <button onClick={() => setIsEditing(true)} className="py-2.5 px-5 rounded-lg border border-border bg-bg-tertiary text-foreground text-sm cursor-pointer font-semibold hover:bg-bg-secondary transition-colors">
            수정하기
          </button>
        )}
      </div>

      <div className="card p-6">
        {isEditing ? (
          <div>
            <div className="mb-5">
              <label className="block text-[13px] text-text-secondary mb-2 font-semibold">브랜드명</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-field w-full"
                placeholder="브랜드명을 입력하세요"
              />
            </div>

            <div className="mb-5">
              <label className="block text-[13px] text-text-secondary mb-2 font-semibold">사업자명</label>
              <input
                type="text"
                value={formData.biz_name}
                onChange={(e) => setFormData({ ...formData, biz_name: e.target.value })}
                className="input-field w-full"
                placeholder="사업자명"
              />
            </div>

            <div className="mb-5">
              <label className="block text-[13px] text-text-secondary mb-2 font-semibold">사업자등록번호</label>
              <input
                type="text"
                value={formData.biz_reg_no}
                onChange={(e) => setFormData({ ...formData, biz_reg_no: e.target.value })}
                className="input-field w-full"
                placeholder="000-00-00000"
              />
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 mb-6">
              <ImageUpload
                value={formData.logo_url}
                onChange={(url) => setFormData({ ...formData, logo_url: url })}
                folder="brands/logos"
                label="로고"
                aspectRatio="1/1"
              />
              <ImageUpload
                value={formData.cover_image_url}
                onChange={(url) => setFormData({ ...formData, cover_image_url: url })}
                folder="brands/covers"
                label="커버 이미지"
                aspectRatio="16/9"
              />
              <ImageUpload
                value={formData.thumbnail_url}
                onChange={(url) => setFormData({ ...formData, thumbnail_url: url })}
                folder="brands/thumbnails"
                label="썸네일"
                aspectRatio="1/1"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saveLoading} className="btn-primary py-2.5 px-5 text-sm">
                {saveLoading ? "저장 중..." : "저장"}
              </button>
              <button onClick={() => setIsEditing(false)} disabled={saveLoading} className="py-2.5 px-5 rounded-lg border border-border bg-transparent text-text-secondary text-sm cursor-pointer hover:bg-bg-tertiary transition-colors">
                취소
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Cover image banner */}
            {brand.cover_image_url && (
              <div className="mb-6">
                <Image
                  src={brand.cover_image_url}
                  alt="?? ???"
                  width={1200}
                  height={675}
                  className="w-full rounded-lg object-cover"
                  style={{ aspectRatio: "16/9" }}
                />
              </div>
            )}

            <div className="flex items-center gap-4 mb-6">
              {brand.logo_url ? (
                <Image
                  src={brand.logo_url}
                  alt={brand.name}
                  width={80}
                  height={80}
                  className="w-20 h-20 rounded-xl object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-bg-tertiary flex items-center justify-center text-[40px]">
                  🏢
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold mb-2 text-foreground">{brand.name}</h2>
                <div className="text-sm text-text-secondary">역할: {brand.myRole}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              {brand.biz_name && (
                <div>
                  <div className="text-[13px] text-text-secondary mb-1">사업자명</div>
                  <div className="text-[15px] text-foreground">{brand.biz_name}</div>
                </div>
              )}
              {brand.biz_reg_no && (
                <div>
                  <div className="text-[13px] text-text-secondary mb-1">사업자등록번호</div>
                  <div className="text-[15px] text-foreground">{brand.biz_reg_no}</div>
                </div>
              )}
            </div>

            {brand.thumbnail_url && (
              <div className="mb-5">
                <div className="text-[13px] text-text-secondary mb-2">썸네일</div>
                <Image
                  src={brand.thumbnail_url}
                  alt="???"
                  width={120}
                  height={120}
                  className="w-[120px] h-[120px] object-cover rounded-lg border border-border"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div>
                <div className="text-[11px] text-text-tertiary mb-1">등록일</div>
                <div className="text-sm text-foreground">{new Date(brand.created_at).toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
