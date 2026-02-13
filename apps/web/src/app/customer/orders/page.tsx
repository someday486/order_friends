"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import {
  formatDateTime,
  formatRelativeTime,
  formatWon,
} from "@/lib/format";
import type { Branch, OrderStatus } from "@/types/common";
import Modal from "@/components/ui/Modal";
import { createOrderExportJob, getOrderExportJobStatus } from "@/lib/exports";

// ============================================================
// Types
// ============================================================

type Order = {
  id: string;
  orderNo: string | null;
  customerName: string;
  totalAmount: number;
  status: OrderStatus;
  orderedAt: string;
  items?: { name: string; qty: number }[];
  branchName?: string;
};

type OrderListResponse = {
  data?: Order[];
  items?: Order[];
  pagination?: {
    total?: number;
  };
  total?: number;
};

// ============================================================
// Constants
// ============================================================

// TODO(5-C): 카드 레이아웃과 함께 동작하는 컬럼 드래그 재정렬 UX를 다음 단계에서 추가.
const STATUS_FILTERS: { value: OrderStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "CREATED", label: "주문접수" },
  { value: "CONFIRMED", label: "확인" },
  { value: "PREPARING", label: "준비중" },
  { value: "READY", label: "준비완료" },
  { value: "COMPLETED", label: "완료" },
  { value: "CANCELLED", label: "취소" },
];

const statusConfig: Record<
  OrderStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  CREATED: {
    label: "주문접수",
    bg: "bg-warning-500/15",
    text: "text-warning-600",
    dot: "bg-warning-500",
  },
  CONFIRMED: {
    label: "확인",
    bg: "bg-primary-500/15",
    text: "text-primary-600",
    dot: "bg-primary-500",
  },
  PREPARING: {
    label: "준비중",
    bg: "bg-secondary-500/15",
    text: "text-secondary-600",
    dot: "bg-secondary-500",
  },
  READY: {
    label: "준비완료",
    bg: "bg-success/15",
    text: "text-success-600",
    dot: "bg-success",
  },
  COMPLETED: {
    label: "완료",
    bg: "bg-neutral-200",
    text: "text-neutral-600",
    dot: "bg-neutral-500",
  },
  CANCELLED: {
    label: "취소",
    bg: "bg-danger-500/15",
    text: "text-danger-600",
    dot: "bg-danger-500",
  },
  REFUNDED: {
    label: "환불",
    bg: "bg-pink-500/15",
    text: "text-pink-500",
    dot: "bg-pink-500",
  },
};

// ============================================================
// Helpers
// ============================================================

const UUID_FORMAT_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuidFormat(value: string): boolean {
  return UUID_FORMAT_REGEX.test(value);
}

function getItemSummary(order: Order): string {
  if (!order.items || order.items.length === 0) return "";
  const first = order.items[0];
  const rest = order.items.length - 1;
  const label = `${first.name} ${first.qty > 1 ? `x${first.qty}` : ""}`;
  return rest > 0 ? `${label} 외 ${rest}건` : label;
}

// ============================================================
// Sub-components
// ============================================================

function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function OrderCard({ order }: { order: Order }) {
  const itemSummary = getItemSummary(order);

  return (
    <Link
      href={`/customer/orders/${order.id}`}
      className="block no-underline animate-fade-in"
    >
      <div className="bg-card rounded-md border border-border p-4 hover:shadow-lg hover:border-primary-200 transition-all duration-200 active:scale-[0.99] cursor-pointer group">
        {/* Top row: status + time */}
        <div className="flex items-center justify-between mb-3">
          <StatusBadge status={order.status} />
          <span className="text-xs text-text-tertiary">
            {formatRelativeTime(order.orderedAt)}
          </span>
        </div>

        {/* Order number + customer */}
        <div className="flex items-center justify-between mb-1">
          <span className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-foreground group-hover:text-primary-500 transition-colors">
              {order.orderNo ?? order.id.slice(0, 8)}
            </span>
            {order.branchName && (
              <span className="text-2xs text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded">
                {order.branchName}
              </span>
            )}
          </span>
          <span className="text-lg font-extrabold text-foreground">
            {formatWon(order.totalAmount)}
          </span>
        </div>

        {/* Item summary + customer name */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary truncate max-w-[60%]">
            {itemSummary || order.customerName || "-"}
          </span>
          {itemSummary && order.customerName && (
            <span className="text-xs text-text-tertiary">
              {order.customerName}
            </span>
          )}
        </div>

        {/* Bottom: exact time on hover */}
        <div className="mt-2 pt-2 border-t border-border-light text-xs text-text-tertiary">
          {formatDateTime(order.orderedAt)}
        </div>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-bg-tertiary flex items-center justify-center mb-4">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-text-tertiary"
        >
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 14l2 2 4-4" />
        </svg>
      </div>
      <p className="text-foreground font-semibold mb-1">주문이 없습니다</p>
      <p className="text-sm text-text-tertiary">
        필터를 변경하거나 새 주문을 기다려주세요
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-card rounded-md border border-border p-4 animate-pulse"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="h-6 w-16 bg-bg-tertiary rounded-full" />
            <div className="h-4 w-12 bg-bg-tertiary rounded" />
          </div>
          <div className="flex items-center justify-between mb-1">
            <div className="h-5 w-32 bg-bg-tertiary rounded" />
            <div className="h-6 w-20 bg-bg-tertiary rounded" />
          </div>
          <div className="h-4 w-40 bg-bg-tertiary rounded mt-2" />
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [branchFilter, setBranchFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDateStart, setExportDateStart] = useState("");
  const [exportDateEnd, setExportDateEnd] = useState("");
  const [exporting, setExporting] = useState(false);
  const validBranches = branches.filter((branch) => isUuidFormat(branch.id));
  const isInvalidExportDateRange = useMemo(() => {
    if (!exportDateStart || !exportDateEnd) return false;
    return exportDateEnd < exportDateStart;
  }, [exportDateStart, exportDateEnd]);

  // Load branches
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const branchList = await apiClient.get<Branch[]>("/customer/branches");
        setBranches(branchList);
      } catch (e) {
        console.error(e);
      }
    };

    loadBranches();
  }, []);

  useEffect(() => {
    if (branchFilter !== "ALL" && !isUuidFormat(branchFilter)) {
      setBranchFilter("ALL");
      setPage(1);
    }
  }, [branchFilter]);

  // Load orders
  useEffect(() => {
    const loadOrders = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        });

        if (branchFilter !== "ALL" && isUuidFormat(branchFilter)) {
          params.append("branchId", branchFilter);
        }

        if (statusFilter !== "ALL") {
          params.append("status", statusFilter);
        }

        const data = await apiClient.get<OrderListResponse | Order[]>(
          `/customer/orders?${params.toString()}`,
        );
        const orderItems = Array.isArray(data) ? data : data.data || data.items || [];
        setOrders(orderItems);
        setTotal(
          Array.isArray(data)
            ? data.length
            : data.pagination?.total || data.total || orderItems.length || 0,
        );
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "주문을 불러올 수 없습니다");
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [page, limit, branchFilter, statusFilter]);

  const totalPages = Math.ceil(total / limit);

  // Count active orders (not completed/cancelled/refunded)
  const activeCount = orders.filter(
    (o) => !["COMPLETED", "CANCELLED", "REFUNDED"].includes(o.status),
  ).length;

  const handleCreateExportJob = async () => {
    if (isInvalidExportDateRange) {
      alert("종료일은 시작일보다 빠를 수 없습니다.");
      return;
    }

    try {
      setExporting(true);
      const createResponse = await createOrderExportJob({
        format: "csv",
        scope: "detail",
        filters: {
          ...(branchFilter !== "ALL" && isUuidFormat(branchFilter) ? { branchId: branchFilter } : {}),
          ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
          ...(exportDateStart ? { dateStart: exportDateStart } : {}),
          ...(exportDateEnd ? { dateEnd: exportDateEnd } : {}),
        },
      });
      const jobId = createResponse.jobId || createResponse.id;

      if (!jobId) {
        throw new Error("Export 작업 ID를 확인할 수 없습니다.");
      }

      const maxAttempts = 30;
      let downloadUrl: string | null = null;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const statusResponse = await getOrderExportJobStatus(jobId);

        if (statusResponse.status === "COMPLETED") {
          downloadUrl = statusResponse.downloadUrl ?? null;
          break;
        }

        if (statusResponse.status === "FAILED") {
          alert(statusResponse.error || "Export 생성에 실패했습니다.");
          return;
        }

        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      if (downloadUrl) {
        window.open(downloadUrl, "_blank");
        setShowExportModal(false);
        return;
      }

      alert("아직 처리중입니다. 잠시 후 Export 목록에서 다운로드하세요.");
      setShowExportModal(false);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Export 생성에 실패했습니다");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-foreground">주문 관리</h1>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-sm text-text-secondary">
            총 <span className="font-bold text-foreground">{total}</span>건
          </span>
          {activeCount > 0 && (
            <span className="inline-flex items-center gap-1 text-sm text-primary-500 font-semibold">
              <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse-slow" />
              진행중 {activeCount}건
            </span>
          )}
          <button
            onClick={() => setShowExportModal(true)}
            className="h-8 px-3 rounded-md border border-border bg-bg-secondary text-sm text-foreground hover:bg-bg-tertiary transition-colors"
          >
            Export 다운로드
          </button>
        </div>
      </div>

      {/* Branch filter (dropdown) */}
      {validBranches.length > 1 && (
        <div className="mb-3">
          <select
            value={branchFilter}
            onChange={(e) => {
              setBranchFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 rounded-full border border-border bg-bg-secondary text-foreground text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            <option value="ALL">모든 지점</option>
            {validBranches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Status filter chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 -mx-1 px-1">
        {STATUS_FILTERS.map((opt) => {
          const isActive = statusFilter === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => {
                setStatusFilter(opt.value);
                setPage(1);
              }}
              className={`
                shrink-0 h-8 px-4 rounded-full text-sm font-medium
                border transition-all duration-150 cursor-pointer touch-feedback
                ${
                  isActive
                    ? "bg-foreground text-background border-foreground font-bold"
                    : "bg-bg-secondary text-text-secondary border-border hover:bg-bg-tertiary"
                }
              `}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="border border-danger-500 rounded-md p-4 bg-danger-500/10 text-danger-500 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Order list */}
      {loading && orders.length === 0 ? (
        <LoadingSkeleton />
      ) : orders.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-8 mb-4">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="w-9 h-9 rounded-full border border-border bg-bg-secondary text-foreground text-sm font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-bg-tertiary transition-colors"
          >
            &laquo;
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-9 h-9 rounded-full border border-border bg-bg-secondary text-foreground text-sm font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-bg-tertiary transition-colors"
          >
            &lsaquo;
          </button>

          <div className="flex items-center gap-1 mx-2">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-9 h-9 rounded-full text-sm font-bold cursor-pointer transition-all duration-150 ${
                    page === pageNum
                      ? "bg-foreground text-background"
                      : "border border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-9 h-9 rounded-full border border-border bg-bg-secondary text-foreground text-sm font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-bg-tertiary transition-colors"
          >
            &rsaquo;
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            className="w-9 h-9 rounded-full border border-border bg-bg-secondary text-foreground text-sm font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-bg-tertiary transition-colors"
          >
            &raquo;
          </button>
        </div>
      )}

      <Modal
        open={showExportModal}
        title="Export 다운로드"
        onClose={() => {
          if (!exporting) setShowExportModal(false);
        }}
        footer={(
          <>
            <button
              onClick={() => setShowExportModal(false)}
              disabled={exporting}
              className="h-9 px-3 rounded-md border border-border bg-bg-secondary text-sm text-foreground disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={handleCreateExportJob}
              disabled={exporting || isInvalidExportDateRange}
              className="h-9 px-3 rounded-md bg-foreground text-background text-sm font-semibold disabled:opacity-50"
            >
              {exporting ? "생성 중..." : "Export 생성"}
            </button>
          </>
        )}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1">시작일 (dateStart)</label>
            <input
              type="date"
              value={exportDateStart}
              onChange={(e) => setExportDateStart(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-border bg-bg-secondary text-sm text-foreground"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">종료일 (dateEnd)</label>
            <input
              type="date"
              value={exportDateEnd}
              onChange={(e) => setExportDateEnd(e.target.value)}
              min={exportDateStart || undefined}
              className="w-full h-9 px-3 rounded-md border border-border bg-bg-secondary text-sm text-foreground"
            />
          </div>
          {isInvalidExportDateRange && (
            <p className="text-xs text-danger-500">종료일은 시작일보다 빠를 수 없습니다.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
