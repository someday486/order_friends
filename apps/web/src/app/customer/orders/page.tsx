'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { formatRelativeTime, formatWon } from '@/lib/format';
import {
  FULFILLMENT_TYPE_LABEL,
  type Branch,
  type FulfillmentType,
  type OrderStatus,
} from '@/types/common';
import { createOrderExportJob } from '@/lib/exports';

// ============================================================
// Types
// ============================================================

type Order = {
  id: string;
  orderNo: string | null;
  customerName: string;
  totalAmount: number;
  status: OrderStatus;
  fulfillmentType?: FulfillmentType | null;
  fulfillment_type?: FulfillmentType | null;
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

type BulkUpdateStatusResponse = {
  updatedCount: number;
  status: OrderStatus;
  orderIds: string[];
};

// ============================================================
// Constants
// ============================================================

const STATUS_FILTERS: { value: OrderStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'CREATED', label: '주문접수' },
  { value: 'CONFIRMED', label: '확인' },
  { value: 'PREPARING', label: '준비중' },
  { value: 'READY', label: '준비완료' },
  { value: 'COMPLETED', label: '완료' },
  { value: 'CANCELLED', label: '취소' },
];

const BULK_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'CREATED', label: '주문접수' },
  { value: 'CONFIRMED', label: '확인' },
  { value: 'PREPARING', label: '준비중' },
  { value: 'READY', label: '준비완료' },
  { value: 'COMPLETED', label: '완료' },
  { value: 'CANCELLED', label: '취소' },
];

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  CREATED: '주문접수',
  CONFIRMED: '확인',
  PREPARING: '준비중',
  READY: '준비완료',
  COMPLETED: '완료',
  CANCELLED: '취소',
  REFUNDED: '환불',
};

// Active statuses: filled + ring (high visual weight)
// Terminal statuses: muted (low visual weight)
const ORDER_STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  CREATED:   'bg-blue-500/15 text-blue-600 ring-1 ring-inset ring-blue-500/40',
  CONFIRMED: 'bg-indigo-500/15 text-indigo-600 ring-1 ring-inset ring-indigo-500/40',
  PREPARING: 'bg-amber-500/15 text-amber-700 ring-1 ring-inset ring-amber-500/40',
  READY:     'bg-emerald-500/15 text-emerald-700 ring-1 ring-inset ring-emerald-500/40',
  COMPLETED: 'bg-gray-500/10 text-gray-500',
  CANCELLED: 'bg-red-500/10 text-red-500',
  REFUNDED:  'bg-purple-500/10 text-purple-500',
};

const FULFILLMENT_FILTERS: { value: FulfillmentType | 'ALL'; label: string }[] =
  [
    { value: 'ALL', label: '전체 방식' },
    { value: 'PICKUP', label: '포장' },
    { value: 'DELIVERY', label: '배달' },
    { value: 'DINE_IN', label: '매장' },
  ];

// Outlined style: subordinate visual weight compared to status badges
const FULFILLMENT_BADGE_CLASS: Record<FulfillmentType, string> = {
  PICKUP:   'border border-sky-400/70 text-sky-600',
  DELIVERY: 'border border-orange-400/70 text-orange-600',
  DINE_IN:  'border border-neutral-400/70 text-neutral-500',
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
  const firstName = order.firstItemName ?? order.first_item_name;
  const firstQty = order.firstItemQty ?? order.first_item_qty;
  const itemCount = order.item_count ?? order.itemCount;

  if (firstName) {
    const qtyLabel = firstQty ? `${firstQty}개` : '1개';
    if (itemCount && itemCount > 1) {
      return `${firstName} ${qtyLabel} 외 ${itemCount - 1}개`;
    }
    return `${firstName} ${qtyLabel}`;
  }

  const items = order.items ?? order.order_items;
  if (items && items.length > 0) {
    const first = items[0];
    const qtyLabel = first.qty ? `${first.qty}개` : '1개';
    if (items.length > 1) {
      return `${first.name} ${qtyLabel} 외 ${items.length - 1}개`;
    }
    return `${first.name} ${qtyLabel}`;
  }

  if (itemCount) return `총 ${itemCount}개`;
  return '-';
}

function formatYmdHm(iso: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
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
        필터를 변경하거나 새 주문을 기다려주세요.
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

// ── ExportDialog ─────────────────────────────────────────────

type ExportDialogProps = {
  selectedCount: number;
  exporting: boolean;
  onClose: () => void;
  onDownload: (format: 'csv' | 'xlsx', scope: 'filter' | 'selected') => void;
};

function ExportDialog({
  selectedCount,
  exporting,
  onClose,
  onDownload,
}: ExportDialogProps) {
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv');
  const [scope, setScope] = useState<'filter' | 'selected'>('filter');

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !exporting) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [exporting, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => { if (!exporting) onClose(); }}
    >
      <div
        className="relative w-full max-w-sm bg-bg-primary rounded-2xl border border-border shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-foreground mb-5">주문 내보내기</h2>

        {/* Format */}
        <fieldset className="mb-5">
          <legend className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
            형식
          </legend>
          <div className="flex gap-4">
            {(['csv', 'xlsx'] as const).map((f) => (
              <label key={f} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="export-format"
                  value={f}
                  checked={format === f}
                  onChange={() => setFormat(f)}
                  className="accent-primary"
                />
                <span className="text-sm font-medium text-foreground">
                  {f === 'csv' ? 'CSV' : 'Excel (.xlsx)'}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Scope */}
        <fieldset className="mb-6">
          <legend className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
            범위
          </legend>
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="export-scope"
                value="filter"
                checked={scope === 'filter'}
                onChange={() => setScope('filter')}
                className="accent-primary"
              />
              <span className="text-sm font-medium text-foreground">현재 필터 결과</span>
            </label>
            <label
              className={`flex items-center gap-2 ${
                selectedCount === 0 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <input
                type="radio"
                name="export-scope"
                value="selected"
                checked={scope === 'selected'}
                onChange={() => setScope('selected')}
                disabled={selectedCount === 0}
                className="accent-primary"
              />
              <span className="text-sm font-medium text-foreground">
                선택 주문
                {selectedCount > 0 && (
                  <span className="ml-1.5 text-xs text-text-secondary">
                    ({selectedCount}건)
                  </span>
                )}
              </span>
            </label>
          </div>
        </fieldset>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="h-9 px-4 rounded-lg border border-border bg-bg-secondary text-sm font-medium text-foreground hover:bg-bg-tertiary transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => onDownload(format, scope)}
            disabled={exporting}
            className="h-9 px-5 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 min-w-[80px]"
          >
            {exporting ? '처리 중...' : '다운로드'}
          </button>
        </div>
      </div>
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

  // Filters
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<
    FulfillmentType | 'ALL'
  >('ALL');

  // Date range: input (staged) vs applied (active)
  const [dateStartInput, setDateStartInput] = useState('');
  const [dateEndInput, setDateEndInput] = useState('');
  const [appliedDateStart, setAppliedDateStart] = useState('');
  const [appliedDateEnd, setAppliedDateEnd] = useState('');

  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);

  // Export
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Bulk update
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    new Set(),
  );
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>('CONFIRMED');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const validBranches = branches.filter((branch) => isUuidFormat(branch.id));
  const showMultiBranch = validBranches.length > 1;
  // cols: checkbox + 주문/고객 + 상품 + (지점) + 방식 + 상태 + 금액
  const tableCols = showMultiBranch ? 7 : 6;

  const isInvalidDateRange = useMemo(() => {
    if (!dateStartInput || !dateEndInput) return false;
    return dateEndInput < dateStartInput;
  }, [dateStartInput, dateEndInput]);

  const branchMap = useMemo(() => {
    return new Map(branches.map((b) => [b.id, b.name]));
  }, [branches]);

  // Load branches
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const branchList = await apiClient.get<Branch[]>('/customer/branches');
        setBranches(branchList);
      } catch (e) {
        console.error(e);
      }
    };

    void loadBranches();
  }, []);

  useEffect(() => {
    if (branchFilter !== 'ALL' && !isUuidFormat(branchFilter)) {
      setBranchFilter('ALL');
      setPage(1);
    }
  }, [branchFilter]);

  useEffect(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const now = new Date();
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    // staged inputs
    setDateStartInput(today);
    setDateEndInput(today);

    // applied (즉시 조회 조건에 반영)
    setAppliedDateStart(today);
    setAppliedDateEnd(today);

    setPage(1);
  }, []);

  // Load orders — fires on filter changes and 조회 button (via appliedDate* / reloadToken)
  useEffect(() => {
    const loadOrders = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        });

        if (branchFilter !== 'ALL' && isUuidFormat(branchFilter)) {
          params.append('branchId', branchFilter);
        }
        if (statusFilter !== 'ALL') {
          params.append('status', statusFilter);
        }
        if (fulfillmentFilter !== 'ALL') {
          params.append('fulfillmentType', fulfillmentFilter);
        }
        if (appliedDateStart) {
          params.append('dateStart', appliedDateStart);
        }
        if (appliedDateEnd) {
          params.append('dateEnd', appliedDateEnd);
        }

        const data = await apiClient.get<OrderListResponse | Order[]>(
          `/customer/orders?${params.toString()}`,
        );
        const orderItems = Array.isArray(data)
          ? data
          : data.data || data.items || [];
        setOrders(orderItems);
        setSelectedOrderIds((prev) => {
          if (prev.size === 0) return prev;
          const visibleIds = new Set(orderItems.map((item) => item.id));
          return new Set(
            Array.from(prev).filter((orderId) => visibleIds.has(orderId)),
          );
        });
        setTotal(
          Array.isArray(data)
            ? data.length
            : data.pagination?.total || data.total || orderItems.length || 0,
        );
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : '주문을 불러올 수 없습니다');
      } finally {
        setLoading(false);
      }
    };

    void loadOrders();
  }, [
    page,
    limit,
    branchFilter,
    statusFilter,
    fulfillmentFilter,
    appliedDateStart,
    appliedDateEnd,
    reloadToken,
  ]);

  const totalPages = Math.ceil(total / limit);

  const activeCount = orders.filter(
    (o) => !['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(o.status),
  ).length;
  const selectedCount = selectedOrderIds.size;
  const allVisibleSelected =
    orders.length > 0 && orders.every((order) => selectedOrderIds.has(order.id));

  const statusCounts = useMemo(() => {
    const init: Record<OrderStatus, number> = {
      CREATED: 0,
      CONFIRMED: 0,
      PREPARING: 0,
      READY: 0,
      COMPLETED: 0,
      CANCELLED: 0,
      REFUNDED: 0,
    };

    for (const o of orders) {
      init[o.status] = (init[o.status] ?? 0) + 1;
    }

    return init;
  }, [orders]);

  
  // 조회 버튼: staged → applied + page reset
  const handleApplyFilter = () => {
    setAppliedDateStart(dateStartInput);
    setAppliedDateEnd(dateEndInput);
    setPage(1);
  };

  const toggleSelectAllVisible = (checked: boolean) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const order of orders) {
          next.add(order.id);
        }
      } else {
        for (const order of orders) {
          next.delete(order.id);
        }
      }
      return next;
    });
  };

  const handleBulkStatusUpdate = async () => {
    if (selectedCount === 0) return;

    const confirmed = window.confirm(
      `선택한 ${selectedCount}건의 주문 상태를 "${ORDER_STATUS_LABEL[bulkStatus]}"(으)로 변경하시겠습니까?`,
    );
    if (!confirmed) return;

    try {
      setBulkUpdating(true);
      setError(null);

      const response = await apiClient.patch<BulkUpdateStatusResponse>(
        '/customer/orders/bulk-status',
        {
          orderIds: Array.from(selectedOrderIds),
          status: bulkStatus,
        },
      );

      setSelectedOrderIds(new Set());
      setReloadToken((prev) => prev + 1);
      window.alert(
        `${response.updatedCount}건의 주문 상태를 "${ORDER_STATUS_LABEL[bulkStatus]}"(으)로 변경했습니다.`,
      );
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : '일괄 상태 변경에 실패했습니다');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleDownload = async (
    format: 'csv' | 'xlsx',
    _scope: 'filter' | 'selected',
  ) => {
    try {
      setExporting(true);
      // createOrderExportJob polls internally until DONE (45s) and returns downloadUrl
      const result = await createOrderExportJob({
        format,
        scope: 'detail',
        filters: {
          ...(branchFilter !== 'ALL' && isUuidFormat(branchFilter)
            ? { branchId: branchFilter }
            : {}),
          ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
          ...(fulfillmentFilter !== 'ALL'
            ? { fulfillmentType: fulfillmentFilter }
            : {}),
          ...(appliedDateStart ? { dateStart: appliedDateStart } : {}),
          ...(appliedDateEnd ? { dateEnd: appliedDateEnd } : {}),
        },
      });

      const url = result?.downloadUrl;
      if (url) {
        window.open(url, '_blank');
        setShowExportDialog(false);
      } else {
        alert('아직 처리중입니다. 잠시 후 Export 목록에서 다운로드해 주세요.');
      }
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Export 생성에 실패했습니다');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      {/* ── Section 1: OrderPageHeader ── */}
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-foreground m-0">
          주문 관리
        </h1>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[13px] text-text-secondary">
            총 <span className="font-bold text-foreground">{total}</span>건
          </span>
          {activeCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[13px] text-primary-500 font-semibold">
              <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse-slow" />
              진행중 {activeCount}건
            </span>
          )}
        </div>
      </div>

      {/* ── Section 1.5: Today Status Summary Cards ── */}
      <div className="mb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {([
          { key: "CREATED", label: "주문접수" },
          { key: "CONFIRMED", label: "확인" },
          { key: "PREPARING", label: "준비중" },
          { key: "READY", label: "준비완료" },
          { key: "COMPLETED", label: "완료" },
          { key: "CANCELLED", label: "취소" },
        ] as const).map((c) => {
          const k = c.key as OrderStatus;
          const count = statusCounts[k] ?? 0;

          return (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                setStatusFilter(k);
                setPage(1);
              }}
              className="text-left rounded-xl border border-border bg-bg-secondary hover:bg-bg-tertiary transition-colors p-3"
            >
              <div className="text-xs font-semibold text-text-secondary">
                {c.label}
              </div>
              <div className="mt-1 text-2xl font-extrabold text-foreground">
                {count}
              </div>
              <div className="mt-1 text-[11px] text-text-tertiary">
                오늘 기준
              </div>
            </button>
          );
        })}
      </div>


      {/* ── Section 2: OrderFiltersBar ── */}
      <div className="flex flex-wrap items-end gap-2 mb-4 p-3 rounded-xl border border-border bg-bg-secondary">
        {showMultiBranch && (
          <select
            value={branchFilter}
            onChange={(e) => {
              setBranchFilter(e.target.value);
              setPage(1);
            }}
            className="input-field h-9 text-sm min-w-[140px] max-w-[200px]"
          >
            <option value="ALL">모든 지점</option>
            {validBranches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateStartInput}
            onChange={(e) => setDateStartInput(e.target.value)}
            className="input-field h-9 text-sm w-[140px]"
            placeholder="시작일"
          />
          <span className="text-text-tertiary text-sm select-none">~</span>
          <input
            type="date"
            value={dateEndInput}
            min={dateStartInput || undefined}
            onChange={(e) => setDateEndInput(e.target.value)}
            className="input-field h-9 text-sm w-[140px]"
            placeholder="종료일"
          />
        </div>

        <button
          type="button"
          onClick={handleApplyFilter}
          disabled={isInvalidDateRange}
          className="h-9 px-4 rounded-md bg-foreground text-background text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          조회
        </button>

        <div className="hidden sm:block w-px h-7 bg-border mx-1" />

        <button
          type="button"
          onClick={() => setShowExportDialog(true)}
          className="h-9 px-3.5 rounded-md border border-border bg-bg-tertiary text-foreground text-sm font-medium hover:bg-bg-tertiary/80 transition-colors flex items-center gap-1.5 whitespace-nowrap"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7,10 12,15 17,10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          내보내기
        </button>

        {isInvalidDateRange && (
          <p className="w-full mt-0.5 text-xs text-danger-500">
            종료일은 시작일보다 빠를 수 없습니다.
          </p>
        )}
      </div>

      {/* ── Section 3: OrderQuickChips ── */}
      <div className="mb-4 space-y-1.5">
        {/* Status chips */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
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
                  shrink-0 h-7 px-3.5 rounded-full text-xs font-medium
                  border transition-all duration-150 cursor-pointer
                  ${
                    isActive
                      ? 'bg-foreground text-background border-foreground font-bold'
                      : 'bg-bg-secondary text-text-secondary border-border hover:bg-bg-tertiary'
                  }
                `}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Fulfillment chips */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          {FULFILLMENT_FILTERS.map((opt) => {
            const isActive = fulfillmentFilter === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => {
                  setFulfillmentFilter(opt.value);
                  setPage(1);
                }}
                className={`
                  shrink-0 h-7 px-3.5 rounded-full text-xs font-medium
                  border transition-all duration-150 cursor-pointer
                  ${
                    isActive
                      ? 'bg-foreground text-background border-foreground font-bold'
                      : 'bg-bg-secondary text-text-secondary border-border hover:bg-bg-tertiary'
                  }
                `}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="border border-danger-500 rounded-xl p-4 bg-danger-500/10 text-danger-500 mb-4">
          {error}
        </div>
      )}

      {/* ── BulkActionBar — sticky, only when selectedCount > 0 ── */}
      {selectedCount > 0 && (
        <div className="sticky top-0 z-20 mb-3 rounded-xl border border-border bg-bg-secondary/95 backdrop-blur-sm p-3 shadow-md">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm font-bold text-foreground">
              {selectedCount}건 선택됨
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as OrderStatus)}
                className="input-field h-8 text-sm min-w-[130px]"
                disabled={bulkUpdating}
              >
                {BULK_STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  void handleBulkStatusUpdate();
                }}
                disabled={bulkUpdating}
                className="h-8 px-3 rounded-md bg-foreground text-background text-sm font-semibold disabled:opacity-50 whitespace-nowrap"
              >
                {bulkUpdating ? '변경 중...' : '일괄 변경'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedOrderIds(new Set())}
                disabled={bulkUpdating}
                className="h-8 px-3 rounded-md border border-border bg-bg-secondary text-sm text-foreground disabled:opacity-50"
              >
                선택 해제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Order Table ── */}
      {loading && orders.length === 0 ? (
        <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full border-collapse min-w-[640px]">
            <thead className="bg-bg-tertiary">
              <tr>
                <th className="text-center py-3 px-3.5 text-xs font-bold text-text-secondary w-10">
                  선택
                </th>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">
                  주문 / 고객
                </th>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">
                  상품
                </th>
                {showMultiBranch && (
                  <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">
                    지점
                  </th>
                )}
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">
                  방식
                </th>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">
                  상태
                </th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">
                  금액
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, index) => (
                <TableRowSkeleton key={index} cols={tableCols} />
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
                <th className="text-center py-3 px-3.5 text-xs font-bold text-text-secondary w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => toggleSelectAllVisible(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary cursor-pointer"
                    aria-label="전체 선택"
                  />
                </th>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">
                  주문 / 고객
                </th>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">
                  상품
                </th>
                {showMultiBranch && (
                  <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">
                    지점
                  </th>
                )}
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">
                  방식
                </th>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">
                  상태
                </th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">
                  금액
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const itemSummary = getItemSummary(order);
                const fullItemsSummary =
                  order.itemsSummary ?? order.items_summary;
                const branchId = order.branch_id ?? order.branchId;
                const branchName = branchId
                  ? (branchMap.get(branchId) ?? order.branchName ?? '-')
                  : (order.branchName ?? '-');
                const fulfillmentType =
                  order.fulfillmentType ?? order.fulfillment_type;

                return (
                  <tr
                    key={order.id}
                    className="group border-t border-border cursor-pointer hover:bg-bg-tertiary transition-colors"
                    onClick={() => router.push(`/customer/orders/${order.id}`)}
                  >
                    {/* Checkbox */}
                    <td
                      className="py-3 px-3.5 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.has(order.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedOrderIds((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(order.id);
                            else next.delete(order.id);
                            return next;
                          });
                        }}
                        className="w-4 h-4 rounded accent-primary cursor-pointer"
                        aria-label={`주문 ${order.orderNo ?? order.id.slice(0, 8)} 선택`}
                      />
                    </td>

                    {/* 주문번호 + 고객명 · 주문시간 (2-line) */}
                    <td
                      className="py-2.5 px-3.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Line 1: 주문번호 + 복사 버튼 */}
                      <div className="flex items-center gap-1.5">
                        <span
                          className="font-mono text-[13px] font-bold text-foreground cursor-pointer hover:text-primary-500 transition-colors"
                          onClick={() =>
                            router.push(`/customer/orders/${order.id}`)
                          }
                        >
                          {order.orderNo ?? order.id.slice(0, 8)}
                        </span>
                        <button
                          type="button"
                          title="주문번호 복사"
                          onClick={() => {
                            void navigator.clipboard.writeText(
                              order.orderNo ?? order.id,
                            );
                          }}
                          className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-text-tertiary hover:text-foreground transition-all p-0.5 rounded"
                        >
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                        </button>
                      </div>
                      {/* Line 2: 고객명 · 주문시간 */}
                      <div
                        className="text-xs text-text-secondary mt-0.5 cursor-pointer"
                        onClick={() =>
                          router.push(`/customer/orders/${order.id}`)
                        }
                      >
                        {order.customerName || '-'}
                        <span className="mx-1 text-text-tertiary">·</span>
                        {formatYmdHm(order.orderedAt)}
                        <span className="ml-1.5 text-text-tertiary">
                          {formatRelativeTime(order.orderedAt)}
                        </span>
                      </div>
                    </td>

                    {/* 상품 */}
                    <td
                      className="py-3 px-3.5 text-[13px] text-text-secondary relative group/item"
                      onClick={(e) => {
                        if (fullItemsSummary) {
                          e.stopPropagation();
                        }
                      }}
                    >
                      <span className={fullItemsSummary ? 'cursor-help' : ''}>
                        {itemSummary}
                      </span>
                      {fullItemsSummary && (
                        <div className="absolute left-0 top-full mt-1 z-10 hidden group-hover/item:block bg-bg-secondary border border-border rounded-lg shadow-lg p-3 text-xs whitespace-nowrap max-w-xs">
                          {fullItemsSummary}
                        </div>
                      )}
                    </td>

                    {/* 지점 (multi-branch only) */}
                    {showMultiBranch && (
                      <td className="py-3 px-3.5 text-[13px] text-foreground whitespace-nowrap">
                        {branchName}
                      </td>
                    )}

                    {/* 방식 */}
                    <td className="py-3 px-3.5 text-[13px]">
                      {fulfillmentType ? (
                        <span
                          className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-medium ${FULFILLMENT_BADGE_CLASS[fulfillmentType]}`}
                        >
                          {FULFILLMENT_TYPE_LABEL[fulfillmentType]}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>

                    {/* 상태 */}
                    <td className="py-3 px-3.5 text-[13px]">
                      <span
                        className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold ${ORDER_STATUS_BADGE_CLASS[order.status]}`}
                      >
                        {ORDER_STATUS_LABEL[order.status]}
                      </span>
                    </td>

                    {/* 금액 */}
                    <td className="py-3 px-3.5 text-[13px] text-right font-bold text-foreground">
                      {formatWon(order.totalAmount)}
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
                      ? 'bg-foreground text-background'
                      : 'border border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
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

      {/* ExportDialog */}
      {showExportDialog && (
        <ExportDialog
          selectedCount={selectedCount}
          exporting={exporting}
          onClose={() => setShowExportDialog(false)}
          onDownload={(format, scope) => {
            void handleDownload(format, scope);
          }}
        />
      )}
    </div>
  );
}
