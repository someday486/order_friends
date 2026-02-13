"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api-client";
import { ImageUpload } from "@/components/ui/ImageUpload";

type Brand = {
  id: string;
  name: string;
  slug: string | null;
  biz_name: string | null;
  biz_reg_no: string | null;
  rep_name: string | null;
  address: string | null;
  biz_cert_url: string | null;
  bizCertUrl?: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  myRole: string;
  created_at: string;
};

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
    slug: "",
    biz_name: "",
    biz_reg_no: "",
    rep_name: "",
    address: "",
    bizCertUrl: null as string | null,
    logo_url: null as string | null,
    cover_image_url: null as string | null,
  });
  const [saveLoading, setSaveLoading] = useState(false);
  const [bizCertUploading, setBizCertUploading] = useState(false);
  const [bizCertUploadError, setBizCertUploadError] = useState<string | null>(null);
  const bizCertInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadBrand = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await apiClient.get<Brand>(`/customer/brands/${brandId}`);
        setBrand(data);
        setFormData({
          name: data.name || "",
          slug: data.slug || "",
          biz_name: data.biz_name || "",
          biz_reg_no: data.biz_reg_no || "",
          rep_name: data.rep_name || "",
          address: data.address || "",
          bizCertUrl: data.biz_cert_url || data.bizCertUrl || null,
          logo_url: data.logo_url || null,
          cover_image_url: data.cover_image_url || null,
        });
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "브랜드 정보를 불러올 수 없습니다");
      } finally {
        setLoading(false);
      }
    };

    if (brandId) {
      loadBrand();
    }
  }, [brandId]);

  const handleBizCertUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setBizCertUploadError("이미지 파일만 업로드할 수 있습니다");
      return;
    }

    try {
      setBizCertUploadError(null);
      setBizCertUploading(true);

      const uploadBody = new FormData();
      uploadBody.append("file", file);
      uploadBody.append("folder", "biz-certs");

      const uploaded = await apiClient.post<{ url: string; path: string; bucket: string }>(
        "/upload/image",
        uploadBody,
      );
      setFormData((prev) => ({ ...prev, bizCertUrl: uploaded.url }));
    } catch (e) {
      console.error(e);
      setBizCertUploadError(e instanceof Error ? e.message : "사업자등록증 업로드에 실패했습니다");
    } finally {
      setBizCertUploading(false);
    }
  };

  const handleBizCertFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleBizCertUpload(file);
    e.target.value = "";
  };

  const handleSave = async () => {
    try {
      setSaveLoading(true);

      const updatedBrand = await apiClient.patch<Brand>(`/customer/brands/${brandId}`, formData);
      setBrand(updatedBrand);
      setIsEditing(false);
      toast.success("브랜드 정보가 저장되었습니다.");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "브랜드 수정에 실패했습니다");
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
        <button
          onClick={() => router.back()}
          className="py-2 px-4 rounded-lg border border-border bg-transparent text-text-secondary text-sm cursor-pointer mb-6 hover:bg-bg-tertiary transition-colors"
        >
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
      <button
        onClick={() => router.back()}
        className="py-2 px-4 rounded-lg border border-border bg-transparent text-text-secondary text-sm cursor-pointer mb-6 hover:bg-bg-tertiary transition-colors"
      >
        ← 뒤로 가기
      </button>

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-extrabold m-0 text-foreground">브랜드 상세</h1>
        {canEdit && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="py-2.5 px-5 rounded-lg border border-border bg-bg-tertiary text-foreground text-sm cursor-pointer font-semibold hover:bg-bg-secondary transition-colors"
          >
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
              <label className="block text-[13px] text-text-secondary mb-2 font-semibold">브랜드 Slug</label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({ ...formData, slug: e.target.value.toLowerCase() })
                }
                className="input-field w-full"
                placeholder="brand-slug"
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

            <div className="mb-5">
              <label className="block text-[13px] text-text-secondary mb-2 font-semibold">대표자명</label>
              <input
                type="text"
                value={formData.rep_name}
                onChange={(e) => setFormData({ ...formData, rep_name: e.target.value })}
                className="input-field w-full"
                placeholder="대표자명 (선택)"
              />
            </div>

            <div className="mb-5">
              <label className="block text-[13px] text-text-secondary mb-2 font-semibold">주소</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="input-field w-full"
                placeholder="사업장 주소 (선택)"
              />
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr)] gap-4 mb-6">
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
            </div>

            <div className="mb-6">
              <label className="block text-[13px] text-text-secondary mb-2 font-semibold">사업자등록증</label>
              <div className="flex items-start gap-3">
                {formData.bizCertUrl ? (
                  <a
                    href={formData.bizCertUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block border border-border rounded-lg overflow-hidden"
                  >
                    <Image
                      src={formData.bizCertUrl}
                      alt="사업자등록증"
                      width={180}
                      height={120}
                      className="w-[180px] h-[120px] object-cover"
                    />
                  </a>
                ) : (
                  <div className="w-[180px] h-[120px] rounded-lg border border-dashed border-border bg-bg-tertiary flex items-center justify-center text-xs text-text-tertiary">
                    미리보기 없음
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <input
                    ref={bizCertInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBizCertFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => bizCertInputRef.current?.click()}
                    disabled={bizCertUploading}
                    className="py-2 px-3 rounded border border-border bg-bg-secondary text-sm text-foreground hover:bg-bg-tertiary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {bizCertUploading ? "업로드 중..." : formData.bizCertUrl ? "변경" : "파일 선택"}
                  </button>
                  {bizCertUploading && <span className="text-xs text-text-secondary">업로드 중...</span>}
                </div>
              </div>
              {bizCertUploadError && (
                <div className="text-danger-500 text-xs mt-2">{bizCertUploadError}</div>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setIsEditing(false)}
                disabled={saveLoading}
                className="py-2.5 px-5 rounded-lg border border-border bg-transparent text-text-secondary text-sm cursor-pointer hover:bg-bg-tertiary transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saveLoading}
                className="btn-primary py-2.5 px-5 text-sm"
              >
                {saveLoading ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        ) : (
          <div>
            {brand.biz_cert_url && (
              <div className="mb-5">
                <div className="text-[13px] text-text-secondary mb-2">사업자등록증</div>
                <a href={brand.biz_cert_url} target="_blank" rel="noopener noreferrer" className="inline-block">
                  <Image
                    src={brand.biz_cert_url}
                    alt="사업자등록증"
                    width={180}
                    height={120}
                    className="w-[180px] h-[120px] object-cover rounded-lg border border-border hover:opacity-90 transition-opacity"
                  />
                </a>
              </div>
            )}

            {/* Cover image banner */}
            {brand.cover_image_url && (
              <div className="mb-6">
                <div className="w-full max-w-[560px]">
                  <Image
                    src={brand.cover_image_url}
                    alt="커버 이미지"
                    width={1200}
                    height={675}
                    className="w-full rounded-lg object-cover border border-border"
                    style={{ aspectRatio: "16/9" }}
                  />
                </div>
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

            <div className="mb-5">
              <div className="text-[13px] text-text-secondary mb-2">브랜드 Slug</div>
              <div className="text-[15px] text-foreground">{brand.slug || '-'}</div>
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
              {brand.rep_name && (
                <div>
                  <div className="text-[13px] text-text-secondary mb-1">대표자명</div>
                  <div className="text-[15px] text-foreground">{brand.rep_name}</div>
                </div>
              )}
              {brand.address && (
                <div>
                  <div className="text-[13px] text-text-secondary mb-1">주소</div>
                  <div className="text-[15px] text-foreground">{brand.address}</div>
                </div>
              )}
            </div>

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