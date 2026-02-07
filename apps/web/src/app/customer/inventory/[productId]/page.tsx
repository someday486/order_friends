"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
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

const TRANSACTION_BADGE_CLASSES: Record<string, string> = {
  RESTOCK: "bg-success/20 text-success",
  ADJUSTMENT: "bg-primary-500/20 text-primary-500",
  DAMAGE: "bg-danger-500/20 text-danger-500",
  RETURN: "bg-warning-500/20 text-warning-500",
  SALE: "bg-neutral-500/20 text-neutral-400",
  RESERVATION: "bg-purple-500/20 text-purple-400",
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

function InventoryDetailPageContent() {
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
        <Link href="/customer/inventory" className="text-foreground no-underline hover:text-primary-500 transition-colors text-sm font-semibold">
          ← 재고 목록
        </Link>
        <h1 className="text-2xl font-extrabold mt-4 text-foreground">재고 상세</h1>
        <div className="mt-8 text-text-secondary">로딩 중...</div>
      </div>
    );
  }

  if (!inventory) {
    return (
      <div>
        <Link href="/customer/inventory" className="text-foreground no-underline hover:text-primary-500 transition-colors text-sm font-semibold">
          ← 재고 목록
        </Link>
        <h1 className="text-2xl font-extrabold mt-4 text-foreground">재고 상세</h1>
        <div className="border border-danger-500 rounded-xl p-4 bg-danger-500/10 text-danger-500">재고 정보를 찾을 수 없습니다</div>
      </div>
    );
  }

  return (
    <div>
      <Link href="/customer/inventory" className="text-foreground no-underline hover:text-primary-500 transition-colors text-sm font-semibold">
        ← 재고 목록
      </Link>

      <div className="mt-4 mb-8">
        <h1 className="text-2xl font-extrabold m-0 text-foreground">재고 상세</h1>
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

      {/* Product Info */}
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-6 mb-6">
          {inventory.product?.imageUrl && (
            <img
              src={inventory.product.imageUrl}
              alt={inventory.product.name || "상품 이미지"}
              className="w-[120px] h-[120px] rounded-xl object-cover border border-border"
            />
          )}
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-2 text-foreground">
              {inventory.product?.name || "상품명 없음"}
            </h2>
            {inventory.product?.price && (
              <div className="text-lg font-extrabold text-foreground mb-2">
                {formatWon(inventory.product.price)}
              </div>
            )}
            <div className="text-[13px] text-text-secondary">매장: {inventory.branch?.name || "-"}</div>
          </div>
          {isLowStock && (
            <span className="inline-flex items-center h-8 px-4 rounded-full bg-danger-500/20 text-danger-500 text-sm font-semibold">
              재고 부족
            </span>
          )}
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-bg-tertiary border border-border">
            <div className="text-xs text-text-secondary mb-2 font-semibold">재고 가능</div>
            <div className={`text-2xl font-extrabold ${isLowStock ? "text-danger-500" : "text-success"}`}>
              {inventory.qty_available}
            </div>
          </div>
          <div className="p-4 rounded-lg bg-bg-tertiary border border-border">
            <div className="text-xs text-text-secondary mb-2 font-semibold">예약됨</div>
            <div className="text-2xl font-extrabold text-foreground">{inventory.qty_reserved}</div>
          </div>
          <div className="p-4 rounded-lg bg-bg-tertiary border border-border">
            <div className="text-xs text-text-secondary mb-2 font-semibold">판매됨</div>
            <div className="text-2xl font-extrabold text-foreground">{inventory.qty_sold}</div>
          </div>
          <div className="p-4 rounded-lg bg-bg-tertiary border border-border">
            <div className="text-xs text-text-secondary mb-2 font-semibold">최소 재고</div>
            <div className="text-2xl font-extrabold text-foreground">{inventory.low_stock_threshold}</div>
          </div>
        </div>
      </div>

      {/* Edit Form (OWNER/ADMIN only) */}
      {canEdit && (
        <div className="card p-6 mb-6">
          <h3 className="text-lg font-bold mb-4 text-foreground">재고 정보 수정</h3>

          {!editMode ? (
            <button onClick={() => setEditMode(true)} className="py-2.5 px-5 rounded-lg border border-border bg-bg-tertiary text-foreground text-sm cursor-pointer font-semibold hover:bg-bg-secondary transition-colors">
              수정하기
            </button>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-[13px] text-text-secondary mb-2 font-semibold">재고 가능 수량</label>
                  <input
                    type="number"
                    value={editQtyAvailable}
                    onChange={(e) => setEditQtyAvailable(parseInt(e.target.value) || 0)}
                    className="input-field w-full"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-[13px] text-text-secondary mb-2 font-semibold">최소 재고 기준</label>
                  <input
                    type="number"
                    value={editLowStockThreshold}
                    onChange={(e) => setEditLowStockThreshold(parseInt(e.target.value) || 0)}
                    className="input-field w-full"
                    min="0"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveEdit} disabled={saving} className="btn-primary py-2.5 px-5 text-sm">
                  {saving ? "저장 중..." : "저장"}
                </button>
                <button
                  onClick={() => {
                    setEditMode(false);
                    setEditQtyAvailable(inventory.qty_available);
                    setEditLowStockThreshold(inventory.low_stock_threshold);
                  }}
                  className="py-2.5 px-5 rounded-lg border border-border bg-bg-tertiary text-foreground text-sm cursor-pointer font-semibold hover:bg-bg-secondary transition-colors"
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
        <div className="card p-6 mb-6">
          <h3 className="text-lg font-bold mb-4 text-foreground">재고 수동 조정</h3>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-[13px] text-text-secondary mb-2 font-semibold">거래 유형</label>
              <select value={adjustmentType} onChange={(e) => setAdjustmentType(e.target.value)} className="input-field w-full">
                {TRANSACTION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[13px] text-text-secondary mb-2 font-semibold">수량 변경 (양수 또는 음수)</label>
              <input
                type="number"
                value={adjustmentQty}
                onChange={(e) => setAdjustmentQty(e.target.value)}
                placeholder="예: +10 또는 -5"
                className="input-field w-full"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-[13px] text-text-secondary mb-2 font-semibold">메모 (선택)</label>
            <textarea
              value={adjustmentNotes}
              onChange={(e) => setAdjustmentNotes(e.target.value)}
              placeholder="조정 사유를 입력하세요"
              className="input-field w-full resize-y font-[inherit]"
              rows={3}
            />
          </div>

          <button onClick={handleAdjustment} disabled={adjusting || !adjustmentQty} className="py-3 px-6 rounded-lg border-none bg-success text-white text-sm cursor-pointer font-bold hover:opacity-80 transition-opacity">
            {adjusting ? "처리 중..." : "재고 조정 실행"}
          </button>
        </div>
      )}

      {/* Inventory Logs */}
      <div className="card p-6 mb-6">
        <h3 className="text-lg font-bold mb-4 text-foreground">재고 변경 이력</h3>

        {logs.length === 0 ? (
          <div className="border border-border rounded-xl p-12 bg-bg-secondary text-text-tertiary text-center">재고 변경 이력이 없습니다</div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead className="bg-bg-tertiary">
                <tr>
                  <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">거래 유형</th>
                  <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">수량 변경</th>
                  <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">변경 전</th>
                  <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">변경 후</th>
                  <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">메모</th>
                  <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">일시</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-border">
                    <td className="py-3 px-3.5 text-[13px] text-foreground">
                      <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold ${TRANSACTION_BADGE_CLASSES[log.transactionType] || "bg-neutral-500/20 text-neutral-400"}`}>
                        {TRANSACTION_LABELS[log.transactionType] || log.transactionType}
                      </span>
                    </td>
                    <td className={`py-3 px-3.5 text-[13px] text-right font-bold ${log.qtyChange > 0 ? "text-success" : log.qtyChange < 0 ? "text-danger-500" : "text-text-secondary"}`}>
                      {log.qtyChange > 0 ? "+" : ""}
                      {log.qtyChange}
                    </td>
                    <td className="py-3 px-3.5 text-[13px] text-right text-text-secondary">{log.qtyBefore}</td>
                    <td className="py-3 px-3.5 text-[13px] text-right text-foreground">{log.qtyAfter}</td>
                    <td className="py-3 px-3.5 text-xs text-text-secondary">{log.notes || "-"}</td>
                    <td className="py-3 px-3.5 text-xs text-text-secondary">{formatDateTime(log.createdAt)}</td>
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

export default function InventoryDetailPage() {
  return (
    <Suspense fallback={<div className="text-muted">로딩 중...</div>}>
      <InventoryDetailPageContent />
    </Suspense>
  );
}
