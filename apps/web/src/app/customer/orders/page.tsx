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
import { createOrderExportJob } from "@/lib/exports";
import { useRouter } from 'next/navigation';


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
  order_items?: { name: string; qty: number }[];
  itemsSummary?: string;
  items_summary?: string;
  firstItemName?: string;
  first_item_name?: string;
  firstItemQty?: number;
  first_item_qty?: number;
  branchName?: string;
  branchId?: string;
  branch_id?: string;
  item_count?: number;
  itemCount?: number;
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

const STATUS_FILTERS: { value: OrderStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "CREATED", label: "주문접수" },
  { value: "CONFIRMED", label: "확인" },
  { value: "PREPARING", label: "준비중" },
  { value: "READY", label: "준비완료" },
  { value: "COMPLETED", label: "완료" },
  { value: "CANCELLED", label: "취소" },
];

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  CREATED: "주문접수",
  CONFIRMED: "확인",
  PREPARING: "준비중",
  READY: "준비완료",
  COMPLETED: "완료",
  CANCELLED: "취소",
  REFUNDED: "환불",
};

const ORDER_STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  CREATED: "bg-blue-500/10 text-blue-500",
  CONFIRMED: "bg-indigo-500/10 text-indigo-500",
  PREPARING: "bg-yellow-500/10 text-yellow-600",
  READY: "bg-green-500/10 text-green-600",
  COMPLETED: "bg-gray-500/10 text-gray-600",
  CANCELLED: "bg-red-500/10 text-red-600",
  REFUNDED: "bg-purple-500/10 text-purple-600",
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
  // 우선순위 1: firstItemName + firstItemQty + itemCount 사용
  const firstName = order.firstItemName ?? order.first_item_name;
  const firstQty = order.firstItemQty ?? order.first_item_qty;
  const itemCount = order.item_count ?? order.itemCount;

  if (firstName) {
    const qtyLabel = firstQty ? `${firstQty}개` : "1개";
    if (itemCount && itemCount > 1) {
      return `${firstName} ${qtyLabel} 외 ${itemCount - 1}개`;
    }
    return `${firstName} ${qtyLabel}`;
  }

  // 우선순위 2: items 배열 사용
  const items = order.items ?? order.order_items;
  if (items && items.length > 0) {
    const first = items[0];
    const qtyLabel = first.qty ? `${first.qty}개` : "1개";
    if (items.length > 1) {
      return `${first.name} ${qtyLabel} 외 ${items.length - 1}개`;
    }
    return `${first.name} ${qtyLabel}`;
  }

  // 우선순위 3: count만 있는 경우
  if (itemCount) return `총 ${itemCount}개`;
  return "-";
}

function escapeCSVField(value: string | number): string {
  const str = String(value);
  // 쉼표, 줄바꿈, 따옴표가 있으면 따옴표로 감싸기
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCSV(orders: Order[], branchMap: Map<string, string>) {
  if (orders.length === 0) return;

  // CSV 헤더
  const headers = [
    "주문번호",
    "지점명",
    "주문일시",
    "고객명",
    "상태",
    "결제금액",
    "상품",
  ];

  // CSV 행 생성
  const rows = orders.map((order) => {
    // 지점명 매핑
    const branchId = order.branch_id ?? order.branchId;
    const branchName = branchId
      ? (branchMap.get(branchId) ?? order.branchName ?? "-")
      : (order.branchName ?? "-");

    // 상품 정보: itemsSummary 우선, 없으면 getItemSummary fallback
    const itemsSummary = order.itemsSummary ?? order.items_summary;
    const itemsForDownload = itemsSummary || getItemSummary(order);

    return [
      escapeCSVField(order.orderNo ?? order.id.slice(0, 8)),
      escapeCSVField(branchName),
      escapeCSVField(formatYmdHm(order.orderedAt)),
      escapeCSVField(order.customerName || "-"),
      escapeCSVField(ORDER_STATUS_LABEL[order.status]),
      escapeCSVField(order.totalAmount),
      escapeCSVField(itemsForDownload),
    ].join(",");
  });

  // UTF-8 BOM + 헤더 + 데이터
  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");

  // Blob 생성 및 다운로드
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  // 파일명: orders_YYYYMMDD_HHmm.csv
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const filename = `orders_${year}${month}${day}_${hour}${minute}.csv`;

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function downloadExcel(orders: Order[], branchMap: Map<string, string>) {
  if (orders.length === 0) return;

  // Dynamic import로 번들 사이즈 최적화
  const XLSX = await import("xlsx");

  // 엑셀 데이터 생성
  const data = [
    // 헤더
    ["주문번호", "지점명", "주문일시", "고객명", "상태", "결제금액", "상품"],
    // 데이터 행
    ...orders.map((order) => {
      // 지점명 매핑
      const branchId = order.branch_id ?? order.branchId;
      const branchName = branchId
        ? (branchMap.get(branchId) ?? order.branchName ?? "-")
        : (order.branchName ?? "-");

      // 상품 정보: itemsSummary 우선, 없으면 getItemSummary fallback
      const itemsSummary = order.itemsSummary ?? order.items_summary;
      const itemsForDownload = itemsSummary || getItemSummary(order);

      return [
        order.orderNo ?? order.id.slice(0, 8),
        branchName,
        formatYmdHm(order.orderedAt),
        order.customerName || "-",
        ORDER_STATUS_LABEL[order.status],
        order.totalAmount,
        itemsForDownload,
      ];
    }),
  ];

  // 워크시트 생성
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // 컬럼 너비 설정 (선택사항)
  worksheet["!cols"] = [
    { wch: 18 }, // 주문번호
    { wch: 12 }, // 지점명
    { wch: 16 }, // 주문일시
    { wch: 12 }, // 고객명
    { wch: 10 }, // 상태
    { wch: 12 }, // 결제금액
    { wch: 35 }, // 상품 (itemsSummary 때문에 더 넓게)
  ];

  // 워크북 생성
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "주문목록");

  // 파일명: orders_YYYYMMDD_HHmm.xlsx
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const filename = `orders_${year}${month}${day}_${hour}${minute}.xlsx`;

  // 파일 다운로드
  XLSX.writeFile(workbook, filename);
}

function formatYmdHm(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}


// ============================================================
// Sub-components
// ============================================================

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

function TableRowSkeleton({ cols }: { cols: number }) {
  return (
    <tr className="border-t border-border">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3 px-3.5">
          <div className="h-4 w-full max-w-[140px] bg-bg-tertiary rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}


// ============================================================
// Main Component
// ============================================================

export default function CustomerOrdersPage() {
  const router = useRouter();
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

  // 지점 ID → 지점명 매핑
  const branchMap = useMemo(() => {
    return new Map(branches.map((b) => [b.id, b.name]));
  }, [branches]);

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
      await createOrderExportJob({
        format: "csv",
        scope: "detail",
        filters: {
          ...(branchFilter !== "ALL" && isUuidFormat(branchFilter) ? { branchId: branchFilter } : {}),
          ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
          ...(exportDateStart ? { dateStart: exportDateStart } : {}),
          ...(exportDateEnd ? { dateEnd: exportDateEnd } : {}),
        },
      });
      setShowExportModal(false);
      alert("Export 작업이 생성되었습니다.");
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Export 생성에 실패했습니다");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
        <h1 className="text-2xl font-extrabold text-foreground m-0">주문 관리</h1>
        <p className="text-text-secondary mt-1 mb-0 text-[13px]">
          총 <span className="font-bold text-foreground">{total}</span>건
          {activeCount > 0 && (
            <span className="inline-flex items-center gap-1 text-sm text-primary-500 font-semibold ml-3">
              <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse-slow" />
              진행중 {activeCount}건
            </span>
          )}
        </p>
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
        <div className="mb-4">
          <label className="block text-[13px] text-text-secondary mb-2 font-semibold">
            지점 필터
          </label>
          <select
            value={branchFilter}
            onChange={(e) => {
              setBranchFilter(e.target.value);
              setPage(1);
            }}
            className="input-field max-w-[280px]"
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
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 mb-4">
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
                border transition-all duration-150 cursor-pointer
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
        <div className="border border-danger-500 rounded-xl p-4 bg-danger-500/10 text-danger-500 mb-4">
          {error}
        </div>
      )}

      {/* Order table */}
      {loading && orders.length === 0 ? (
        <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full border-collapse min-w-[640px]">
            <thead className="bg-bg-tertiary">
              <tr>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">주문번호</th>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">고객명</th>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">상품</th>
                {validBranches.length > 1 && (
                  <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">지점</th>
                )}
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">상태</th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">금액</th>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">주문시간</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, index) => (
                <TableRowSkeleton key={index} cols={validBranches.length > 1 ? 7 : 6} />
              ))}
            </tbody>
          </table>
        </div>
      ) : orders.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full border-collapse min-w-[640px]">
            <thead className="bg-bg-tertiary">
              <tr>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">주문번호</th>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">고객명</th>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">상품</th>
                {validBranches.length > 1 && (
                  <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">지점</th>
                )}
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">상태</th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">금액</th>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">주문시간</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const itemSummary = getItemSummary(order);
                const fullItemsSummary = order.itemsSummary ?? order.items_summary;

                // 지점 ID 추출 (snake_case 또는 camelCase)
                const branchId = order.branch_id ?? order.branchId;
                // 지점명 매핑 (branchMap → order.branchName → "-")
                const branchName = branchId
                  ? (branchMap.get(branchId) ?? order.branchName ?? "-")
                  : (order.branchName ?? "-");

                return (
                  <tr
                    key={order.id}
                    className="border-t border-border cursor-pointer hover:bg-bg-tertiary transition-colors"
                    onClick={() => router.push(`/customer/orders/${order.id}`)}
                  >
                    <td className="py-3 px-3.5 text-[13px] text-foreground">
                      <span className="font-mono font-bold">
                        {order.orderNo ?? order.id.slice(0, 8)}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-[13px] text-foreground">
                      {order.customerName || "-"}
                    </td>
                    <td
                      className="py-3 px-3.5 text-[13px] text-text-secondary relative group"
                      onClick={(e) => {
                        if (fullItemsSummary) {
                          e.stopPropagation();
                        }
                      }}
                    >
                      <span className={fullItemsSummary ? "cursor-help" : ""}>
                        {itemSummary}
                      </span>
                      {fullItemsSummary && (
                        <div className="absolute left-0 top-full mt-1 z-10 hidden group-hover:block bg-bg-secondary border border-border rounded-lg shadow-lg p-3 text-xs whitespace-nowrap max-w-xs">
                          {fullItemsSummary}
                        </div>
                      )}
                    </td>
                    {validBranches.length > 1 && (
                      <td className="py-3 px-3.5 text-[13px] text-foreground whitespace-nowrap">
                        {branchName}
                      </td>
                    )}
                    <td className="py-3 px-3.5 text-[13px]">
                      <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold ${ORDER_STATUS_BADGE_CLASS[order.status]}`}>
                        {ORDER_STATUS_LABEL[order.status]}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-[13px] text-right font-bold text-foreground">
                      {formatWon(order.totalAmount)}
                    </td>
                    <td className="py-3 px-3.5 text-[13px] text-text-secondary whitespace-nowrap">
                      <div>{formatYmdHm(order.orderedAt)}</div>
                      <div className="text-xs text-text-tertiary">
                        {formatRelativeTime(order.orderedAt)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
