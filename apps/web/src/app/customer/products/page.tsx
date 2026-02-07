"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

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
        <h1 className="text-2xl font-extrabold mb-8 text-foreground">상품 관리</h1>
        <div className="text-text-secondary">로딩 중...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-extrabold m-0 text-foreground">상품 관리</h1>
        {canManageProducts && selectedBranchId && (
          <Link href={`/customer/products/new?branchId=${selectedBranchId}`} className="no-underline">
            <button className="btn-primary px-5 py-2.5 text-sm">+ 상품 추가</button>
          </Link>
        )}
      </div>

      {/* Branch Filter */}
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

      {error && <div className="border border-danger-500 rounded-md p-4 bg-danger-500/10 text-danger-500 mb-4">{error}</div>}

      {branches.length === 0 ? (
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
        <img
          src={product.image_url}
          alt={product.name}
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
