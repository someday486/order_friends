"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { formatDateTimeFull, formatWon } from "@/lib/format";
import { useParams, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { exportToExcel } from "@/lib/excel-export";

// ============================================================
// Types
// ============================================================

type InventoryDetail = {
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
  product?: {
    id: string;
    name: string;
    description?: string;
    price: number;
    image_url?: string;
    category?: string;
  };
};

type InventoryLog = {
  id: string;
  product_id: string;
  branch_id: string;
  transaction_type: string;
  qty_change: number;
  qty_before: number;
  qty_after: number;
  notes?: string | null;
  created_at: string;
  created_by?: string;
};

type Branch = {
  id: string;
  name: string;
  myRole: string;
};

// ============================================================
// Constants
// ============================================================

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
        const data = await apiClient.get<Branch[]>("/customer/branches");
        setBranches(data);

        if (!selectedBranchId && data.length > 0) {
          setSelectedBranchId(data[0].id);
        }
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "지점 목록을 불러올 수 없습니다");
      }
    };

    loadBranches();
  }, []);

  // Load inventory and logs
  useEffect(() => {
    const loadData = async () => {
      if (!productId || productId === "undefined" || !selectedBranchId) {
        setLoading(false);
        if (productId === "undefined") {
          setError("잘못된 상품 ID입니다. 재고 목록에서 다시 선택해주세요.");
        }
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const inventoryData = await apiClient.get<InventoryDetail>(`/customer/inventory/${productId}?branchId=${encodeURIComponent(selectedBranchId)}`);
        setInventory(inventoryData);
        setEditQtyAvailable(inventoryData.qty_available);
        setEditLowStockThreshold(inventoryData.low_stock_threshold);

        try {
          const logsData = await apiClient.get<InventoryLog[]>(`/customer/inventory/logs?productId=${productId}&branchId=${encodeURIComponent(selectedBranchId)}`);
          setLogs(logsData);
        } catch (e) {
          console.warn("Failed to fetch inventory logs", e);
        }

        const branch = branches.find((b) => b.id === selectedBranchId);
        if (branch) {
          setUserRole(branch.myRole);
        }
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "재고 정보를 불러올 수 없습니다");
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

      const updatedData = await apiClient.patch<InventoryDetail>(`/customer/inventory/${productId}?branchId=${encodeURIComponent(selectedBranchId)}`, {
        qty_available: editQtyAvailable,
        low_stock_threshold: editLowStockThreshold,
      });

      setInventory(updatedData);
      setEditMode(false);

      try {
        const logsData = await apiClient.get<InventoryLog[]>(`/customer/inventory/logs?productId=${productId}&branchId=${encodeURIComponent(selectedBranchId)}`);
        setLogs(logsData);
      } catch (e) {
        console.warn("Failed to fetch inventory logs", e);
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "재고 수정에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  const handleAdjustment = async () => {
    if (!inventory || !adjustmentQty) return;

    const qtyChange = parseInt(adjustmentQty, 10);
    if (isNaN(qtyChange) || qtyChange === 0) {
      setError("유효한 수량을 입력해주세요");
      return;
    }

    try {
      setAdjusting(true);
      setError(null);

      const updatedData = await apiClient.post<InventoryDetail>(`/customer/inventory/${productId}/adjust?branchId=${encodeURIComponent(selectedBranchId)}`, {
        transaction_type: adjustmentType,
        qty_change: qtyChange,
        notes: adjustmentNotes || undefined,
      });

      setInventory(updatedData);
      setEditQtyAvailable(updatedData.qty_available);

      setAdjustmentQty("");
      setAdjustmentNotes("");

      try {
        const logsData = await apiClient.get<InventoryLog[]>(`/customer/inventory/logs?productId=${productId}&branchId=${encodeURIComponent(selectedBranchId)}`);
        setLogs(logsData);
      } catch (e) {
        console.warn("Failed to fetch inventory logs", e);
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "재고 조정에 실패했습니다");
    } finally {
      setAdjusting(false);
    }
  };

  const canEdit =
    userRole === "OWNER" ||
    userRole === "ADMIN" ||
    userRole === "BRANCH_OWNER" ||
    userRole === "BRANCH_ADMIN";
  const isLowStock = inventory?.is_low_stock;

  const handleExportLogs = () => {
    if (logs.length === 0) return;
    const filename = inventory
      ? `inventory-logs-${inventory.product_name || inventory.product_id}`
      : "inventory-logs";
    exportToExcel(
      logs.map((log) => ({
        일시: formatDateTimeFull(log.created_at),
        거래유형: TRANSACTION_LABELS[log.transaction_type] || log.transaction_type,
        수량변경: log.qty_change,
        변경전: log.qty_before,
        변경후: log.qty_after,
        메모: log.notes || "",
      })),
      filename,
      "재고변경이력",
    );
  };

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
          {inventory.product?.image_url && (
            <Image
              src={inventory.product.image_url}
              alt={inventory.product?.name || "상품 이미지"}
              width={120}
              height={120}
              className="w-[120px] h-[120px] rounded-xl object-cover border border-border"
            />
          )}
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-2 text-foreground">
              {inventory.product?.name || inventory.product_name || "상품명 없음"}
            </h2>
            {inventory.product?.price != null && (
              <div className="text-lg font-extrabold text-foreground mb-2">
                {formatWon(inventory.product.price)}
              </div>
            )}
          </div>
          {isLowStock && (
            <span className="inline-flex items-center h-8 px-4 rounded-full bg-danger-500/20 text-danger-500 text-sm font-semibold">
              재고 부족
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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

      {/* Edit Form (OWNER/ADMIN/BRANCH roles only) */}
      {canEdit && (
        <div className="card p-6 mb-6">
          <h3 className="text-lg font-bold mb-4 text-foreground">재고 정보 수정</h3>

          {!editMode ? (
            <button onClick={() => setEditMode(true)} className="py-2.5 px-5 rounded-lg border border-border bg-bg-tertiary text-foreground text-sm cursor-pointer font-semibold hover:bg-bg-secondary transition-colors">
              수정하기
            </button>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-foreground">재고 변경 이력</h3>
          <button
            onClick={handleExportLogs}
            disabled={logs.length === 0}
            className="py-2 px-3 text-xs rounded border border-border bg-bg-secondary text-foreground hover:bg-bg-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            엑셀 다운로드
          </button>
        </div>

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
                      <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold ${TRANSACTION_BADGE_CLASSES[log.transaction_type] || "bg-neutral-500/20 text-neutral-400"}`}>
                        {TRANSACTION_LABELS[log.transaction_type] || log.transaction_type}
                      </span>
                    </td>
                    <td className={`py-3 px-3.5 text-[13px] text-right font-bold ${log.qty_change > 0 ? "text-success" : log.qty_change < 0 ? "text-danger-500" : "text-text-secondary"}`}>
                      {log.qty_change > 0 ? "+" : ""}
                      {log.qty_change}
                    </td>
                    <td className="py-3 px-3.5 text-[13px] text-right text-text-secondary">{log.qty_before}</td>
                    <td className="py-3 px-3.5 text-[13px] text-right text-foreground">{log.qty_after}</td>
                    <td className="py-3 px-3.5 text-xs text-text-secondary">{log.notes || "-"}</td>
                    <td className="py-3 px-3.5 text-xs text-text-secondary">{formatDateTimeFull(log.created_at)}</td>
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
