"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

// ============================================================
// Types
// ============================================================

type Product = {
  id: string;
  name: string;
  price: number;
  category?: string | null;
  status: string;
  isActive: boolean;
  options?: unknown[];
  imageUrl?: string | null;
  createdAt: string;
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

export default function CustomerProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

        // Set first branch as default if available
        if (data.length > 0) {
          setSelectedBranchId(data[0].id);
          setUserRole(data[0].myRole);
        }
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "매장 목록 조회 중 오류 발생");
      }
    };

    loadBranches();
  }, []);

  // Load products when branch changes
  useEffect(() => {
    const loadProducts = async () => {
      if (!selectedBranchId) {
        setProducts([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const token = await getAccessToken();

        const res = await fetch(`${API_BASE}/customer/products?branchId=${encodeURIComponent(selectedBranchId)}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`상품 목록 조회 실패: ${res.status}`);
        }

        const data = await res.json();
        setProducts(data);

        // Update role based on selected branch
        const branch = branches.find((b) => b.id === selectedBranchId);
        if (branch) {
          setUserRole(branch.myRole);
        }
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "상품 목록 조회 중 오류 발생");
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [selectedBranchId, branches]);

  const canManageProducts = userRole === "OWNER" || userRole === "ADMIN";

  if (loading && branches.length === 0) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 32 }}>상품 관리</h1>
        <div>로딩 중...</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>상품 관리</h1>
        {canManageProducts && selectedBranchId && (
          <Link href={`/customer/products/new?branchId=${selectedBranchId}`} style={{ textDecoration: "none" }}>
            <button style={addButton}>+ 상품 추가</button>
          </Link>
        )}
      </div>

      {/* Branch Filter */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>매장 선택</label>
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          style={selectStyle}
        >
          <option value="">매장을 선택하세요</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      {branches.length === 0 ? (
        <div style={emptyBox}>
          <div style={{ fontSize: 16, marginBottom: 8 }}>등록된 매장이 없습니다</div>
          <div style={{ fontSize: 13, color: "#666" }}>먼저 매장을 등록해주세요</div>
        </div>
      ) : !selectedBranchId ? (
        <div style={emptyBox}>
          <div style={{ fontSize: 16, marginBottom: 8 }}>매장을 선택하세요</div>
          <div style={{ fontSize: 13, color: "#666" }}>위에서 매장을 선택하면 상품 목록이 표시됩니다</div>
        </div>
      ) : loading ? (
        <div style={emptyBox}>로딩 중...</div>
      ) : products.length === 0 ? (
        <div style={emptyBox}>
          <div style={{ fontSize: 16, marginBottom: 8 }}>등록된 상품이 없습니다</div>
          {canManageProducts && (
            <div style={{ fontSize: 13, color: "#666" }}>상품 추가 버튼을 클릭하여 상품을 등록하세요</div>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Sub Components
// ============================================================

function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/customer/products/${product.id}`} style={productCardStyle}>
      {product.imageUrl && (
        <img
          src={product.imageUrl}
          alt={product.name}
          style={{ width: "100%", height: 160, borderRadius: 8, objectFit: "cover", marginBottom: 12 }}
        />
      )}
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{product.name}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 8 }}>{formatWon(product.price)}</div>
      {product.category && (
        <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>카테고리: {product.category}</div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <div
          style={{
            ...statusBadge,
            background: product.isActive ? "#10b98120" : "#6b728020",
            color: product.isActive ? "#10b981" : "#6b7280",
          }}
        >
          {product.isActive ? "판매중" : "숨김"}
        </div>
        {product.options && product.options.length > 0 && (
          <div style={{ fontSize: 11, color: "#666" }}>옵션 {product.options.length}개</div>
        )}
      </div>
      <div style={{ fontSize: 11, color: "#666", marginTop: 8 }}>
        등록일: {new Date(product.createdAt).toLocaleDateString()}
      </div>
    </Link>
  );
}

// ============================================================
// Styles
// ============================================================

const addButton: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 8,
  border: "none",
  background: "#0070f3",
  color: "#fff",
  fontSize: 14,
  cursor: "pointer",
  fontWeight: 600,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "#aaa",
  marginBottom: 8,
  fontWeight: 600,
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 400,
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "#1a1a1a",
  color: "#fff",
  fontSize: 14,
  outline: "none",
};

const productCardStyle: React.CSSProperties = {
  display: "block",
  padding: 16,
  borderRadius: 12,
  border: "1px solid #222",
  background: "#0f0f0f",
  color: "white",
  textDecoration: "none",
  transition: "all 0.15s",
};

const statusBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 24,
  padding: "0 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
};

const emptyBox: React.CSSProperties = {
  border: "1px solid #222",
  borderRadius: 12,
  padding: 48,
  background: "#0a0a0a",
  color: "#666",
  textAlign: "center",
};

const errorBox: React.CSSProperties = {
  border: "1px solid #ff4444",
  borderRadius: 12,
  padding: 16,
  background: "#1a0000",
  color: "#ff8888",
  marginBottom: 16,
};
