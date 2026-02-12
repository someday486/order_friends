"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api-client";
import { useSelectedBranch } from "@/hooks/useSelectedBranch";
import BranchSelector from "@/components/admin/BranchSelector";

// ============================================================
// Types
// ============================================================

type ProductDetail = {
  id: string;
  branchId: string;
  name: string;
  categoryId?: string | null;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  isActive: boolean;
  sortOrder?: number;
  options?: unknown[];
};

type ProductCategory = {
  id: string;
  branchId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
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

function ProductDetailPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialBranchId = useMemo(() => searchParams?.get("branchId") ?? "", [searchParams]);
  const { branchId: selectedBranchId, selectBranch } = useSelectedBranch();
  const productId = params?.productId as string;
  const isNew = productId === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [branchId, setBranchId] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [categories, setCategories] = useState<ProductCategory[]>([]);

  useEffect(() => {
    if (initialBranchId) selectBranch(initialBranchId);
  }, [initialBranchId, selectBranch]);

  useEffect(() => {
    if (isNew && selectedBranchId) {
      setBranchId(selectedBranchId);
    }
  }, [isNew, selectedBranchId]);

  // 상품 상세 조회 (수정 모드)
  useEffect(() => {
    if (isNew) return;

    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await apiClient.get<ProductDetail>(`/admin/products/${productId}`);
        setBranchId(data.branchId);
        setName(data.name);
        setCategoryId(data.categoryId ?? "");
        setDescription(data.description ?? "");
        setPrice(data.price);
        setImageUrl(data.imageUrl ?? null);
        setImagePreviewUrl(data.imageUrl ?? null);
        setIsActive(data.isActive);
      } catch (e: unknown) {
        const err = e as Error;
        setError(err?.message ?? "?? ??");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId, isNew]);

  // ???? ??
  useEffect(() => {
    if (!branchId) {
      setCategories([]);
      setCategoryId("");
      return;
    }

    const fetchCategories = async () => {
      try {
        const data = await apiClient.get<ProductCategory[]>(`/admin/products/categories?branchId=${encodeURIComponent(branchId)}`);
        setCategories(data.filter((item) => item.isActive));
      } catch (e: unknown) {
        const err = e as Error;
        setError(err?.message ?? "???? ?? ??");
      }
    };

    fetchCategories();
  }, [branchId]);

  const handleImageChange = (file: File | null) => {
    setImageFile(file);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setImagePreviewUrl(previewUrl);
    } else {
      setImagePreviewUrl(imageUrl ?? null);
    }
  };

  const uploadImage = async (productIdForUpload: string) => {
    if (!imageFile || !branchId) return imageUrl;
    setUploadingImage(true);

    try {
      const supabase = supabaseBrowser;
      const timestamp = Date.now();
      const extension = imageFile.name.split(".").pop() || "png";
      const filePath = `${branchId}/${productIdForUpload}/main-${timestamp}.${extension}`;

      const { error } = await supabase.storage
        .from("product-images")
        .upload(filePath, imageFile, { upsert: true });

      if (error) {
        throw new Error(`이미지 업로드 실패: ${error.message}`);
      }

      const { data } = supabase.storage.from("product-images").getPublicUrl(filePath);
      return data.publicUrl;
    } finally {
      setUploadingImage(false);
    }
  };

  // 저장
  const handleSave = async () => {
    if (!name.trim()) {
      alert("???? ??????");
      return;
    }

    if (isNew && !branchId.trim()) {
      alert("??? ??????");
      return;
    }

    if (!categoryId.trim()) {
      alert("????? ??????");
      return;
    }

    if (price < 0) {
      alert("??? 0 ???? ??????");
      return;
    }

    if (!imageFile && !imageUrl) {
      alert("?? ???? ???????.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (isNew) {
        const data = await apiClient.post<ProductDetail>("/admin/products", {
          branchId,
          name,
          categoryId,
          description: description || null,
          price,
          imageUrl: imageUrl ?? null,
          isActive,
        });

        const uploadedUrl = await uploadImage(data.id);
        if (uploadedUrl) {
          await apiClient.patch("/admin/products/" + data.id, {
            imageUrl: uploadedUrl,
          });
          setImageUrl(uploadedUrl);
        }
        router.push("/admin/products/" + data.id);
      } else {
        let uploadedUrl: string | null = imageUrl;
        if (imageFile) {
          uploadedUrl = await uploadImage(productId);
          setImageUrl(uploadedUrl);
        }

        await apiClient.patch("/admin/products/" + productId, {
          name,
          categoryId,
          description: description || null,
          price,
          imageUrl: uploadedUrl,
          isActive,
        });

        alert("???????.");
      }
    } catch (e: unknown) {
      const err = e as Error;
      setError(err?.message ?? "?? ??");
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // Render
  // ============================================================

  if (loading) {
    return (
      <div>
        <p className="text-text-secondary">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href="/admin/products" className="text-foreground no-underline hover:text-primary-500 transition-colors">
          ← 상품 목록
        </Link>

        <h1 className="text-[22px] font-extrabold mt-2.5 text-foreground">
          {isNew ? "상품 등록" : "상품 수정"}
        </h1>
      </div>

      {/* Error */}
      {error && <p className="text-danger-500 mb-4">{error}</p>}

      {/* Form */}
      <div className="max-w-[600px]">
        {/* 가게 선택 (등록 시에만) */}
        {isNew && (
          <div className="mb-4">
            <label className="block text-text-secondary text-[13px] mb-1.5">가게 선택 *</label>
            <BranchSelector />
            {!branchId && (
              <p className="text-text-tertiary mt-2 text-xs">
                가게를 선택하면 카테고리를 불러옵니다.
              </p>
            )}
          </div>
        )}

        {/* 상품명 */}
        <div className="mb-4">
          <label className="block text-text-secondary text-[13px] mb-1.5">상품명 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="상품명 입력"
            className="input-field w-full"
          />
        </div>

        {/* 카테고리 */}
        <div className="mb-4">
          <label className="block text-text-secondary text-[13px] mb-1.5">카테고리 *</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="input-field w-full"
          >
            <option value="">카테고리 선택</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {/* 설명 */}
        <div className="mb-4">
          <label className="block text-text-secondary text-[13px] mb-1.5">설명</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="상품 설명 (선택)"
            rows={3}
            className="input-field w-full h-auto py-2.5 px-3"
          />
        </div>

        {/* 상품 이미지 */}
        <div className="mb-4">
          <label className="block text-text-secondary text-[13px] mb-1.5">상품 이미지 *</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)}
            className="input-field w-full h-auto py-2 px-3"
          />
          {uploadingImage && (
            <p className="text-text-tertiary text-xs mt-2">이미지 업로드 중...</p>
          )}
          {imagePreviewUrl && (
            <Image
              src={imagePreviewUrl}
              alt="?? ????"
              width={240}
              height={240}
              className="mt-3 w-full max-w-[240px] rounded-xl h-auto"
              unoptimized
            />
          )}
        </div>

        {/* 가격 */}
        <div className="mb-4">
          <label className="block text-text-secondary text-[13px] mb-1.5">가격(원)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            min={0}
            className="input-field w-full"
          />
        </div>

        {/* 활성 상태 */}
        <div className="mb-4">
          <label className="flex items-center gap-2 text-text-secondary text-[13px] cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            판매 활성화
          </label>
        </div>

        {/* Buttons */}
        <div className="mt-8 flex gap-3">
          <button onClick={handleSave} disabled={saving || uploadingImage} className="btn-primary h-10 px-6 text-sm">
            {saving ? "저장 중..." : isNew ? "등록" : "저장"}
          </button>
          <Link href="/admin/products">
            <button className="h-10 px-6 rounded-lg border border-border bg-transparent text-foreground font-semibold cursor-pointer text-sm hover:bg-bg-tertiary transition-colors">
              취소
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ProductDetailPage() {
  return (
    <Suspense fallback={<div className="text-muted">로딩 중...</div>}>
      <ProductDetailPageContent />
    </Suspense>
  );
}
