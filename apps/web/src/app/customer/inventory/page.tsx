"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Download, History, Search, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { exportToExcel } from "@/lib/excel-export";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import toast from "react-hot-toast";

// ─── Types ───────────────────────────────────────────────────────────────────

type Brand = {
  id: string;
  name: string;
  slug?: string | null;
  myRole?: string | null;
};

type ProductCategory = {
  id: string;
  name: string;
  isActive: boolean;
};

type CategoryFilter =
  | "ALL"
  | "UNCATEGORIZED"
  | `CATEGORY:${string}`
  | `CATEGORY_NAME:${string}`;

type InventoryItem = {
  id: string;
  product_id: string;
  product_name: string;
  branch_id: string;
  branch_name?: string;
  qty_available: number;
  qty_reserved: number;
  qty_sold: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
  image_url?: string;
  category_id?: string | null;
  category_name?: string | null;
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
  brandId: string;
  myRole: string;
};

type BulkDeactivateResponse = {
  total: number;
  successful: number;
  alreadyInactive?: number;
};

type InventoryHistoryItem = InventoryLog & {
  branch_name?: string;
  product_name?: string;
};

// ─── Utilities ───────────────────────────────────────────────────────────────

function normalizeCategoryName(name: string) {
  return (name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}


function toCategoryNameFilter(categoryName: string): CategoryFilter {
  return `CATEGORY_NAME:${normalizeCategoryName(categoryName)}`;
}

function getCategoryIdFromFilter(filter: CategoryFilter): string | null {
  if (!filter.startsWith("CATEGORY:")) return null;
  return filter.replace("CATEGORY:", "").trim() || null;
}

function getCategoryNameKeyFromFilter(filter: CategoryFilter): string | null {
  if (!filter.startsWith("CATEGORY_NAME:")) return null;
  return filter.replace("CATEGORY_NAME:", "").trim() || null;
}


// ─── Constants ───────────────────────────────────────────────────────────────

const TRANSACTION_TYPES = [
  { value: "RESTOCK", label: "재입고" },
  { value: "ADJUSTMENT", label: "재고 조정" },
  { value: "DAMAGE", label: "손상/폐기" },
  { value: "RETURN", label: "반품" },
];

const TRANSACTION_LABELS: Record<string, string> = {
  RESTOCK: "재입고",
  ADJUSTMENT: "재고 조정",
  DAMAGE: "파손/폐기",
  RETURN: "반품",
  SALE: "판매",
  RESERVATION: "예약",
  RESERVE: "예약",
  RELEASE: "예약 해제",
};

const TRANSACTION_BADGE_CLASSES: Record<string, string> = {
  RESTOCK: "bg-success/20 text-success",
  ADJUSTMENT: "bg-primary-500/20 text-primary-500",
  DAMAGE: "bg-danger-500/20 text-danger-500",
  RETURN: "bg-warning-500/20 text-warning-500",
  SALE: "bg-neutral-500/20 text-neutral-400",
  RESERVATION: "bg-primary-500/10 text-primary-500",
  RESERVE: "bg-primary-500/10 text-primary-500",
  RELEASE: "bg-bg-tertiary text-text-secondary",
};

function getTransactionLabel(type: string) {
  return TRANSACTION_LABELS[type] || type;
}

function getHistoryDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatHistoryDateGroup(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function isLowStock(item: InventoryItem): boolean {
  return item.is_low_stock;
}

function InventoryHistoryModal({
  open,
  logs,
  loading,
  error,
  onClose,
  onExport,
}: {
  open: boolean;
  logs: InventoryHistoryItem[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onExport: () => void;
}) {
  const [filter, setFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const handleClose = () => {
    setFilter("ALL");
    setSearch("");
    onClose();
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filter !== "ALL" && log.transaction_type !== filter) {
        return false;
      }

      if (!search.trim()) return true;

      const query = search.toLowerCase();
      return [
        log.product_name || "",
        log.branch_name || "",
        log.notes || "",
        getTransactionLabel(log.transaction_type),
        String(log.qty_before),
        String(log.qty_after),
        String(log.qty_change),
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [filter, logs, search]);

  const groupedLogs = useMemo(() => {
    const groups = new Map<string, InventoryHistoryItem[]>();

    filteredLogs.forEach((log) => {
      const key = getHistoryDateKey(log.created_at);
      const current = groups.get(key) || [];
      current.push(log);
      groups.set(key, current);
    });

    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      label: formatHistoryDateGroup(items[0]?.created_at || key),
      items,
    }));
  }, [filteredLogs]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-6xl rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">재고 변경 이력</h2>
            <p className="mt-1 text-sm text-text-secondary">
              현재 선택된 매장 기준의 재고 변동 내역을 확인합니다.
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
              <button
                type="button"
                onClick={() => setFilter("ALL")}
                className={`h-9 rounded-full px-4 text-sm font-semibold transition-colors ${
                  filter === "ALL"
                    ? "bg-primary-500 text-white"
                    : "border border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-foreground"
                }`}
              >
                전체 유형
              </button>
              {TRANSACTION_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFilter(type.value)}
                  className={`h-9 rounded-full px-4 text-sm font-semibold transition-colors ${
                    filter === type.value
                      ? "bg-primary-500 text-white"
                      : "border border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-foreground"
                  }`}
                >
                  {getTransactionLabel(type.value)}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full lg:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="상품, 매장, 메모 검색"
                  className="input-field h-9 w-full pl-9 pr-9 text-sm"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
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
          {loading ? (
            <div className="rounded-xl border border-border bg-bg-secondary p-12 text-center text-text-secondary">
              변경 이력을 불러오는 중입니다...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-danger-500 bg-danger-500/10 p-4 text-danger-500">
              {error}
            </div>
          ) : groupedLogs.length === 0 ? (
            <div className="rounded-xl border border-border bg-bg-secondary p-12 text-center">
              <div className="text-base text-text-secondary">표시할 변경 이력이 없습니다</div>
              <div className="mt-1 text-sm text-text-tertiary">선택된 매장을 조정하거나 재고를 변경한 뒤 다시 확인해보세요</div>
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
                                  TRANSACTION_BADGE_CLASSES[log.transaction_type] ||
                                  "bg-neutral-500/20 text-neutral-400"
                                }`}
                              >
                                {getTransactionLabel(log.transaction_type)}
                              </span>
                              <span className="text-sm font-semibold text-text-secondary">
                                {log.branch_name || "-"}
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-foreground">
                              {log.product_name || "상품"} 재고가 {log.qty_before}개에서 {log.qty_after}개로 변경되었습니다.
                            </p>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
                              <span>변경량 {log.qty_change > 0 ? "+" : ""}{log.qty_change}</span>
                              <span>변경 전 {log.qty_before}</span>
                              <span>변경 후 {log.qty_after}</span>
                            </div>
                            <p className="mt-2 text-sm text-text-secondary">
                              {log.notes?.trim() || "메모 없음"}
                            </p>
                          </div>
                          <div className="shrink-0 text-xs font-medium text-text-tertiary">
                            {new Date(log.created_at).toLocaleString("ko-KR")}
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

// ─── Component ───────────────────────────────────────────────────────────────

export default function CustomerInventoryPage() {
  const router = useRouter();

  // ── Brand / Branch
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchCategories, setBranchCategories] = useState<Record<string, ProductCategory[]>>({});

  // ── Inventory
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<Set<string>>(new Set());
  const [branchSearch, setBranchSearch] = useState("");

  // ── Filters
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // ── UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBranchPanelOpen, setIsBranchPanelOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<InventoryHistoryItem[]>([]);

  // ── Bulk
  const [selectedInventoryIds, setSelectedInventoryIds] = useState<Set<string>>(new Set());
  const [bulkQty, setBulkQty] = useState("");
  const [bulkNotes, setBulkNotes] = useState("");
  const [bulkType, setBulkType] = useState("ADJUSTMENT");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkDeactivating, setBulkDeactivating] = useState(false);

  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  // ── Derived
  const manageRoles = new Set(["OWNER", "ADMIN", "BRANCH_OWNER", "BRANCH_ADMIN"]);
  const canManage =
    selectedBranchIds.size > 0 &&
    Array.from(selectedBranchIds).every((id) => {
      const role = branches.find((b) => b.id === id)?.myRole;
      return role ? manageRoles.has(role) : false;
    });

  const filteredBranches = useMemo(() => {
    if (!branchSearch.trim()) return branches;
    const q = branchSearch.toLowerCase();
    return branches.filter((b) => b.name.toLowerCase().includes(q));
  }, [branches, branchSearch]);

  const availableCategories = useMemo(() => {
    const list = Object.values(branchCategories).flat();
    const byName = new Map<string, ProductCategory>();
    for (const c of list) {
      if (!c?.id || c.isActive === false) continue;
      const key = normalizeCategoryName(c.name);
      if (key && !byName.has(key)) byName.set(key, c);
    }
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [branchCategories]);

  const categoryIdToNameKey = useMemo(() => {
    const map: Record<string, string> = {};
    for (const cats of Object.values(branchCategories)) {
      for (const c of cats ?? []) {
        if (c?.id && c.isActive !== false) map[c.id] = normalizeCategoryName(c.name);
      }
    }
    return map;
  }, [branchCategories]);

  // ── Filter chain ─────────────────────────────────────────────────────────

  const categoryFilteredInventory = useMemo(() => {
    if (categoryFilter === "ALL") return inventory;
    if (categoryFilter === "UNCATEGORIZED") {
      return inventory.filter((item) => !item.category_id);
    }
    const cid = getCategoryIdFromFilter(categoryFilter);
    if (cid) {
      return inventory.filter((item) => item.category_id === cid);
    }
    const nameKey = getCategoryNameKeyFromFilter(categoryFilter);
    if (!nameKey) return inventory;
    return inventory.filter(
      (item) => item.category_id && categoryIdToNameKey[item.category_id] === nameKey,
    );
  }, [inventory, categoryFilter, categoryIdToNameKey]);

  const searchedInventory = useMemo(() => {
    if (!searchQuery.trim()) return categoryFilteredInventory;
    const q = searchQuery.toLowerCase();
    return categoryFilteredInventory.filter(
      (item) =>
        (item.product_name ?? "").toLowerCase().includes(q) ||
        (item.branch_name ?? "").toLowerCase().includes(q),
    );
  }, [categoryFilteredInventory, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(searchedInventory.length / PAGE_SIZE));

  const pagedInventory = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return searchedInventory.slice(start, start + PAGE_SIZE);
  }, [searchedInventory, page]);

  const allSelected =
    pagedInventory.length > 0 &&
    pagedInventory.every((item) => selectedInventoryIds.has(item.id));

  // ── KPI 파생값 ────────────────────────────────────────────────────────────

  const lowStockCount = useMemo(
    () => searchedInventory.filter(isLowStock).length,
    [searchedInventory],
  );
  const normalStockCount = searchedInventory.length - lowStockCount;

  // 판매채널 요약 레이블
  const branchSummaryLabel = useMemo(() => {
    const selectedCount = selectedBranchIds.size;

    if (selectedCount === 0) return "판매채널 미선택";

    if (selectedCount === 1) {
      return branches.find((b) => selectedBranchIds.has(b.id))?.name ?? "판매채널 1개";
    }

    return `전체 ${selectedCount}개`;
  }, [selectedBranchIds, branches]);

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadBranchCategories = useCallback(async (branchRows: Branch[]) => {
    const entries = await Promise.all(
      branchRows.map(async (branch) => {
        try {
          const cats = await apiClient.get<ProductCategory[]>(
            `/customer/products/categories?branchId=${encodeURIComponent(branch.id)}`,
          );
          return [branch.id, cats] as const;
        } catch {
          return [branch.id, []] as const;
        }
      }),
    );
    setBranchCategories(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const brandRows = await apiClient.get<Brand[]>("/customer/brands");
        setBrands(brandRows);
        if (brandRows.length === 0) {
          setLoading(false);
          return;
        }
        setSelectedBrandId(brandRows[0].id);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "브랜드 목록을 불러올 수 없습니다");
        setLoading(false);
      }
    };
    run();
  }, []);

  useEffect(() => {
    if (!selectedBrandId) return;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        setSelectedBranchIds(new Set());
        setBranches([]);
        setBranchCategories({});
        setCategoryFilter("ALL");
        setSearchInput("");
        setSearchQuery("");
        setSelectedInventoryIds(new Set());
        setPage(1);

        const branchRows = await apiClient.get<Branch[]>(
          `/customer/branches?brandId=${encodeURIComponent(selectedBrandId)}`,
        );
        setBranches(branchRows);
        await loadBranchCategories(branchRows);
        setSelectedBranchIds(new Set(branchRows.map((b) => b.id)));
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "지점 목록을 불러올 수 없습니다");
        setLoading(false);
      }
    };
    run();
  }, [selectedBrandId, loadBranchCategories]);

  useEffect(() => {
    const loadInventory = async () => {
      if (selectedBranchIds.size === 0) {
        setInventory([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const branchIds = Array.from(selectedBranchIds);
        const responses = await Promise.all(
          branchIds.map((branchId) =>
            apiClient
              .get<InventoryItem[]>(`/customer/inventory?branchId=${encodeURIComponent(branchId)}`)
              .catch(() => []),
          ),
        );
        const branchMap = new Map(branches.map((b) => [b.id, b.name]));
        const merged = responses
          .flat()
          .map((item) => ({
            ...item,
            branch_name: item.branch_name || branchMap.get(item.branch_id) || "-",
          }))
          .sort((a, b) => {
            const bc = (a.branch_name || "").localeCompare(b.branch_name || "");
            if (bc !== 0) return bc;
            return (a.product_name || "").localeCompare(b.product_name || "");
          });

        setInventory(merged);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "재고 목록을 불러올 수 없습니다");
      } finally {
        setLoading(false);
      }
    };

    loadInventory();
  }, [selectedBranchIds, branches]);

  useEffect(() => {
    setSelectedInventoryIds((prev) => {
      if (prev.size === 0) return prev;
      const visibleIds = new Set(searchedInventory.map((item) => item.id));
      const next = new Set(Array.from(prev).filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [searchedInventory]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [categoryFilter, searchQuery, selectedBrandId]);

  useEffect(() => {
    setPage(1);
  }, [selectedBranchIds, branchSearch]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleBulkAdjust = async () => {
    const qty = Number.parseInt(bulkQty, 10);
    if (Number.isNaN(qty) || qty === 0) {
      toast.error("유효한 조정 수량을 입력하세요");
      return;
    }
    if (selectedInventoryIds.size === 0) {
      toast.error("대상을 선택하세요");
      return;
    }

    try {
      setBulkSaving(true);
      const targets = inventory.filter((item) => selectedInventoryIds.has(item.id));
      await Promise.all(
        targets.map((item) =>
          apiClient.post(
            `/customer/inventory/${item.product_id}/adjust?branchId=${encodeURIComponent(item.branch_id)}`,
            {
              transaction_type: bulkType,
              qty_change: qty,
              notes: bulkNotes || undefined,
            },
          ),
        ),
      );

      toast.success(`${targets.length}개 상품 재고를 일괄 조정했습니다`);
      setSelectedInventoryIds(new Set());
      setBulkQty("");
      setBulkNotes("");
      setSelectedBranchIds((prev) => new Set(prev));
      if (historyOpen) void loadHistory();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "일괄 조정에 실패했습니다");
    } finally {
      setBulkSaving(false);
    }
  };

  const handleBulkDeactivate = async () => {
    if (selectedInventoryIds.size === 0) {
      toast.error("비활성화할 대상을 선택해 주세요.");
      return;
    }

    try {
      setBulkDeactivating(true);
      const targets = inventory.filter((item) => selectedInventoryIds.has(item.id));

      const result = await apiClient.post<BulkDeactivateResponse>(
        "/customer/inventory/bulk-deactivate",
        {
          items: targets.map((item) => ({
            productId: item.product_id,
            branchId: item.branch_id,
          })),
          notes: bulkNotes || undefined,
        },
      );

      if (result.successful === result.total) {
        toast.success(
          result.alreadyInactive
            ? `${result.total}개 상품 재고 관리 비활성화 완료 (이미 비활성 ${result.alreadyInactive}개 포함)`
            : `${result.total}개 상품 재고 관리 비활성화 완료`,
        );
      } else {
        toast.error(`일부만 처리됨 (${result.successful}/${result.total})`);
      }

      setSelectedInventoryIds(new Set());
      setSelectedBranchIds((prev) => new Set(prev));
      if (historyOpen) void loadHistory();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "일괄 비활성화에 실패했습니다");
    } finally {
      setBulkDeactivating(false);
    }
  };

  const loadHistory = useCallback(async () => {
    if (selectedBranchIds.size === 0) {
      setHistoryItems([]);
      return;
    }

    try {
      setHistoryLoading(true);
      setHistoryError(null);

      const branchIds = Array.from(selectedBranchIds);
      const responses = await Promise.all(
        branchIds.map((branchId) =>
          apiClient
            .get<InventoryLog[]>(
              `/customer/inventory/logs?branchId=${encodeURIComponent(branchId)}`,
            )
            .then((items) =>
              items.map((item) => ({
                ...item,
                branch_name:
                  branches.find((branch) => branch.id === item.branch_id)?.name ||
                  "-",
                product_name:
                  inventory.find(
                    (inv) =>
                      inv.product_id === item.product_id &&
                      inv.branch_id === item.branch_id,
                  )?.product_name || "",
              })),
            )
            .catch(() => [] as InventoryHistoryItem[]),
        ),
      );

      const merged = responses
        .flat()
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );

      setHistoryItems(merged);
    } catch (e) {
      console.error(e);
      setHistoryError(
        e instanceof Error ? e.message : "변경 이력을 불러올 수 없습니다",
      );
    } finally {
      setHistoryLoading(false);
    }
  }, [branches, inventory, selectedBranchIds]);

  const handleOpenHistory = async () => {
    setHistoryOpen(true);
    await loadHistory();
  };

  const handleExportHistory = () => {
    if (historyItems.length === 0) return;

    exportToExcel(
      historyItems.map((item) => ({
        일시: new Date(item.created_at).toLocaleString("ko-KR"),
        매장: item.branch_name || "",
        상품: item.product_name || "",
        거래유형: getTransactionLabel(item.transaction_type),
        변경량: item.qty_change,
        변경전: item.qty_before,
        변경후: item.qty_after,
        메모: item.notes || "",
      })),
      "inventory-history",
      "재고변경이력",
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading && brands.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold mb-8 text-foreground">재고관리</h1>
        <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full border-collapse min-w-[840px]">
            <thead className="bg-white">
              <tr>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">매장</th>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">상품</th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">가능재고</th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">예약됨</th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">판매됨</th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">최소재고</th>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">상태</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, index) => (
                <TableRowSkeleton key={index} cols={7} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold m-0 text-foreground">재고 관리</h1>
      </div>

      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => void handleOpenHistory()}
          disabled={selectedBranchIds.size === 0}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-bg-secondary px-4 text-sm font-semibold text-foreground transition-colors hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <History className="h-4 w-4 text-text-secondary" />
          변경 이력
        </button>
      </div>

      {/* Sticky filter bar */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border pb-3 mb-3">
        <div className="flex flex-wrap items-end gap-3">

          {/* 브랜드 */}
          <div className="w-full min-w-0 sm:flex-1 sm:min-w-[160px]">
            <label className="block text-xs text-text-secondary mb-1.5 font-semibold">브랜드</label>
            <select
              value={selectedBrandId}
              onChange={(e) => setSelectedBrandId(e.target.value)}
              className="input-field h-9 text-sm w-full"
            >
              {brands.length === 0 && <option value="">브랜드 없음</option>}
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {selectedBrandId && (
            <>
              {/* 판매채널 토글 */}
              <div className="w-full min-w-0 sm:flex-1 sm:min-w-[160px]">
                <label className="block text-xs text-text-secondary mb-1.5 font-semibold">판매채널</label>
                <button
                  type="button"
                  onClick={() => setIsBranchPanelOpen((v) => !v)}
                  className="input-field h-9 text-sm w-full flex items-center justify-between gap-2 text-left"
                  aria-expanded={isBranchPanelOpen}
                >
                  <span className="truncate text-foreground">{branchSummaryLabel}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-text-secondary flex-shrink-0 transition-transform duration-150 ${
                      isBranchPanelOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </div>

              {/* 카테고리 */}
              <div className="w-full min-w-0 sm:flex-1 sm:min-w-[150px]">
                <label className="block text-xs text-text-secondary mb-1.5 font-semibold">카테고리</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
                  className="input-field h-9 text-sm w-full"
                >
                  <option value="ALL">전체</option>
                  <option value="UNCATEGORIZED">카테고리 없음</option>
                  {availableCategories.map((c) => (
                    <option
                      key={c.id}
                      value={toCategoryNameFilter(c.name)}
                    >
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 검색 */}
              <div className="w-full lg:w-64">
                <label className="block text-xs text-text-secondary mb-1.5 font-semibold">검색</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setSearchInput("");
                    }}
                    placeholder="상품명/매장명 검색"
                    className="input-field h-9 text-sm w-full pl-9 pr-9"
                    aria-label="재고 검색"
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={() => setSearchInput("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-foreground transition-colors"
                      aria-label="검색어 지우기"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* 총 개수 */}
              <div className="flex items-center h-9 w-full sm:w-auto">
                <span className="text-sm text-text-secondary whitespace-nowrap">
                  총 {searchedInventory.length}개
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 판매채널 펼침 패널 */}
      {selectedBrandId && isBranchPanelOpen && (
        <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden mb-4">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-bg-tertiary">
            <span className="text-xs font-semibold text-text-secondary">표시할 판매채널을 선택하세요</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedBranchIds(new Set(branches.map((b) => b.id)))}
                className="text-xs text-primary-500 hover:underline"
              >
                전체선택
              </button>
              <span className="text-text-tertiary text-xs">·</span>
              <button
                type="button"
                onClick={() => setSelectedBranchIds(new Set())}
                className="text-xs text-text-secondary hover:underline"
              >
                전체해제
              </button>
            </div>
          </div>
          <div className="px-4 pt-3 pb-3">
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
              <input
                type="text"
                value={branchSearch}
                onChange={(e) => setBranchSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setBranchSearch("");
                }}
                placeholder="매장 검색"
                className="input-field h-8 text-sm w-full pl-9 pr-9"
                aria-label="매장 검색"
              />
              {branchSearch && (
                <button
                  type="button"
                  onClick={() => setBranchSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-foreground transition-colors"
                  aria-label="검색어 지우기"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="max-h-40 overflow-y-auto">
              {filteredBranches.length === 0 ? (
                <div className="py-4 text-center text-sm text-text-tertiary">
                  {branchSearch ? "검색 결과가 없습니다" : "등록된 매장이 없습니다"}
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {filteredBranches.map((branch) => (
                    <label
                      key={branch.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-bg-tertiary cursor-pointer text-sm text-foreground"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBranchIds.has(branch.id)}
                        onChange={(e) => {
                          setSelectedBranchIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(branch.id);
                            else next.delete(branch.id);
                            return next;
                          });
                        }}
                        className="w-4 h-4 rounded accent-primary"
                      />
                      <span>{branch.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="border border-danger-500 rounded-xl p-4 bg-danger-500/10 text-danger-500 mb-4">
          {error}
        </div>
      )}

      {canManage && selectedInventoryIds.size > 0 && (
        <div className="mb-4 p-3 rounded-lg border border-primary-500/20 bg-primary-500/5">
          <div className="text-sm font-medium text-foreground mb-3">
            선택된 {selectedInventoryIds.size}개 상품 일괄 조정
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[180px_180px_1fr_auto] gap-2">
            <select
              value={bulkType}
              onChange={(e) => setBulkType(e.target.value)}
              className="input-field"
            >
              {TRANSACTION_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={bulkQty}
              onChange={(e) => setBulkQty(e.target.value)}
              placeholder="수량 (+/-)"
              className="input-field"
            />
            <input
              type="text"
              value={bulkNotes}
              onChange={(e) => setBulkNotes(e.target.value)}
              placeholder="메모 (선택)"
              className="input-field"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkAdjust}
                disabled={bulkSaving || bulkDeactivating}
                className="btn-primary px-4 py-2 text-sm whitespace-nowrap"
              >
                {bulkSaving ? "처리 중..." : "일괄 적용"}
              </button>
              <button
                onClick={handleBulkDeactivate}
                disabled={bulkSaving || bulkDeactivating}
                className="btn-danger px-4 py-2 text-sm whitespace-nowrap"
              >
                {bulkDeactivating ? "처리 중..." : "일괄 비활성화"}
              </button>
            </div>
          </div>
        </div>
      )}

      {brands.length === 0 ? (
        <div className="border border-border rounded-xl p-12 bg-bg-secondary text-text-tertiary text-center">
          <div className="text-base mb-2">등록된 브랜드가 없습니다</div>
          <div className="text-[13px]">먼저 브랜드를 등록해주세요</div>
        </div>
      ) : loading ? (
        <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full border-collapse min-w-[840px]">
            <thead className="bg-white">
              <tr>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">매장</th>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">상품</th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">재고 가능</th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">예약됨</th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">판매됨</th>
                <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">최소 재고</th>
                <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">상태</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, index) => (
                <TableRowSkeleton key={index} cols={7} />
              ))}
            </tbody>
          </table>
        </div>
      ) : branches.length === 0 ? (
        <div className="border border-border rounded-xl p-12 bg-bg-secondary text-text-tertiary text-center">
          <div className="text-base mb-2">등록된 매장이 없습니다</div>
          <div className="text-[13px]">먼저 매장을 등록해주세요</div>
        </div>
      ) : selectedBranchIds.size === 0 ? (
        <div className="border border-border rounded-xl p-12 bg-bg-secondary text-text-tertiary text-center">
          <div className="text-base mb-2">매장을 1개 이상 선택하세요</div>
        </div>
      ) : inventory.length === 0 ? (
        <div className="border border-border rounded-xl p-12 bg-bg-secondary text-text-tertiary text-center">
          <div className="text-base mb-2">재고 정보가 없습니다</div>
          <div className="text-[13px]">상품을 추가하면 자동으로 재고가 생성됩니다</div>
        </div>
      ) : searchedInventory.length === 0 ? (
        <div className="border border-border rounded-xl p-12 bg-bg-secondary text-text-tertiary text-center">
          <div className="text-base mb-2">
            {searchQuery.trim()
              ? "검색 결과가 없습니다"
              : "선택한 조건에 해당하는 재고가 없습니다"}
          </div>
        </div>
      ) : (
        <>
          {/* KPI 요약 바 */}
          <div className="flex flex-wrap gap-2 mb-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-bg-secondary text-sm">
              <span className="text-text-secondary">전체</span>
              <span className="font-bold text-foreground">{searchedInventory.length}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-success/10 text-sm">
              <span className="text-text-secondary">정상</span>
              <span className="font-bold text-success">{normalStockCount}</span>
            </div>
            {lowStockCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-danger-500/30 bg-danger-500/10 text-sm">
                <span className="text-text-secondary">재고 부족</span>
                <span className="font-bold text-danger-500">{lowStockCount}</span>
              </div>
            )}
            {selectedInventoryIds.size > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary-500/30 bg-primary-500/10 text-sm">
                <span className="text-text-secondary">선택됨</span>
                <span className="font-bold text-primary-500">{selectedInventoryIds.size}</span>
              </div>
            )}
          </div>

          <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full border-collapse min-w-[840px]">
              <thead className="bg-white">
                <tr>
                  {canManage && (
                    <th className="w-10 py-3 px-3.5 text-left">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => {
                          setSelectedInventoryIds((prev) => {
                            const next = new Set(prev);
                            if (allSelected) {
                              for (const item of pagedInventory) next.delete(item.id);
                            } else {
                              for (const item of pagedInventory) next.add(item.id);
                            }
                            return next;
                          });
                        }}
                        className="w-4 h-4 rounded accent-primary"
                      />
                    </th>
                  )}
                  <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">매장</th>
                  <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">상품</th>
                  <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">재고 가능</th>
                  <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">예약됨</th>
                  <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">판매됨</th>
                  <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">최소 재고</th>
                  <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">상태</th>
                </tr>
              </thead>
              <tbody>
                {pagedInventory.map((item) => {
                  const lowStock = isLowStock(item);
                  return (
                    <tr
                      key={item.id}
                      className="border-t border-border cursor-pointer hover:bg-bg-tertiary transition-colors"
                      onClick={() =>
                        router.push(
                          `/customer/inventory/${item.product_id}?branchId=${encodeURIComponent(item.branch_id)}`,
                        )
                      }
                    >
                      {canManage && (
                        <td
                          className="py-3 px-3.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedInventoryIds.has(item.id)}
                            onChange={() => {
                              setSelectedInventoryIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(item.id)) next.delete(item.id);
                                else next.add(item.id);
                                return next;
                              });
                            }}
                            className="w-4 h-4 rounded accent-primary"
                          />
                        </td>
                      )}
                      <td className="py-3 px-3.5 text-[13px] text-foreground whitespace-nowrap">
                        {item.branch_name || "-"}
                      </td>
                      <td className="py-3 px-3.5 text-[13px] text-foreground">
                        <div className="flex items-center gap-3">
                          {item.image_url && (
                            <Image
                              src={item.image_url}
                              alt={item.product_name || "상품 이미지"}
                              width={48}
                              height={48}
                              className="w-12 h-12 rounded-lg object-cover border border-border"
                            />
                          )}
                          <div className="font-semibold text-sm">
                            {item.product_name || "상품명 없음"}
                          </div>
                        </div>
                      </td>
                      <td className={`py-3 px-3.5 text-[13px] text-right font-bold ${lowStock ? "text-danger-500" : "text-success"}`}>
                        {item.qty_available}
                      </td>
                      <td className="py-3 px-3.5 text-[13px] text-right text-text-secondary">{item.qty_reserved}</td>
                      <td className="py-3 px-3.5 text-[13px] text-right text-text-secondary">{item.qty_sold}</td>
                      <td className="py-3 px-3.5 text-[13px] text-right text-text-secondary">{item.low_stock_threshold}</td>
                      <td className="py-3 px-3.5 text-[13px] text-foreground">
                        {lowStock ? (
                          <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-danger-500/20 text-danger-500 text-xs font-semibold">재고 부족</span>
                        ) : (
                          <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-success/20 text-success text-xs font-semibold">정상</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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
        </>
      )}

      <InventoryHistoryModal
        open={historyOpen}
        logs={historyItems}
        loading={historyLoading}
        error={historyError}
        onClose={() => setHistoryOpen(false)}
        onExport={handleExportHistory}
      />
    </div>
  );
}
