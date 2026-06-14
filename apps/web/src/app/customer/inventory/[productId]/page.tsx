'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Download, Search, X } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { exportToExcel } from '@/lib/excel-export';
import { formatDateTimeFull, formatWon } from '@/lib/format';

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

type HistoryFilter =
  | 'ALL'
  | 'RESTOCK'
  | 'ADJUSTMENT'
  | 'DAMAGE'
  | 'RETURN'
  | 'SALE'
  | 'RESERVATION';

type InventoryHistoryModalProps = {
  open: boolean;
  logs: InventoryLog[];
  branchName?: string;
  productName?: string;
  onClose: () => void;
  onExport: () => void;
};

const TRANSACTION_TYPES = [
  { value: 'RESTOCK', label: '재입고' },
  { value: 'ADJUSTMENT', label: '재고 조정' },
  { value: 'DAMAGE', label: '파손/폐기' },
  { value: 'RETURN', label: '반품' },
];

const TRANSACTION_FILTERS: Array<{ value: HistoryFilter; label: string }> = [
  { value: 'ALL', label: '전체 유형' },
  { value: 'RESTOCK', label: '재입고' },
  { value: 'ADJUSTMENT', label: '재고 조정' },
  { value: 'DAMAGE', label: '파손/폐기' },
  { value: 'RETURN', label: '반품' },
  { value: 'SALE', label: '판매' },
  { value: 'RESERVATION', label: '예약' },
];

const TRANSACTION_LABELS: Record<string, string> = {
  RESTOCK: '재입고',
  ADJUSTMENT: '재고 조정',
  DAMAGE: '파손/폐기',
  RETURN: '반품',
  SALE: '판매',
  RESERVATION: '예약',
};

const TRANSACTION_BADGE_CLASSES: Record<string, string> = {
  RESTOCK: 'bg-success/20 text-success',
  ADJUSTMENT: 'bg-primary-500/20 text-primary-500',
  DAMAGE: 'bg-danger-500/20 text-danger-500',
  RETURN: 'bg-warning-500/20 text-warning-500',
  SALE: 'bg-neutral-500/20 text-neutral-400',
  RESERVATION: 'bg-primary-500/10 text-primary-500',
};

function getTransactionLabel(type: string) {
  return TRANSACTION_LABELS[type] || type;
}

function formatDateGroup(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
}

function getDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getQtyChangeClass(value: number) {
  if (value > 0) return 'text-success';
  if (value < 0) return 'text-danger-500';
  return 'text-text-secondary';
}

function getQtyChangeText(value: number) {
  return `${value > 0 ? '+' : ''}${value}`;
}

function InventoryHistoryModal({
  open,
  logs,
  branchName,
  productName,
  onClose,
  onExport,
}: InventoryHistoryModalProps) {
  const [filter, setFilter] = useState<HistoryFilter>('ALL');
  const [search, setSearch] = useState('');

  const handleClose = () => {
    setFilter('ALL');
    setSearch('');
    onClose();
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filter !== 'ALL' && log.transaction_type !== filter) {
        return false;
      }

      if (!search.trim()) {
        return true;
      }

      const query = search.toLowerCase();
      return [
        getTransactionLabel(log.transaction_type),
        log.notes || '',
        String(log.qty_before),
        String(log.qty_after),
        getQtyChangeText(log.qty_change),
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [filter, logs, search]);

  const groupedLogs = useMemo(() => {
    const groups = new Map<string, InventoryLog[]>();

    filteredLogs.forEach((log) => {
      const key = getDateKey(log.created_at);
      const current = groups.get(key) || [];
      current.push(log);
      groups.set(key, current);
    });

    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      label: formatDateGroup(items[0]?.created_at || key),
      items,
    }));
  }, [filteredLogs]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-5xl rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              재고 변경 이력
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {productName || '상품'} · {branchName || '스토어'} 기준 이력을
              확인합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-bg-secondary text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-border px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {TRANSACTION_FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  className={`h-9 rounded-full px-4 text-sm font-semibold transition-colors ${
                    filter === option.value
                      ? 'bg-primary-500 text-white'
                      : 'border border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-foreground'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full lg:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="유형, 메모, 수량 검색"
                  className="input-field h-9 w-full pl-9 pr-9 text-sm"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary transition-colors hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={onExport}
                disabled={filteredLogs.length === 0}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-bg-secondary px-3 text-sm font-semibold text-foreground transition-colors hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                엑셀
              </button>
            </div>
          </div>
        </div>

        <div className="max-h-[32rem] overflow-y-auto px-5 py-4">
          {groupedLogs.length === 0 ? (
            <div className="rounded-xl border border-border bg-bg-secondary p-12 text-center">
              <div className="text-base text-text-secondary">
                표시할 변경 이력이 없습니다
              </div>
              <div className="mt-1 text-sm text-text-tertiary">
                필터를 조정하거나 다른 스토어를 선택해보세요
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {groupedLogs.map((group) => (
                <section key={group.key}>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-px flex-1 bg-border" />
                    <div className="text-xs font-bold uppercase tracking-[0.12em] text-text-tertiary">
                      {group.label}
                    </div>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  <div className="space-y-3">
                    {group.items.map((log) => (
                      <article
                        key={log.id}
                        className="rounded-xl border border-border bg-bg-secondary p-4"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ${
                                  TRANSACTION_BADGE_CLASSES[
                                    log.transaction_type
                                  ] || 'bg-neutral-500/20 text-neutral-400'
                                }`}
                              >
                                {getTransactionLabel(log.transaction_type)}
                              </span>
                              <span
                                className={`text-sm font-bold ${getQtyChangeClass(log.qty_change)}`}
                              >
                                {getQtyChangeText(log.qty_change)}
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-foreground">
                              재고가 {log.qty_before}개에서 {log.qty_after}개로
                              변경되었습니다.
                            </p>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
                              <span>변경 전 {log.qty_before}</span>
                              <span>변경 후 {log.qty_after}</span>
                              <span>
                                차이 {getQtyChangeText(log.qty_change)}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-text-secondary">
                              {log.notes?.trim() || '메모 없음'}
                            </p>
                          </div>
                          <div className="shrink-0 text-xs font-medium text-text-tertiary">
                            {formatDateTimeFull(log.created_at)}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InventoryDetailPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const productId = params.productId as string;
  const branchId = searchParams.get('branchId');

  const [inventory, setInventory] = useState<InventoryDetail | null>(null);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    branchId || '',
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [editQtyAvailable, setEditQtyAvailable] = useState(0);
  const [editLowStockThreshold, setEditLowStockThreshold] = useState(0);
  const [saving, setSaving] = useState(false);

  const [adjustmentType, setAdjustmentType] = useState<string>('RESTOCK');
  const [adjustmentQty, setAdjustmentQty] = useState<string>('');
  const [adjustmentNotes, setAdjustmentNotes] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const data = await apiClient.get<Branch[]>('/customer/branches');
        setBranches(data);

        if (data.length > 0) {
          setSelectedBranchId((prev) => prev || data[0].id);
        }
      } catch (e) {
        console.error(e);
        setError(
          e instanceof Error ? e.message : '스토어 목록을 불러올 수 없습니다',
        );
      }
    };

    void loadBranches();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (!productId || productId === 'undefined' || !selectedBranchId) {
        setLoading(false);
        if (productId === 'undefined') {
          setError('잘못된 상품 ID입니다. 재고 목록에서 다시 선택해주세요.');
        }
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const inventoryData = await apiClient.get<InventoryDetail>(
          `/customer/inventory/${productId}?branchId=${encodeURIComponent(selectedBranchId)}`,
        );
        setInventory(inventoryData);
        setEditQtyAvailable(inventoryData.qty_available);
        setEditLowStockThreshold(inventoryData.low_stock_threshold);

        try {
          const logsData = await apiClient.get<InventoryLog[]>(
            `/customer/inventory/logs?productId=${productId}&branchId=${encodeURIComponent(selectedBranchId)}`,
          );
          setLogs(logsData);
        } catch (e) {
          console.warn('Failed to fetch inventory logs', e);
          setLogs([]);
        }

        const branch = branches.find((item) => item.id === selectedBranchId);
        if (branch) {
          setUserRole(branch.myRole);
        }
      } catch (e) {
        console.error(e);
        setError(
          e instanceof Error ? e.message : '재고 정보를 불러올 수 없습니다',
        );
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [productId, selectedBranchId, branches]);

  const reloadLogs = async () => {
    if (!productId || !selectedBranchId) return;

    try {
      const logsData = await apiClient.get<InventoryLog[]>(
        `/customer/inventory/logs?productId=${productId}&branchId=${encodeURIComponent(selectedBranchId)}`,
      );
      setLogs(logsData);
    } catch (e) {
      console.warn('Failed to fetch inventory logs', e);
    }
  };

  const handleSaveEdit = async () => {
    if (!inventory) return;

    try {
      setSaving(true);
      setError(null);

      const updatedData = await apiClient.patch<InventoryDetail>(
        `/customer/inventory/${productId}?branchId=${encodeURIComponent(selectedBranchId)}`,
        {
          qty_available: editQtyAvailable,
          low_stock_threshold: editLowStockThreshold,
        },
      );

      setInventory(updatedData);
      setEditQtyAvailable(updatedData.qty_available);
      setEditLowStockThreshold(updatedData.low_stock_threshold);
      await reloadLogs();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : '재고 수정에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  const handleAdjustment = async () => {
    if (!inventory || !adjustmentQty) return;

    const qtyChange = parseInt(adjustmentQty, 10);
    if (Number.isNaN(qtyChange) || qtyChange === 0) {
      setError('유효한 수량을 입력해주세요');
      return;
    }

    try {
      setAdjusting(true);
      setError(null);

      const updatedData = await apiClient.post<InventoryDetail>(
        `/customer/inventory/${productId}/adjust?branchId=${encodeURIComponent(selectedBranchId)}`,
        {
          transaction_type: adjustmentType,
          qty_change: qtyChange,
          notes: adjustmentNotes || undefined,
        },
      );

      setInventory(updatedData);
      setEditQtyAvailable(updatedData.qty_available);
      setAdjustmentQty('');
      setAdjustmentNotes('');
      await reloadLogs();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : '재고 조정에 실패했습니다');
    } finally {
      setAdjusting(false);
    }
  };

  const handleExportLogs = () => {
    if (logs.length === 0) return;

    const filename = inventory
      ? `inventory-logs-${inventory.product_name || inventory.product_id}`
      : 'inventory-logs';

    exportToExcel(
      logs.map((log) => ({
        일시: formatDateTimeFull(log.created_at),
        거래유형: getTransactionLabel(log.transaction_type),
        수량변경: log.qty_change,
        변경전: log.qty_before,
        변경후: log.qty_after,
        메모: log.notes || '',
      })),
      filename,
      '재고변경이력',
    );
  };

  const canEdit =
    userRole === 'OWNER' ||
    userRole === 'ADMIN' ||
    userRole === 'BRANCH_OWNER' ||
    userRole === 'BRANCH_ADMIN';
  const isLowStock = inventory?.is_low_stock;
  const selectedBranchName = branches.find(
    (branch) => branch.id === selectedBranchId,
  )?.name;
  const categoryName = inventory?.category || inventory?.product?.category;
  const recentLogs = logs.slice(0, 5);

  const thresholdGap = inventory
    ? inventory.qty_available - inventory.low_stock_threshold
    : null;

  const thresholdStatusText =
    thresholdGap === null
      ? null
      : thresholdGap > 0
        ? '기준 이상'
        : thresholdGap === 0
          ? '최소 재고와 동일'
          : `기준 대비 ${Math.abs(thresholdGap)}개 부족`;

  const thresholdStatusColor =
    thresholdGap === null
      ? ''
      : thresholdGap > 0
        ? 'text-success'
        : thresholdGap === 0
          ? 'text-warning-500'
          : 'text-danger-500';

  if (loading) {
    return (
      <div>
        <Link
          href="/customer/inventory"
          className="text-sm font-semibold text-foreground no-underline transition-colors hover:text-primary-500"
        >
          ← 재고 목록
        </Link>
        <h1 className="mt-4 text-2xl font-extrabold text-foreground">
          재고 상세
        </h1>
        <div className="mt-8 text-text-secondary">로딩 중...</div>
      </div>
    );
  }

  if (!inventory) {
    return (
      <div>
        <Link
          href="/customer/inventory"
          className="text-sm font-semibold text-foreground no-underline transition-colors hover:text-primary-500"
        >
          ← 재고 목록
        </Link>
        <h1 className="mt-4 text-2xl font-extrabold text-foreground">
          재고 상세
        </h1>
        <div className="rounded-xl border border-danger-500 bg-danger-500/10 p-4 text-danger-500">
          재고 정보를 찾을 수 없습니다
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/customer/inventory"
        className="text-sm font-semibold text-foreground no-underline transition-colors hover:text-primary-500"
      >
        ← 재고 목록
      </Link>

      <div className="mb-6 mt-4">
        <h1 className="m-0 text-2xl font-extrabold text-foreground">
          재고 상세
        </h1>
      </div>

      <div className="mb-6">
        <label className="mb-2 block text-[13px] font-semibold text-text-secondary">
          스토어 선택
        </label>
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="input-field w-full max-w-[400px]"
        >
          <option value="">스토어를 선택하세요</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-danger-500 bg-danger-500/10 p-4 text-danger-500">
          {error}
        </div>
      )}

      <div className="card mb-6 p-6">
        <div className="mb-6 flex items-start gap-5">
          {inventory.product?.image_url ? (
            <Image
              src={inventory.product.image_url}
              alt={inventory.product?.name || '상품 이미지'}
              width={100}
              height={100}
              className="h-[100px] w-[100px] shrink-0 rounded-xl border border-border object-cover"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className="mb-1 text-xl font-bold leading-snug text-foreground">
              {inventory.product?.name ||
                inventory.product_name ||
                '상품명 없음'}
            </h2>
            {(selectedBranchName || categoryName) && (
              <p className="mb-2 text-sm text-text-secondary">
                {[selectedBranchName, categoryName].filter(Boolean).join(' · ')}
              </p>
            )}
            {inventory.product?.price != null && (
              <div className="text-lg font-extrabold text-foreground">
                {formatWon(inventory.product.price)}
              </div>
            )}
          </div>
          {isLowStock && (
            <span className="inline-flex h-8 shrink-0 items-center rounded-full bg-danger-500/20 px-4 text-sm font-semibold text-danger-500">
              재고 부족
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div
            className={`rounded-lg border p-4 ${
              isLowStock
                ? 'border-danger-500/40 bg-danger-500/10'
                : 'border-success/30 bg-success/10'
            }`}
          >
            <div className="mb-1.5 text-xs font-semibold text-text-secondary">
              재고 가용 수량
            </div>
            <div
              className={`mb-2 text-3xl font-extrabold leading-none ${isLowStock ? 'text-danger-500' : 'text-success'}`}
            >
              {inventory.qty_available}
            </div>
            {thresholdStatusText && (
              <div
                className={`text-[11px] font-semibold ${thresholdStatusColor}`}
              >
                {thresholdStatusText}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-bg-tertiary p-4">
            <div className="mb-1.5 text-xs font-semibold text-text-secondary">
              예약 수량
            </div>
            <div className="text-2xl font-extrabold text-foreground">
              {inventory.qty_reserved}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-bg-tertiary p-4">
            <div className="mb-1.5 text-xs font-semibold text-text-secondary">
              판매 수량
            </div>
            <div className="text-2xl font-extrabold text-foreground">
              {inventory.qty_sold}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-bg-tertiary p-4">
            <div className="mb-1.5 text-xs font-semibold text-text-secondary">
              최소 재고 기준
            </div>
            <div className="text-2xl font-extrabold text-foreground">
              {inventory.low_stock_threshold}
            </div>
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="card mb-6 p-6">
          <div className="mb-4">
            <h3 className="mb-1 text-lg font-bold text-foreground">
              재고 정보 수정
            </h3>
            <p className="text-sm text-text-secondary">
              현재 재고 수량과 최소 재고 기준을 직접 수정합니다.
            </p>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-[13px] font-semibold text-text-secondary">
                재고 가용 수량
              </label>
              <input
                type="number"
                value={editQtyAvailable}
                onChange={(e) =>
                  setEditQtyAvailable(parseInt(e.target.value, 10) || 0)
                }
                className="input-field w-full"
                min="0"
              />
            </div>
            <div>
              <label className="mb-2 block text-[13px] font-semibold text-text-secondary">
                최소 재고 기준
              </label>
              <input
                type="number"
                value={editLowStockThreshold}
                onChange={(e) =>
                  setEditLowStockThreshold(parseInt(e.target.value, 10) || 0)
                }
                className="input-field w-full"
                min="0"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void handleSaveEdit()}
              disabled={saving}
              className="btn-primary px-5 py-2.5 text-sm"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
            <button
              onClick={() => {
                setEditQtyAvailable(inventory.qty_available);
                setEditLowStockThreshold(inventory.low_stock_threshold);
              }}
              className="rounded-lg border border-border bg-bg-tertiary px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-bg-secondary"
            >
              변경 취소
            </button>
          </div>
        </div>
      )}

      {canEdit && (
        <div className="card mb-6 p-6">
          <div className="mb-4">
            <h3 className="mb-1 text-lg font-bold text-foreground">
              재고 수동 조정
            </h3>
            <p className="text-sm text-text-secondary">
              입고, 파손, 반품 등의 변동을 기록하면서 재고를 조정합니다.
            </p>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-[13px] font-semibold text-text-secondary">
                거래 유형
              </label>
              <select
                value={adjustmentType}
                onChange={(e) => setAdjustmentType(e.target.value)}
                className="input-field w-full"
              >
                {TRANSACTION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-[13px] font-semibold text-text-secondary">
                수량 변경
              </label>
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
            <label className="mb-2 block text-[13px] font-semibold text-text-secondary">
              메모
            </label>
            <textarea
              value={adjustmentNotes}
              onChange={(e) => setAdjustmentNotes(e.target.value)}
              placeholder="조정 사유를 입력하세요"
              className="input-field w-full resize-y font-[inherit]"
              rows={3}
            />
          </div>

          <button
            onClick={() => void handleAdjustment()}
            disabled={adjusting || !adjustmentQty}
            className="rounded-lg border-none bg-success px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {adjusting ? '처리 중...' : '재고 조정 실행'}
          </button>
        </div>
      )}

      <div className="card mb-6 p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="mb-0.5 text-lg font-bold text-foreground">
              재고 변경 이력
            </h3>
            <p className="text-sm text-text-secondary">
              현재 스토어 기준 최근 재고 변경 내역을 확인할 수 있습니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportLogs}
              disabled={logs.length === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-bg-secondary px-3 text-sm font-semibold text-foreground transition-colors hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              엑셀 다운로드
            </button>
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              disabled={logs.length === 0}
              className="inline-flex h-9 items-center rounded-lg bg-primary-500 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              전체 변경 이력
            </button>
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="rounded-xl border border-border bg-bg-secondary p-12 text-center text-text-tertiary">
            재고 변경 이력이 없습니다
          </div>
        ) : (
          <div className="space-y-3">
            {recentLogs.map((log) => (
              <article
                key={log.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-bg-secondary p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ${
                        TRANSACTION_BADGE_CLASSES[log.transaction_type] ||
                        'bg-neutral-500/20 text-neutral-400'
                      }`}
                    >
                      {getTransactionLabel(log.transaction_type)}
                    </span>
                    <span
                      className={`text-sm font-bold ${getQtyChangeClass(log.qty_change)}`}
                    >
                      {getQtyChangeText(log.qty_change)}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    재고가 {log.qty_before}개에서 {log.qty_after}개로
                    변경되었습니다.
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {log.notes?.trim() || '메모 없음'}
                  </p>
                </div>
                <div className="shrink-0 text-xs text-text-tertiary">
                  {formatDateTimeFull(log.created_at)}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <InventoryHistoryModal
        open={historyOpen}
        logs={logs}
        branchName={selectedBranchName}
        productName={inventory.product?.name || inventory.product_name}
        onClose={() => setHistoryOpen(false)}
        onExport={handleExportLogs}
      />
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
