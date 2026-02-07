"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

// ============================================================
// Types
// ============================================================

type InventoryItem = {
  id: string;
  product_id: string;
  product_name: string;
  branch_id: string;
  qty_available: number;
  qty_reserved: number;
  qty_sold: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
  total_quantity?: number;
  image_url?: string;
  category?: string;
  created_at: string;
  updated_at: string;
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

function isLowStock(item: InventoryItem): boolean {
  return item.is_low_stock;
}

// ============================================================
// Component
// ============================================================

export default function CustomerInventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        }
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "매장 목록 조회 중 오류 발생");
      }
    };

    loadBranches();
  }, []);

  // Load inventory when branch changes
  useEffect(() => {
    const loadInventory = async () => {
      if (!selectedBranchId) {
        setInventory([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const token = await getAccessToken();

        const res = await fetch(
          `${API_BASE}/customer/inventory?branchId=${encodeURIComponent(selectedBranchId)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) {
          throw new Error(`재고 목록 조회 실패: ${res.status}`);
        }

        const data = await res.json();
        setInventory(data);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "재고 목록 조회 중 오류 발생");
      } finally {
        setLoading(false);
      }
    };

    loadInventory();
  }, [selectedBranchId]);

  if (loading && branches.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold mb-8 text-foreground">재고 관리</h1>
        <div className="text-text-secondary">로딩 중...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-extrabold m-0 text-foreground">재고 관리</h1>
          <p className="text-text-secondary mt-1 mb-0 text-[13px]">
            {inventory.length > 0 && `총 ${inventory.length}개 상품`}
            {inventory.filter(isLowStock).length > 0 &&
              ` · 재고 부족 ${inventory.filter(isLowStock).length}개`}
          </p>
        </div>
      </div>

      {/* Branch Filter */}
      <div className="mb-6">
        <label className="block text-[13px] text-text-secondary mb-2 font-semibold">매장 선택</label>
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="input-field w-full max-w-[400px]"
        >
          <option value="">매장을 선택하세요</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="border border-danger-500 rounded-xl p-4 bg-danger-500/10 text-danger-500 mb-4">
          {error}
        </div>
      )}

      {branches.length === 0 ? (
        <div className="border border-border rounded-xl p-12 bg-bg-secondary text-text-tertiary text-center">
          <div className="text-base mb-2">등록된 매장이 없습니다</div>
          <div className="text-[13px] text-text-tertiary">먼저 매장을 등록해주세요</div>
        </div>
      ) : !selectedBranchId ? (
        <div className="border border-border rounded-xl p-12 bg-bg-secondary text-text-tertiary text-center">
          <div className="text-base mb-2">매장을 선택하세요</div>
          <div className="text-[13px] text-text-tertiary">위에서 매장을 선택하면 재고 목록이 표시됩니다</div>
        </div>
      ) : loading ? (
        <div className="border border-border rounded-xl p-12 bg-bg-secondary text-text-tertiary text-center">로딩 중...</div>
      ) : inventory.length === 0 ? (
        <div className="border border-border rounded-xl p-12 bg-bg-secondary text-text-tertiary text-center">
          <div className="text-base mb-2">재고 정보가 없습니다</div>
          <div className="text-[13px] text-text-tertiary">상품을 추가하면 자동으로 재고가 생성됩니다</div>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full border-collapse">
            <thead className="bg-bg-tertiary">
              <tr>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">상품</th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">재고 가능</th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">예약됨</th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">판매됨</th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">최소 재고</th>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">상태</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => {
                const lowStock = isLowStock(item);
                return (
                  <tr
                    key={item.id}
                    className="border-t border-border cursor-pointer hover:bg-bg-tertiary transition-colors"
                    onClick={() => window.location.href = `/customer/inventory/${item.product_id}`}
                  >
                    <td className="py-3 px-3.5 text-[13px] text-foreground">
                      <div className="flex items-center gap-3">
                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt={item.product_name || "상품 이미지"}
                            className="w-12 h-12 rounded-lg object-cover border border-border"
                          />
                        )}
                        <div>
                          <div className="font-semibold text-sm">
                            {item.product_name || "상품명 없음"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={`py-3 px-3.5 text-[13px] text-right font-bold ${lowStock ? "text-danger-500" : "text-success"}`}>
                      {item.qty_available}
                    </td>
                    <td className="py-3 px-3.5 text-[13px] text-right text-text-secondary">{item.qty_reserved}</td>
                    <td className="py-3 px-3.5 text-[13px] text-right text-text-secondary">{item.qty_sold}</td>
                    <td className="py-3 px-3.5 text-[13px] text-right text-text-secondary">{item.low_stock_threshold}</td>
                    <td className="py-3 px-3.5 text-[13px] text-foreground">
                      {lowStock ? (
                        <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-danger-500/20 text-danger-500 text-xs font-semibold">재고 부족</span>
                      ) : (
                        <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-success/20 text-success text-xs font-semibold">정상</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
