"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabaseClient";
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

export default function ProductDetailPage() {
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

        const token = await getAccessToken();

        const res = await fetch(`${API_BASE}/admin/products/${productId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`상품 조회 실패: ${res.status} ${text}`);
        }

        const data = (await res.json()) as ProductDetail;
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
        setError(err?.message ?? "조회 실패");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId, isNew]);

  // 카테고리 조회
  useEffect(() => {
    if (!branchId) {
      setCategories([]);
      setCategoryId("");
      return;
    }

    const fetchCategories = async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch(
          `${API_BASE}/admin/products/categories?branchId=${encodeURIComponent(branchId)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`카테고리 조회 실패: ${res.status} ${text}`);
        }

        const data = (await res.json()) as ProductCategory[];
        setCategories(data.filter((item) => item.isActive));
      } catch (e: unknown) {
        const err = e as Error;
        setError(err?.message ?? "카테고리 조회 실패");
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
      const supabase = createClient();
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
      alert("상품명을 입력하세요.");
      return;
    }

    if (isNew && !branchId.trim()) {
      alert("가게를 선택하세요.");
      return;
    }

    if (!categoryId.trim()) {
      alert("카테고리를 선택하세요.");
      return;
    }

    if (price < 0) {
      alert("가격을 0 이상으로 입력하세요.");
      return;
    }

    if (!imageFile && !imageUrl) {
      alert("상품 이미지를 업로드하세요.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const token = await getAccessToken();

      if (isNew) {
        // 생성
        const res = await fetch(`${API_BASE}/admin/products`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            branchId,
            name,
            categoryId,
            description: description || null,
            price,
            imageUrl: imageUrl ?? null,
            isActive,
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`생성 실패: ${res.status} ${text}`);
        }

        const data = (await res.json()) as ProductDetail;
        const uploadedUrl = await uploadImage(data.id);
        if (uploadedUrl) {
          await fetch(`${API_BASE}/admin/products/${data.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              imageUrl: uploadedUrl,
            }),
          });
          setImageUrl(uploadedUrl);
        }
        router.push(`/admin/products/${data.id}`);
      } else {
        let uploadedUrl: string | null = imageUrl;
        if (imageFile) {
          uploadedUrl = await uploadImage(productId);
          setImageUrl(uploadedUrl);
        }
        // 수정
        const res = await fetch(`${API_BASE}/admin/products/${productId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name,
            categoryId,
            description: description || null,
            price,
            imageUrl: uploadedUrl,
            isActive,
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`수정 실패: ${res.status} ${text}`);
        }

        alert("저장되었습니다.");
      }
    } catch (e: unknown) {
      const err = e as Error;
      setError(err?.message ?? "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // Render
  // ============================================================

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "#aaa" }}>불러오는 중...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/admin/products" style={{ color: "white", textDecoration: "none" }}>
          ← 상품 목록
        </Link>

        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "10px 0 0 0" }}>
          {isNew ? "상품 등록" : "상품 수정"}
        </h1>
      </div>

      {/* Error */}
      {error && <p style={{ color: "#ff8a8a", marginBottom: 16 }}>{error}</p>}

      {/* Form */}
      <div style={{ maxWidth: 600 }}>
        {/* 가게 선택 (등록 시에만) */}
        {isNew && (
          <div style={formGroup}>
            <label style={label}>가게 선택 *</label>
            <BranchSelector />
            {!branchId && (
              <p style={{ color: "#666", marginTop: 8, fontSize: 12 }}>
                가게를 선택하면 카테고리를 불러옵니다.
              </p>
            )}
          </div>
        )}

        {/* 상품명 */}
        <div style={formGroup}>
          <label style={label}>상품명 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="상품명 입력"
            style={input}
          />
        </div>

        {/* 카테고리 */}
        <div style={formGroup}>
          <label style={label}>카테고리 *</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            style={input}
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
        <div style={formGroup}>
          <label style={label}>설명</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="상품 설명 (선택)"
            rows={3}
            style={{ ...input, height: "auto", padding: "10px 12px" }}
          />
        </div>

        {/* 상품 이미지 */}
        <div style={formGroup}>
          <label style={label}>상품 이미지 *</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)}
            style={inputFile}
          />
          {uploadingImage && (
            <p style={{ color: "#999", fontSize: 12, marginTop: 8 }}>이미지 업로드 중...</p>
          )}
          {imagePreviewUrl && (
            <img
              src={imagePreviewUrl}
              alt="상품 미리보기"
              style={{ marginTop: 12, width: "100%", maxWidth: 240, borderRadius: 12 }}
            />
          )}
        </div>

        {/* 가격 */}
        <div style={formGroup}>
          <label style={label}>가격(원)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            min={0}
            style={input}
          />
        </div>

        {/* 활성 상태 */}
        <div style={formGroup}>
          <label style={{ ...label, display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            판매 활성화
          </label>
        </div>

        {/* Buttons */}
        <div style={{ marginTop: 32, display: "flex", gap: 12 }}>
          <button onClick={handleSave} disabled={saving || uploadingImage} style={btnPrimary}>
            {saving ? "저장 중..." : isNew ? "등록" : "저장"}
          </button>
          <Link href="/admin/products">
            <button style={btnGhost}>취소</button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Styles
// ============================================================

const formGroup: React.CSSProperties = {
  marginBottom: 16,
};

const label: React.CSSProperties = {
  display: "block",
  color: "#aaa",
  fontSize: 13,
  marginBottom: 6,
};

const input: React.CSSProperties = {
  width: "100%",
  height: 40,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "#0a0a0a",
  color: "white",
  fontSize: 14,
};

const inputFile: React.CSSProperties = {
  ...input,
  padding: "8px 12px",
  height: "auto",
};

const btnPrimary: React.CSSProperties = {
  height: 40,
  padding: "0 24px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "white",
  color: "#000",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 14,
};

const btnGhost: React.CSSProperties = {
  height: 40,
  padding: "0 24px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "transparent",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 14,
};

const btnSmall: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  border: "1px solid #333",
  background: "transparent",
  color: "white",
  fontWeight: 500,
  cursor: "pointer",
  fontSize: 12,
};
