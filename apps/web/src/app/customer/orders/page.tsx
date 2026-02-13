"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import {
  formatDateTime,
  formatRelativeTime,
  formatWon,
} from "@/lib/format";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_BADGE_CLASS,
  type Branch,
  type OrderStatus,
} from "@/types/common";
import { TableRowSkeleton } from "@/components/ui/Skeleton";


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
  const [downloadFormat, setDownloadFormat] = useState<"csv" | "xlsx">("csv");
  const validBranches = branches.filter((branch) => isUuidFormat(branch.id));

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

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground m-0">주문 관리</h1>
          <p className="text-text-secondary mt-1 mb-0 text-[13px]">
            총 <span className="font-bold text-foreground">{total}</span>건
            {activeCount > 0 && (
              <span className="ml-3 text-primary-500 font-semibold">
                · 진행중 {activeCount}건
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={downloadFormat}
            onChange={(e) => setDownloadFormat(e.target.value as "csv" | "xlsx")}
            className="h-9 px-3 rounded-lg border border-border bg-bg-secondary text-foreground text-[13px] font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            <option value="csv">CSV</option>
            <option value="xlsx">Excel (.xlsx)</option>
          </select>
          <button
            onClick={async () => {
              if (downloadFormat === "csv") {
                downloadCSV(orders, branchMap);
              } else {
                await downloadExcel(orders, branchMap);
              }
            }}
            disabled={orders.length === 0}
            className="h-9 px-4 rounded-lg border border-border bg-primary-500 text-white font-semibold cursor-pointer text-[13px] hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            다운로드
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
    </div>
  );
}
