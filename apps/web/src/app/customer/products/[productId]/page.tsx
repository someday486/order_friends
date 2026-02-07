"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

// ============================================================
// Types
// ============================================================

type Product = {
  id: string;
  branchId: string;
  name: string;
  categoryId?: string | null;
  category?: string | null;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  isActive: boolean;
  options?: unknown[];
  createdAt: string;
  updatedAt: string;
};

type ProductCategory = {
  id: string;
  branchId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

type Branch = {
  id: string;
  name: string;
  brandId: string;
  myRole: string;
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

function formatWon(amount: number) {
  return amount.toLocaleString("ko-KR") + "원";
}

// ============================================================
// Component
// ============================================================

function ProductDetailPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = params?.productId as string;
  const isNew = productId === "new";
  const initialBranchId = searchParams?.get("branchId") ?? "";

  const [product, setProduct] = useState<Product | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(isNew);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    branchId: initialBranchId,
    name: "",
    categoryId: "",
    description: "",
    price: 0,
    imageUrl: "",
    isActive: true,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [userRole, setUserRole] = useState<string | null>(null);

  // Load branches
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const token = await getAccessToken();

        const res = await fetch(`${API_BASE}/customer/branches`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`매장 목록 조회 실패: ${res.status}`);
        }

        const data = await res.json();
        setBranches(data);

        // If new product, set first branch as default
        if (isNew && data.length > 0 && !initialBranchId) {
          setFormData((prev) => ({ ...prev, branchId: data[0].id }));
          setUserRole(data[0].myRole);
        }
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "매장 목록 조회 중 오류 발생");
      }
    };

    loadBranches();
  }, [isNew, initialBranchId]);

  // Load product (edit mode)
  useEffect(() => {
    if (isNew) return;

    const loadProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = await getAccessToken();

        const res = await fetch(`${API_BASE}/customer/products/${productId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`상품 조회 실패: ${res.status}`);
        }

        const data = await res.json();
        setProduct(data);
        setFormData({
          branchId: data.branchId || "",
          name: data.name || "",
          categoryId: data.categoryId || "",
          description: data.description || "",
          price: data.price || 0,
          imageUrl: data.imageUrl || "",
          isActive: data.isActive ?? true,
        });
        setImagePreviewUrl(data.imageUrl || null);

        // Get branch role
        const token2 = await getAccessToken();
        const branchRes = await fetch(`${API_BASE}/customer/branches`, {
          headers: {
            Authorization: `Bearer ${token2}`,
          },
        });
        if (branchRes.ok) {
          const branchesData = await branchRes.json();
          const branch = branchesData.find((b: Branch) => b.id === data.branchId);
          if (branch) {
            setUserRole(branch.myRole);
          }
        }
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "상품 조회 중 오류 발생");
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [productId, isNew]);

  // Load categories when branch changes
  useEffect(() => {
    if (!formData.branchId) {
      setCategories([]);
      return;
    }

    const loadCategories = async () => {
      try {
        const token = await getAccessToken();

        const res = await fetch(
          `${API_BASE}/customer/products/categories?branchId=${encodeURIComponent(formData.branchId)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (res.ok) {
          const data = await res.json();
          setCategories(data.filter((c: ProductCategory) => c.isActive));
        }
      } catch (e) {
        console.error(e);
      }
    };

    loadCategories();
  }, [formData.branchId]);

  const handleImageChange = (file: File | null) => {
    setImageFile(file);
    if (imagePreviewUrl && !formData.imageUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setImagePreviewUrl(previewUrl);
    } else {
      setImagePreviewUrl(formData.imageUrl || null);
    }
  };

  const uploadImage = async (productIdForUpload: string) => {
    if (!imageFile || !formData.branchId) return formData.imageUrl;
    setUploadingImage(true);

    try {
      const supabase = createClient();
      const timestamp = Date.now();
      const extension = imageFile.name.split(".").pop() || "png";
      const filePath = `${formData.branchId}/${productIdForUpload}/main-${timestamp}.${extension}`;

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

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert("상품명을 입력하세요");
      return;
    }

    if (!formData.branchId) {
      alert("매장을 선택하세요");
      return;
    }

    if (!formData.categoryId) {
      alert("카테고리를 선택하세요");
      return;
    }

    if (formData.price < 0) {
      alert("가격을 0 이상으로 입력하세요");
      return;
    }

    try {
      setSaveLoading(true);
      setError(null);
      const token = await getAccessToken();

      if (isNew) {
        // Create product
        const res = await fetch(`${API_BASE}/customer/products`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            branchId: formData.branchId,
            name: formData.name,
            categoryId: formData.categoryId,
            description: formData.description || null,
            price: formData.price,
            imageUrl: formData.imageUrl || null,
            isActive: formData.isActive,
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`상품 등록 실패: ${res.status} ${text}`);
        }

        const data = await res.json();

        // Upload image if provided
        if (imageFile) {
          const uploadedUrl = await uploadImage(data.id);
          if (uploadedUrl) {
            await fetch(`${API_BASE}/customer/products/${data.id}`, {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                imageUrl: uploadedUrl,
              }),
            });
          }
        }

        alert("상품이 등록되었습니다");
        router.push(`/customer/products/${data.id}`);
      } else {
        // Update product
        let uploadedUrl = formData.imageUrl;
        if (imageFile) {
          uploadedUrl = await uploadImage(productId);
        }

        const res = await fetch(`${API_BASE}/customer/products/${productId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: formData.name,
            categoryId: formData.categoryId,
            description: formData.description || null,
            price: formData.price,
            imageUrl: uploadedUrl,
            isActive: formData.isActive,
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`상품 수정 실패: ${res.status} ${text}`);
        }

        const updated = await res.json();
        setProduct(updated);
        setFormData({
          branchId: updated.branchId || "",
          name: updated.name || "",
          categoryId: updated.categoryId || "",
          description: updated.description || "",
          price: updated.price || 0,
          imageUrl: updated.imageUrl || "",
          isActive: updated.isActive ?? true,
        });
        setImagePreviewUrl(updated.imageUrl || null);
        setIsEditing(false);
        alert("상품 정보가 수정되었습니다");
      }
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "저장 중 오류 발생");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`"${product?.name}" 상품을 삭제하시겠습니까?`)) return;

    try {
      setDeleteLoading(true);
      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/customer/products/${productId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`상품 삭제 실패: ${res.status} ${text}`);
      }

      alert("상품이 삭제되었습니다");
      router.push("/customer/products");
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "삭제 중 오류 발생");
    } finally {
      setDeleteLoading(false);
    }
  };

  const canEdit = userRole === "OWNER" || userRole === "ADMIN";

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold mb-8 text-foreground">상품 상세</h1>
        <div className="text-text-secondary">로딩 중...</div>
      </div>
    );
  }

  if (error || (!isNew && !product)) {
    return (
      <div>
        <button onClick={() => router.back()} className="py-2 px-4 rounded-lg border border-border bg-transparent text-text-secondary text-sm cursor-pointer mb-6 hover:bg-bg-tertiary transition-colors">
          ← 뒤로 가기
        </button>
        <h1 className="text-2xl font-extrabold mb-4 text-foreground">상품 상세</h1>
        <div className="border border-danger-500 rounded-xl p-4 bg-danger-500/10 text-danger-500">
          {error || "상품을 찾을 수 없습니다"}
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
        <h1 className="text-2xl font-extrabold m-0 text-foreground">
          {isNew ? "상품 등록" : isEditing ? "상품 수정" : "상품 상세"}
        </h1>
        {!isNew && canEdit && !isEditing && (
          <div className="flex gap-3">
            <button onClick={() => setIsEditing(true)} className="py-2.5 px-5 rounded-lg border border-border bg-bg-tertiary text-foreground text-sm cursor-pointer font-semibold hover:bg-bg-secondary transition-colors">
              수정하기
            </button>
            <button onClick={handleDelete} disabled={deleteLoading} className="py-2.5 px-5 rounded-lg border border-danger-500 bg-transparent text-danger-500 text-sm cursor-pointer font-semibold hover:bg-danger-500/10 transition-colors">
              {deleteLoading ? "삭제 중..." : "삭제"}
            </button>
          </div>
        )}
      </div>

      <div className="card p-6">
        {isEditing ? (
          <div>
            {/* Branch selection (only for new products) */}
            {isNew && (
              <div className="mb-5">
                <label className="block text-[13px] text-text-secondary mb-2 font-semibold">매장 선택 *</label>
                <select
                  value={formData.branchId}
                  onChange={(e) => {
                    setFormData({ ...formData, branchId: e.target.value });
                    const branch = branches.find((b) => b.id === e.target.value);
                    if (branch) {
                      setUserRole(branch.myRole);
                    }
                  }}
                  className="input-field w-full"
                >
                  <option value="">매장을 선택하세요</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-5">
              <label className="block text-[13px] text-text-secondary mb-2 font-semibold">상품명 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-field w-full"
                placeholder="상품명을 입력하세요"
              />
            </div>

            <div className="mb-5">
              <label className="block text-[13px] text-text-secondary mb-2 font-semibold">카테고리 *</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
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

            <div className="mb-5">
              <label className="block text-[13px] text-text-secondary mb-2 font-semibold">설명</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input-field w-full min-h-[100px] resize-y"
                placeholder="상품 설명을 입력하세요"
              />
            </div>

            <div className="mb-5">
              <label className="block text-[13px] text-text-secondary mb-2 font-semibold">가격(원) *</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                className="input-field w-full"
                min={0}
              />
            </div>

            <div className="mb-5">
              <label className="block text-[13px] text-text-secondary mb-2 font-semibold">상품 이미지</label>
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
                <img
                  src={imagePreviewUrl}
                  alt="상품 미리보기"
                  className="mt-3 w-full max-w-[240px] rounded-xl"
                />
              )}
            </div>

            <div className="mb-6">
              <label className="flex items-center gap-2 text-[13px] text-text-secondary font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                판매 활성화
              </label>
            </div>

            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saveLoading || uploadingImage} className="btn-primary py-2.5 px-5 text-sm">
                {saveLoading ? "저장 중..." : isNew ? "등록" : "저장"}
              </button>
              {!isNew && (
                <button
                  onClick={() => {
                    setIsEditing(false);
                    if (product) {
                      setFormData({
                        branchId: product.branchId || "",
                        name: product.name || "",
                        categoryId: product.categoryId || "",
                        description: product.description || "",
                        price: product.price || 0,
                        imageUrl: product.imageUrl || "",
                        isActive: product.isActive ?? true,
                      });
                      setImagePreviewUrl(product.imageUrl || null);
                    }
                  }}
                  disabled={saveLoading}
                  className="py-2.5 px-5 rounded-lg border border-border bg-transparent text-text-secondary text-sm cursor-pointer hover:bg-bg-tertiary transition-colors"
                >
                  취소
                </button>
              )}
            </div>
          </div>
        ) : (
          product && (
            <div>
              {product.imageUrl && (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full max-w-[400px] rounded-xl object-cover mb-6"
                />
              )}

              <h2 className="text-xl font-bold mb-4 text-foreground">{product.name}</h2>

              <div className="mb-5">
                <div className="text-[13px] text-text-secondary mb-2">가격</div>
                <div className="text-2xl text-foreground font-bold">{formatWon(product.price)}</div>
              </div>

              {product.category && (
                <div className="mb-5">
                  <div className="text-[13px] text-text-secondary mb-2">카테고리</div>
                  <div className="text-[15px] text-foreground">{product.category}</div>
                </div>
              )}

              {product.description && (
                <div className="mb-5">
                  <div className="text-[13px] text-text-secondary mb-2">설명</div>
                  <div className="text-[15px] text-foreground leading-relaxed">{product.description}</div>
                </div>
              )}

              <div className="mb-5">
                <div className="text-[13px] text-text-secondary mb-2">판매 상태</div>
                <div
                  className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold ${
                    product.isActive ? "bg-success/20 text-success" : "bg-neutral-500/20 text-text-secondary"
                  }`}
                >
                  {product.isActive ? "판매중" : "숨김"}
                </div>
              </div>

              {product.options && product.options.length > 0 && (
                <div className="mb-5">
                  <div className="text-[13px] text-text-secondary mb-2">옵션</div>
                  <div className="text-[15px] text-foreground">{product.options.length}개 옵션 사용 가능</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div>
                  <div className="text-[11px] text-text-tertiary mb-1">등록일</div>
                  <div className="text-sm text-foreground">{new Date(product.createdAt).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[11px] text-text-tertiary mb-1">수정일</div>
                  <div className="text-sm text-foreground">{new Date(product.updatedAt).toLocaleString()}</div>
                </div>
              </div>
            </div>
          )
        )}
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
