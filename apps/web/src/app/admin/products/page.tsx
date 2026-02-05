"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
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

      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/admin/products?branchId=${encodeURIComponent(bid)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`상품 목록 조회 실패: ${res.status} ${text}`);
      }

      const data = (await res.json()) as Product[];
      setProducts(data);
    } catch (e: unknown) {
      const err = e as Error;
      setError(err?.message ?? "조회 실패");
    } finally {
      setLoading(false);
    }
  };

  // 상품 삭제
  const handleDelete = async (productId: string, productName: string) => {
    if (!confirm(`"${productName}" 상품을 삭제하시겠습니까?`)) return;

    try {
      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/admin/products/${productId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`삭제 실패: ${res.status} ${text}`);
      }

      // 목록에서 제거
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    } catch (e: unknown) {
      const err = e as Error;
      alert(err?.message ?? "삭제 실패");
    }
  };

  // 활성/비활성 토글
  const handleToggleActive = async (product: Product) => {
    try {
      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/admin/products/${product.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !product.isActive }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`상태 변경 실패: ${res.status} ${text}`);
      }

      // 목록 업데이트
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, isActive: !p.isActive } : p))
      );
    } catch (e: unknown) {
      const err = e as Error;
      alert(err?.message ?? "상태 변경 실패");
    }
  };

  // branchId 변경 시 조회
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>상품 관리</h1>
          <p style={{ color: "#aaa", margin: "4px 0 0 0", fontSize: 13 }}>
            총 {filteredProducts.length}개
          </p>
        </div>

        <Link href="/admin/products/new" style={{ textDecoration: "none" }}>
          <button style={btnPrimary}>+ 상품 등록</button>
        </Link>
      </div>

      {/* Branch 선택 */}
      <div style={{ marginBottom: 16 }}>
        <BranchSelector />
      </div>

      {/* 필터 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ color: "#aaa", fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          비활성 상품 표시
        </label>
      </div>

      {/* Error */}
      {error && <p style={{ color: "#ff8a8a", marginBottom: 16 }}>{error}</p>}

      {!branchId && (
        <p style={{ color: "#666", marginBottom: 16 }}>
          가게를 선택하면 상품 목록이 표시됩니다.
        </p>
      )}

      {/* Table */}
      <div
        style={{
          border: "1px solid #222",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#0f0f0f" }}>
            <tr>
              <th style={th}>상품명</th>
              <th style={{ ...th, textAlign: "right" }}>가격</th>
              <th style={th}>상태</th>
              <th style={{ ...th, textAlign: "center" }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} style={{ ...td, textAlign: "center", color: "#666" }}>
                  불러오는 중...
                </td>
              </tr>
            )}

            {!loading && branchId && filteredProducts.length === 0 && (
              <tr>
                <td colSpan={4} style={{ ...td, textAlign: "center", color: "#666" }}>
                  상품이 없습니다.
                </td>
              </tr>
            )}

            {!loading &&
              filteredProducts.map((product) => (
                <tr key={product.id} style={{ borderTop: "1px solid #222" }}>
                  <td style={td}>
                    <Link
                      href={`/admin/products/${product.id}`}
                      style={{ color: "white", textDecoration: "none" }}
                    >
                      {product.name}
                    </Link>
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>{formatWon(product.price)}</td>
                  <td style={td}>
                    <button
                      onClick={() => handleToggleActive(product)}
                      style={{
                        ...statusBadge,
                        background: product.isActive ? "#10b98120" : "#6b728020",
                        color: product.isActive ? "#10b981" : "#6b7280",
                      }}
                    >
                      {product.isActive ? "판매중" : "숨김"}
                    </button>
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <Link href={`/admin/products/${product.id}`}>
                      <button style={btnSmall}>수정</button>
                    </Link>
                    <button
                      style={{ ...btnSmall, color: "#ef4444", marginLeft: 6 }}
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

// ============================================================
// Styles
// ============================================================

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  fontSize: 12,
  fontWeight: 700,
  color: "#aaa",
};

const td: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: 13,
  color: "white",
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

const statusBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 24,
  padding: "0 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  border: "none",
  cursor: "pointer",
};

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="text-muted">로딩 중...</div>}>
      <ProductsPageContent />
    </Suspense>
  );
}
