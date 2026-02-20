"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import toast from "react-hot-toast";
import { Skeleton } from "@/components/ui/Skeleton";
import { DragHandle, SortableList } from "@/components/ui/SortableList";
import { HelpCircle, Pencil, X } from "lucide-react";

// ============================================================
// Types
// ============================================================

type Category = {
  id: string;
  branchId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
};

type Branch = {
  id: string;
  name: string;
  brandId: string;
  myRole: string;
};

type CategoryGroup = {
  key: string;
  name: string;
  items: Category[];
  branchNames: string[];
  allActive: boolean;
  someActive: boolean;
  minSortOrder: number;
};

function canManageCategory(role: string | null | undefined) {
  return (
    role === "OWNER" ||
    role === "ADMIN" ||
    role === "BRANCH_OWNER" ||
    role === "BRANCH_ADMIN"
  );
}

// ============================================================
// Helpers
// ============================================================

function normalizeKey(name: string): string {
  return name.trim().toLowerCase();
}

function groupCategories(categories: Category[], branches: Branch[]): CategoryGroup[] {
  const map = new Map<string, CategoryGroup>();

  for (const cat of categories) {
    const key = normalizeKey(cat.name);
    const branchName = branches.find((b) => b.id === cat.branchId)?.name ?? "";

    if (!map.has(key)) {
      map.set(key, {
        key,
        name: cat.name,
        items: [],
        branchNames: [],
        allActive: true,
        someActive: false,
        minSortOrder: cat.sortOrder,
      });
    }

    const group = map.get(key)!;
    group.items.push(cat);
    if (branchName && !group.branchNames.includes(branchName)) {
      group.branchNames.push(branchName);
    }
    if (cat.sortOrder < group.minSortOrder) {
      group.minSortOrder = cat.sortOrder;
    }
  }

  for (const group of map.values()) {
    group.allActive = group.items.every((item) => item.isActive);
    group.someActive = group.items.some((item) => item.isActive);
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.minSortOrder !== b.minSortOrder) {
      return a.minSortOrder - b.minSortOrder;
    }
    return a.name.localeCompare(b.name);
  });
}

// ============================================================
// Component
// ============================================================

export default function CustomerCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedBranchIds, setSelectedBranchIds] = useState<Set<string>>(new Set());
  const [branchSearch, setBranchSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New category form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Bulk selection
  const [selectedCatIds, setSelectedCatIds] = useState<Set<string>>(new Set());

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Load branches
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const data = await apiClient.get<Branch[]>("/customer/branches");
        setBranches(data);
        if (data.length > 0) {
          setSelectedBranchId(data[0].id);
          setSelectedBranchIds(new Set([data[0].id]));
        }
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "지점 목록을 불러올 수 없습니다");
      }
    };
    loadBranches();
  }, []);

  const loadSelectedBranchCategories = useCallback(async () => {
    if (selectedBranchIds.size === 0) {
      setCategories([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const branchIds = Array.from(selectedBranchIds);
      const results = await Promise.all(
        branchIds.map((branchId) =>
          apiClient.get<Category[]>(
            `/customer/products/categories?branchId=${encodeURIComponent(branchId)}`,
          ),
        ),
      );
      const merged = results
        .flat()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      setCategories(merged);

      if (branchIds.length === 1) {
        const activeBranchId = branchIds[0];
        setSelectedBranchId(activeBranchId);
      } else {
        setSelectedBranchId("");
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "카테고리를 불러올 수 없습니다");
    } finally {
      setLoading(false);
    }
  }, [selectedBranchIds]);

  // Load categories when branch changes
  useEffect(() => {
    void loadSelectedBranchCategories();
  }, [loadSelectedBranchCategories]);

  const selectedBranches = useMemo(
    () => branches.filter((branch) => selectedBranchIds.has(branch.id)),
    [branches, selectedBranchIds],
  );

  const isSingleBranchMode = selectedBranchIds.size === 1;

  const canManage =
    selectedBranches.length > 0 &&
    selectedBranches.every((branch) => canManageCategory(branch.myRole));
  const canReorder = canManage && isSingleBranchMode;
  const canBulkStatus = canManage && isSingleBranchMode;

  const groupedCategories = useMemo(
    () => groupCategories(categories, branches),
    [categories, branches],
  );

  const displayCategoryCount = isSingleBranchMode ? categories.length : groupedCategories.length;
  const activeCategoryCount = isSingleBranchMode
    ? categories.filter((c) => c.isActive).length
    : groupedCategories.filter((g) => g.allActive).length;
  const inactiveCategoryCount = displayCategoryCount - activeCategoryCount;

  // Add category
  const handleAdd = async () => {
    const name = newCategoryName.trim();
    const branchIds = Array.from(selectedBranchIds);
    if (branchIds.length === 0 || !name) return;

    try {
      setAddLoading(true);
      if (branchIds.length === 1) {
        const created = await apiClient.post<Category>("/customer/products/categories", {
          branchId: branchIds[0],
          name,
          sortOrder: categories.length,
        });
        setCategories((prev) => [...prev, created]);
      } else {
        const result = await apiClient.post<{
          created: number;
          skipped: number;
          skippedBranchIds?: string[];
        }>("/customer/products/categories/bulk-create", {
          branchIds,
          name,
        });
        await loadSelectedBranchCategories();
        if (result.skipped > 0) {
          toast.success(
            `${result.created}개 매장에 생성, ${result.skipped}개 매장은 같은 이름이 있어 건너뛰었습니다.`,
          );
        } else {
          toast.success(`${result.created}개 매장에 카테고리를 생성했습니다.`);
        }
      }

      setNewCategoryName("");
      setShowAddForm(false);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "카테고리 추가에 실패했습니다");
    } finally {
      setAddLoading(false);
    }
  };

  const handleUpdate = async (categoryId: string) => {
    if (!isSingleBranchMode) {
      toast.error("이름 수정은 단일 매장 선택에서만 가능합니다.");
      return;
    }
    if (!editName.trim()) return;
    try {
      setEditLoading(true);
      const updated = await apiClient.patch<Category>("/customer/products/categories/" + categoryId, {
        name: editName.trim(),
      });
      setCategories((prev) => prev.map((c) => (c.id === categoryId ? updated : c)));
      setEditingId(null);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "카테고리 수정에 실패했습니다");
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleActive = async (category: Category) => {
    if (!isSingleBranchMode) {
      toast.error("활성/비활성 변경은 단일 매장 선택에서만 가능합니다.");
      return;
    }
    try {
      const updated = await apiClient.patch<Category>("/customer/products/categories/" + category.id, {
        isActive: !category.isActive,
      });
      setCategories((prev) => prev.map((c) => (c.id === category.id ? updated : c)));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "상태 변경에 실패했습니다");
    }
  };

  const handleDelete = async (categoryId: string) => {
    if (!isSingleBranchMode) {
      toast.error("삭제는 단일 매장 선택에서만 가능합니다.");
      return;
    }
    if (!confirm("이 카테고리를 삭제하시겠습니까?\n해당 카테고리의 상품은 '카테고리 없음' 상태가 됩니다.")) return;
    try {
      await apiClient.delete("/customer/products/categories/" + categoryId);
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "카테고리 삭제에 실패했습니다");
    }
  };

  const handleGroupToggleActive = async (group: CategoryGroup) => {
    const nextActive = !group.allActive;
    try {
      await Promise.all(
        group.items.map((item) =>
          apiClient.patch(`/customer/products/categories/${item.id}`, {
            isActive: nextActive,
          }),
        ),
      );
      await loadSelectedBranchCategories();
      toast.success(
        `"${group.name}" 카테고리를 선택 지점 전체에서 ${nextActive ? "활성화" : "비활성화"}했습니다.`,
      );
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "그룹 상태 변경에 실패했습니다");
    }
  };

  const openGroupEdit = async (group: CategoryGroup) => {
    const newName = prompt("새 카테고리 이름을 입력하세요:", group.name);
    if (!newName || !newName.trim() || newName.trim() === group.name) return;

    try {
      await Promise.all(
        group.items.map((item) =>
          apiClient.patch(`/customer/products/categories/${item.id}`, {
            name: newName.trim(),
          }),
        ),
      );
      await loadSelectedBranchCategories();
      toast.success(`"${group.name}" 카테고리 이름을 선택 지점 전체에서 변경했습니다.`);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "그룹 이름 변경에 실패했습니다");
    }
  };

  const handleGroupDelete = async (group: CategoryGroup) => {
    if (
      !confirm(
        `"${group.name}" 카테고리를 선택한 모든 지점에서 삭제하시겠습니까?\n해당 카테고리의 상품은 '카테고리 없음' 상태가 됩니다.`,
      )
    )
      return;

    try {
      await Promise.all(
        group.items.map((item) => apiClient.delete(`/customer/products/categories/${item.id}`)),
      );
      await loadSelectedBranchCategories();
      toast.success(`"${group.name}" 카테고리를 선택 지점 전체에서 삭제했습니다.`);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "그룹 삭제에 실패했습니다");
    }
  };

  const handleBulkToggle = async (active: boolean) => {
    if (!canBulkStatus) {
      toast.error("일괄 활성/비활성은 단일 매장 선택에서만 가능합니다.");
      return;
    }
    const targetBranchId = selectedBranchId || Array.from(selectedBranchIds)[0];
    const categoryIds = Array.from(selectedCatIds);
    if (!targetBranchId || categoryIds.length === 0) return;

    try {
      await apiClient.patch("/customer/products/categories/bulk-status", {
        branchId: targetBranchId,
        categoryIds,
        isActive: active,
      });

      const refreshed = await apiClient.get<Category[]>(
        `/customer/products/categories?branchId=${encodeURIComponent(targetBranchId)}`,
      );
      setCategories(
        refreshed.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
      );
      setSelectedCatIds(new Set());
      toast.success(`${categoryIds.length}개 카테고리가 ${active ? "활성화" : "비활성화"}되었습니다.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "일괄 변경에 실패했습니다");
    }
  };

  const handleReorder = async (newList: Category[]) => {
    setCategories(newList);

    if (!selectedBranchId) return;

    try {
      const items = newList.map((c, idx) => ({ id: c.id, sortOrder: idx }));
      await apiClient.patch("/customer/products/categories/reorder", {
        branchId: selectedBranchId,
        items,
      });
    } catch (e) {
      console.error("순서 저장 실패:", e);
      toast.error("정렬 저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
      if (selectedBranchId) {
        await loadSelectedBranchCategories();
      }
    }
  };

  const filteredBranches = useMemo(() => {
    if (!branchSearch.trim()) return branches;
    const q = branchSearch.toLowerCase();
    return branches.filter((b) => b.name.toLowerCase().includes(q));
  }, [branches, branchSearch]);

  useEffect(() => {
    setSelectedCatIds((prev) => {
      if (prev.size === 0) return prev;
      const visibleIds = new Set(categories.map((c) => c.id));
      return new Set(Array.from(prev).filter((id) => visibleIds.has(id)));
    });
  }, [categories]);

  useEffect(() => {
    if (!canManage) {
      setShowAddForm(false);
      setEditingId(null);
    }
  }, [canManage]);

  useEffect(() => {
    if (!isSingleBranchMode) {
      setSelectedCatIds(new Set());
      setEditingId(null);
    }
  }, [isSingleBranchMode]);

  const renderCategoryRow = (
    category: Category,
    index: number,
    dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>,
  ) => {
    return (
      <div
        key={category.id}
        className={`flex items-center gap-3 p-3 rounded-md border bg-bg-secondary ${
          category.isActive ? "border-border" : "border-border opacity-50"
        }`}
      >
        {canBulkStatus && (
          <input
            type="checkbox"
            checked={selectedCatIds.has(category.id)}
            onChange={() => {
              setSelectedCatIds((prev) => {
                const next = new Set(prev);
                if (next.has(category.id)) next.delete(category.id);
                else next.add(category.id);
                return next;
              });
            }}
            className="w-4 h-4 rounded accent-primary flex-shrink-0"
          />
        )}

        {canManage && dragHandleProps ? (
          <DragHandle {...dragHandleProps} className="flex-shrink-0" />
        ) : (
          <span className="w-8 h-8 flex items-center justify-center rounded-full bg-bg-tertiary text-sm font-bold text-text-secondary flex-shrink-0">
            {index + 1}
          </span>
        )}

        <div className="flex-1 min-w-0">
          {editingId === category.id ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="input-field text-sm flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUpdate(category.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                autoFocus
              />
              <button
                onClick={() => handleUpdate(category.id)}
                disabled={editLoading}
                className="btn-primary px-3 py-1.5 text-xs"
              >
                {editLoading ? "..." : "저장"}
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="px-3 py-1.5 text-xs rounded border border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary transition-colors"
              >
                취소
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-foreground">{category.name}</span>
              <span
                className={`inline-flex items-center h-5 px-2 rounded-full text-2xs font-semibold ${
                  category.isActive
                    ? "bg-success/20 text-success"
                    : "bg-neutral-500/20 text-text-secondary"
                }`}
              >
                {category.isActive ? "활성" : "비활성"}
              </span>
            </div>
          )}
        </div>

        {isSingleBranchMode && canManage && editingId !== category.id && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => handleToggleActive(category)}
              className={`relative w-9 h-5 p-0 rounded-full transition-colors cursor-pointer shrink-0 ${
                category.isActive
                  ? "bg-success/80 hover:bg-success"
                  : "bg-neutral-400/70 hover:bg-neutral-500/70"
              }`}
              title={category.isActive ? "비활성화" : "활성화"}
              aria-label={`${category.name} ${category.isActive ? "비활성화" : "활성화"}`}
            >
              <span
                className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow-sm pointer-events-none transition-transform ${
                  category.isActive ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
            <button
              onClick={() => {
                setEditingId(category.id);
                setEditName(category.name);
              }}
              className="w-8 h-8 flex items-center justify-center rounded border border-border bg-bg-secondary text-foreground hover:bg-bg-tertiary cursor-pointer text-sm transition-colors"
              title="이름 수정"
              aria-label="이름 수정"
            >
              <Pencil className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleDelete(category.id)}
              className="w-8 h-8 flex items-center justify-center rounded border border-danger-500/30 bg-danger-500/10 text-danger-500 hover:bg-danger-500/20 cursor-pointer transition-colors"
              title="삭제"
              aria-label="삭제"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderCategoryGroupRow = (group: CategoryGroup, index: number) => {
    const MAX_VISIBLE_BRANCH_CHIPS = 1;
    const visibleBranchNames = group.branchNames.slice(0, MAX_VISIBLE_BRANCH_CHIPS);
    const remainingBranchCount = group.branchNames.length - visibleBranchNames.length;
    const allBranchNamesText = group.branchNames.join(", ");
    const tooltipLines = group.branchNames;
    const tooltipText = tooltipLines.join(", ");

    return (
      <div
        key={group.key}
        className="flex items-center gap-3 p-3 rounded-md border border-border bg-bg-secondary"
      >
        <span className="w-8 h-8 flex items-center justify-center rounded-full bg-bg-tertiary text-sm font-bold text-text-secondary flex-shrink-0">
          {index + 1}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-foreground">{group.name}</span>
            {visibleBranchNames.map((branchName) => (
              <div key={branchName} className="relative group">
                <span
                  className="inline-flex items-center h-5 px-2 rounded-full text-2xs font-medium bg-bg-tertiary text-text-tertiary border border-border"
                  aria-label={`포함 지점: ${tooltipText}`}
                >
                  {branchName}
                </span>

                {/* Tooltip */}
                <div className="absolute left-0 top-full mt-2 w-64 p-3 rounded-md bg-bg-tertiary border border-border text-xs text-text-secondary opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                  {tooltipLines.map((line) => (
                    <div key={line} className="leading-5">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {remainingBranchCount > 0 && (
              <div className="relative group">
                <span
                  className="inline-flex items-center h-5 px-2 rounded-full text-2xs font-semibold bg-bg-tertiary text-text-secondary border border-border"
                  aria-label={`외 ${remainingBranchCount}개 지점 (전체: ${tooltipText})`}
                >
                  +{remainingBranchCount}
                </span>

                {/* Tooltip */}
                <div className="absolute left-0 top-full mt-2 w-64 p-3 rounded-md bg-bg-tertiary border border-border text-xs text-text-secondary opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                  {tooltipLines.map((line) => (
                    <div key={line} className="leading-5">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            )}




            <span
              className={`inline-flex items-center h-5 px-2 rounded-full text-2xs font-semibold ${
                group.allActive
                  ? "bg-success/20 text-success"
                  : "bg-neutral-500/20 text-text-secondary"
              }`}
            >
              {group.allActive ? "활성" : "비활성"}
            </span>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
            <button
              onClick={() => handleGroupToggleActive(group)}
              className={`relative w-9 h-5 p-0 rounded-full transition-colors cursor-pointer shrink-0 ${
                group.allActive
                  ? "bg-success/80 hover:bg-success"
                  : "bg-neutral-400/70 hover:bg-neutral-500/70"
              }`}
              title={group.allActive ? "전체 비활성화" : "전체 활성화"}
              aria-label={`${group.name} ${group.allActive ? "전체 비활성화" : "전체 활성화"}`}
            >
              <span
                className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow-sm pointer-events-none transition-transform ${
                  group.allActive ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
            <button
              onClick={() => openGroupEdit(group)}
              className="w-8 h-8 flex items-center justify-center rounded border border-border bg-bg-secondary text-foreground hover:bg-bg-tertiary cursor-pointer text-sm transition-colors"
              title="그룹 이름 수정"
              aria-label="그룹 이름 수정"
            >
              <Pencil className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleGroupDelete(group)}
              className="w-8 h-8 flex items-center justify-center rounded border border-danger-500/30 bg-danger-500/10 text-danger-500 hover:bg-danger-500/20 cursor-pointer transition-colors"
              title="그룹 삭제"
              aria-label="그룹 삭제"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  if (loading && branches.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold mb-8 text-foreground">카테고리 관리</h1>
        <div className="space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  const modeBadge = isSingleBranchMode
    ? { label: "단일 매장 모드 (정렬/일괄상태 변경 가능)", color: "bg-success/20 text-success" }
    : selectedBranchIds.size > 1
      ? { label: "다중 매장 모드 (카테고리 추가만 일괄 등록)", color: "bg-bg-tertiary text-text-secondary" }
      : { label: "매장 선택 필요", color: "bg-bg-tertiary text-text-secondary" };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-extrabold m-0 text-foreground">카테고리 관리</h1>
          <p className="text-text-secondary text-sm mt-1">
            선택 매장 {selectedBranchIds.size}개 · 카테고리 {displayCategoryCount}개 · 활성 {activeCategoryCount}개 · 비활성 {inactiveCategoryCount}개
          </p>
        </div>
        {canManage && selectedBranchIds.size > 0 && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-primary px-5 py-2.5 text-sm"
          >
            {showAddForm ? "추가 닫기" : "+ 카테고리 추가"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[520px_1fr] gap-6">
        {/* Left column: Branch selection */}
        <div className="rounded-xl border border-border bg-bg-secondary p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <label className="text-sm text-text-secondary font-semibold">매장 선택 (다중선택가능)</label>

              <div className="relative group cursor-pointer">
                <HelpCircle
                  size={16}
                  className="text-text-secondary hover:text-foreground transition-colors"
                />

                <div className="absolute left-6 top-1/2 -translate-y-1/2 w-72 p-3 rounded-md bg-bg-tertiary border border-border text-xs text-text-secondary opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                  여러 매장을 동시에 선택하면 카테고리를 한 번에 등록할 수 있습니다.<br/>
                  정렬 변경, 이름 수정, 삭제, 활성/비활성 변경(일괄 포함)은 단일 매장 선택에서만 가능합니다.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedBranchIds(new Set(filteredBranches.map((b) => b.id)))}
                disabled={filteredBranches.length === 0}
                className="text-xs px-2.5 py-1 rounded border border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary transition-colors disabled:opacity-50"
              >
                전체 선택
              </button>
              <button
                onClick={() => setSelectedBranchIds(new Set())}
                disabled={selectedBranchIds.size === 0}
                className="text-xs px-2.5 py-1 rounded border border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary transition-colors disabled:opacity-50"
              >
                전체 해제
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              value={branchSearch}
              onChange={(e) => setBranchSearch(e.target.value)}
              placeholder="매장 검색..."
              className="input-field w-full"
            />

            {/* {selectedBranchIds.size > 0 ? (
              <div className="flex flex-wrap gap-2 p-2 bg-background rounded-lg border border-border">
                {Array.from(selectedBranchIds).map((branchId) => {
                  const branch = branches.find((b) => b.id === branchId);
                  if (!branch) return null;
                  return (
                    <span
                      key={branchId}
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium bg-primary-500/10 text-primary-500 border border-primary-500/30"
                    >
                      <span>{branch.name}</span>
                      <button
                        onClick={() => {
                          setSelectedBranchIds((prev) => {
                            const next = new Set(prev);
                            next.delete(branchId);
                            return next;
                          });
                        }}
                        className="hover:text-primary-700 transition-colors"
                        aria-label={`${branch.name} 선택 해제`}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            ) : (
              <div className="p-2 text-xs text-text-tertiary italic">매장을 1개 이상 선택하세요</div>
            )} */}

            <div className="max-h-44 overflow-y-auto border border-border rounded-lg p-2 bg-background">
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

            <div className="flex items-center justify-center pt-1">
              <span className={`inline-flex items-center h-6 px-3 rounded-full text-xs font-medium ${modeBadge.color}`}>
                {modeBadge.label}
              </span>
            </div>
          </div>
        </div>

        {/* Right column: Add form + list */}
        <div className="max-w-[980px] w-full">
          {/* Capabilities indicator */}
          {selectedBranchIds.size > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <span
                className={`inline-flex items-center h-6 px-3 rounded-full text-xs font-medium ${
                  canReorder
                    ? "bg-success/20 text-success"
                    : "bg-bg-tertiary text-text-tertiary cursor-help"
                }`}
                title={canReorder ? "정렬 변경 가능" : "단일 매장 선택에서만 가능"}
              >
                정렬 변경
              </span>
              <span
                className={`inline-flex items-center h-6 px-3 rounded-full text-xs font-medium ${
                  canBulkStatus
                    ? "bg-success/20 text-success"
                    : "bg-bg-tertiary text-text-tertiary cursor-help"
                }`}
                title={canBulkStatus ? "일괄 활성/비활성 가능" : "단일 매장 선택에서만 가능"}
              >
                일괄 활성/비활성
              </span>
            </div>
          )}

          {error && (
            <div className="border border-danger-500 rounded-md p-4 bg-danger-500/10 text-danger-500 mb-4">{error}</div>
          )}

          {/* Add Form */}
          {showAddForm && (
            <div className="mb-6 p-4 rounded-lg border border-primary-500/30 bg-primary-500/5 w-full">
              <div className="text-sm font-semibold text-foreground mb-1">새 카테고리</div>
              <div className="text-xs text-text-secondary mb-3">
                {selectedBranchIds.size > 1
                  ? `선택한 ${selectedBranchIds.size}개 매장에 동일한 카테고리를 등록합니다.`
                  : "선택한 매장에 카테고리를 등록합니다."}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="카테고리 이름"
                  className="input-field flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  autoFocus
                />
                <button
                  onClick={handleAdd}
                  disabled={addLoading || !newCategoryName.trim()}
                  className="btn-primary px-4 py-2 text-sm"
                >
                  {addLoading ? "..." : "추가"}
                </button>
                <button
                  onClick={() => { setShowAddForm(false); setNewCategoryName(""); }}
                  className="px-4 py-2 text-sm rounded-lg border border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {/* Category List */}
          {selectedBranchIds.size === 0 ? (
            <div className="card p-12 text-center text-text-tertiary">
              <div className="text-base mb-2">매장을 1개 이상 선택하세요</div>
            </div>
          ) : loading ? (
            <div className="card p-6">
              <div className="space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ) : categories.length === 0 ? (
            <div className="card p-12 text-center text-text-tertiary">
              <div className="text-base mb-2">등록된 카테고리가 없습니다</div>
              {canManage && <div className="text-sm">카테고리 추가 버튼을 클릭하여 등록하세요</div>}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Bulk action bar */}
              {canBulkStatus && (
                selectedCatIds.size > 0 ? (
                  <div className="flex items-center gap-2 mb-2 p-3 rounded-lg bg-primary-500/5 border border-primary-500/20">
                    <span className="text-sm font-medium text-foreground">일괄 변경: {selectedCatIds.size}개 선택됨</span>
                    <button className="ml-auto text-xs px-3 py-1.5 rounded bg-success/20 text-success font-medium hover:bg-success/30 transition-colors" onClick={() => handleBulkToggle(true)}>선택 활성화</button>
                    <button className="text-xs px-3 py-1.5 rounded bg-danger-500/20 text-danger-500 font-medium hover:bg-danger-500/30 transition-colors" onClick={() => handleBulkToggle(false)}>선택 비활성화</button>
                    <button className="text-xs px-3 py-1.5 rounded bg-bg-tertiary text-text-secondary font-medium hover:bg-bg-secondary transition-colors" onClick={() => setSelectedCatIds(new Set())}>선택 해제</button>
                  </div>
                ) : (
                  <div className="mb-2 p-3 rounded-lg bg-bg-tertiary/40 border border-border text-xs text-text-secondary italic text-center">
                    카테고리를 선택하면 일괄 활성/비활성이 가능합니다.
                  </div>
                )
              )}

              {isSingleBranchMode ? (
                canReorder ? (
                  <SortableList
                    items={categories}
                    keyExtractor={(item) => item.id}
                    onReorder={handleReorder}
                    className="flex flex-col gap-2"
                    renderItem={(category, index, dragHandleProps) =>
                      renderCategoryRow(category, index, dragHandleProps)
                    }
                  />
                ) : (
                  categories.map((category, index) => renderCategoryRow(category, index))
                )
              ) : (
                groupedCategories.map((group, index) => renderCategoryGroupRow(group, index))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
