'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { formatRelativeTime, formatWon } from '@/lib/format';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import {
  FULFILLMENT_TYPE_LABEL,
  type DepositMatchStatus,
  type Branch,
  type FulfillmentType,
  type OrderStatus,
  type OrderStatusDisplay,
} from '@/types/common';
import { createOrderExportJob } from '@/lib/exports';

// ============================================================
// Types
// ============================================================

type Brand = {
  id: string;
  name: string;
};

type Order = {
  id: string;
  orderNo: string | null;
  customerName: string;
  totalAmount: number;
  status: OrderStatus;
  depositMatchStatus?: DepositMatchStatus | null;
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

const BULK_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'CONFIRMED', label: '주문확인' },
  { value: 'PREPARING', label: '준비중' },
  { value: 'READY', label: '준비완료' },
  { value: 'COMPLETED', label: '주문완료' },
  { value: 'CANCELLED', label: '취소' },
];

const BULK_STATUS_OPTIONS_WITH_REFUND: { value: OrderStatus; label: string }[] = [
  ...BULK_STATUS_OPTIONS.slice(0, 4),
  { value: 'REFUNDED', label: '환불' },
  ...BULK_STATUS_OPTIONS.slice(4),
];

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  CREATED: '주문접수',
  CONFIRMED: '주문확인',
  PREPARING: '준비중',
  READY: '준비완료',
  COMPLETED: '주문완료',
  CANCELLED: '취소',
  REFUNDED: '취소',
};

ORDER_STATUS_LABEL.REFUNDED = '환불';

// Active statuses: filled + ring (high visual weight)
// Terminal statuses: muted (low visual weight)
const ORDER_STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  CREATED:   'bg-blue-500/15 text-blue-600 ring-1 ring-inset ring-blue-500/40',
  CONFIRMED: 'bg-blue-500/15 text-blue-600 ring-1 ring-inset ring-blue-500/40',
  PREPARING: 'bg-amber-500/15 text-amber-700 ring-1 ring-inset ring-amber-500/40',
  READY:     'bg-emerald-500/15 text-emerald-700 ring-1 ring-inset ring-emerald-500/40',
  COMPLETED: 'bg-emerald-500/15 text-emerald-700 ring-1 ring-inset ring-emerald-500/40',
  CANCELLED: 'bg-red-500/10 text-red-500',
  REFUNDED:  'bg-red-500/10 text-red-500',
};

const DEPOSIT_MATCH_LABEL: Record<DepositMatchStatus, string> = {
  PENDING: '입금대기',
  AUTO_MATCHED: '입금확인',
};

const DEPOSIT_MATCH_BADGE_CLASS: Record<DepositMatchStatus, string> = {
  PENDING:
    'bg-amber-500/15 text-amber-700 ring-1 ring-inset ring-amber-500/40',
  AUTO_MATCHED:
    'bg-emerald-500/15 text-emerald-700 ring-1 ring-inset ring-emerald-500/40',
};

const FULFILLMENT_FILTERS: { value: FulfillmentType | 'ALL'; label: string }[] =
  [
    { value: 'ALL', label: '전체 방식' },
    { value: 'PICKUP', label: '포장' },
    { value: 'DELIVERY', label: '배달' },
    { value: 'DINE_IN', label: '직접 수령' },
    { value: 'SHIPPING', label: '택배' },
  ];

const DEPOSIT_STATUS_FILTERS: {
  value: DepositMatchStatus | 'ALL';
  label: string;
}[] = [
  { value: 'ALL', label: '입금여부' },
  { value: 'AUTO_MATCHED', label: '입금확인' },
  { value: 'PENDING', label: '미확인' },
];

// Outlined style: subordinate visual weight compared to status badges
const FULFILLMENT_BADGE_CLASS: Record<FulfillmentType, string> = {
  PICKUP:   'border border-sky-400/70 text-sky-600',
  DELIVERY: 'border border-orange-400/70 text-orange-600',
  DINE_IN:  'border border-neutral-400/70 text-neutral-500',
  SHIPPING: 'border border-violet-400/70 text-violet-600',
};

const DISPLAY_STATUS_GROUPS: Record<OrderStatusDisplay, OrderStatus[]> = {
  RECEIVED: ['CREATED', 'CONFIRMED'],
  PREPARING: ['PREPARING'],
  READY: ['READY', 'COMPLETED'],
  CANCELLED: ['CANCELLED', 'REFUNDED'],
};

type AutoRefreshMode = 'FAST' | 'DEFAULT' | 'SAVE';

const AUTO_REFRESH_INTERVAL_BY_MODE: Record<AutoRefreshMode, number> = {
  FAST: 5_000,
  DEFAULT: 10_000,
  SAVE: 30_000,
};

const DELAY_THRESHOLD_MS = 20 * 60 * 1000;

// ============================================================
// Helpers
// ============================================================

const UUID_FORMAT_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuidFormat(value: string): boolean {
  return UUID_FORMAT_REGEX.test(value);
}

function getTotalQty(order: Order): number | null {
  const items = order.items ?? order.order_items;
  if (items && items.length > 0) {
    return items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
  }

  // 백엔드가 총수량을 내려주는 경우(이 필드 의미가 총수량이면 그대로 사용)
  const fallback = order.item_count ?? order.itemCount;
  return typeof fallback === "number" ? fallback : null;
}

function getItemSummary(order: Order): string {
  const firstName = order.firstItemName ?? order.first_item_name;

  const firstQtyRaw = order.firstItemQty ?? order.first_item_qty;
  const firstQty = typeof firstQtyRaw === "number" ? firstQtyRaw : 1;

  const totalQty = getTotalQty(order);

  if (firstName) {
    const qtyLabel = `${firstQty}개`;

    // totalQty가 있으면 "총 수량" 기준으로 "외 N개" 계산
    if (totalQty && totalQty > firstQty) {
      return `${firstName} ${qtyLabel} 외 ${totalQty - firstQty}개`;
    }
    return `${firstName} ${qtyLabel}`;
  }

  // firstItem 정보가 없으면 items로 대체
  const items = order.items ?? order.order_items;
  if (items && items.length > 0) {
    const first = items[0];
    const fq = Number(first.qty) || 1;
    const total = items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);

    if (total > fq) return `${first.name} ${fq}개 외 ${total - fq}개`;
    return `${first.name} ${fq}개`;
  }

  if (totalQty) return `총 ${totalQty}개`;
  return "-";
}

function formatYmdHm(iso: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

// ✅ [추가] 상태 전이 규칙
const ORDER_FLOW: OrderStatus[] = ["CREATED", "CONFIRMED", "PREPARING", "READY", "COMPLETED"];

function canTransition(from: OrderStatus, to: OrderStatus) {
  if (from === to) return false;

  // terminal
  if (from === "CANCELLED" || from === "REFUNDED") return false;
  if (from === "COMPLETED") return to === "REFUNDED";

  // cancel allowed from non-terminal
  if (to === "CANCELLED") return true;

  // step-by-step only
  const fi = ORDER_FLOW.indexOf(from);
  const ti = ORDER_FLOW.indexOf(to);
  if (fi === -1 || ti === -1) return false;

  return ti === fi + 1;
}

function getAllowedTargetsForSelection(selectedOrders: Order[]) {
  if (selectedOrders.length === 0) return BULK_STATUS_OPTIONS_WITH_REFUND;

  const perOrderAllowed = selectedOrders.map((o) =>
    BULK_STATUS_OPTIONS_WITH_REFUND.map((opt) => opt.value).filter((target) => canTransition(o.status, target)),
  );

  const intersection = perOrderAllowed.reduce<Set<OrderStatus> | null>((acc, cur) => {
    if (acc === null) return new Set(cur);
    for (const v of Array.from(acc)) if (!cur.includes(v)) acc.delete(v);
    return acc;
  }, null);

  const allowed = intersection ?? new Set<OrderStatus>();
  return BULK_STATUS_OPTIONS_WITH_REFUND.filter((opt) => allowed.has(opt.value));
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

function getTodayYmd(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

// ── ExportDialog ─────────────────────────────────────────────

type ExportDialogProps = {
  selectedCount: number;
  exporting: boolean;
  onClose: () => void;
  onDownload: (format: 'csv' | 'xlsx') => void;
};

function ExportDialog({
  selectedCount,
  exporting,
  onClose,
  onDownload,
}: ExportDialogProps) {
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv');

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !exporting) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [exporting, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
      onClick={() => { if (!exporting) onClose(); }}
    >
      <div
        className="relative w-full max-w-sm bg-[#FAFAFA] dark:bg-neutral-900 rounded-2xl border border-border shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-export-dialog-title"
      >
        <h2 id="order-export-dialog-title" className="text-lg font-bold text-foreground mb-5">주문 내보내기</h2>

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

        <div className="mb-6 rounded-lg border border-border bg-bg-secondary p-3 text-sm text-text-secondary">
          현재 버전에서는 <strong className="text-foreground">필터 결과 전체</strong>만 내보내기를 지원합니다.
          {selectedCount > 0 && (
            <span className="ml-1">선택된 {selectedCount}건은 다음 업데이트에서 지원 예정입니다.</span>
          )}
        </div>

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
            onClick={() => onDownload(format)}
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
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<OrderStatusDisplay | 'ALL'>('ALL');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<
    FulfillmentType | 'ALL'
  >('ALL');
  const [brandFilter, setBrandFilter] = useState<string>('ALL');
  const [depositStatusFilter, setDepositStatusFilter] = useState<
    DepositMatchStatus | 'ALL'
  >('ALL');

  // Date range: input (staged) vs applied (active)
  const [dateStartInput, setDateStartInput] = useState(() => getTodayYmd());
  const [dateEndInput, setDateEndInput] = useState(() => getTodayYmd());
  const [appliedDateStart, setAppliedDateStart] = useState(() => getTodayYmd());
  const [appliedDateEnd, setAppliedDateEnd] = useState(() => getTodayYmd());
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

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
  const [showBulkConfirmModal, setShowBulkConfirmModal] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [autoRefreshMode, setAutoRefreshMode] = useState<AutoRefreshMode>('DEFAULT');
  const [lastAutoRefreshAt, setLastAutoRefreshAt] = useState<Date | null>(null);

  // ✅ [추가] 선택된 주문 객체들
  const selectedOrders = useMemo(() => {
    if (selectedOrderIds.size === 0) return [];
    const map = new Map(orders.map((o) => [o.id, o]));
    return Array.from(selectedOrderIds)
      .map((id) => map.get(id))
      .filter(Boolean) as Order[];
  }, [orders, selectedOrderIds]);

  const bulkAllowedOptions = useMemo(() => {
    if (selectedOrders.length === 0) {
      return BULK_STATUS_OPTIONS_WITH_REFUND;
    }

    return getAllowedTargetsForSelection(selectedOrders);
  }, [selectedOrders]);

  const bulkAllowedSet = useMemo(
    () => new Set(bulkAllowedOptions.map((option) => option.value)),
    [bulkAllowedOptions],
  );

  useEffect(() => {
    if (selectedOrders.length === 0) return;

    // bulkStatus가 불가면, 가능한 첫번째 상태로 자동 변경
    if (!bulkAllowedSet.has(bulkStatus)) {
      const firstAllowed =
        bulkAllowedOptions[0]?.value ??
        'CONFIRMED';
      setBulkStatus(firstAllowed);
    }
  }, [selectedOrders.length, bulkAllowedOptions, bulkAllowedSet, bulkStatus]);


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

  const [summaryBranch, setSummaryBranch] = useState<string>("ALL");
  const [summaryFulfillment, setSummaryFulfillment] = useState<FulfillmentType | "ALL">("ALL");
  const [summaryDepositStatus, setSummaryDepositStatus] = useState<
    DepositMatchStatus | 'ALL'
  >('ALL');

  //카드 기준 레이블: "오늘 기준" vs "조회 기준"
  const isTodayRange = useMemo(() => {
    const today = getTodayYmd();
    return appliedDateStart === today && appliedDateEnd === today;
  }, [appliedDateStart, appliedDateEnd]);

  const cardBasisLabel = isTodayRange ? "오늘 기준" : "조회 기준";

  // Summary (기간/지점/방식 기준 고정)
  const [summaryCounts, setSummaryCounts] = useState<Record<OrderStatus, number>>({
    CREATED: 0,
    CONFIRMED: 0,
    PREPARING: 0,
    READY: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    REFUNDED: 0,
  });
  const [summaryTotal, setSummaryTotal] = useState(0);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Load base metadata in parallel once.
  useEffect(() => {
    let active = true;

    const loadBaseMeta = async () => {
      try {
        const [branchList, brandList] = await Promise.all([
          apiClient.get<Branch[]>('/customer/branches'),
          apiClient.get<Brand[]>('/customer/brands'),
        ]);

        if (!active) return;
        setBranches(branchList);
        setBrands(brandList);
      } catch (e) {
        console.error(e);
      }
    };

    void loadBaseMeta();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        setSummaryLoading(true);

        const baseParams = new URLSearchParams({
          page: "1",
          limit: "1", // 총 개수만 필요
        });

        if (summaryBranch !== "ALL" && isUuidFormat(summaryBranch)) {
          baseParams.append("branchId", summaryBranch);
        }
        if (summaryFulfillment !== "ALL") {
          baseParams.append("fulfillmentType", summaryFulfillment);
        }
        if (summaryDepositStatus !== 'ALL') {
          baseParams.append('depositStatus', summaryDepositStatus);
        }
        if (appliedDateStart) baseParams.append("dateStart", appliedDateStart);
        if (appliedDateEnd) baseParams.append("dateEnd", appliedDateEnd);

        // 총합(상태 ALL)
        const totalRes = await apiClient.get<OrderListResponse | Order[]>(
          `/customer/orders?${baseParams.toString()}`,
        );
        const totalCount = Array.isArray(totalRes)
          ? totalRes.length
          : totalRes.pagination?.total || totalRes.total || 0;

        // 상태별 카운트
        const STATUSES: OrderStatus[] = [
          "CREATED",
          "CONFIRMED",
          "PREPARING",
          "READY",
          "COMPLETED",
          "CANCELLED",
          "REFUNDED",
        ];

        const results = await Promise.all(
          STATUSES.map(async (s) => {
            const p = new URLSearchParams(baseParams);
            p.append("status", s);

            const res = await apiClient.get<OrderListResponse | Order[]>(
              `/customer/orders?${p.toString()}`,
            );

            const count = Array.isArray(res)
              ? res.length
              : res.pagination?.total || res.total || 0;

            return [s, count] as const;
          }),
        );

        setSummaryTotal(totalCount);
        setSummaryCounts((prev) => {
          const next = { ...prev };
          for (const [s, c] of results) next[s] = c;
          return next;
        });
      } catch (e) {
        console.error(e);
        // 요약 실패해도 리스트는 동작해야 하니 error state는 건드리지 않는 걸 추천
      } finally {
        setSummaryLoading(false);
      }
    };

    void loadSummary();
  }, [
    summaryBranch,
    summaryFulfillment,
    summaryDepositStatus,
    appliedDateStart,
    appliedDateEnd,
    reloadToken,
  ]);


  useEffect(() => {
    if (branchFilter !== 'ALL' && !isUuidFormat(branchFilter)) {
      setBranchFilter('ALL');
      setPage(1);
    }
  }, [branchFilter]);

  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const intervalMs = AUTO_REFRESH_INTERVAL_BY_MODE[autoRefreshMode];
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setReloadToken((prev) => prev + 1);
      setLastAutoRefreshAt(new Date());
    }, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [autoRefreshEnabled, autoRefreshMode]);


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
        if (fulfillmentFilter !== 'ALL') {
          params.append('fulfillmentType', fulfillmentFilter);
        }
        if (depositStatusFilter !== 'ALL') {
          params.append('depositStatus', depositStatusFilter);
        }
        if (appliedDateStart) {
          params.append('dateStart', appliedDateStart);
        }
        if (appliedDateEnd) {
          params.append('dateEnd', appliedDateEnd);
        }
        if (appliedSearch) {
          params.append('search', appliedSearch);
        }

        let orderItems: Order[] = [];
        let nextTotal = 0;

        if (statusFilter === 'ALL') {
          const data = await apiClient.get<OrderListResponse | Order[]>(
            `/customer/orders?${params.toString()}`,
          );
          orderItems = Array.isArray(data)
            ? data
            : data.data || data.items || [];
          nextTotal = Array.isArray(data)
            ? data.length
            : data.pagination?.total || data.total || orderItems.length || 0;
        } else {
          const groupedStatuses = DISPLAY_STATUS_GROUPS[statusFilter];
          const groupedLimit = Math.max(limit * page, limit);

          const groupedResponses = await Promise.all(
            groupedStatuses.map(async (status) => {
              const groupedParams = new URLSearchParams(params);
              groupedParams.set('page', '1');
              groupedParams.set('limit', groupedLimit.toString());
              groupedParams.append('status', status);

              const response = await apiClient.get<OrderListResponse | Order[]>(
                `/customer/orders?${groupedParams.toString()}`,
              );

              const items = Array.isArray(response)
                ? response
                : response.data || response.items || [];
              const totalCount = Array.isArray(response)
                ? response.length
                : response.pagination?.total || response.total || items.length || 0;

              return { items, totalCount };
            }),
          );

          orderItems = groupedResponses
            .flatMap((result) => result.items)
            .sort(
              (a, b) =>
                new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime(),
            )
            .slice((page - 1) * limit, page * limit);

          nextTotal = groupedResponses.reduce(
            (sum, result) => sum + result.totalCount,
            0,
          );
        }

        setOrders(orderItems);
        setSelectedOrderIds((prev) => {
          if (prev.size === 0) return prev;
          const visibleIds = new Set(orderItems.map((item) => item.id));
          return new Set(
            Array.from(prev).filter((orderId) => visibleIds.has(orderId)),
          );
        });
        setTotal(nextTotal);
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
    depositStatusFilter,
    appliedDateStart,
    appliedDateEnd,
    appliedSearch,
    reloadToken,
  ]);

  const totalPages = Math.ceil(total / limit);

  const receivedCount =
    (summaryCounts.CREATED ?? 0) + (summaryCounts.CONFIRMED ?? 0);
  const readyCount =
    (summaryCounts.READY ?? 0) + (summaryCounts.COMPLETED ?? 0);
  const cancelledCount =
    (summaryCounts.CANCELLED ?? 0) + (summaryCounts.REFUNDED ?? 0);
  const activeCount =
    receivedCount + (summaryCounts.PREPARING ?? 0) + readyCount;
  const newOrderCount = receivedCount;
  const unhandledCount = receivedCount;
  const delayedCount = useMemo(() => {
    const now = Date.now();
    return orders.filter((order) => {
      if (!['CREATED', 'CONFIRMED', 'PREPARING'].includes(order.status)) {
        return false;
      }
      const orderedAtMs = new Date(order.orderedAt).getTime();
      if (!Number.isFinite(orderedAtMs)) return false;
      return now - orderedAtMs >= DELAY_THRESHOLD_MS;
    }).length;
  }, [orders]);
  const selectedCount = selectedOrderIds.size;
  // ✅ 금액 합계 (현재 페이지 / 선택)
  const pageTotalAmount = useMemo(() => {
    return orders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  }, [orders]);

  const selectedTotalAmount = useMemo(() => {
    return selectedOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  }, [selectedOrders]);

  const allVisibleSelected =
    orders.length > 0 && orders.every((order) => selectedOrderIds.has(order.id));



  
  // 조회 버튼: staged → applied + page reset
  const handleApplyFilter = () => {
    setAppliedDateStart(dateStartInput);
    setAppliedDateEnd(dateEndInput);
    setAppliedSearch(searchInput.trim());

    // ✅ 조회 버튼 누르면 상태는 전체로 초기화
    setStatusFilter("ALL");

    // ✅ 요약은 조회 버튼 눌렀을 때만 고정 업데이트
    setSummaryBranch(branchFilter);
    setSummaryFulfillment(fulfillmentFilter);
    setSummaryDepositStatus(depositStatusFilter);

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

  const handleBulkStatusUpdate = () => {
    if (selectedCount === 0) return;
    setShowBulkConfirmModal(true);
  };

  const executeBulkStatusUpdate = async () => {
    if (selectedCount === 0) {
      setShowBulkConfirmModal(false);
      return;
    }
    // ✅ [추가] 실행 직전 방어: 불가능한 전이가 섞이면 요청 막기
    const invalid = selectedOrders.filter((o) => !canTransition(o.status, bulkStatus));
    if (invalid.length > 0) {
      toast.error(
        `선택된 주문 중 ${invalid.length}건은 "${ORDER_STATUS_LABEL[bulkStatus]}"로 변경할 수 없습니다.`,
      );
      setShowBulkConfirmModal(false);
      return;
    }
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
      toast.success(
        `${response.updatedCount}건의 주문 상태를 "${ORDER_STATUS_LABEL[bulkStatus]}"(으)로 변경했습니다.`,
      );
      setShowBulkConfirmModal(false);
    } catch (e) {
      console.error(e);
      const message = e instanceof Error ? e.message : '일괄 상태 변경에 실패했습니다';
      setError(message);
      toast.error(message);
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleDownload = async (format: 'csv' | 'xlsx') => {
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
          ...(statusFilter !== 'ALL' &&
          DISPLAY_STATUS_GROUPS[statusFilter].length === 1
            ? { status: DISPLAY_STATUS_GROUPS[statusFilter][0] }
            : {}),
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
        toast.success('다운로드 링크를 새 탭에서 열었습니다.');
      } else {
        toast('아직 처리중입니다. 잠시 후 Export 목록에서 다운로드해 주세요.');
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Export 생성에 실패했습니다');
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
            총 <span className="font-bold text-foreground">{summaryTotal}</span>건
          </span>
          {summaryLoading && (
            <span className="text-[12px] text-text-tertiary">집계 갱신 중...</span>
          )}
          {activeCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[13px] text-primary-500 font-semibold">
              <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse-slow" />
              진행중 {activeCount}건
            </span>
          )}
          <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-600">
            신규 {newOrderCount}
          </span>
          <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
            지연 {delayedCount}
          </span>
          <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-600">
            미처리 {unhandledCount}
          </span>
        </div>
      </div>

      {/* ── Section 1.5: Today Status Summary Cards ── */}
      <div className="mb-4 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2" aria-busy={summaryLoading}>
        {([
          { key: "RECEIVED", label: "주문접수", count: receivedCount },
          { key: "PREPARING", label: "준비중", count: summaryCounts.PREPARING ?? 0 },
          { key: "READY", label: "준비완료", count: readyCount },
          { key: "CANCELLED", label: "취소", count: cancelledCount },
        ] as const).map((c) => {

          return (
            <button
              key={c.key}
              type="button"
              disabled={summaryLoading}
              onClick={() => {
                setStatusFilter(c.key);
                setPage(1);
              }}
              className={`
                text-left rounded-xl border transition-colors py-7 px-8 disabled:opacity-70 disabled:cursor-not-allowed
                ${statusFilter === c.key
                  ? "border-foreground bg-foreground/5"
                  : "border-border bg-bg-secondary hover:bg-bg-tertiary"
                }
              `}
            >
              <div className="text-xs font-semibold text-text-secondary">
                {c.label}
              </div>
              <div className="mt-1 text-2xl font-extrabold text-foreground">
                {c.count}
              </div>
              <div className="mt-1 text-[11px] text-text-tertiary">
                {cardBasisLabel}
              </div>
            </button>
          );
        })}
      </div>


      {/* ── Section 2: OrderFiltersBar ── */}
      <div className="mb-4 rounded-xl border border-border bg-bg-secondary p-3.5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-end">
            <div className="flex flex-1 flex-wrap items-end gap-2">
              <select
                value={brandFilter}
                onChange={(e) => {
                  setBrandFilter(e.target.value);
                  setPage(1);
                }}
                className="input-field h-9 text-sm w-full sm:w-auto sm:min-w-[170px] sm:max-w-[220px]"
              >
                <option value="ALL">모든 브랜드</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>

              {showMultiBranch && (
                <select
                  value={branchFilter}
                  onChange={(e) => {
                    setBranchFilter(e.target.value);
                    setPage(1);
                  }}
                  className="input-field h-9 text-sm w-full sm:w-auto sm:min-w-[150px] sm:max-w-[200px]"
                >
                  <option value="ALL">모든 스토어</option>
                  {validBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              )}

              <select
                value={depositStatusFilter}
                onChange={(e) => {
                  setDepositStatusFilter(e.target.value as DepositMatchStatus | 'ALL');
                  setPage(1);
                }}
                className="input-field h-9 text-sm w-full sm:w-auto sm:min-w-[140px] sm:max-w-[160px]"
                aria-label="입금상태 필터"
              >
                {DEPOSIT_STATUS_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:w-auto sm:min-w-[292px]">
                <input
                  type="date"
                  value={dateStartInput}
                  onChange={(e) => setDateStartInput(e.target.value)}
                  className="input-field h-9 text-sm w-full min-w-0"
                  placeholder="시작일"
                />
                <span className="text-text-tertiary text-sm select-none">~</span>
                <input
                  type="date"
                  value={dateEndInput}
                  min={dateStartInput || undefined}
                  onChange={(e) => setDateEndInput(e.target.value)}
                  className="input-field h-9 text-sm w-full min-w-0"
                  placeholder="종료일"
                />
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-[420px] xl:flex-none">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isInvalidDateRange) {
                    handleApplyFilter();
                  }
                }}
                className="input-field h-9 text-sm w-full min-w-0 sm:flex-1"
                placeholder="상품명/주문번호/고객명 검색"
          aria-label="주문 검색"
        />

              <button
                type="button"
                onClick={handleApplyFilter}
                disabled={isInvalidDateRange}
                className="h-9 px-4 rounded-md bg-foreground text-background text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity w-full sm:w-[92px] sm:shrink-0"
              >
                조회
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-border/70 pt-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-bg-tertiary text-sm text-foreground cursor-pointer select-none w-full sm:w-auto">
                <input
                  type="checkbox"
                  checked={autoRefreshEnabled}
                  onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary cursor-pointer"
                  aria-label="자동 새로고침"
                />
                자동갱신
              </label>
              <select
                value={autoRefreshMode}
                onChange={(e) => setAutoRefreshMode(e.target.value as AutoRefreshMode)}
                className="input-field h-9 text-sm w-full sm:w-auto sm:min-w-[124px] sm:max-w-[140px]"
                aria-label="자동갱신 속도"
                disabled={!autoRefreshEnabled}
              >
                <option value="FAST">빠름(5초)</option>
                <option value="DEFAULT">기본(10초)</option>
                <option value="SAVE">절전(30초)</option>
              </select>

              {lastAutoRefreshAt && (
                <span className="inline-flex h-9 items-center text-xs text-text-tertiary whitespace-nowrap px-1">
                  최근갱신 {lastAutoRefreshAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowExportDialog(true)}
              className="h-9 px-3.5 rounded-md border border-border bg-bg-tertiary text-foreground text-sm font-medium hover:bg-bg-tertiary/80 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap w-full sm:w-auto lg:min-w-[116px]"
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
          </div>
        </div>

        {isInvalidDateRange && (
          <p className="w-full mt-0.5 text-xs text-danger-500">
            종료일은 시작일보다 빠를 수 없습니다.
          </p>
        )}
      </div>

      {/* ── Section 3: OrderQuickChips ── */}
      <div className="mb-4">
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

      
      {/* ✅ 합계 바 (테이블 위) */}
      <div className="mb-2 flex items-center justify-end pr-4">
        <div className="text-xs text-text-tertiary">
          {selectedCount > 0 ? (
            <>
              선택 <span className="font-semibold text-foreground">{selectedCount}건</span> · 합계{" "}
              <span className="font-semibold text-foreground">
                {formatWon(selectedTotalAmount)}
              </span>
              <span className="ml-2 text-text-tertiary">
                (현재 페이지 {orders.length}건 · {formatWon(pageTotalAmount)})
              </span>
            </>
          ) : (
            <>
              현재 페이지 <span className="font-semibold text-foreground">
                {orders.length}건
              </span>{" "}
              · 합계{" "}
              <span className="font-semibold text-foreground">
                {formatWon(pageTotalAmount)}
              </span>
            </>
          )}
        </div>
      </div>     
      {/* ── Order Table ── */} 
      <div className={selectedCount > 0 ? "pb-24" : ""}>
      {loading && orders.length === 0 ? (
        <div className="w-full max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-xl border border-border [touch-action:pan-x] [-webkit-overflow-scrolling:touch]">
          <table className="w-full border-collapse min-w-[720px]">
            <thead className="bg-white">
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
                    스토어
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
        <div className="w-full max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-xl border border-border [touch-action:pan-x] [-webkit-overflow-scrolling:touch]">
          <table className="w-full border-collapse min-w-[720px]">
            <thead className="bg-white">
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
                    스토어
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
                        const items = order.items ?? order.order_items;
                        const hasTooltip = (items && items.length > 0) || !!fullItemsSummary;
                        if (hasTooltip) e.stopPropagation();
                      }}
                    >
                      {(() => {
                        const items = order.items ?? order.order_items;
                        const totalQty = getTotalQty(order);
                        const hasTooltip = (items && items.length > 0) || !!fullItemsSummary;

                        return (
                          <>
                            <span className={hasTooltip ? "cursor-help" : ""}>{itemSummary}</span>

                            {/* 1) items 배열이 있으면: 세로 리스트 툴팁 */}
                            {items && items.length > 0 ? (
                              <div className="absolute left-0 top-full mt-1 z-10 hidden group-hover/item:block">
                                <div className="bg-bg-secondary border border-border rounded-lg shadow-lg p-3 text-xs w-[280px]">
                                  {typeof totalQty === "number" && (
                                    <div className="mb-2 font-semibold text-foreground">
                                      총 {totalQty}개
                                    </div>
                                  )}
                                  <div className="flex flex-col gap-1">
                                    {items.map((it, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-start justify-between gap-3"
                                      >
                                        <span className="text-text-secondary break-words whitespace-normal">
                                          {it.name}
                                        </span>
                                        <span className="text-foreground font-semibold shrink-0">
                                          {Number(it.qty) || 1}개
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : fullItemsSummary ? (
                              // 2) items가 없고 fullItemsSummary 문자열만 있으면: 쉼표 기준으로 줄바꿈
                              <div className="absolute left-0 top-full mt-1 z-10 hidden group-hover/item:block">
                                <div className="bg-bg-secondary border border-border rounded-lg shadow-lg p-3 text-xs w-[280px]">
                                  {typeof totalQty === "number" && (
                                    <div className="mb-2 font-semibold text-foreground">
                                      총 {totalQty}개
                                    </div>
                                  )}
                                  <div className="flex flex-col gap-1">
                                    {fullItemsSummary
                                      .split(",")
                                      .map((s) => s.trim())
                                      .filter(Boolean)
                                      .map((line, i) => (
                                        <div
                                          key={i}
                                          className="text-text-secondary break-words whitespace-normal"
                                        >
                                          {line}
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </>
                        );
                      })()}
                    </td>                    


                    {/* 스토어 (multi-branch only) */}
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
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold ${ORDER_STATUS_BADGE_CLASS[order.status]}`}
                        >
                          {ORDER_STATUS_LABEL[order.status]}
                        </span>
                        {order.depositMatchStatus && (
                          <span
                            className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold ${DEPOSIT_MATCH_BADGE_CLASS[order.depositMatchStatus]}`}
                          >
                            {DEPOSIT_MATCH_LABEL[order.depositMatchStatus]}
                          </span>
                        )}
                      </div>
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
      </div>

      {/* ── Bulk Bottom Bar — fixed, only when selectedCount > 0 ── */}
      {selectedCount > 0 && (
        <div className="
            fixed bottom-0 z-[9999]
            left-0 w-full
            lg:left-[260px] lg:w-[calc(100%-260px)]
            border-t border-border bg-bg-secondary/95 backdrop-blur shadow-lg
          ">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* 왼쪽: 선택 건수 */}
              <div className="flex flex-wrap items-center gap-3 flex-shrink-0 text-sm text-text-secondary">
                <span className="font-semibold text-foreground">
                  {selectedCount}건 선택됨
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedOrderIds(new Set())}
                  disabled={bulkUpdating}
                  className="h-9 px-4 rounded-md border border-border bg-bg-secondary text-sm text-foreground disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  선택 해제
                </button>
              </div>


              {/* 오른쪽: 컨트롤 */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 justify-end w-full sm:w-auto">
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value as OrderStatus)}
                  className="input-field h-9 text-sm w-full sm:w-auto sm:min-w-[120px]"
                  disabled={bulkUpdating || bulkAllowedOptions.length === 0}
                >
                  {bulkAllowedOptions.length === 0 ? (
                    <option value="">변경 가능한 상태 없음</option>
                  ) : (
                    bulkAllowedOptions.map((opt) => (
                      <option
                        key={opt.value}
                        value={opt.value}
                      >
                        {opt.label}
                      </option>
                    ))
                  )}
                </select>

                <button
                  type="button"
                  onClick={() => void handleBulkStatusUpdate()}
                  disabled={bulkUpdating || bulkAllowedOptions.length === 0}
                  className="h-9 px-4 rounded-md bg-foreground text-background text-sm font-semibold disabled:opacity-50 whitespace-nowrap shrink-0 w-full sm:w-auto"
                >
                  {bulkUpdating ? "변경 중..." : "일괄 변경"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ExportDialog */}
      {showExportDialog && (
        <ExportDialog
          selectedCount={selectedCount}
          exporting={exporting}
          onClose={() => setShowExportDialog(false)}
          onDownload={(format) => {
            void handleDownload(format);
          }}
        />
      )}

      <Modal
        open={showBulkConfirmModal}
        title="주문 상태 일괄 변경"
        onClose={() => {
          if (!bulkUpdating) setShowBulkConfirmModal(false);
        }}
        footer={
          <>
            <button
              type="button"
              className="h-9 px-4 rounded-md border border-border bg-bg-secondary text-sm text-foreground disabled:opacity-50"
              onClick={() => setShowBulkConfirmModal(false)}
              disabled={bulkUpdating}
            >
              취소
            </button>
            <button
              type="button"
              className="h-9 px-4 rounded-md bg-foreground text-background text-sm font-semibold disabled:opacity-50"
              onClick={() => void executeBulkStatusUpdate()}
              disabled={bulkUpdating}
            >
              {bulkUpdating ? '변경 중...' : '변경'}
            </button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          선택한 <strong className="text-foreground">{selectedCount}건</strong>의 주문 상태를{' '}
          <strong className="text-foreground">&quot;{ORDER_STATUS_LABEL[bulkStatus]}&quot;</strong>으로 변경하시겠습니까?
        </p>
      </Modal>
      </div>

  );
}
