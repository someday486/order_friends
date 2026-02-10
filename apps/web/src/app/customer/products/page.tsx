"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Image from "next/image";
import { apiClient } from "@/lib/api-client";

// ============================================================
// Types
// ============================================================

type Product = {
  id: string;
  branch_id: string;
  name: string;
  description?: string | null;
  category_id?: string | null;
  price: number;
  base_price?: number;
  is_active?: boolean;
  is_hidden?: boolean;
  sort_order?: number;
  image_url?: string | null;
  created_at: string;
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

// ============================================================
// Helpers
// ============================================================

function formatWon(amount: number) {
  return amount.toLocaleString("ko-KR") + "원";
}

// ============================================================
// Component
// ============================================================

export default function CustomerProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Reorder mode
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [reorderList, setReorderList] = useState<Product[]>([]);
  const [reorderSaving, setReorderSaving] = useState(false);

  // Load branches
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const data = await apiClient.get<Branch[]>("/customer/branches");
        setBranches(data);
        if (data.length > 0) {
          setSelectedBranchId(data[0].id);
        }
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "?? ?? ?? ? ?? ??");
      }
    };

    loadBranches();
  }, []);

  // Load products when branch changes
  useEffect(() => {
    const loadProducts = async () => {
      if (!selectedBranchId) return;

      try {
        setLoading(true);
        setError(null);

        const data = await apiClient.get<Product[]>(`/customer/products?branchId=${encodeURIComponent(selectedBranchId)}`);
        setProducts(data);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "?? ?? ?? ? ?? ??");
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [selectedBranchId, branches]);

  const canManageProducts = userRole === "OWNER" || userRole === "ADMIN";

  // Enter reorder mode
  const enterReorderMode = () => {
    setReorderList([...products]);
    setIsReorderMode(true);
  };

  // Cancel reorder
  const cancelReorder = () => {
    setIsReorderMode(false);
    setReorderList([]);
  };

  // Move product up/down
  const moveProduct = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= reorderList.length) return;

    const newList = [...reorderList];
    [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
    setReorderList(newList);
  };

  // Save reorder
  const saveReorder = async () => {
    try {
      setReorderSaving(true);

      const items = reorderList.map((p, idx) => ({
        id: p.id,
        sortOrder: idx,
      }));

      const data = await apiClient.patch<Product[]>("/customer/products/reorder", {
        branchId: selectedBranchId,
        items,
      });

      setProducts(data);
      setIsReorderMode(false);
      setReorderList([]);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "?? ?? ? ?? ??");
    } finally {
      setReorderSaving(false);
    }
  };


  if (loading && branches.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold mb-8 text-foreground">상품 관리</h1>
        <div className="text-text-secondary">로딩 중...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-extrabold m-0 text-foreground">상품 관리</h1>
        <div className="flex gap-2">
          {canManageProducts && selectedBranchId && !isReorderMode && products.length > 1 && (
            <button
              onClick={enterReorderMode}
              className="px-4 py-2.5 text-sm rounded-lg border border-border bg-bg-secondary text-foreground hover:bg-bg-tertiary transition-colors"
            >
              순서 편집
            </button>
          )}
          {canManageProducts && selectedBranchId && !isReorderMode && (
            <Link href={`/customer/products/new?branchId=${selectedBranchId}`} className="no-underline">
              <button className="btn-primary px-5 py-2.5 text-sm">+ 상품 추가</button>
            </Link>
          )}
        </div>
      </div>

      {/* Branch Filter */}
      {!isReorderMode && (
        <div className="mb-6">
          <label className="block text-sm text-text-secondary mb-2 font-semibold">매장 선택</label>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="input-field max-w-[400px]"
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

      {error && <div className="border border-danger-500 rounded-md p-4 bg-danger-500/10 text-danger-500 mb-4">{error}</div>}

      {/* Reorder Mode */}
      {isReorderMode ? (
        <div>
          <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-primary-500/10 border border-primary-500/30">
            <span className="text-sm font-semibold text-foreground">
              화살표를 눌러 순서를 변경하세요
            </span>
            <div className="flex gap-2">
              <button
                onClick={cancelReorder}
                disabled={reorderSaving}
                className="px-4 py-2 text-sm rounded-lg border border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary transition-colors"
              >
                취소
              </button>
              <button
                onClick={saveReorder}
                disabled={reorderSaving}
                className="btn-primary px-4 py-2 text-sm"
              >
                {reorderSaving ? "저장 중..." : "순서 저장"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {reorderList.map((product, index) => (
              <div
                key={product.id}
                className="flex items-center gap-3 p-3 rounded-md border border-border bg-bg-secondary"
              >
                {/* Order number */}
                <span className="w-8 h-8 flex items-center justify-center rounded-full bg-bg-tertiary text-sm font-bold text-text-secondary flex-shrink-0">
                  {index + 1}
                </span>

                {/* Product image */}
                {product.image_url ? (
                  <Image
                  src={product.image_url}
                  alt={product.name}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded object-cover flex-shrink-0"
                />
                ) : (
                  <div className="w-12 h-12 rounded bg-bg-tertiary flex items-center justify-center text-lg flex-shrink-0">
                    📦
                  </div>
                )}

                {/* Product info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-foreground truncate">{product.name}</div>
                  <div className="text-xs text-text-secondary">{formatWon(product.base_price ?? product.price ?? 0)}</div>
                </div>

                {/* Up/Down buttons */}
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button
                    onClick={() => moveProduct(index, "up")}
                    disabled={index === 0}
                    className={`w-8 h-8 flex items-center justify-center rounded border text-sm transition-colors ${
                      index === 0
                        ? "border-border bg-bg-tertiary text-text-tertiary cursor-not-allowed"
                        : "border-border bg-bg-secondary text-foreground hover:bg-bg-tertiary cursor-pointer"
                    }`}
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveProduct(index, "down")}
                    disabled={index === reorderList.length - 1}
                    className={`w-8 h-8 flex items-center justify-center rounded border text-sm transition-colors ${
                      index === reorderList.length - 1
                        ? "border-border bg-bg-tertiary text-text-tertiary cursor-not-allowed"
                        : "border-border bg-bg-secondary text-foreground hover:bg-bg-tertiary cursor-pointer"
                    }`}
                  >
                    ▼
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : branches.length === 0 ? (
        <div className="card p-12 text-center text-text-tertiary">
          <div className="text-base mb-2">등록된 매장이 없습니다</div>
          <div className="text-sm">먼저 매장을 등록해주세요</div>
        </div>
      ) : !selectedBranchId ? (
        <div className="card p-12 text-center text-text-tertiary">
          <div className="text-base mb-2">매장을 선택하세요</div>
          <div className="text-sm">위에서 매장을 선택하면 상품 목록이 표시됩니다</div>
        </div>
      ) : loading ? (
        <div className="card p-12 text-center text-text-secondary">로딩 중...</div>
      ) : products.length === 0 ? (
        <div className="card p-12 text-center text-text-tertiary">
          <div className="text-base mb-2">등록된 상품이 없습니다</div>
          {canManageProducts && (
            <div className="text-sm">상품 추가 버튼을 클릭하여 상품을 등록하세요</div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {products.map((product) => (
            <CustomerProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Sub Components
// ============================================================

function CustomerProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/customer/products/${product.id}`}
      className="block p-4 rounded-md border border-border bg-bg-secondary text-foreground no-underline transition-colors hover:bg-bg-tertiary"
    >
      {product.image_url && (
        <Image
        src={product.image_url}
        alt={product.name}
        width={480}
        height={160}
        className="w-full h-40 rounded object-cover mb-3"
      />
      )}
      <div className="font-bold text-base mb-2">{product.name}</div>
      <div className="text-lg font-extrabold text-foreground mb-2">{formatWon(product.base_price ?? product.price ?? 0)}</div>
      <div className="flex justify-between items-center mt-3">
        <span
          className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold ${
            (product.is_active ?? !product.is_hidden)
              ? "bg-success/20 text-success"
              : "bg-neutral-500/20 text-text-secondary"
          }`}
        >
          {(product.is_active ?? !product.is_hidden) ? "판매중" : "숨김"}
        </span>
      </div>
      <div className="text-2xs text-text-tertiary mt-2">
        등록일: {new Date(product.created_at).toLocaleDateString()}
      </div>
    </Link>
  );
}
