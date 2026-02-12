"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api-client";
import { useSelectedBranch } from "@/hooks/useSelectedBranch";
import BranchSelector from "@/components/admin/BranchSelector";

// ============================================================
// Types
// ============================================================

type Product = {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  createdAt: string;
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

function ProductsPageContent() {
  const searchParams = useSearchParams();
  const initialBranchId = useMemo(() => searchParams?.get("branchId") ?? "", [searchParams]);
  const { branchId, selectBranch } = useSelectedBranch();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    if (initialBranchId) selectBranch(initialBranchId);
  }, [initialBranchId, selectBranch]);

  // 상품 목록 조회
  const fetchProducts = async (bid: string) => {
    if (!bid) return;

    try {
      setLoading(true);
      setError(null);

      const data = await apiClient.get<Product[]>(`/admin/products?branchId=${encodeURIComponent(bid)}`);
      setProducts(data);
    } catch (e: unknown) {
      const err = e as Error;
      setError(err?.message ?? "상품 조회에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId: string, productName: string) => {
    if (!confirm(`"${productName}" 상품을 삭제하시겠습니까?`)) return;

    try {
      await apiClient.delete("/admin/products/" + productId);

      // ???? ??
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err?.message ?? "상품 삭제에 실패했습니다.");
    }
  };

  const handleToggleActive = async (product: Product) => {
    try {
      await apiClient.patch("/admin/products/" + product.id, {
        isActive: !product.isActive,
      });

      // ?? ????
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, isActive: !p.isActive } : p))
      );
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err?.message ?? "상품 상태 변경에 실패했습니다.");
    }
  };

  useEffect(() => {
    if (branchId) {
      fetchProducts(branchId);
    } else {
      setProducts([]);
    }
  }, [branchId]);

  // 필터된 상품
  const filteredProducts = showInactive
    ? products
    : products.filter((p) => p.isActive);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-extrabold m-0 text-foreground">상품 관리</h1>
          <p className="text-text-secondary mt-1 text-[13px]">
            총 {filteredProducts.length}개
          </p>
        </div>

        <Link href="/admin/products/new" className="no-underline">
          <button className="btn-primary h-9 px-4 text-[13px]">+ 상품 등록</button>
        </Link>
      </div>

      {/* Branch 선택 */}
      <div className="mb-4">
        <BranchSelector />
      </div>

      {/* 필터 */}
      <div className="mb-4">
        <label className="text-text-secondary text-[13px] cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="mr-1.5"
          />
          비활성 상품 표시
        </label>
      </div>

      {/* Error */}
      {error && <p className="text-danger-500 mb-4">{error}</p>}

      {!branchId && (
        <p className="text-text-tertiary mb-4">
          가게를 선택하면 상품 목록이 표시됩니다.
        </p>
      )}

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="bg-bg-tertiary">
            <tr>
              <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">상품명</th>
              <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">가격</th>
              <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">상태</th>
              <th className="text-center py-3 px-3.5 text-xs font-bold text-text-secondary">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="py-3 px-3.5 text-[13px] text-center text-text-tertiary">
                  불러오는 중...
                </td>
              </tr>
            )}

            {!loading && branchId && filteredProducts.length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 px-3.5 text-[13px] text-center text-text-tertiary">
                  상품이 없습니다.
                </td>
              </tr>
            )}

            {!loading &&
              filteredProducts.map((product) => (
                <tr key={product.id} className="border-t border-border">
                  <td className="py-3 px-3.5 text-[13px] text-foreground">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="text-foreground no-underline hover:text-primary-500 transition-colors"
                    >
                      {product.name}
                    </Link>
                  </td>
                  <td className="py-3 px-3.5 text-[13px] text-foreground text-right">{formatWon(product.price)}</td>
                  <td className="py-3 px-3.5 text-[13px]">
                    <button
                      onClick={() => handleToggleActive(product)}
                      className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold border-none cursor-pointer ${
                        product.isActive
                          ? "bg-success/20 text-success"
                          : "bg-neutral-500/20 text-text-secondary"
                      }`}
                    >
                      {product.isActive ? "판매중" : "숨김"}
                    </button>
                  </td>
                  <td className="py-3 px-3.5 text-[13px] text-center">
                    <Link href={`/admin/products/${product.id}`}>
                      <button className="py-1 px-2.5 rounded-md border border-border bg-transparent text-foreground font-medium cursor-pointer text-xs hover:bg-bg-tertiary transition-colors">
                        수정
                      </button>
                    </Link>
                    <button
                      className="py-1 px-2.5 rounded-md border border-border bg-transparent text-danger-500 font-medium cursor-pointer text-xs ml-1.5 hover:bg-bg-tertiary transition-colors"
                      onClick={() => handleDelete(product.id, product.name)}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="text-muted">로딩 중...</div>}>
      <ProductsPageContent />
    </Suspense>
  );
}
