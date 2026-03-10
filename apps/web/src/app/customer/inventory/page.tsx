"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
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

type SalesChannelFilter = "ALL" | `BRANCH:${string}`;

type CategoryFilter =
  | "ALL"
  | "UNCATEGORIZED"
  | `CATEGORY:${string}`       // 지점 선택 시 (id 기준)
  | `CATEGORY_NAME:${string}`; // 전체 (이름 기준)

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
  // 카테고리 필터링은 API가 아래 필드를 반환할 때만 정확히 작동.
  // 반환하지 않으면 모든 항목이 UNCATEGORIZED로 처리됨.
  category_id?: string | null;
  category_name?: string | null;
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

// ─── Utilities ───────────────────────────────────────────────────────────────

function normalizeCategoryName(name: string) {
  return (name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function toCategoryFilter(categoryId: string): CategoryFilter {
  return `CATEGORY:${categoryId}`;
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

function getBranchIdFromSalesChannelFilter(filter: SalesChannelFilter): string | null {
  if (!filter.startsWith("BRANCH:")) return null;
  return filter.replace("BRANCH:", "").trim() || null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TRANSACTION_TYPES = [
  { value: "RESTOCK", label: "재입고" },
  { value: "ADJUSTMENT", label: "재고 조정" },
  { value: "DAMAGE", label: "손상/폐기" },
  { value: "RETURN", label: "반품" },
];

function isLowStock(item: InventoryItem): boolean {
  return item.is_low_stock;
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
  const [salesChannelFilter, setSalesChannelFilter] = useState<SalesChannelFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // ── UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const selectedFilterBranchId = useMemo(
    () => getBranchIdFromSalesChannelFilter(salesChannelFilter),
    [salesChannelFilter],
  );

  // 카테고리 드롭다운 목록
  const availableCategories = useMemo(() => {
    if (selectedFilterBranchId) {
      const list = branchCategories[selectedFilterBranchId] ?? [];
      const byId = new Map<string, ProductCategory>();
      for (const c of list) {
        if (c?.id && c.isActive !== false && !byId.has(c.id)) byId.set(c.id, c);
      }
      return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, "ko"));
    }
    // ALL: 이름 기준 중복 제거
    const list = Object.values(branchCategories).flat();
    const byName = new Map<string, ProductCategory>();
    for (const c of list) {
      if (!c?.id || c.isActive === false) continue;
      const key = normalizeCategoryName(c.name);
      if (key && !byName.has(key)) byName.set(key, c);
    }
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [branchCategories, selectedFilterBranchId]);

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

  // 1) 판매채널 필터
  const filteredBySalesChannel = useMemo(() => {
    if (salesChannelFilter === "ALL" || !selectedFilterBranchId) return inventory;
    return inventory.filter((item) => item.branch_id === selectedFilterBranchId);
  }, [inventory, salesChannelFilter, selectedFilterBranchId]);

  // 2) 카테고리 필터
  const categoryFilteredInventory = useMemo(() => {
    if (categoryFilter === "ALL") return filteredBySalesChannel;
    if (categoryFilter === "UNCATEGORIZED") {
      return filteredBySalesChannel.filter((item) => !item.category_id);
    }
    const cid = getCategoryIdFromFilter(categoryFilter);
    if (cid) {
      return filteredBySalesChannel.filter((item) => item.category_id === cid);
    }
    const nameKey = getCategoryNameKeyFromFilter(categoryFilter);
    if (!nameKey) return filteredBySalesChannel;
    return filteredBySalesChannel.filter(
      (item) => item.category_id && categoryIdToNameKey[item.category_id] === nameKey,
    );
  }, [filteredBySalesChannel, categoryFilter, categoryIdToNameKey]);

  // 3) 검색 필터
  const searchedInventory = useMemo(() => {
    if (!searchQuery.trim()) return categoryFilteredInventory;
    const q = searchQuery.toLowerCase();
    return categoryFilteredInventory.filter(
      (item) =>
        (item.product_name ?? "").toLowerCase().includes(q) ||
        (item.branch_name ?? "").toLowerCase().includes(q),
    );
  }, [categoryFilteredInventory, searchQuery]);

  // 4) 페이지네이션
  const totalPages = Math.max(1, Math.ceil(searchedInventory.length / PAGE_SIZE));

  const pagedInventory = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return searchedInventory.slice(start, start + PAGE_SIZE);
  }, [searchedInventory, page]);

  const allSelected =
    pagedInventory.length > 0 &&
    pagedInventory.every((item) => selectedInventoryIds.has(item.id));

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

  // 최초: 브랜드 목록 로드
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
        // selectedBrandId 변경 → 아래 useEffect가 branches/categories 로드
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "브랜드 목록을 불러올 수 없습니다");
        setLoading(false);
      }
    };
    run();
  }, []);

  // 브랜드 변경 시: 지점 + 카테고리 로드 후 전체 지점 선택
  useEffect(() => {
    if (!selectedBrandId) return;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        // 먼저 초기화 (이전 브랜드 데이터 + 필터 클리어)
        setSelectedBranchIds(new Set());
        setBranches([]);
        setBranchCategories({});
        setSalesChannelFilter("ALL");
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

        // 전체 지점 선택 상태로 시작 → loadInventory useEffect 트리거
        setSelectedBranchIds(new Set(branchRows.map((b) => b.id)));
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "지점 목록을 불러올 수 없습니다");
        setLoading(false);
      }
    };
    run();
  }, [selectedBrandId, loadBranchCategories]);

  // 선택 지점 변경 시: 재고 로드
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

  // 필터 결과에서 사라진 항목 선택 해제
  useEffect(() => {
    setSelectedInventoryIds((prev) => {
      if (prev.size === 0) return prev;
      const visibleIds = new Set(searchedInventory.map((item) => item.id));
      const next = new Set(Array.from(prev).filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [searchedInventory]);

  // 검색어 debounce (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 필터/브랜드 변경 시 page 1 리셋
  useEffect(() => {
    setPage(1);
  }, [salesChannelFilter, categoryFilter, searchQuery, selectedBrandId]);

  useEffect(() => {
    setPage(1);
  }, [selectedBranchIds, branchSearch]);

  // page 보정
  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  // 판매채널/브랜드 변경 시 카테고리 필터 초기화
  useEffect(() => {
    setCategoryFilter("ALL");
  }, [selectedBrandId, salesChannelFilter]);

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
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "일괄 비활성화에 실패했습니다");
    } finally {
      setBulkDeactivating(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  // 초기 로딩 스켈레톤 (브랜드/지점 정보 없는 첫 진입)
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
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold m-0 text-foreground">재고 관리</h1>
          <p className="text-text-secondary mt-1 mb-0 text-[13px]">
            {searchedInventory.length > 0 && `총 ${searchedInventory.length}개 상품`}
            {searchedInventory.filter(isLowStock).length > 0 &&
              ` · 재고 부족 ${searchedInventory.filter(isLowStock).length}개`}
          </p>
        </div>
      </div>

      {/* Sticky filter bar */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border pb-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* 브랜드 */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-text-secondary mb-2 font-semibold">브랜드</label>
            <select
              value={selectedBrandId}
              onChange={(e) => setSelectedBrandId(e.target.value)}
              className="input-field w-full"
            >
              {brands.length === 0 && <option value="">브랜드 없음</option>}
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {selectedBrandId && (
            <>
              {/* 판매채널 */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm text-text-secondary mb-2 font-semibold">판매채널</label>
                <select
                  value={salesChannelFilter}
                  onChange={(e) => setSalesChannelFilter(e.target.value as SalesChannelFilter)}
                  className="input-field w-full"
                >
                  <option value="ALL">전체</option>
                  {branches.map((b) => (
                    <option key={b.id} value={`BRANCH:${b.id}`}>
                      지점 주문 - {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 카테고리 */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm text-text-secondary mb-2 font-semibold">카테고리</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
                  className="input-field w-full"
                >
                  <option value="ALL">전체</option>
                  <option value="UNCATEGORIZED">카테고리 없음</option>
                  {availableCategories.map((c) => (
                    <option
                      key={c.id}
                      value={selectedFilterBranchId ? toCategoryFilter(c.id) : toCategoryNameFilter(c.name)}
                    >
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 검색 */}
              <div className="w-80">
                <label className="block text-sm text-text-secondary mb-2 font-semibold">검색</label>
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
                    className="input-field w-full pl-9 pr-9"
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
              <div className="flex items-center h-10">
                <span className="text-sm text-text-secondary whitespace-nowrap">
                  총 {searchedInventory.length}개
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 재고 조회 지점 선택 */}
      {selectedBrandId && (
        <div className="mb-6">
          <label className="block text-[13px] text-text-secondary mb-2 font-semibold">
            재고 조회 지점
          </label>
          <div className="max-w-[520px] space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
              <input
                type="text"
                value={branchSearch}
                onChange={(e) => setBranchSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setBranchSearch("");
                }}
                placeholder="매장 검색"
                className="input-field w-full pl-9 pr-9 focus:ring-1 focus:ring-primary-500"
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
            <div className="max-h-44 overflow-y-auto border border-border rounded-lg p-2 bg-bg-secondary">
              <div className="flex flex-col gap-1">
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
    </div>
  );
}
