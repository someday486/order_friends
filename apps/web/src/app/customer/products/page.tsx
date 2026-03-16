"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api-client";
import { formatWon } from "@/lib/format";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { Switch } from "@/components/common/Switch";
import { HelpCircle, Pencil, Search, X, ExternalLink, Star, ChevronDown } from "lucide-react";


type Brand = {
  id: string;
  name: string;
  slug?: string | null;
  myRole?: string | null;
};

type Branch = {
  id: string;
  name: string;
  slug?: string | null;
  brandId: string;
  myRole?: string | null;
};

type ProductCategory = {
  id: string;
  name: string;
  isActive: boolean;
};

type InventoryMode = "PRODUCT" | "NONE" | "MIXED";

type BrandTemplate = {
  id: string;
  brandId: string;
  name: string;
  description?: string | null;
  price: number;
  discountPrice?: number;
  urgentDiscountPrice?: number | null;
  urgentDiscountStartAt?: string | null;
  urgentDiscountEndAt?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[];
  isActive: boolean;
  sortOrder: number;
  appliedBranchIds?: string[];
  appliedBranchCategoryIds?: Record<string, string | null>;
  appliedBranchCount?: number;
  totalBranchCount?: number | null;
  inventoryMode?: InventoryMode;
  isOnlineShopVisible?: boolean;
};

type TemplateForm = {
  name: string;
  description: string;
  price: string;
  urgentDiscountPrice: string;
  urgentDiscountStartAt: string;
  urgentDiscountEndAt: string;
  imageUrls: string[];
  isActive: boolean;
  inventoryMode: "PRODUCT" | "NONE";
};

type BulkStatus = "keep" | "active" | "inactive";
type BulkInventoryMode = "keep" | "PRODUCT" | "NONE";
type SalesChannelFilter = "ALL" | "ONLINE_SHOP" | `BRANCH:${string}`;
type UrgentDiscountHistory = {
  id?: string;
  price: number | null;
  startAt: string | null;
  endAt: string | null;
  recordedReason?: string | null;
  createdAt?: string | null;
};

type CategoryFilter =
  | "ALL"
  | "UNCATEGORIZED"
  | `CATEGORY:${string}`          // 지점 선택 시 (id 기준)
  | `CATEGORY_NAME:${string}`;    // 전체/온라인샵 (이름 기준)

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
  const id = filter.replace("CATEGORY:", "").trim();
  return id || null;
}

function getCategoryNameKeyFromFilter(filter: CategoryFilter): string | null {
  if (!filter.startsWith("CATEGORY_NAME:")) return null;
  const key = filter.replace("CATEGORY_NAME:", "").trim();
  return key || null;
}

const EMPTY_FORM: TemplateForm = {
  name: "",
  description: "",
  price: "",
  urgentDiscountPrice: "",
  urgentDiscountStartAt: "",
  urgentDiscountEndAt: "",
  imageUrls: [],
  isActive: true,
  inventoryMode: "PRODUCT",
};

const MAX_TEMPLATE_IMAGES = 10;

function normalizeImageUrls(imageUrls?: string[] | null, imageUrl?: string | null) {
  const normalized = Array.from(
    new Set(
      (Array.isArray(imageUrls) ? imageUrls : [])
        .filter((url): url is string => typeof url === "string")
        .map((url) => url.trim())
        .filter(Boolean),
    ),
  );

  if (normalized.length > 0) {
    return normalized.slice(0, MAX_TEMPLATE_IMAGES);
  }

  if (typeof imageUrl === "string" && imageUrl.trim().length > 0) {
    return [imageUrl.trim()];
  }

  return [];
}

function toDatetimeLocalValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function toIsoOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatKoreanDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getUrgentDiscountHistoryBadge(
  recordedReason?: string | null,
  endAt?: string | null,
) {
  const reason = (recordedReason ?? "").toUpperCase();
  if (reason === "CLEARED") {
    return {
      label: "해제",
      className: "bg-neutral-200 text-neutral-700 border border-neutral-300",
    };
  }
  if (reason === "REPLACED") {
    return {
      label: "교체",
      className: "bg-primary-100 text-primary-700 border border-primary-200",
    };
  }

  const endTs = endAt ? Date.parse(endAt) : Number.NaN;
  if (Number.isFinite(endTs) && endTs < Date.now()) {
    return {
      label: "만료",
      className: "bg-warning-100 text-warning-700 border border-warning-200",
    };
  }

  if (reason === "UPDATED") {
    return {
      label: "변경",
      className: "bg-blue-100 text-blue-700 border border-blue-200",
    };
  }

  return {
    label: "설정",
    className: "bg-success/15 text-success border border-success/30",
  };
}

const URGENT_DISCOUNT_UNSUPPORTED_MESSAGE =
  "긴급할인 기능을 사용하려면 상품 테이블에 할인 컬럼이 필요합니다.";

function isUrgentDiscountUnsupportedError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.message.includes(URGENT_DISCOUNT_UNSUPPORTED_MESSAGE);
}



function canManageBrandTemplate(role: string | null | undefined) {
  return role === "OWNER" || role === "ADMIN";
}

function getOrderUrl(branch: Branch, brandSlug?: string | null) {
  if (brandSlug && branch.slug) {
    return `/order/${encodeURIComponent(brandSlug)}/${encodeURIComponent(branch.slug)}`;
  }
  return `/order/branch/${encodeURIComponent(branch.id)}`;
}

function getShopUrl(brandSlug: string | null | undefined) {
  if (!brandSlug) return null;
  return `/shop/${encodeURIComponent(brandSlug)}`;
}

function isInternalOnlineShopBranch(branch: Branch, brandName?: string | null): boolean {
  if (branch.slug) return false;
  const branchName = (branch.name ?? "").trim();
  if (!branchName) return false;
  const normalizedBranchName = branchName.toLowerCase();
  const normalizedBrandName = (brandName ?? "").trim().toLowerCase();

  if (normalizedBrandName && normalizedBranchName === `${normalizedBrandName} 온라인샵`) {
    return true;
  }
  return normalizedBranchName.endsWith("온라인샵");
}

function toBranchSalesChannelFilter(branchId: string): SalesChannelFilter {
  return `BRANCH:${branchId}`;
}

function getBranchIdFromSalesChannelFilter(filter: SalesChannelFilter): string | null {
  if (!filter.startsWith("BRANCH:")) {
    return null;
  }
  const branchId = filter.replace("BRANCH:", "").trim();
  return branchId || null;
}

function BranchChecklistTable({
  branches,
  selectedIds,
  onToggle,
  onToggleAll,
  categoryMap,
  selectedCategoryIds,
  onChangeCategory,
  onlineShopChecked,
  onToggleOnlineShop,
  onlineShopUrl,
  brandSlug,
  disabled,
}: {
  branches: Branch[];
  selectedIds: Set<string>;
  onToggle: (branchId: string) => void;
  onToggleAll: (checked: boolean) => void;
  categoryMap?: Record<string, ProductCategory[]>;
  selectedCategoryIds?: Record<string, string>;
  onChangeCategory?: (branchId: string, categoryId: string) => void;
  onlineShopChecked?: boolean;
  onToggleOnlineShop?: () => void;
  onlineShopUrl?: string | null;
  brandSlug?: string | null;
  disabled?: boolean;
}) {
  const [branchSearch, setBranchSearch] = useState("");

  const filteredBranches = useMemo(() => {
    if (!branchSearch.trim()) return branches;
    const keyword = branchSearch.toLowerCase();
    return branches.filter((b) =>
      (b.name ?? "").toLowerCase().includes(keyword)
    );
  }, [branches, branchSearch]);

  const allBranchesChecked =
    filteredBranches.length > 0 &&
    filteredBranches.every((b) => selectedIds.has(b.id));

  const allChecked = onToggleOnlineShop
    ? allBranchesChecked && (onlineShopChecked ?? false)
    : allBranchesChecked;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="p-3 border-b border-border bg-bg-tertiary">
        <input
          type="text"
          value={branchSearch}
          onChange={(e) => setBranchSearch(e.target.value)}
          placeholder="매장명 검색"
          className="input-field w-full text-xs"
        />
      </div>
      <table className="w-full border-collapse">
        <thead className="bg-white">
          <tr>
            <th className="w-12 py-2.5 px-3 text-center">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={(event) => onToggleAll(event.target.checked)}
                disabled={disabled || branches.length === 0}
                className="w-4 h-4 rounded accent-primary"
              />
            </th>
            <th className="py-2.5 px-3 text-left text-xs font-bold text-text-secondary">매장명</th>
            {/* <th className="py-2.5 px-3 text-left text-xs font-bold text-text-secondary">채널 URL</th> */}
            {onChangeCategory && (
              <th className="py-2.5 px-3 text-left text-xs font-bold text-text-secondary">
                카테고리
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {filteredBranches.map((branch) => (  //여기수정함
            <tr key={branch.id} className="border-t border-border">
              <td className="py-2.5 px-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(branch.id)}
                  onChange={() => onToggle(branch.id)}
                  disabled={disabled}
                  className="w-4 h-4 rounded accent-primary"
                />
              </td>
              <td className="py-2.5 px-3 text-sm text-foreground">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate">{branch.name}</div>
                    <div className="text-xs text-text-secondary">지점 주문</div>
                  </div>

                  <a
                    href={getOrderUrl(branch, brandSlug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="고객 주문 페이지 열기"
                    aria-label={`${branch.name} 고객 주문 페이지 열기`}
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-foreground transition-colors flex-shrink-0"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </td>


              {onChangeCategory && (
                <td className="py-2.5 px-3">
                  <select
                    value={selectedCategoryIds?.[branch.id] ?? ""}
                    onChange={(event) => onChangeCategory(branch.id, event.target.value)}
                    disabled={disabled || !selectedIds.has(branch.id)}
                    className="input-field h-8 py-1 text-xs"
                  >
                    <option value="">카테고리 없음</option>
                    {(categoryMap?.[branch.id] ?? [])
                      .filter((category) => category.isActive !== false)
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </select>
                </td>
              )}
            </tr>
          ))}
          {onToggleOnlineShop && (
            <tr className="border-t border-border bg-bg-secondary/40">
              <td className="py-2.5 px-3">
                <input
                  type="checkbox"
                  checked={onlineShopChecked ?? false}
                  onChange={() => onToggleOnlineShop()}
                  disabled={disabled}
                  className="w-4 h-4 rounded accent-primary"
                />
              </td>
              <td className="py-2.5 px-3 text-sm text-foreground font-semibold">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div>온라인샵</div>
                    <div className="text-xs text-text-secondary font-normal">브랜드 직배송</div>
                  </div>

                  {onlineShopUrl ? (
                    <a
                      href={onlineShopUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="온라인샵 페이지 열기"
                      aria-label="온라인샵 페이지 열기"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-foreground transition-colors flex-shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : null}
                </div>
              </td>


              {onChangeCategory && (
                <td className="py-2.5 px-3 text-xs text-text-tertiary">카테고리 미사용</td>
              )}
            </tr>
          )}
          {branches.length === 0 && (
            <tr>
              <td
                colSpan={onChangeCategory ? 3 : 2}
                className="py-4 px-3 text-sm text-text-secondary text-center"
              >
                등록된 매장이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function CustomerProductsPage() {
  const [bulkAutoOpenDisabled, setBulkAutoOpenDisabled] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  
  // ============================
  // Brand favorites (localStorage)
  // ============================
  const [favoriteBrandIds, setFavoriteBrandIds] = useState<string[]>([]);
  const [isBrandOpen, setIsBrandOpen] = useState(false); // (다음 단계 UI에서 사용)
  const [brandSearch, setBrandSearch] = useState("");   // (다음 단계 UI에서 사용)

  const toggleFavoriteBrand = useCallback((brandId: string) => {
    setFavoriteBrandIds((prev) => {
      const idx = prev.indexOf(brandId);
      // 이미 즐겨찾기면 제거
      if (idx !== -1) {
        const next = prev.slice();
        next.splice(idx, 1);
        return next;
      }
      // 아니면 "끝에 추가" => 즐겨찾기한 순서 유지
      return [...prev, brandId];
    });
  }, []);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchCategories, setBranchCategories] = useState<Record<string, ProductCategory[]>>({});
  const [templates, setTemplates] = useState<BrandTemplate[]>([]);
  const [isUrgentDiscountSupported, setIsUrgentDiscountSupported] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<TemplateForm>(EMPTY_FORM);
  const [createBranchIds, setCreateBranchIds] = useState<Set<string>>(new Set());
  const [createOnlineShopChecked, setCreateOnlineShopChecked] = useState(true);
  const [createBranchCategoryIds, setCreateBranchCategoryIds] = useState<Record<string, string>>({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TemplateForm>(EMPTY_FORM);
  const [editBranchIds, setEditBranchIds] = useState<Set<string>>(new Set());
  const [editOnlineShopChecked, setEditOnlineShopChecked] = useState(true);
  const [editBranchCategoryIds, setEditBranchCategoryIds] = useState<Record<string, string>>({});
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [bulkBranchIds, setBulkBranchIds] = useState<Set<string>>(new Set());
  const [bulkOnlineShopChecked, setBulkOnlineShopChecked] = useState(true);
  const [bulkStatus, setBulkStatus] = useState<BulkStatus>("keep");
  const [bulkInventoryMode, setBulkInventoryMode] = useState<BulkInventoryMode>("keep");
  const [bulkChangeStatus, setBulkChangeStatus] = useState(false);
  const [bulkChangeInventory, setBulkChangeInventory] = useState(false);
  const [bulkChangeChannels, setBulkChangeChannels] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [appliedDrawerTemplateId, setAppliedDrawerTemplateId] = useState<string | null>(null);
  const [drawerBranchSearch, setDrawerBranchSearch] = useState("");
  const lastSelectedTemplateIdRef = useRef<string | null>(null);
  const brandDropdownRef = useRef<HTMLDivElement | null>(null);
  const [salesChannelFilter, setSalesChannelFilter] = useState<SalesChannelFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const [isEditChannelOpen, setIsEditChannelOpen] = useState(false);
  const [editInitialSnapshot, setEditInitialSnapshot] = useState<string | null>(null);
  const [editUrgentDiscountHistory, setEditUrgentDiscountHistory] =
    useState<UrgentDiscountHistory | null>(null);
  const [editUrgentDiscountHistories, setEditUrgentDiscountHistories] = useState<
    UrgentDiscountHistory[]
  >([]);
  const [editUrgentDiscountHistoriesLoading, setEditUrgentDiscountHistoriesLoading] =
    useState(false);
  const [isUrgentHistoryOpen, setIsUrgentHistoryOpen] = useState(false);
  const [isEditDrawerVisible, setIsEditDrawerVisible] = useState(false);
  const editDrawerCloseTimerRef = useRef<number | null>(null);
  const brandSearchInputRef = useRef<HTMLInputElement | null>(null);
  const selectedBrand = useMemo(
    () => brands.find((brand) => brand.id === selectedBrandId) ?? null,
    [brands, selectedBrandId],
  );
  
  const favoriteSet = useMemo(
    () => new Set(favoriteBrandIds),
    [favoriteBrandIds],
  );

  const filteredBrands = useMemo(() => {
    const q = brandSearch.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => (b.name ?? "").toLowerCase().includes(q));
  }, [brands, brandSearch]);

  const sortedBrands = useMemo(() => {
    const byId = new Map(filteredBrands.map((b) => [b.id, b]));

    const favoritesInOrder = favoriteBrandIds
      .map((id) => byId.get(id))
      .filter(Boolean) as Brand[];

    const rest = filteredBrands
      .filter((b) => !favoriteSet.has(b.id))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));

    return [...favoritesInOrder, ...rest];
  }, [filteredBrands, favoriteBrandIds, favoriteSet]);
  
  const selectedBrandShopUrl = getShopUrl(selectedBrand?.slug);

  const clearEditDrawerCloseTimer = useCallback(() => {
    if (editDrawerCloseTimerRef.current !== null) {
      window.clearTimeout(editDrawerCloseTimerRef.current);
      editDrawerCloseTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearEditDrawerCloseTimer();
  }, [clearEditDrawerCloseTimer]);

  useEffect(() => {
    if (editingTemplateId) {
      setIsEditDrawerVisible(true);
    }
  }, [editingTemplateId]);

  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const disableUrgentDiscountUI = useCallback(() => {
    setIsUrgentDiscountSupported(false);
    setCreateForm((prev) => ({
      ...prev,
      urgentDiscountPrice: "",
      urgentDiscountStartAt: "",
      urgentDiscountEndAt: "",
    }));
    setEditForm((prev) => ({
      ...prev,
      urgentDiscountPrice: "",
      urgentDiscountStartAt: "",
      urgentDiscountEndAt: "",
    }));
  }, []);

  const selectedFilterBranchId = useMemo(
    () => getBranchIdFromSalesChannelFilter(salesChannelFilter),
    [salesChannelFilter],
  );
  const selectedFilterBranchName = useMemo(
    () => branches.find((branch) => branch.id === selectedFilterBranchId)?.name ?? null,
    [branches, selectedFilterBranchId],
  );
  const availableCategories = useMemo(() => {
    const branchId = getBranchIdFromSalesChannelFilter(salesChannelFilter);

    // 지점 선택이면: 해당 지점 카테고리만 (id 기준 중복 제거)
    if (branchId) {
      const list = branchCategories[branchId] ?? [];
      const byId = new Map<string, ProductCategory>();
      for (const c of list) {
        if (c?.id && c.isActive !== false && !byId.has(c.id)) byId.set(c.id, c);
      }
      return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, "ko"));
    }

    // 전체/온라인샵이면: 여러 지점 카테고리 합쳐서 "이름" 기준 중복 제거
    const list = Object.values(branchCategories).flat();
    const byName = new Map<string, ProductCategory>();

    for (const c of list) {
      if (!c?.id) continue;
      if (c.isActive === false) continue;

      const key = normalizeCategoryName(c.name);
      if (!key) continue;

      if (!byName.has(key)) byName.set(key, c); // 같은 이름이면 1개만 유지
    }

    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [branchCategories, salesChannelFilter]);

  const categoryIdToNameKey = useMemo(() => {
    const map: Record<string, string> = {};
    for (const categories of Object.values(branchCategories)) {
      for (const c of categories ?? []) {
        if (!c?.id) continue;
        if (c.isActive === false) continue;
        map[c.id] = normalizeCategoryName(c.name);
      }
    }
    return map;
  }, [branchCategories]);

  const filteredTemplates = useMemo(() => {
    if (salesChannelFilter === "ALL") {
      return templates;
    }
    if (salesChannelFilter === "ONLINE_SHOP") {
      return templates.filter((template) => template.isOnlineShopVisible !== false);
    }
    if (!selectedFilterBranchId) {
      return templates;
    }
    return templates.filter((template) =>
      (template.appliedBranchIds ?? []).includes(selectedFilterBranchId),
    );
  }, [templates, salesChannelFilter, selectedFilterBranchId]);  
  const filteredTemplateIdSet = useMemo(
    () => new Set(filteredTemplates.map((template) => template.id)),
    [filteredTemplates],
  );

  const categoryFilteredTemplates = useMemo(() => {
    if (categoryFilter === "ALL") return filteredTemplates;

    // 카테고리 없음
    if (categoryFilter === "UNCATEGORIZED") {
      if (selectedFilterBranchId) {
        // 지점 선택 시: 해당 지점에 카테고리 미지정인 템플릿
        return filteredTemplates.filter((t) => {
          const map = t.appliedBranchCategoryIds ?? {};
          return !map[selectedFilterBranchId];
        });
      }

      // 전체/온라인샵: 모든 지점에서 카테고리 지정이 하나도 없는 템플릿
      return filteredTemplates.filter((t) => {
        const values = Object.values(t.appliedBranchCategoryIds ?? {});
        return values.filter(Boolean).length === 0;
      });
    }

    // 1) 지점 선택이면: CATEGORY:id 기준 필터
    const cid = getCategoryIdFromFilter(categoryFilter);
    if (cid) {
      if (selectedFilterBranchId) {
        return filteredTemplates.filter(
          (t) => (t.appliedBranchCategoryIds ?? {})[selectedFilterBranchId] === cid,
        );
      }

      // (이 경우는 사실상 잘 안 옴: 전체인데 CATEGORY:id를 선택할 일이 없게 UI를 만들 거라)
      return filteredTemplates.filter((t) =>
        Object.values(t.appliedBranchCategoryIds ?? {}).some((v) => v === cid),
      );
    }

    // 2) 전체/온라인샵이면: CATEGORY_NAME:key 기준 필터
    const nameKey = getCategoryNameKeyFromFilter(categoryFilter);
    if (!nameKey) return filteredTemplates;

    return filteredTemplates.filter((t) => {
      const ids = Object.values(t.appliedBranchCategoryIds ?? {});
      return ids.some((id) => id && categoryIdToNameKey[id] === nameKey);
    });
  }, [filteredTemplates, categoryFilter, selectedFilterBranchId, categoryIdToNameKey]);  

  const searchedTemplates = useMemo(() => {
    if (!searchQuery.trim()) {
      return categoryFilteredTemplates;
    }
    const query = searchQuery.toLowerCase();
    return categoryFilteredTemplates.filter((template) => {
      const name = (template.name ?? "").toLowerCase();
      const description = (template.description ?? "").toLowerCase();
      return name.includes(query) || description.includes(query);
    });
  }, [categoryFilteredTemplates, searchQuery]);

  const searchedTemplateIdSet = useMemo(
    () => new Set(searchedTemplates.map((template) => template.id)),
    [searchedTemplates],
  );

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(searchedTemplates.length / PAGE_SIZE));
  }, [searchedTemplates.length]);

  const pagedTemplates = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return searchedTemplates.slice(start, start + PAGE_SIZE);
  }, [searchedTemplates, page]);

  // mount 시 즐겨찾기 로드
  useEffect(() => {
    try {
      const raw = localStorage.getItem("customerProducts.favoriteBrandIds");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
        setFavoriteBrandIds(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  // 변경 시 저장
  useEffect(() => {
    try {
      localStorage.setItem(
        "customerProducts.favoriteBrandIds",
        JSON.stringify(favoriteBrandIds),
      );
    } catch {
      // ignore
    }
  }, [favoriteBrandIds]);

  useEffect(() => {
    if (!isBrandOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const el = brandDropdownRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setIsBrandOpen(false);
        setBrandSearch("");
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsBrandOpen(false);
        setBrandSearch("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isBrandOpen]);

  useEffect(() => {
    if (isBrandOpen) {
      setTimeout(() => {
        brandSearchInputRef.current?.focus();
      }, 0);
    }
  }, [isBrandOpen]);  

  // 판매 채널/브랜드/카테고리/검색어 바뀌면 1페이지로 리셋
  useEffect(() => {
    setPage(1);
  }, [salesChannelFilter, selectedBrandId, categoryFilter, searchQuery]);

  useEffect(() => {
    // 브랜드/판매채널 바뀌면 카테고리 필터는 안전하게 전체로
    setCategoryFilter("ALL");
  }, [selectedBrandId, salesChannelFilter]);

  // page가 totalPages보다 커지면 보정
  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  // 검색 결과에서 사라진 항목 자동 제거
  useEffect(() => {
    setSelectedTemplateIds((prev) => {
      const next = new Set([...prev].filter((id) => searchedTemplateIdSet.has(id)));
      if (next.size === prev.size) {
        return prev;
      }
      return next;
    });
  }, [searchedTemplateIdSet]);

  // 검색 input debounce (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    // 0 -> 1 이상 되는 순간에만 자동으로 펼치기
    if (selectedTemplateIds.size > 0 && !isBulkOpen && !bulkAutoOpenDisabled) {
      setIsBulkOpen(true);
    }

    // 선택이 0이 되면, 다음 선택 때는 다시 자동오픈 허용
    if (selectedTemplateIds.size === 0 && bulkAutoOpenDisabled) {
      setBulkAutoOpenDisabled(false);
    }
  }, [selectedTemplateIds.size, isBulkOpen, bulkAutoOpenDisabled]);

  // 선택된 메뉴가 0개가 되면 일괄변경 플래그 리셋
  useEffect(() => {
    if (selectedTemplateIds.size === 0) {
      setBulkChangeStatus(false);
      setBulkChangeInventory(false);
      setBulkChangeChannels(false);
    }
  }, [selectedTemplateIds.size]);

  // 드로어 닫기: ESC
  useEffect(() => {
    if (!appliedDrawerTemplateId) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAppliedDrawerTemplateId(null);
        setDrawerBranchSearch("");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [appliedDrawerTemplateId]);

  const canManage = canManageBrandTemplate(selectedBrand?.myRole);
  const hasSelectedTemplates = selectedTemplateIds.size > 0;
  const allTemplatesChecked =
    searchedTemplates.length > 0 &&
    searchedTemplates.every((template) => selectedTemplateIds.has(template.id));
  const createSelectedCount = createBranchIds.size + (createOnlineShopChecked ? 1 : 0);
  const createTotalCount = branches.length + 1;
  const hasCreateImage = createForm.imageUrls.length > 0;

  const toggleSetValue = (source: Set<string>, id: string) => {
    const next = new Set(source);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return next;
  };

  const setAllBranchChecks = (checked: boolean, target: "create" | "edit") => {
    const next = checked ? new Set(branches.map((branch) => branch.id)) : new Set<string>();
    if (target === "create") {
      setCreateBranchIds(next);
      setCreateOnlineShopChecked(checked);
      return;
    }
    setEditBranchIds(next);
    setEditOnlineShopChecked(checked);
  };

  const buildBranchCategoryAssignments = (
    selectedBranchIds: Set<string>,
    selectedCategoryIds: Record<string, string>,
  ) => {
    return Array.from(selectedBranchIds).map((branchId) => ({
      branchId,
      categoryId: selectedCategoryIds[branchId]?.trim() ? selectedCategoryIds[branchId] : null,
    }));
  };

  const loadBranchCategories = useCallback(async (branchRows: Branch[]) => {
    const entries = await Promise.all(
      branchRows.map(async (branch) => {
        try {
          const categories = await apiClient.get<ProductCategory[]>(
            `/customer/products/categories?branchId=${encodeURIComponent(branch.id)}`,
          );
          return [branch.id, categories] as const;
        } catch (e) {
          console.error(e);
          return [branch.id, []] as const;
        }
      }),
    );

    setBranchCategories(Object.fromEntries(entries));
  }, []);

  const loadTemplates = useCallback(async (brandId: string) => {
    const query = new URLSearchParams({ brandId });
    const data = await apiClient.get<BrandTemplate[]>(
      `/customer/products/brand-templates?${query.toString()}`,
    );
    setTemplates(data);
    setSelectedTemplateIds((prev) => {
      const visibleIds = new Set(data.map((item) => item.id));
      return new Set([...prev].filter((id) => visibleIds.has(id)));
    });
  }, []);

  const loadTemplateUrgentDiscountHistories = useCallback(
    async (templateId: string) => {
      setEditUrgentDiscountHistoriesLoading(true);
      try {
        const rows = await apiClient.get<
          Array<{
            id: string;
            discountPrice: number | null;
            discountStartAt: string | null;
            discountEndAt: string | null;
            recordedReason?: string | null;
            createdAt?: string | null;
          }>
        >(
          `/customer/products/brand-templates/${encodeURIComponent(
            templateId,
          )}/urgent-discount-histories?limit=20`,
        );

        setEditUrgentDiscountHistories(
          (rows ?? []).map((row) => ({
            id: row.id,
            price:
              typeof row.discountPrice === "number" ? row.discountPrice : null,
            startAt: row.discountStartAt ?? null,
            endAt: row.discountEndAt ?? null,
            recordedReason: row.recordedReason ?? null,
            createdAt: row.createdAt ?? null,
          })),
        );
      } catch (e) {
        console.error(e);
        setEditUrgentDiscountHistories([]);
      } finally {
        setEditUrgentDiscountHistoriesLoading(false);
      }
    },
    [],
  );

  const loadBrandContext = useCallback(async (brandId: string, brandName?: string | null) => {
    const [branchRows] = await Promise.all([
      apiClient.get<Branch[]>(`/customer/branches?brandId=${encodeURIComponent(brandId)}`),
      loadTemplates(brandId),
    ]);

    const visibleBranchRows = branchRows.filter(
      (branch) => !isInternalOnlineShopBranch(branch, brandName),
    );

    setBranches(visibleBranchRows);
    // Categories are only needed for channel assignment/filter controls, so load in background.
    void loadBranchCategories(visibleBranchRows);
    setCreateBranchIds(new Set(visibleBranchRows.map((branch) => branch.id)));
    setCreateOnlineShopChecked(true);
    setCreateBranchCategoryIds({});
    setEditBranchCategoryIds({});
    setEditOnlineShopChecked(true);
    setEditingTemplateId(null);
    setBulkBranchIds(new Set(visibleBranchRows.map((branch) => branch.id)));
    setBulkOnlineShopChecked(true);
    setSelectedTemplateIds(new Set());
    setBulkStatus("keep");
    setBulkInventoryMode("keep");
    setBulkChangeStatus(false);
    setBulkChangeInventory(false);
    setBulkChangeChannels(false);
    setSalesChannelFilter("ALL");
  }, [loadBranchCategories, loadTemplates]);

  useEffect(() => {
    setSelectedTemplateIds((prev) => {
      const next = new Set([...prev].filter((id) => filteredTemplateIdSet.has(id)));
      if (next.size === prev.size) {
        return prev;
      }
      return next;
    });
  }, [filteredTemplateIdSet]);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        const brandRows = await apiClient.get<Brand[]>("/customer/brands");
        setBrands(brandRows);

        if (brandRows.length === 0) {
          setSelectedBrandId("");
          setBranches([]);
          setTemplates([]);
          return;
        }

        const initialBrand = brandRows[0];
        const initialBrandId = initialBrand.id;
        setSelectedBrandId(initialBrandId);
        // await loadBrandContext(initialBrandId, initialBrand.name);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "브랜드 메뉴 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [loadBrandContext]);

  useEffect(() => {
    if (!selectedBrandId) {
      return;
    }

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        await loadBrandContext(selectedBrandId, selectedBrand?.name);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "브랜드 메뉴 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [selectedBrandId, selectedBrand?.name, loadBrandContext]);

  const handleCreateTemplate = async () => {
    if (!selectedBrandId) {
      return;
    }
    if (!createForm.name.trim()) {
      toast.error("메뉴명을 입력해주세요.");
      return;
    }

    const parsedPrice = Number.parseInt(createForm.price, 10);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error("가격은 0 이상의 숫자여야 합니다.");
      return;
    }
    const parsedUrgentDiscountPrice = isUrgentDiscountSupported
      ? createForm.urgentDiscountPrice.trim()
        ? Number.parseInt(createForm.urgentDiscountPrice, 10)
        : null
      : null;
    if (isUrgentDiscountSupported) {
      if (
        parsedUrgentDiscountPrice !== null &&
        (Number.isNaN(parsedUrgentDiscountPrice) ||
          parsedUrgentDiscountPrice < 0 ||
          parsedUrgentDiscountPrice >= parsedPrice)
      ) {
        toast.error("긴급할인가는 기본 가격보다 낮은 0 이상 숫자여야 합니다.");
        return;
      }
      const urgentDiscountStartAt = toIsoOrNull(createForm.urgentDiscountStartAt);
      const urgentDiscountEndAt = toIsoOrNull(createForm.urgentDiscountEndAt);
      if (createForm.urgentDiscountStartAt.trim() && !urgentDiscountStartAt) {
        toast.error("긴급할인 시작 시각 형식이 올바르지 않습니다.");
        return;
      }
      if (createForm.urgentDiscountEndAt.trim() && !urgentDiscountEndAt) {
        toast.error("긴급할인 종료 시각 형식이 올바르지 않습니다.");
        return;
      }
      if (
        urgentDiscountStartAt &&
        urgentDiscountEndAt &&
        new Date(urgentDiscountStartAt).getTime() >=
          new Date(urgentDiscountEndAt).getTime()
      ) {
        toast.error("긴급할인 종료 시각은 시작 시각보다 늦어야 합니다.");
        return;
      }
    }
    const urgentDiscountStartAt = isUrgentDiscountSupported
      ? toIsoOrNull(createForm.urgentDiscountStartAt)
      : null;
    const urgentDiscountEndAt = isUrgentDiscountSupported
      ? toIsoOrNull(createForm.urgentDiscountEndAt)
      : null;

    try {
      setSaving(true);
      await apiClient.post("/customer/products/brand-templates", {
        brandId: selectedBrandId,
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
        price: parsedPrice,
        urgentDiscountPrice: isUrgentDiscountSupported
          ? parsedUrgentDiscountPrice ?? undefined
          : undefined,
        urgentDiscountStartAt: isUrgentDiscountSupported
          ? urgentDiscountStartAt ?? undefined
          : undefined,
        urgentDiscountEndAt: isUrgentDiscountSupported
          ? urgentDiscountEndAt ?? undefined
          : undefined,
        imageUrl: createForm.imageUrls[0],
        imageUrls: createForm.imageUrls,
        isActive: createForm.isActive,
        isOnlineShopVisible: createOnlineShopChecked,
        inventoryMode: createForm.inventoryMode,
        branchIds: Array.from(createBranchIds),
        branchCategoryAssignments: buildBranchCategoryAssignments(
          createBranchIds,
          createBranchCategoryIds,
        ),
      });

      setCreateForm(EMPTY_FORM);
      setCreateBranchIds(new Set(branches.map((branch) => branch.id)));
      setCreateOnlineShopChecked(true);
      setCreateBranchCategoryIds({});
      setIsCreateModalOpen(false);
      await loadTemplates(selectedBrandId);
      toast.success("브랜드 메뉴를 등록했습니다.");
    } catch (e) {
      console.error(e);
      if (isUrgentDiscountUnsupportedError(e)) {
        disableUrgentDiscountUI();
      }
      toast.error(e instanceof Error ? e.message : "브랜드 메뉴 등록에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const startEditTemplate = (template: BrandTemplate) => {
    const urgentDiscountEndTs = template.urgentDiscountEndAt
      ? Date.parse(template.urgentDiscountEndAt)
      : Number.NaN;
    const isExpiredUrgentDiscount =
      Number.isFinite(urgentDiscountEndTs) && urgentDiscountEndTs <= Date.now();

    setEditUrgentDiscountHistory(
      isExpiredUrgentDiscount
        ? {
            price:
              typeof template.urgentDiscountPrice === "number"
                ? template.urgentDiscountPrice
                : null,
            startAt: template.urgentDiscountStartAt ?? null,
            endAt: template.urgentDiscountEndAt ?? null,
          }
        : null,
    );

    const initialForm: TemplateForm = {
      name: template.name,
      description: template.description ?? "",
      price: String(template.price ?? 0),
      urgentDiscountPrice:
        !isExpiredUrgentDiscount && typeof template.urgentDiscountPrice === "number"
          ? String(template.urgentDiscountPrice)
          : "",
      urgentDiscountStartAt: isExpiredUrgentDiscount
        ? ""
        : toDatetimeLocalValue(template.urgentDiscountStartAt),
      urgentDiscountEndAt: isExpiredUrgentDiscount
        ? ""
        : toDatetimeLocalValue(template.urgentDiscountEndAt),
      imageUrls: normalizeImageUrls(template.imageUrls, template.imageUrl),
      isActive: template.isActive,
      inventoryMode: template.inventoryMode === "NONE" ? "NONE" : "PRODUCT",
    };
    const initialBranchIds = Array.from(new Set(template.appliedBranchIds ?? [])).sort();
    const initialOnlineShopChecked = template.isOnlineShopVisible !== false;
    const mappedCategories: Record<string, string> = {};
    for (const [branchId, categoryId] of Object.entries(template.appliedBranchCategoryIds ?? {})) {
      if (typeof categoryId === "string" && categoryId.length > 0) {
        mappedCategories[branchId] = categoryId;
      }
    }

    const normalizedInitialCategories = Object.fromEntries(
      Object.entries(mappedCategories).sort(([a], [b]) => a.localeCompare(b)),
    );
    setEditInitialSnapshot(
      JSON.stringify({
        form: initialForm,
        branchIds: initialBranchIds,
        onlineShopChecked: initialOnlineShopChecked,
        categories: normalizedInitialCategories,
      }),
    );

    clearEditDrawerCloseTimer();
    setIsEditDrawerVisible(true);
    setEditingTemplateId(template.id);
    setEditForm(initialForm);
    setEditBranchIds(new Set(initialBranchIds));
    setEditOnlineShopChecked(initialOnlineShopChecked);
    setEditBranchCategoryIds(mappedCategories);
    setEditUrgentDiscountHistories([]);
    setEditUrgentDiscountHistoriesLoading(false);
    setIsUrgentHistoryOpen(false);
    setIsEditChannelOpen(false);
    void loadTemplateUrgentDiscountHistories(template.id);
  };

  const addCreateImage = useCallback((url: string | null) => {
    if (!url) return;
    setCreateForm((prev) => {
      const next = normalizeImageUrls([...prev.imageUrls, url], undefined);
      return { ...prev, imageUrls: next };
    });
  }, []);

  const addEditImage = useCallback((url: string | null) => {
    if (!url) return;
    setEditForm((prev) => {
      const next = normalizeImageUrls([...prev.imageUrls, url], undefined);
      return { ...prev, imageUrls: next };
    });
  }, []);

  const removeCreateImageAt = (index: number) => {
    setCreateForm((prev) => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, i) => i !== index),
    }));
  };

  const removeEditImageAt = (index: number) => {
    setEditForm((prev) => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, i) => i !== index),
    }));
  };

  const setCreatePrimaryImage = (index: number) => {
    setCreateForm((prev) => {
      const target = prev.imageUrls[index];
      if (!target) return prev;
      const reordered = [target, ...prev.imageUrls.filter((_, i) => i !== index)];
      return { ...prev, imageUrls: reordered };
    });
  };

  const setEditPrimaryImage = (index: number) => {
    setEditForm((prev) => {
      const target = prev.imageUrls[index];
      if (!target) return prev;
      const reordered = [target, ...prev.imageUrls.filter((_, i) => i !== index)];
      return { ...prev, imageUrls: reordered };
    });
  };

  const hasEditChanges = useMemo(() => {
    if (!editingTemplateId || !editInitialSnapshot) {
      return false;
    }
    const normalizedCurrentCategories = Object.fromEntries(
      Object.entries(editBranchCategoryIds).sort(([a], [b]) => a.localeCompare(b)),
    );
    const currentSnapshot = JSON.stringify({
      form: editForm,
      branchIds: Array.from(editBranchIds).sort(),
      onlineShopChecked: editOnlineShopChecked,
      categories: normalizedCurrentCategories,
    });
    return currentSnapshot !== editInitialSnapshot;
  }, [
    editBranchCategoryIds,
    editBranchIds,
    editForm,
    editInitialSnapshot,
    editOnlineShopChecked,
    editingTemplateId,
  ]);

  const resetEditTemplateState = useCallback(() => {
    setEditingTemplateId(null);
    setEditForm(EMPTY_FORM);
    setEditBranchIds(new Set());
    setEditOnlineShopChecked(true);
    setEditBranchCategoryIds({});
    setEditInitialSnapshot(null);
    setEditUrgentDiscountHistory(null);
    setEditUrgentDiscountHistories([]);
    setEditUrgentDiscountHistoriesLoading(false);
    setIsUrgentHistoryOpen(false);
    setIsEditChannelOpen(false);
  }, []);

  const cancelEditTemplate = (skipConfirm = false) => {
    if (!skipConfirm && hasEditChanges) {
      const shouldClose = window.confirm(
        "저장하지 않은 변경 사항이 있습니다. 편집을 닫을까요?",
      );
      if (!shouldClose) {
        return false;
      }
    }
    setIsEditDrawerVisible(false);
    clearEditDrawerCloseTimer();
    editDrawerCloseTimerRef.current = window.setTimeout(() => {
      resetEditTemplateState();
      editDrawerCloseTimerRef.current = null;
    }, 180);
    return true;
  };

  const handleSaveTemplate = async (templateId: string) => {
    if (!selectedBrandId) {
      return;
    }
    if (!editForm.name.trim()) {
      toast.error("메뉴명을 입력해주세요.");
      return;
    }

    const parsedPrice = Number.parseInt(editForm.price, 10);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error("가격은 0 이상의 숫자여야 합니다.");
      return;
    }
    const parsedUrgentDiscountPrice = isUrgentDiscountSupported
      ? editForm.urgentDiscountPrice.trim()
        ? Number.parseInt(editForm.urgentDiscountPrice, 10)
        : null
      : null;
    if (isUrgentDiscountSupported) {
      if (
        parsedUrgentDiscountPrice !== null &&
        (Number.isNaN(parsedUrgentDiscountPrice) ||
          parsedUrgentDiscountPrice < 0 ||
          parsedUrgentDiscountPrice >= parsedPrice)
      ) {
        toast.error("긴급할인가는 기본 가격보다 낮은 0 이상 숫자여야 합니다.");
        return;
      }
      const urgentDiscountStartAt = toIsoOrNull(editForm.urgentDiscountStartAt);
      const urgentDiscountEndAt = toIsoOrNull(editForm.urgentDiscountEndAt);
      if (editForm.urgentDiscountStartAt.trim() && !urgentDiscountStartAt) {
        toast.error("긴급할인 시작 시각 형식이 올바르지 않습니다.");
        return;
      }
      if (editForm.urgentDiscountEndAt.trim() && !urgentDiscountEndAt) {
        toast.error("긴급할인 종료 시각 형식이 올바르지 않습니다.");
        return;
      }
      if (
        urgentDiscountStartAt &&
        urgentDiscountEndAt &&
        new Date(urgentDiscountStartAt).getTime() >=
          new Date(urgentDiscountEndAt).getTime()
      ) {
        toast.error("긴급할인 종료 시각은 시작 시각보다 늦어야 합니다.");
        return;
      }
    }
    const urgentDiscountStartAt = isUrgentDiscountSupported
      ? toIsoOrNull(editForm.urgentDiscountStartAt)
      : null;
    const urgentDiscountEndAt = isUrgentDiscountSupported
      ? toIsoOrNull(editForm.urgentDiscountEndAt)
      : null;

    try {
      setSaving(true);
      await apiClient.patch(`/customer/products/brand-templates/${templateId}`, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || undefined,
        price: parsedPrice,
        urgentDiscountPrice: isUrgentDiscountSupported
          ? parsedUrgentDiscountPrice
          : undefined,
        urgentDiscountStartAt: isUrgentDiscountSupported
          ? urgentDiscountStartAt
          : undefined,
        urgentDiscountEndAt: isUrgentDiscountSupported
          ? urgentDiscountEndAt
          : undefined,
        imageUrl: editForm.imageUrls[0],
        imageUrls: editForm.imageUrls,
        isActive: editForm.isActive,
        isOnlineShopVisible: editOnlineShopChecked,
        inventoryMode: editForm.inventoryMode,
        branchIds: Array.from(editBranchIds),
        branchCategoryAssignments: buildBranchCategoryAssignments(
          editBranchIds,
          editBranchCategoryIds,
        ),
      });

      await loadTemplates(selectedBrandId);
      cancelEditTemplate(true);
      toast.success("브랜드 메뉴를 수정했습니다.");
    } catch (e) {
      console.error(e);
      if (isUrgentDiscountUnsupportedError(e)) {
        disableUrgentDiscountUI();
      }
      toast.error(e instanceof Error ? e.message : "브랜드 메뉴 수정에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTemplateActive = async (template: BrandTemplate, nextActive: boolean) => {
    const previousActive = template.isActive;

    setTemplates((prev) =>
      prev.map((item) =>
        item.id === template.id
          ? {
              ...item,
              isActive: nextActive,
            }
          : item,
      ),
    );

    if (editingTemplateId === template.id) {
      setEditForm((prev) => ({ ...prev, isActive: nextActive }));
    }

    try {
      await apiClient.patch(`/customer/products/brand-templates/${template.id}`, {
        isActive: nextActive,
      });
      toast.success(nextActive ? "메뉴를 활성화했습니다." : "메뉴를 비활성화했습니다.");
    } catch (e) {
      console.error(e);
      setTemplates((prev) =>
        prev.map((item) =>
          item.id === template.id
            ? {
                ...item,
                isActive: previousActive,
              }
            : item,
        ),
      );

      if (editingTemplateId === template.id) {
        setEditForm((prev) => ({ ...prev, isActive: previousActive }));
      }

      toast.error(e instanceof Error ? e.message : "상태 변경에 실패했습니다.");
    }
  };

  const handleToggleTemplateInventory = async (
    template: BrandTemplate,
    nextEnabled: boolean,
  ) => {
    const previousMode = template.inventoryMode ?? "PRODUCT";
    const nextMode: InventoryMode = nextEnabled ? "PRODUCT" : "NONE";

    // MIXED는 여기로 못 들어오게 UI에서 막을 예정(안전장치)
    setTemplates((prev) =>
      prev.map((item) =>
        item.id === template.id ? { ...item, inventoryMode: nextMode } : item,
      ),
    );

    if (editingTemplateId === template.id) {
      setEditForm((prev) => ({ ...prev, inventoryMode: nextMode }));
    }

    try {
      await apiClient.patch(`/customer/products/brand-templates/${template.id}`, {
        inventoryMode: nextMode,
      });
      toast.success(nextEnabled ? "재고관리를 사용합니다." : "재고관리를 미사용합니다.");
    } catch (e) {
      console.error(e);

      // 롤백
      setTemplates((prev) =>
        prev.map((item) =>
          item.id === template.id ? { ...item, inventoryMode: previousMode } : item,
        ),
      );
      if (editingTemplateId === template.id) {
        setEditForm((prev) => ({
          ...prev,
          inventoryMode: previousMode === "NONE" ? "NONE" : "PRODUCT",
        }));
      }

      toast.error(e instanceof Error ? e.message : "재고관리 변경에 실패했습니다.");
    }
  };


  const toggleTemplateSelection = (templateId: string) => {
    setSelectedTemplateIds((prev) => toggleSetValue(prev, templateId));
  };

  const toggleAllTemplateSelection = (checked: boolean) => {
    if (!checked) {
      setSelectedTemplateIds(new Set());
      return;
    }
    setSelectedTemplateIds(new Set(searchedTemplates.map((template) => template.id)));
  };

  const handleTemplateCheckboxClick = useCallback(
    (templateId: string, e: React.MouseEvent<HTMLInputElement>) => {
      if (e.shiftKey && lastSelectedTemplateIdRef.current) {
        e.preventDefault();
        const currentIndex = pagedTemplates.findIndex((t) => t.id === templateId);
        const lastIndex = pagedTemplates.findIndex(
          (t) => t.id === lastSelectedTemplateIdRef.current,
        );
        if (currentIndex !== -1 && lastIndex !== -1) {
          const start = Math.min(currentIndex, lastIndex);
          const end = Math.max(currentIndex, lastIndex);
          const rangeIds = pagedTemplates.slice(start, end + 1).map((t) => t.id);
          setSelectedTemplateIds((prev) => {
            const next = new Set(prev);
            for (const id of rangeIds) next.add(id);
            return next;
          });
        }
        lastSelectedTemplateIdRef.current = templateId;
        return;
      }
      lastSelectedTemplateIdRef.current = templateId;
    },
    [pagedTemplates],
  );

  const handleToggleTemplateForSalesChannel = async (template: BrandTemplate) => {
    if (!selectedBrandId || salesChannelFilter === "ALL") {
      return;
    }

    try {
      setSaving(true);

      if (salesChannelFilter === "ONLINE_SHOP") {
        const nextVisible = template.isOnlineShopVisible === false;
        await apiClient.patch(`/customer/products/brand-templates/${template.id}`, {
          isOnlineShopVisible: nextVisible,
        });
        toast.success(nextVisible ? "온라인샵에 노출했습니다." : "온라인샵에서 숨겼습니다.");
      } else if (selectedFilterBranchId) {
        const isApplied = (template.appliedBranchIds ?? []).includes(selectedFilterBranchId);
        if (isApplied) {
          await apiClient.post(`/customer/products/brand-templates/${template.id}/unapply`, {
            branchId: selectedFilterBranchId,
          });
          toast.success(`${selectedFilterBranchName ?? "지점"}에서 숨겼습니다.`);
        } else {
          await apiClient.post(`/customer/products/brand-templates/${template.id}/apply`, {
            branchId: selectedFilterBranchId,
          });
          toast.success(`${selectedFilterBranchName ?? "지점"}에 노출했습니다.`);
        }
      }

      await loadTemplates(selectedBrandId);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "판매채널 설정 변경에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleBulkUpdateTemplates = async () => {
    if (!selectedBrandId || selectedTemplateIds.size === 0) {
      return;
    }

    if (!bulkChangeStatus && !bulkChangeInventory && !bulkChangeChannels) {
      toast.error("일괄 변경할 항목을 하나 이상 선택해주세요.");
      return;
    }

    const payload: {
      brandId: string;
      templateIds: string[];
      isActive?: boolean;
      isOnlineShopVisible?: boolean;
      branchIds?: string[];
      inventoryMode?: "PRODUCT" | "NONE";
    } = {
      brandId: selectedBrandId,
      templateIds: Array.from(selectedTemplateIds),
    };

    if (bulkChangeStatus) {
      if (bulkStatus === "keep") {
        toast.error("상태 변경이 선택되었지만 '변경 안함'으로 설정되어 있습니다. 활성 또는 비활성을 선택하세요.");
        return;
      }
      payload.isActive = bulkStatus === "active";
    }
    if (bulkChangeInventory) {
      if (bulkInventoryMode === "keep") {
        toast.error("재고관리 변경이 선택되었지만 '변경 안함'으로 설정되어 있습니다. 사용 또는 미사용을 선택하세요.");
        return;
      }
      payload.inventoryMode = bulkInventoryMode;
    }
    if (bulkChangeChannels) {
      payload.branchIds = Array.from(bulkBranchIds);
      payload.isOnlineShopVisible = bulkOnlineShopChecked;
    }

    try {
      setSaving(true);
      await apiClient.patch("/customer/products/brand-templates/bulk/update", payload);
      await loadTemplates(selectedBrandId);
      setSelectedTemplateIds(new Set());
      setBulkChangeStatus(false);
      setBulkChangeInventory(false);
      setBulkChangeChannels(false);
      toast.success("선택한 메뉴를 일괄 변경했습니다.");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "일괄 변경에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-foreground m-0">
              상품관리
            </h1>

            <div className="relative group cursor-pointer">
              <HelpCircle className="w-4 h-4 text-text-secondary hover:text-foreground transition-colors" />

              <div className="absolute left-6 top-1/2 -translate-y-1/2 w-72 p-3 rounded-md bg-bg-tertiary border border-border text-xs text-text-secondary opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                상품은 브랜드 단위로 등록하며, 매장별 노출과 재고관리 전반적인 상품관련 설정을 할 수 있습니다.
              </div>
            </div>
          </div>
          {selectedBrandId && (
            <div className="mt-1 text-sm text-text-secondary">
              총 {searchedTemplates.length}개 상품
            </div>
          )}
        </div>
        {selectedBrandId && canManage && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors flex-shrink-0"
          >
            + 상품등록
          </button>
        )}
      </div>

      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border pb-3 mb-3">
      <div className="flex flex-wrap items-end gap-3">
        <div ref={brandDropdownRef} className="flex-1 min-w-[200px] relative">
          <label className="block text-sm text-text-secondary mb-2 font-semibold">브랜드</label>

          {/* Trigger */}
          <button
            type="button"
            onClick={() => setIsBrandOpen((v) => !v)}
            className="input-field h-9 text-sm w-full flex items-center justify-between gap-2"
            aria-haspopup="listbox"
            aria-expanded={isBrandOpen}
          >
            <span className="truncate">
              {selectedBrand ? selectedBrand.name : "브랜드를 선택하세요"}
            </span>
            <ChevronDown className="w-4 h-4 text-text-secondary flex-shrink-0" />
          </button>

          {/* Dropdown */}
          {isBrandOpen && (
            <div
              className="absolute left-0 top-full mt-2 w-full z-30 rounded-lg border border-border bg-bg-secondary shadow-lg overflow-hidden"
              role="listbox"
            >
              {/* (선택) 검색 input: 다음 단계에서 필터링 연결할 거라 지금은 UI만 */}
              <div className="p-2 border-b border-border bg-bg-tertiary">
                <input
                  ref={brandSearchInputRef}
                  value={brandSearch}
                  onChange={(e) => setBrandSearch(e.target.value)}
                  placeholder="브랜드 검색"
                  className="input-field w-full text-xs"
                />
              </div>

              <div className="max-h-72 overflow-y-auto">
                {sortedBrands.map((brand) => {
                  const isFav = favoriteSet.has(brand.id);
                  const isSelected = brand.id === selectedBrandId;

                  return (
                    <div
                      key={brand.id}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-bg-tertiary ${
                        isSelected ? "bg-bg-tertiary/60" : ""
                      }`}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        setSelectedBrandId(brand.id);
                        setBrandSearch("");       // 🔥 검색어 초기화
                        setIsBrandOpen(false);
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-foreground">{brand.name}</div>
                      </div>

                      {/* 즐겨찾기 버튼: 행 선택(onClick) 방지 위해 stopPropagation */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavoriteBrand(brand.id);
                        }}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-foreground transition-colors flex-shrink-0"
                        aria-label={isFav ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                        title={isFav ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                      >
                        <Star className={`w-4 h-4 ${isFav ? "fill-current text-yellow-500" : ""}`} />
                      </button>
                    </div>
                  );
                })}

                {sortedBrands.length === 0 && (
                  <div className="px-3 py-6 text-center text-sm text-text-secondary">
                    브랜드가 없습니다.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {selectedBrandId && (
          <>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm text-text-secondary mb-2 font-semibold">판매채널</label>
              <select
                value={salesChannelFilter}
                onChange={(event) => setSalesChannelFilter(event.target.value as SalesChannelFilter)}
                className="input-field h-9 text-sm w-full"
              >
                <option value="ALL">전체</option>
                <option value="ONLINE_SHOP">온라인샵</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={toBranchSalesChannelFilter(branch.id)}>
                    지점 주문 - {branch.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm text-text-secondary mb-2 font-semibold">카테고리</label>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}
                className="input-field h-9 text-sm w-full"
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

            <div className="w-80">
              <label className="block text-sm text-text-secondary mb-2 font-semibold">검색</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setSearchInput("");
                    }
                  }}
                  placeholder="메뉴명/설명 검색"
                  className="input-field h-9 text-sm w-full pl-9 pr-9 focus:ring-1 focus:ring-primary-500"
                  aria-label="메뉴 검색"
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

          </>
        )}
      </div>
      </div>

      {error && (
        <div className="border border-danger-500 bg-danger-500/10 rounded-md p-3 text-danger-500 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-text-secondary text-sm">불러오는 중...</div>
      ) : !selectedBrandId ? (
        <div className="text-text-secondary text-sm">브랜드를 먼저 선택해주세요.</div>
      ) : !canManage ? (
        <div className="border border-border rounded-xl p-4 text-sm text-text-secondary">
          OWNER 또는 ADMIN 권한에서만 메뉴를 등록/수정할 수 있습니다.
        </div>
      ) : (
        <>
          {templates.length === 0 ? (
            <div className="border border-border rounded-xl p-6 text-center text-text-secondary text-sm">
              등록된 메뉴가 없습니다.
            </div>
          ) : (
            <>
              <div className="border border-border rounded-xl p-4 mb-4 bg-bg-secondary">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">일괄변경</h3>

                    <div className="relative group cursor-pointer">
                      <HelpCircle
                        size={16}
                        className="text-text-secondary hover:text-foreground transition-colors"
                      />

                      <div className="absolute left-6 top-1/2 -translate-y-1/2 w-64 p-3 rounded-md bg-bg-tertiary border border-border text-xs text-text-secondary opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                        1) 표에서 메뉴 체크 <br />
                        2) 변경할 항목 선택 (체크박스) <br />
                        3) 일괄변경 버튼 클릭
                      </div>
                    </div>

                    {!isBulkOpen && !hasSelectedTemplates && (
                      <span className="inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold bg-warning/20 text-warning">
                        상품을 선택하세요
                      </span>
                    )}

                    {!isBulkOpen && hasSelectedTemplates && (
                      <span className="inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold bg-primary-500/20 text-primary-500">
                        {selectedTemplateIds.size}개 선택됨
                        {(bulkChangeStatus || bulkChangeInventory || bulkChangeChannels) && " · 변경항목 있음"}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsBulkOpen((prev) => !prev)}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold border border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary transition-colors"
                    >
                      {isBulkOpen ? "접기" : "펼치기"}
                    </button>
                  </div>
                </div>

                {isBulkOpen && selectedTemplateIds.size > 0 && (
                  <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="checkbox"
                        id="bulk-change-status"
                        checked={bulkChangeStatus}
                        onChange={(event) => setBulkChangeStatus(event.target.checked)}
                        disabled={saving || !hasSelectedTemplates}
                        className="w-4 h-4 rounded accent-primary"
                      />
                      <label htmlFor="bulk-change-status" className="text-xs text-text-secondary font-semibold cursor-pointer">
                        노출상태
                      </label>
                    </div>
                    <select
                      value={bulkStatus}
                      onChange={(event) => setBulkStatus(event.target.value as BulkStatus)}
                      className="input-field"
                      disabled={saving || !hasSelectedTemplates || !bulkChangeStatus}
                    >
                      <option value="keep">변경 안함</option>
                      <option value="active">활성</option>
                      <option value="inactive">비활성</option>
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="checkbox"
                        id="bulk-change-inventory"
                        checked={bulkChangeInventory}
                        onChange={(event) => setBulkChangeInventory(event.target.checked)}
                        disabled={saving || !hasSelectedTemplates}
                        className="w-4 h-4 rounded accent-primary"
                      />
                      <label htmlFor="bulk-change-inventory" className="text-xs text-text-secondary font-semibold cursor-pointer">
                        재고관리
                      </label>
                    </div>
                    <select
                      value={bulkInventoryMode}
                      onChange={(event) =>
                        setBulkInventoryMode(event.target.value as BulkInventoryMode)
                      }
                      className="input-field"
                      disabled={saving || !hasSelectedTemplates || !bulkChangeInventory}
                    >
                      <option value="keep">변경 안함</option>
                      <option value="PRODUCT">재고관리 사용</option>
                      <option value="NONE">재고관리 미사용</option>
                    </select>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="flex items-center gap-2 text-sm text-text-secondary font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bulkChangeChannels}
                      onChange={(event) => setBulkChangeChannels(event.target.checked)}
                      disabled={saving || !hasSelectedTemplates}
                      className="w-4 h-4 rounded accent-primary"
                    />
                    판매 채널 (매장/온라인샵)
                  </label>
                </div>

                {bulkChangeChannels && (
                  <div className="mb-3">
                    <label className="block text-sm text-text-secondary mb-2 font-semibold">
                      일괄 적용할 채널 체크
                    </label>
                    <BranchChecklistTable
                      branches={branches}
                      selectedIds={bulkBranchIds}
                      onToggle={(branchId) => setBulkBranchIds((prev) => toggleSetValue(prev, branchId))}
                      onToggleAll={(checked) => {
                        setBulkBranchIds(
                          checked ? new Set(branches.map((branch) => branch.id)) : new Set(),
                        );
                        setBulkOnlineShopChecked(checked);
                      }}
                      onlineShopChecked={bulkOnlineShopChecked}
                      onToggleOnlineShop={() =>
                        setBulkOnlineShopChecked((prev) => !prev)
                      }
                      onlineShopUrl={selectedBrandShopUrl}
                      brandSlug={selectedBrand?.slug ?? null}
                      disabled={saving || !hasSelectedTemplates}
                    />
                  </div>
                )}

                {hasSelectedTemplates && (bulkChangeStatus || bulkChangeInventory || bulkChangeChannels) && (
                  <div className="mt-3 p-2.5 rounded-md bg-primary-500/10 border border-primary-500/30">
                    <div className="text-xs font-semibold text-primary-500 mb-1">적용 내용</div>
                    <div className="text-xs text-text-secondary space-y-0.5">
                      {bulkChangeStatus && bulkStatus !== "keep" && (
                        <div>• 상태: {bulkStatus === "active" ? "활성" : "비활성"}으로 변경</div>
                      )}
                      {bulkChangeInventory && bulkInventoryMode !== "keep" && (
                        <div>• 재고관리: {bulkInventoryMode === "PRODUCT" ? "사용" : "미사용"}으로 변경</div>
                      )}
                      {bulkChangeChannels && (
                        <div>
                          • 판매 채널: {bulkBranchIds.size}개 지점 + {bulkOnlineShopChecked ? "온라인샵 노출" : "온라인샵 미노출"}
                        </div>
                      )}
                      {bulkChangeStatus && bulkStatus === "keep" && (
                        <div className="text-warning">• 상태: &quot;변경 안함&quot; 선택됨 - 값을 선택하세요</div>
                      )}
                      {bulkChangeInventory && bulkInventoryMode === "keep" && (
                        <div className="text-warning">• 재고관리: &quot;변경 안함&quot; 선택됨 - 값을 선택하세요</div>
                      )}
                    </div>
                  </div>
                )}
                  </>
                )}
              </div>

              <div className="pb-24">
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full border-collapse">
                  <thead className="bg-white">
                    <tr>
                      <th className="w-12 py-3 px-3 text-left">
                        <input
                          type="checkbox"
                          checked={allTemplatesChecked}
                          onChange={(event) => toggleAllTemplateSelection(event.target.checked)}
                          disabled={saving || searchedTemplates.length === 0}
                          className="w-4 h-4 rounded accent-primary"
                        />
                      </th>
                      <th className="text-left py-3 px-3 text-xs font-bold text-text-secondary">메뉴</th>
                      <th className="text-right py-3 px-3 text-xs font-bold text-text-secondary">기본가</th>
                      <th className="text-left py-3 px-3 text-xs font-bold text-text-secondary">판매채널</th>
                      <th className="text-left py-3 px-3 text-xs font-bold text-text-secondary">노출상태</th>
                      <th className="text-left py-3 px-3 text-xs font-bold text-text-secondary">재고관리</th>
                      <th className="text-right py-3 px-3 text-xs font-bold text-text-secondary">편집</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedTemplates.map((template) => {
                      const isEditing = editingTemplateId === template.id;
                      const appliedCount =
                        template.appliedBranchCount ?? template.appliedBranchIds?.length ?? 0;
                      const totalCount = template.totalBranchCount ?? branches.length;
                      const selectedBranchApplied = selectedFilterBranchId
                        ? (template.appliedBranchIds ?? []).includes(selectedFilterBranchId)
                        : false;
                      const isOnlineShopVisible = template.isOnlineShopVisible !== false;

                      return (
                          <tr key={template.id} className="border-t border-border hover:bg-bg-tertiary transition-colors">
                            <td className="py-2 px-3">
                              <input
                                type="checkbox"
                                checked={selectedTemplateIds.has(template.id)}
                                onClick={(e) => handleTemplateCheckboxClick(template.id, e)}
                                onChange={() => toggleTemplateSelection(template.id)}
                                disabled={saving}
                                className="w-4 h-4 rounded accent-primary"
                                title="Shift+클릭으로 범위 선택"
                              />
                            </td>
                            <td className="py-2 px-3 text-sm text-foreground">
                              <div className="font-semibold">{template.name}</div>
                              {template.description && (
                                <div className="text-xs text-text-secondary mt-0.5">{template.description}</div>
                              )}
                            </td>
                            <td className="py-2 px-3 text-sm text-foreground text-right">
                              {typeof template.discountPrice === "number" &&
                              template.discountPrice >= 0 &&
                              template.discountPrice < template.price ? (
                                <div className="inline-flex flex-col items-end">
                                  <span className="text-[11px] text-text-tertiary line-through">
                                    {formatWon(template.price)}
                                  </span>
                                  <span className="font-semibold text-danger-500">
                                    {formatWon(template.discountPrice)}
                                  </span>
                                </div>
                              ) : (
                                formatWon(template.price)
                              )}
                            </td>
                            <td className="py-2 px-3 text-sm text-foreground">
                              {salesChannelFilter === "ALL" ? (
                              <span className="text-xs text-text-secondary">
                                매장 {appliedCount}/{totalCount} · {isOnlineShopVisible ? "온라인샵 노출" : "온라인샵 미노출"}
                              </span>
                              ) : salesChannelFilter === "ONLINE_SHOP" ? (
                                <span
                                  className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold ${
                                    isOnlineShopVisible
                                      ? "bg-success/20 text-success"
                                      : "bg-danger-500/20 text-danger-500"
                                  }`}
                                >
                                  {isOnlineShopVisible ? "온라인샵 노출" : "온라인샵 미노출"}
                                </span>
                              ) : (
                                <span
                                  className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold ${
                                    selectedBranchApplied
                                      ? "bg-success/20 text-success"
                                      : "bg-danger-500/20 text-danger-500"
                                  }`}
                                >
                                  {selectedBranchApplied
                                    ? `${selectedFilterBranchName ?? "선택 지점"}`
                                    : `${selectedFilterBranchName ?? "선택 지점"}`}
                                </span>
                              )}
                            </td>

                            <td className="py-2 px-3 text-sm">
                              <Switch
                                checked={template.isActive}
                                onChange={(nextChecked) =>
                                  handleToggleTemplateActive(template, nextChecked)
                                }
                                disabled={saving}
                                ariaLabel={`${template.name} 판매 상태 토글`}
                              />
                            </td>
                            <td className="py-2 px-3 text-sm">
                              {template.inventoryMode === "MIXED" ? (
                                <div className="relative group inline-flex items-center">
                                  <span className="inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold bg-primary-500/20 text-primary-500">
                                    지점별
                                  </span>

                                  <div className="absolute left-0 top-full mt-2 whitespace-nowrap rounded-md border border-border bg-bg-tertiary px-2 py-1 text-[11px] text-text-secondary opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                                    지점마다 재고관리 사용 여부가 다릅니다
                                  </div>
                                </div>
                              ) : (
                                <Switch
                                  checked={template.inventoryMode !== "NONE"}
                                  onChange={(nextChecked) => handleToggleTemplateInventory(template, nextChecked)}
                                  disabled={saving}
                                  ariaLabel={`${template.name} 재고관리 토글`}
                                />
                              )}
                            </td>

                            <td className="py-2 px-3 text-right">
                              <div className="inline-flex items-center gap-2">
                                {salesChannelFilter !== "ALL" && (
                                  <button
                                    onClick={() => handleToggleTemplateForSalesChannel(template)}
                                    disabled={saving}
                                    className="px-3 py-1.5 rounded-md border border-border bg-bg-secondary text-foreground text-xs hover:bg-bg-tertiary transition-colors disabled:opacity-50"
                                  >
                                    {salesChannelFilter === "ONLINE_SHOP"
                                      ? isOnlineShopVisible
                                        ? "온라인샵 숨김"
                                        : "온라인샵 노출"
                                      : selectedBranchApplied
                                        ? "지점 숨김"
                                        : "지점 노출"}
                                  </button>
                                )}
                                <div className="relative group">
                                  <button
                                    onClick={() => (isEditing ? cancelEditTemplate() : startEditTemplate(template))}
                                    disabled={saving}
                                    aria-label={isEditing ? "편집 닫기" : "수정"}
                                    className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-border bg-bg-secondary text-text-secondary hover:text-foreground hover:bg-bg-tertiary transition-colors disabled:opacity-50"
                                  >
                                    <Pencil size={16} />
                                  </button>

                                  <div className="absolute right-0 top-full mt-2 whitespace-nowrap rounded-md border border-border bg-bg-tertiary px-2 py-1 text-[11px] text-text-secondary opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                                    {isEditing ? "편집 닫기" : "수정"}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                      );
                    })}
                    {searchedTemplates.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-sm text-text-secondary">
                          {searchQuery.trim()
                            ? "검색 결과가 없습니다."
                            : "선택한 판매 채널에 노출된 메뉴가 없습니다."}
                        </td>
                      </tr>
                    )}
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
              </div>

              {editingTemplateId && (() => {
                const editingTemplate = templates.find((template) => template.id === editingTemplateId);
                if (!editingTemplate) return null;

                return (
                  <div className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end">
                    <div
                      className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${
                        isEditDrawerVisible ? "opacity-100" : "opacity-0"
                      }`}
                      onClick={() => cancelEditTemplate()}
                    />

                    <div
                      className={`relative w-full md:max-w-2xl bg-background border-border shadow-xl h-[92vh] md:h-full rounded-t-2xl md:rounded-none md:border-l flex flex-col transform transition-transform duration-200 ease-out ${
                        isEditDrawerVisible
                          ? "translate-y-0 md:translate-y-0 md:translate-x-0"
                          : "translate-y-full md:translate-y-0 md:translate-x-full"
                      }`}
                    >
                      <div className="pt-2 pb-1 flex justify-center md:hidden">
                        <span className="h-1.5 w-12 rounded-full bg-border" />
                      </div>

                      <div className="flex items-center justify-between px-4 py-3 md:px-5 md:py-4 border-b border-border">
                        <div>
                          <h3 className="text-base font-bold text-foreground">메뉴 수정</h3>
                          <p className="text-xs text-text-secondary mt-0.5 truncate max-w-[320px]">
                            {editingTemplate.name}
                          </p>
                        </div>
                        <button
                          onClick={() => cancelEditTemplate()}
                          disabled={saving}
                          className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-border bg-bg-secondary text-text-secondary hover:text-foreground hover:bg-bg-tertiary transition-colors disabled:opacity-50"
                          aria-label="편집 닫기"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto px-4 py-3 md:px-5 md:py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="block text-xs text-text-secondary mb-1">상품명</label>
                            <input
                              value={editForm.name}
                              onChange={(event) =>
                                setEditForm((prev) => ({ ...prev, name: event.target.value }))
                              }
                              placeholder="메뉴명"
                              className="input-field"
                              autoFocus
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-text-secondary mb-1">가격</label>
                            <input
                              value={editForm.price}
                              onChange={(event) => {
                                const digitsOnly = event.target.value.replace(/[^\d]/g, "");
                                setEditForm((prev) => ({ ...prev, price: digitsOnly }));
                              }}
                              placeholder="가격"
                              className="input-field"
                              inputMode="numeric"
                            />
                          </div>
                          {isUrgentDiscountSupported && (
                            <>
                              <div>
                                <label className="block text-xs text-text-secondary mb-1">긴급할인가 (선택)</label>
                                <input
                                  value={editForm.urgentDiscountPrice}
                                  onChange={(event) => {
                                    const digitsOnly = event.target.value.replace(/[^\d]/g, "");
                                    setEditForm((prev) => ({ ...prev, urgentDiscountPrice: digitsOnly }));
                                  }}
                                  placeholder="예: 3900"
                                  className="input-field"
                                  inputMode="numeric"
                                />
                              </div>
                              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="min-w-0">
                                  <label className="block text-xs text-text-secondary mb-1">긴급할인 시작 (선택)</label>
                                  <input
                                    type="datetime-local"
                                    value={editForm.urgentDiscountStartAt}
                                    onChange={(event) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        urgentDiscountStartAt: event.target.value,
                                      }))
                                    }
                                    className="input-field w-full"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <label className="block text-xs text-text-secondary mb-1">긴급할인 종료 (선택)</label>
                                  <input
                                    type="datetime-local"
                                    value={editForm.urgentDiscountEndAt}
                                    onChange={(event) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        urgentDiscountEndAt: event.target.value,
                                      }))
                                    }
                                    className="input-field w-full"
                                  />
                                </div>
                              </div>
                              <div className="md:col-span-2 rounded-md border border-warning-500/30 bg-warning-500/10 px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() => setIsUrgentHistoryOpen((prev) => !prev)}
                                  className="w-full flex items-center justify-between text-left"
                                >
                                  <span className="text-xs font-semibold text-warning-700">
                                    긴급할인 이력
                                  </span>
                                  <span className="text-2xs text-text-secondary">
                                    {isUrgentHistoryOpen ? "접기" : "펼치기"}
                                  </span>
                                </button>
                                {isUrgentHistoryOpen && (
                                  <>
                                    {editUrgentDiscountHistoriesLoading ? (
                                      <div className="mt-1 text-2xs text-text-secondary">
                                        이력 불러오는 중...
                                      </div>
                                    ) : (
                                      <div className="mt-1 space-y-1">
                                        {[
                                          ...editUrgentDiscountHistories,
                                          ...(editUrgentDiscountHistory
                                            ? [editUrgentDiscountHistory]
                                            : []),
                                        ]
                                          .filter((history, index, array) =>
                                            array.findIndex(
                                              (target) =>
                                                target.price === history.price &&
                                                target.startAt === history.startAt &&
                                                target.endAt === history.endAt,
                                            ) === index,
                                          )
                                          .slice(0, 5)
                                          .map((history, index) => {
                                            const badge = getUrgentDiscountHistoryBadge(
                                              history.recordedReason,
                                              history.endAt,
                                            );
                                            return (
                                              <div
                                                key={
                                                  history.id ??
                                                  `${history.startAt ?? "no-start"}-${history.endAt ?? "no-end"}-${history.price ?? "no-price"}-${index}`
                                                }
                                                className="text-2xs text-text-secondary flex items-center gap-1.5 flex-wrap"
                                              >
                                                <span
                                                  className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-semibold ${badge.className}`}
                                                >
                                                  {badge.label}
                                                </span>
                                                <span>
                                                  #{index + 1}{" "}
                                                  {typeof history.price === "number"
                                                    ? `${history.price.toLocaleString()}원`
                                                    : "-"}{" "}
                                                  · {formatKoreanDateTime(history.startAt)} ~{" "}
                                                  {formatKoreanDateTime(history.endAt)}
                                                </span>
                                                {history.createdAt && (
                                                  <span className="text-text-tertiary">
                                                    (기록 {formatKoreanDateTime(history.createdAt)})
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          })}
                                        {editUrgentDiscountHistories.length === 0 &&
                                          !editUrgentDiscountHistory && (
                                            <div className="text-2xs text-text-tertiary">
                                              아직 긴급할인 이력이 없습니다.
                                            </div>
                                          )}
                                      </div>
                                    )}
                                    <div className="mt-1 text-2xs text-text-tertiary">
                                      만료된 할인은 자동으로 입력값을 비워 두었습니다. 다시 진행하려면 새 기간을 입력해주세요.
                                    </div>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                          <div className="md:col-span-2">
                            <label className="block text-xs text-text-secondary mb-1">상품 설명</label>
                            <textarea
                              value={editForm.description}
                              onChange={(event) =>
                                setEditForm((prev) => ({ ...prev, description: event.target.value }))
                              }
                              placeholder="설명 (선택)"
                              className="input-field min-h-[88px] resize-y"
                            />
                          </div>
                        </div>

                        <div className="mb-3">
                          <div className="mb-2">
                            <span className="text-xs text-text-secondary font-semibold">
                              메뉴 이미지 ({editForm.imageUrls.length}/{MAX_TEMPLATE_IMAGES})
                            </span>
                          </div>

                          {editForm.imageUrls.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                              {editForm.imageUrls.map((url, index) => (
                                <div key={`${url}-${index}`} className="relative border border-border rounded-md overflow-hidden bg-bg-secondary">
                                  <img src={url} alt={`메뉴 이미지 ${index + 1}`} className="w-full aspect-square object-cover" />
                                  <div className="p-2 flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setEditPrimaryImage(index)}
                                      className={`px-2 py-1 rounded text-2xs font-semibold border transition-colors ${
                                        index === 0
                                          ? "bg-primary-500 text-white border-primary-500"
                                          : "bg-bg-secondary text-text-secondary border-border hover:bg-bg-tertiary"
                                      }`}
                                    >
                                      {index === 0 ? "대표" : "대표로"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeEditImageAt(index)}
                                      className="px-2 py-1 rounded text-2xs font-semibold border border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary transition-colors"
                                    >
                                      삭제
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {editForm.imageUrls.length < MAX_TEMPLATE_IMAGES && (
                            <ImageUpload
                              value={null}
                              onChange={addEditImage}
                              folder="product-images"
                              label="이미지 추가"
                              aspectRatio="1/1"
                            />
                          )}
                        </div>

                        <div className="mb-4">
                          <button
                            type="button"
                            onClick={() => setIsEditChannelOpen((prev) => !prev)}
                            className="flex items-center justify-between w-full mb-2 px-3 py-2 rounded-md border border-border bg-bg-secondary hover:bg-bg-tertiary transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-text-secondary font-semibold">
                                채널 설정
                              </span>
                              <span className="inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold bg-bg-tertiary text-text-secondary">
                                선택 {editBranchIds.size + (editOnlineShopChecked ? 1 : 0)} / {branches.length + 1}
                              </span>
                            </div>
                            <span className="text-xs text-text-secondary">
                              {isEditChannelOpen ? "접기" : "펼치기"}
                            </span>
                          </button>

                          {isEditChannelOpen && (
                            <BranchChecklistTable
                              branches={branches}
                              selectedIds={editBranchIds}
                              onToggle={(branchId) =>
                                setEditBranchIds((prev) => toggleSetValue(prev, branchId))
                              }
                              onToggleAll={(checked) => setAllBranchChecks(checked, "edit")}
                              categoryMap={branchCategories}
                              selectedCategoryIds={editBranchCategoryIds}
                              onChangeCategory={(branchId, categoryId) =>
                                setEditBranchCategoryIds((prev) => ({
                                  ...prev,
                                  [branchId]: categoryId,
                                }))
                              }
                              onlineShopChecked={editOnlineShopChecked}
                              onToggleOnlineShop={() =>
                                setEditOnlineShopChecked((prev) => !prev)
                              }
                              onlineShopUrl={selectedBrandShopUrl}
                              brandSlug={selectedBrand?.slug ?? null}
                              disabled={saving}
                            />
                          )}
                        </div>
                      </div>

                      <div className="border-t border-border px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:px-5 md:py-4 flex items-center justify-end gap-2">
                        <button
                          onClick={() => cancelEditTemplate()}
                          disabled={saving}
                          className="flex-1 md:flex-none px-3 py-2 rounded-md border border-border bg-bg-secondary text-foreground text-xs hover:bg-bg-tertiary transition-colors disabled:opacity-50"
                        >
                          취소
                        </button>
                        <button
                          onClick={() => handleSaveTemplate(editingTemplate.id)}
                          disabled={saving}
                          className="flex-1 md:flex-none px-3 py-2 rounded-md bg-primary-500 text-white text-xs font-semibold hover:bg-primary-600 transition-colors disabled:opacity-50"
                        >
                          저장
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

            </>
          )}
        </>
      )}


      {isBulkOpen && hasSelectedTemplates && (
        <div className="fixed bottom-0 right-0 left-0 md:left-64 z-40 bg-background/95 backdrop-blur border-t border-border shadow-lg">
          <div className="w-full px-6 py-3 flex items-center justify-between gap-3">
            <div className="text-sm text-text-secondary">
              <span className="font-semibold text-foreground">
                {selectedTemplateIds.size}개 메뉴 선택됨
              </span>
              {(bulkChangeStatus || bulkChangeInventory || bulkChangeChannels) && (
                <span className="ml-2 text-primary-500 font-semibold">· 변경항목 있음</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  // 사용자가 직접 접은 경우: 다음 선택 시 자동오픈 막기
                  setBulkAutoOpenDisabled(true);
                  setIsBulkOpen(false);
                }}
                className="px-4 py-2 rounded-md border border-border bg-bg-secondary text-text-secondary text-sm font-semibold hover:bg-bg-tertiary transition-colors"
              >
                접기
              </button>

              <button
                type="button"
                onClick={handleBulkUpdateTemplates}
                disabled={
                  saving ||
                  !hasSelectedTemplates ||
                  (!bulkChangeStatus && !bulkChangeInventory && !bulkChangeChannels)
                }
                className="px-5 py-2 rounded-md bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 disabled:opacity-50 transition-colors"
              >
                일괄 변경 실행
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 적용 매장 드로어 */}
      {appliedDrawerTemplateId && (() => {
        const drawerTemplate = templates.find((t) => t.id === appliedDrawerTemplateId);
        if (!drawerTemplate) return null;
        const appliedIds = new Set(drawerTemplate.appliedBranchIds ?? []);
        const q = drawerBranchSearch.toLowerCase();
        const filteredDrawerBranches = q
          ? branches.filter((b) => b.name.toLowerCase().includes(q))
          : branches;

        return (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => {
                setAppliedDrawerTemplateId(null);
                setDrawerBranchSearch("");
              }}
            />
            <div className="relative w-full max-w-sm bg-background border-l border-border shadow-xl flex flex-col h-full">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div>
                  <h3 className="text-base font-bold text-foreground">적용 매장</h3>
                  <p className="text-xs text-text-secondary mt-0.5 truncate max-w-[240px]">
                    {drawerTemplate.name}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setAppliedDrawerTemplateId(null);
                    setDrawerBranchSearch("");
                  }}
                  className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-border bg-bg-secondary text-text-secondary hover:text-foreground hover:bg-bg-tertiary transition-colors"
                  aria-label="닫기"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="px-5 py-3 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
                  <input
                    type="text"
                    value={drawerBranchSearch}
                    onChange={(e) => setDrawerBranchSearch(e.target.value)}
                    placeholder="매장 검색..."
                    className="input-field w-full pl-9 text-sm"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-3">
                <div className="text-xs font-semibold text-text-secondary mb-2">
                  적용됨 {appliedIds.size} / {branches.length}
                </div>
                {filteredDrawerBranches.length === 0 ? (
                  <div className="text-sm text-text-tertiary py-4 text-center">
                    검색 결과가 없습니다
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {filteredDrawerBranches.map((branch) => {
                      const isApplied = appliedIds.has(branch.id);
                      return (
                        <li
                          key={branch.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-bg-tertiary transition-colors"
                        >
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              isApplied ? "bg-success" : "bg-neutral-400"
                            }`}
                          />
                          <span className="text-sm text-foreground truncate">
                            {branch.name}
                          </span>
                          <span
                            className={`ml-auto text-2xs font-medium flex-shrink-0 ${
                              isApplied ? "text-success" : "text-text-tertiary"
                            }`}
                          >
                            {isApplied ? "적용" : "미적용"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        drawerTemplate.isOnlineShopVisible !== false
                          ? "bg-success"
                          : "bg-neutral-400"
                      }`}
                    />
                    <span className="text-sm text-foreground font-medium">
                      온라인샵
                    </span>
                    <span
                      className={`ml-auto text-2xs font-medium flex-shrink-0 ${
                        drawerTemplate.isOnlineShopVisible !== false
                          ? "text-success"
                          : "text-text-tertiary"
                      }`}
                    >
                      {drawerTemplate.isOnlineShopVisible !== false
                        ? "노출"
                        : "미노출"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 상품등록 모달 */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background border border-border rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-background border-b border-border px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">상품등록</h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-border bg-bg-secondary text-text-secondary hover:text-foreground hover:bg-bg-tertiary transition-colors"
                aria-label="닫기"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold bg-bg-tertiary text-text-secondary">
                  선택 채널 {createSelectedCount}/{createTotalCount}
                </span>
                <span className="inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold bg-bg-tertiary text-text-secondary">
                  이미지 {hasCreateImage ? "등록됨" : "미등록"}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <div className="border border-border rounded-lg p-3 bg-bg-secondary">
                  <h3 className="text-sm font-semibold text-foreground mb-2">기본 정보</h3>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">메뉴명</label>
                      <input
                        value={createForm.name}
                        onChange={(event) =>
                          setCreateForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                        placeholder="메뉴명"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">가격</label>
                      <input
                        value={createForm.price}
                        onChange={(event) =>
                          setCreateForm((prev) => ({ ...prev, price: event.target.value }))
                        }
                        placeholder="가격"
                        className="input-field"
                        inputMode="numeric"
                      />
                    </div>
                    {isUrgentDiscountSupported && (
                      <>
                        <div>
                          <label className="block text-xs text-text-secondary mb-1">긴급할인가 (선택)</label>
                          <input
                            value={createForm.urgentDiscountPrice}
                            onChange={(event) =>
                              setCreateForm((prev) => ({
                                ...prev,
                                urgentDiscountPrice: event.target.value.replace(/[^\d]/g, ""),
                              }))
                            }
                            placeholder="예: 3900"
                            className="input-field"
                            inputMode="numeric"
                          />
                        </div>
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="min-w-0">
                            <label className="block text-xs text-text-secondary mb-1">긴급할인 시작 (선택)</label>
                            <input
                              type="datetime-local"
                              value={createForm.urgentDiscountStartAt}
                              onChange={(event) =>
                                setCreateForm((prev) => ({
                                  ...prev,
                                  urgentDiscountStartAt: event.target.value,
                                }))
                              }
                              className="input-field w-full"
                            />
                          </div>
                          <div className="min-w-0">
                            <label className="block text-xs text-text-secondary mb-1">긴급할인 종료 (선택)</label>
                            <input
                              type="datetime-local"
                              value={createForm.urgentDiscountEndAt}
                              onChange={(event) =>
                                setCreateForm((prev) => ({
                                  ...prev,
                                  urgentDiscountEndAt: event.target.value,
                                }))
                              }
                              className="input-field w-full"
                            />
                          </div>
                        </div>
                      </>
                    )}
                    {!isUrgentDiscountSupported && (
                      <p className="text-xs text-text-tertiary">
                        긴급할인 기능은 현재 DB 마이그레이션 적용 후 사용할 수 있습니다.
                      </p>
                    )}
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">설명 (선택)</label>
                      <input
                        value={createForm.description}
                        onChange={(event) =>
                          setCreateForm((prev) => ({ ...prev, description: event.target.value }))
                        }
                        placeholder="설명 (선택)"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">재고관리</label>
                      <select
                        value={createForm.inventoryMode}
                        onChange={(event) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            inventoryMode: event.target.value === "NONE" ? "NONE" : "PRODUCT",
                          }))
                        }
                        className="input-field"
                      >
                        <option value="PRODUCT">사용</option>
                        <option value="NONE">미사용</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="border border-border rounded-lg p-3 bg-bg-secondary">
                  <div className="mb-2">
                    <span className="text-xs text-text-secondary font-semibold">
                      메뉴 이미지 ({createForm.imageUrls.length}/{MAX_TEMPLATE_IMAGES})
                    </span>
                  </div>

                  {createForm.imageUrls.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                      {createForm.imageUrls.map((url, index) => (
                        <div key={`${url}-${index}`} className="relative border border-border rounded-md overflow-hidden bg-bg-secondary">
                          <img src={url} alt={`등록 이미지 ${index + 1}`} className="w-full aspect-square object-cover" />
                          <div className="p-2 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setCreatePrimaryImage(index)}
                              className={`px-2 py-1 rounded text-2xs font-semibold border transition-colors ${
                                index === 0
                                  ? "bg-primary-500 text-white border-primary-500"
                                  : "bg-bg-secondary text-text-secondary border-border hover:bg-bg-tertiary"
                              }`}
                            >
                              {index === 0 ? "대표" : "대표로"}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeCreateImageAt(index)}
                              className="px-2 py-1 rounded text-2xs font-semibold border border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary transition-colors"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {createForm.imageUrls.length < MAX_TEMPLATE_IMAGES && (
                    <ImageUpload
                      value={null}
                      onChange={addCreateImage}
                      folder="product-images"
                      label="이미지 추가"
                      aspectRatio="1/1"
                    />
                  )}
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-text-secondary font-semibold">
                      등록 채널 체크
                    </label>
                    <div className="relative group">
                      <HelpCircle className="w-4 h-4 text-text-secondary hover:text-foreground transition-colors" />
                      <div className="absolute left-6 top-1/2 -translate-y-1/2 w-64 p-3 rounded-md bg-bg-tertiary border border-border text-xs text-text-secondary opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                        체크한 채널(지점 주문/온라인샵)에만 메뉴가 노출됩니다.
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold bg-bg-tertiary text-text-secondary">
                    선택 {createBranchIds.size + (createOnlineShopChecked ? 1 : 0)} / {branches.length + 1}
                  </span>
                </div>
                <BranchChecklistTable
                  branches={branches}
                  selectedIds={createBranchIds}
                  onToggle={(branchId) =>
                    setCreateBranchIds((prev) => toggleSetValue(prev, branchId))
                  }
                  onToggleAll={(checked) => setAllBranchChecks(checked, "create")}
                  categoryMap={branchCategories}
                  selectedCategoryIds={createBranchCategoryIds}
                  onChangeCategory={(branchId, categoryId) =>
                    setCreateBranchCategoryIds((prev) => ({
                      ...prev,
                      [branchId]: categoryId,
                    }))
                  }
                  onlineShopChecked={createOnlineShopChecked}
                  onToggleOnlineShop={() =>
                    setCreateOnlineShopChecked((prev) => !prev)
                  }
                  onlineShopUrl={selectedBrandShopUrl}
                  brandSlug={selectedBrand?.slug ?? null}
                  disabled={saving}
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={saving}
                  className="px-4 py-2 rounded-md border border-border bg-bg-secondary text-foreground text-sm hover:bg-bg-tertiary transition-colors disabled:opacity-60"
                >
                  취소
                </button>
                <button
                  onClick={handleCreateTemplate}
                  disabled={saving}
                  className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors disabled:opacity-60"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
