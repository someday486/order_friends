"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

// ============================================================
// Types
// ============================================================

type InventoryItem = {
  id: string;
  productId: string;
  branchId: string;
  qty_available: number;
  qty_reserved: number;
  qty_sold: number;
  low_stock_threshold: number;
  product?: {
    id: string;
    name: string;
    imageUrl?: string | null;
  };
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
  return item.qty_available <= item.low_stock_threshold;
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
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 32 }}>재고 관리</h1>
        <div>로딩 중...</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>재고 관리</h1>
          <p style={{ color: "#aaa", margin: "4px 0 0 0", fontSize: 13 }}>
            {inventory.length > 0 && `총 ${inventory.length}개 상품`}
            {inventory.filter(isLowStock).length > 0 &&
              ` · 재고 부족 ${inventory.filter(isLowStock).length}개`}
          </p>
        </div>
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
          <div style={{ fontSize: 13, color: "#666" }}>위에서 매장을 선택하면 재고 목록이 표시됩니다</div>
        </div>
      ) : loading ? (
        <div style={emptyBox}>로딩 중...</div>
      ) : inventory.length === 0 ? (
        <div style={emptyBox}>
          <div style={{ fontSize: 16, marginBottom: 8 }}>재고 정보가 없습니다</div>
          <div style={{ fontSize: 13, color: "#666" }}>상품을 추가하면 자동으로 재고가 생성됩니다</div>
        </div>
      ) : (
        <div style={{ border: "1px solid #222", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#0f0f0f" }}>
              <tr>
                <th style={th}>상품</th>
                <th style={{ ...th, textAlign: "right" }}>재고 가능</th>
                <th style={{ ...th, textAlign: "right" }}>예약됨</th>
                <th style={{ ...th, textAlign: "right" }}>판매됨</th>
                <th style={{ ...th, textAlign: "right" }}>최소 재고</th>
                <th style={th}>상태</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => {
                const lowStock = isLowStock(item);
                return (
                  <tr
                    key={item.id}
                    style={{
                      borderTop: "1px solid #222",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onClick={() => window.location.href = `/customer/inventory/${item.productId}`}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#151515";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {item.product?.imageUrl && (
                          <img
                            src={item.product.imageUrl}
                            alt={item.product.name || "상품 이미지"}
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 8,
                              objectFit: "cover",
                              border: "1px solid #333",
                            }}
                          />
                        )}
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>
                            {item.product?.name || "상품명 없음"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, color: lowStock ? "#ef4444" : "#10b981" }}>
                      {item.qty_available}
                    </td>
                    <td style={{ ...td, textAlign: "right", color: "#aaa" }}>{item.qty_reserved}</td>
                    <td style={{ ...td, textAlign: "right", color: "#aaa" }}>{item.qty_sold}</td>
                    <td style={{ ...td, textAlign: "right", color: "#aaa" }}>{item.low_stock_threshold}</td>
                    <td style={td}>
                      {lowStock ? (
                        <span style={lowStockBadge}>재고 부족</span>
                      ) : (
                        <span style={healthyStockBadge}>정상</span>
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

// ============================================================
// Styles
// ============================================================

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

const lowStockBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 24,
  padding: "0 10px",
  borderRadius: 999,
  background: "#ef444420",
  color: "#ef4444",
  fontSize: 12,
  fontWeight: 600,
};

const healthyStockBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 24,
  padding: "0 10px",
  borderRadius: 999,
  background: "#10b98120",
  color: "#10b981",
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
