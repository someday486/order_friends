"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

// ============================================================
// Types
// ============================================================

type InventoryDetail = {
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
    price: number;
    imageUrl?: string | null;
  };
  branch?: {
    id: string;
    name: string;
  };
};

type InventoryLog = {
  id: string;
  inventoryId: string;
  transactionType: "RESTOCK" | "ADJUSTMENT" | "DAMAGE" | "RETURN" | "SALE" | "RESERVATION";
  qtyChange: number;
  qtyBefore: number;
  qtyAfter: number;
  notes?: string | null;
  createdAt: string;
  createdBy?: string;
};

type Branch = {
  id: string;
  name: string;
  myRole: string;
};

// ============================================================
// Constants
// ============================================================

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const TRANSACTION_TYPES = [
  { value: "RESTOCK", label: "재입고" },
  { value: "ADJUSTMENT", label: "재고 조정" },
  { value: "DAMAGE", label: "손상/폐기" },
  { value: "RETURN", label: "반품" },
];

const TRANSACTION_LABELS: Record<string, string> = {
  RESTOCK: "재입고",
  ADJUSTMENT: "재고 조정",
  DAMAGE: "손상/폐기",
  RETURN: "반품",
  SALE: "판매",
  RESERVATION: "예약",
};

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

function formatDateTime(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================
// Component
// ============================================================

export default function InventoryDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const productId = params.productId as string;
  const branchId = searchParams.get("branchId");

  const [inventory, setInventory] = useState<InventoryDetail | null>(null);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branchId || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Edit form state
  const [editMode, setEditMode] = useState(false);
  const [editQtyAvailable, setEditQtyAvailable] = useState(0);
  const [editLowStockThreshold, setEditLowStockThreshold] = useState(0);
  const [saving, setSaving] = useState(false);

  // Adjustment form state
  const [adjustmentType, setAdjustmentType] = useState<string>("RESTOCK");
  const [adjustmentQty, setAdjustmentQty] = useState<string>("");
  const [adjustmentNotes, setAdjustmentNotes] = useState("");
  const [adjusting, setAdjusting] = useState(false);

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

        // Set first branch as default if no branch selected
        if (!selectedBranchId && data.length > 0) {
          setSelectedBranchId(data[0].id);
        }
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "매장 목록 조회 중 오류 발생");
      }
    };

    loadBranches();
  }, []);

  // Load inventory and logs
  useEffect(() => {
    const loadData = async () => {
      if (!productId || !selectedBranchId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const token = await getAccessToken();

        // Load inventory detail
        const inventoryRes = await fetch(
          `${API_BASE}/customer/inventory/${productId}?branchId=${encodeURIComponent(selectedBranchId)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!inventoryRes.ok) {
          throw new Error(`재고 정보 조회 실패: ${inventoryRes.status}`);
        }

        const inventoryData = await inventoryRes.json();
        setInventory(inventoryData);
        setEditQtyAvailable(inventoryData.qty_available);
        setEditLowStockThreshold(inventoryData.low_stock_threshold);

        // Load inventory logs
        const logsRes = await fetch(
          `${API_BASE}/customer/inventory/logs?productId=${productId}&branchId=${encodeURIComponent(selectedBranchId)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (logsRes.ok) {
          const logsData = await logsRes.json();
          setLogs(logsData);
        }

        // Set user role
        const branch = branches.find((b) => b.id === selectedBranchId);
        if (branch) {
          setUserRole(branch.myRole);
        }
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "재고 정보 조회 중 오류 발생");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [productId, selectedBranchId, branches]);

  const handleSaveEdit = async () => {
    if (!inventory) return;

    try {
      setSaving(true);
      setError(null);
      const token = await getAccessToken();

      const res = await fetch(
        `${API_BASE}/customer/inventory/${productId}?branchId=${encodeURIComponent(selectedBranchId)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            qty_available: editQtyAvailable,
            low_stock_threshold: editLowStockThreshold,
          }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `재고 수정 실패: ${res.status}`);
      }

      const updatedData = await res.json();
      setInventory(updatedData);
      setEditMode(false);

      // Reload logs
      const logsRes = await fetch(
        `${API_BASE}/customer/inventory/logs?productId=${productId}&branchId=${encodeURIComponent(selectedBranchId)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData);
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "재고 수정 중 오류 발생");
    } finally {
      setSaving(false);
    }
  };

  const handleAdjustment = async () => {
    if (!inventory || !adjustmentQty) return;

    const qtyChange = parseInt(adjustmentQty, 10);
    if (isNaN(qtyChange) || qtyChange === 0) {
      setError("유효한 수량을 입력하세요");
      return;
    }

    try {
      setAdjusting(true);
      setError(null);
      const token = await getAccessToken();

      const res = await fetch(
        `${API_BASE}/customer/inventory/${productId}/adjust?branchId=${encodeURIComponent(selectedBranchId)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transactionType: adjustmentType,
            qtyChange,
            notes: adjustmentNotes || undefined,
          }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `재고 조정 실패: ${res.status}`);
      }

      const updatedData = await res.json();
      setInventory(updatedData);
      setEditQtyAvailable(updatedData.qty_available);

      // Reset form
      setAdjustmentQty("");
      setAdjustmentNotes("");

      // Reload logs
      const logsRes = await fetch(
        `${API_BASE}/customer/inventory/logs?productId=${productId}&branchId=${encodeURIComponent(selectedBranchId)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData);
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "재고 조정 중 오류 발생");
    } finally {
      setAdjusting(false);
    }
  };

  const canEdit = userRole === "OWNER" || userRole === "ADMIN";
  const isLowStock = inventory && inventory.qty_available <= inventory.low_stock_threshold;

  if (loading) {
    return (
      <div>
        <Link href="/customer/inventory" style={backLink}>
          ← 재고 목록
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginTop: 16 }}>재고 상세</h1>
        <div style={{ marginTop: 32 }}>로딩 중...</div>
      </div>
    );
  }

  if (!inventory) {
    return (
      <div>
        <Link href="/customer/inventory" style={backLink}>
          ← 재고 목록
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginTop: 16 }}>재고 상세</h1>
        <div style={errorBox}>재고 정보를 찾을 수 없습니다</div>
      </div>
    );
  }

  return (
    <div>
      <Link href="/customer/inventory" style={backLink}>
        ← 재고 목록
      </Link>

      <div style={{ marginTop: 16, marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>재고 상세</h1>
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

      {/* Product Info */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 24, marginBottom: 24 }}>
          {inventory.product?.imageUrl && (
            <img
              src={inventory.product.imageUrl}
              alt={inventory.product.name || "상품 이미지"}
              style={{
                width: 120,
                height: 120,
                borderRadius: 12,
                objectFit: "cover",
                border: "1px solid #333",
              }}
            />
          )}
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px 0" }}>
              {inventory.product?.name || "상품명 없음"}
            </h2>
            {inventory.product?.price && (
              <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 8 }}>
                {formatWon(inventory.product.price)}
              </div>
            )}
            <div style={{ fontSize: 13, color: "#aaa" }}>매장: {inventory.branch?.name || "-"}</div>
          </div>
          {isLowStock && (
            <div style={{ ...lowStockBadge, height: 32, padding: "0 16px", fontSize: 14 }}>
              재고 부족
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          <div style={statBox}>
            <div style={statLabel}>재고 가능</div>
            <div style={{ ...statValue, color: isLowStock ? "#ef4444" : "#10b981" }}>
              {inventory.qty_available}
            </div>
          </div>
          <div style={statBox}>
            <div style={statLabel}>예약됨</div>
            <div style={statValue}>{inventory.qty_reserved}</div>
          </div>
          <div style={statBox}>
            <div style={statLabel}>판매됨</div>
            <div style={statValue}>{inventory.qty_sold}</div>
          </div>
          <div style={statBox}>
            <div style={statLabel}>최소 재고</div>
            <div style={statValue}>{inventory.low_stock_threshold}</div>
          </div>
        </div>
      </div>

      {/* Edit Form (OWNER/ADMIN only) */}
      {canEdit && (
        <div style={card}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>재고 정보 수정</h3>

          {!editMode ? (
            <button onClick={() => setEditMode(true)} style={editButton}>
              수정하기
            </button>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>재고 가능 수량</label>
                  <input
                    type="number"
                    value={editQtyAvailable}
                    onChange={(e) => setEditQtyAvailable(parseInt(e.target.value) || 0)}
                    style={inputStyle}
                    min="0"
                  />
                </div>
                <div>
                  <label style={labelStyle}>최소 재고 기준</label>
                  <input
                    type="number"
                    value={editLowStockThreshold}
                    onChange={(e) => setEditLowStockThreshold(parseInt(e.target.value) || 0)}
                    style={inputStyle}
                    min="0"
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleSaveEdit} disabled={saving} style={saveButton}>
                  {saving ? "저장 중..." : "저장"}
                </button>
                <button
                  onClick={() => {
                    setEditMode(false);
                    setEditQtyAvailable(inventory.qty_available);
                    setEditLowStockThreshold(inventory.low_stock_threshold);
                  }}
                  style={cancelButton}
                >
                  취소
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Manual Adjustment */}
      {canEdit && (
        <div style={card}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>재고 수동 조정</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>거래 유형</label>
              <select value={adjustmentType} onChange={(e) => setAdjustmentType(e.target.value)} style={selectStyle}>
                {TRANSACTION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>수량 변경 (양수 또는 음수)</label>
              <input
                type="number"
                value={adjustmentQty}
                onChange={(e) => setAdjustmentQty(e.target.value)}
                placeholder="예: +10 또는 -5"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>메모 (선택)</label>
            <textarea
              value={adjustmentNotes}
              onChange={(e) => setAdjustmentNotes(e.target.value)}
              placeholder="조정 사유를 입력하세요"
              style={textareaStyle}
              rows={3}
            />
          </div>

          <button onClick={handleAdjustment} disabled={adjusting || !adjustmentQty} style={adjustButton}>
            {adjusting ? "처리 중..." : "재고 조정 실행"}
          </button>
        </div>
      )}

      {/* Inventory Logs */}
      <div style={card}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>재고 변경 이력</h3>

        {logs.length === 0 ? (
          <div style={emptyBox}>재고 변경 이력이 없습니다</div>
        ) : (
          <div style={{ border: "1px solid #222", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#0f0f0f" }}>
                <tr>
                  <th style={th}>거래 유형</th>
                  <th style={{ ...th, textAlign: "right" }}>수량 변경</th>
                  <th style={{ ...th, textAlign: "right" }}>변경 전</th>
                  <th style={{ ...th, textAlign: "right" }}>변경 후</th>
                  <th style={th}>메모</th>
                  <th style={th}>일시</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderTop: "1px solid #222" }}>
                    <td style={td}>
                      <span style={transactionBadge(log.transactionType)}>
                        {TRANSACTION_LABELS[log.transactionType] || log.transactionType}
                      </span>
                    </td>
                    <td
                      style={{
                        ...td,
                        textAlign: "right",
                        fontWeight: 700,
                        color: log.qtyChange > 0 ? "#10b981" : log.qtyChange < 0 ? "#ef4444" : "#aaa",
                      }}
                    >
                      {log.qtyChange > 0 ? "+" : ""}
                      {log.qtyChange}
                    </td>
                    <td style={{ ...td, textAlign: "right", color: "#aaa" }}>{log.qtyBefore}</td>
                    <td style={{ ...td, textAlign: "right", color: "#fff" }}>{log.qtyAfter}</td>
                    <td style={{ ...td, color: "#aaa", fontSize: 12 }}>{log.notes || "-"}</td>
                    <td style={{ ...td, color: "#aaa", fontSize: 12 }}>{formatDateTime(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Styles
// ============================================================

const backLink: React.CSSProperties = {
  display: "inline-block",
  color: "#0070f3",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 600,
};

const card: React.CSSProperties = {
  border: "1px solid #222",
  borderRadius: 12,
  padding: 24,
  background: "#0f0f0f",
  marginBottom: 24,
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "#1a1a1a",
  color: "#fff",
  fontSize: 14,
  outline: "none",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "#1a1a1a",
  color: "#fff",
  fontSize: 14,
  outline: "none",
  fontFamily: "inherit",
  resize: "vertical",
};

const statBox: React.CSSProperties = {
  padding: 16,
  borderRadius: 8,
  background: "#1a1a1a",
  border: "1px solid #333",
};

const statLabel: React.CSSProperties = {
  fontSize: 12,
  color: "#aaa",
  marginBottom: 8,
  fontWeight: 600,
};

const statValue: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  color: "#fff",
};

const editButton: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "#1a1a1a",
  color: "#fff",
  fontSize: 14,
  cursor: "pointer",
  fontWeight: 600,
};

const saveButton: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 8,
  border: "none",
  background: "#0070f3",
  color: "#fff",
  fontSize: 14,
  cursor: "pointer",
  fontWeight: 600,
};

const cancelButton: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "#1a1a1a",
  color: "#fff",
  fontSize: 14,
  cursor: "pointer",
  fontWeight: 600,
};

const adjustButton: React.CSSProperties = {
  padding: "12px 24px",
  borderRadius: 8,
  border: "none",
  background: "#10b981",
  color: "#fff",
  fontSize: 14,
  cursor: "pointer",
  fontWeight: 700,
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

function transactionBadge(type: string): React.CSSProperties {
  const colors: Record<string, { bg: string; text: string }> = {
    RESTOCK: { bg: "#10b98120", text: "#10b981" },
    ADJUSTMENT: { bg: "#3b82f620", text: "#3b82f6" },
    DAMAGE: { bg: "#ef444420", text: "#ef4444" },
    RETURN: { bg: "#f59e0b20", text: "#f59e0b" },
    SALE: { bg: "#6b728020", text: "#9ca3af" },
    RESERVATION: { bg: "#8b5cf620", text: "#a78bfa" },
  };

  const color = colors[type] || { bg: "#6b728020", text: "#9ca3af" };

  return {
    display: "inline-flex",
    alignItems: "center",
    height: 24,
    padding: "0 10px",
    borderRadius: 999,
    background: color.bg,
    color: color.text,
    fontSize: 12,
    fontWeight: 600,
  };
}
