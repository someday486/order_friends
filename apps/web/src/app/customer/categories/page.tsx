"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import toast from "react-hot-toast";
import { Skeleton } from "@/components/ui/Skeleton";
import { PencilIcon } from "@/components/ui/icons";
import { DragHandle, SortableList } from "@/components/ui/SortableList";

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

// ============================================================
// Constants
// ============================================================

// ============================================================
// Helpers
// ============================================================

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
  const [userRole, setUserRole] = useState<string | null>(null);

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
          setUserRole(data[0].myRole);
        }
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "지점 목록을 불러올 수 없습니다");
      }
    };
    loadBranches();
  }, []);

  // Load categories when branch changes
  useEffect(() => {
    const loadCategories = async () => {
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
          const branch = branches.find((b) => b.id === activeBranchId);
          if (branch) setUserRole(branch.myRole);
        } else {
          setSelectedBranchId("");
          setUserRole(null);
        }
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "카테고리를 불러올 수 없습니다");
      } finally {
        setLoading(false);
      }
    };
    loadCategories();
  }, [selectedBranchIds, branches]);

  const canManage =
    selectedBranchIds.size === 1 &&
    (userRole === "OWNER" ||
      userRole === "ADMIN" ||
      userRole === "BRANCH_OWNER" ||
      userRole === "BRANCH_ADMIN");

  // Add category
  const handleAdd = async () => {
    if (!selectedBranchId || !newCategoryName.trim()) return;
    try {
      setAddLoading(true);
      const created = await apiClient.post<Category>("/customer/products/categories", {
        branchId: selectedBranchId,
        name: newCategoryName.trim(),
        sortOrder: categories.length,
      });
      setCategories((prev) => [...prev, created]);
      setNewCategoryName("");
      setShowAddForm(false);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "카테고리 수정에 실패했습니다");
    } finally {
      setAddLoading(false);
    }
  };

  const handleUpdate = async (categoryId: string) => {
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
      toast.error(e instanceof Error ? e.message : "카테고리 추가에 실패했습니다");
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleActive = async (category: Category) => {
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
    if (!confirm("이 카테고리를 삭제하시겠습니까?\n해당 카테고리의 상품은 '카테고리 없음' 상태가 됩니다.")) return;
    try {
      await apiClient.delete("/customer/products/categories/" + categoryId);
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "카테고리 삭제에 실패했습니다");
    }
  };

  const handleBulkToggle = async (active: boolean) => {
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

  const renderCategoryRow = (
    category: Category,
    index: number,
    dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>,
  ) => (
    <div
      key={category.id}
      className={`flex items-center gap-3 p-4 rounded-md border bg-bg-secondary ${
        category.isActive ? "border-border" : "border-border opacity-50"
      }`}
    >
      {canManage && (
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
          <div className="flex items-center gap-2">
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

      {canManage && editingId !== category.id && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => {
              setEditingId(category.id);
              setEditName(category.name);
            }}
            className="w-8 h-8 flex items-center justify-center rounded border border-border bg-bg-secondary text-foreground hover:bg-bg-tertiary cursor-pointer text-sm transition-colors"
            title="이름 수정"
          >
            <PencilIcon size={14} />
          </button>
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
            onClick={() => handleDelete(category.id)}
            className="px-2.5 py-1.5 rounded border border-danger-500/30 bg-danger-500/10 text-danger-500 hover:bg-danger-500/20 cursor-pointer text-xs font-medium transition-colors"
          >
            삭제
          </button>
        </div>
      )}
    </div>
  );

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

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-extrabold m-0 text-foreground">카테고리 관리</h1>
        {canManage && selectedBranchId && (
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-primary px-5 py-2.5 text-sm"
          >
            + 카테고리 추가
          </button>
        )}
      </div>

      {/* Branch Filter */}
      <div className="mb-6">
        <label className="block text-sm text-text-secondary mb-2 font-semibold">매장 선택</label>
        <div className="max-w-[520px] space-y-2">
          <input
            type="text"
            value={branchSearch}
            onChange={(e) => setBranchSearch(e.target.value)}
            placeholder="매장 검색..."
            className="input-field w-full"
          />
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
          {selectedBranchIds.size !== 1 && (
            <div className="text-xs text-text-tertiary">
              여러 매장 선택 시 조회만 가능하며 편집/정렬은 단일 매장 선택에서만 가능합니다.
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="border border-danger-500 rounded-md p-4 bg-danger-500/10 text-danger-500 mb-4">{error}</div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="mb-6 p-4 rounded-lg border border-primary-500/30 bg-primary-500/5">
          <div className="text-sm font-semibold text-foreground mb-3">새 카테고리</div>
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
          {selectedCatIds.size > 0 && (
            <div className="flex items-center gap-2 mb-2 p-3 rounded-lg bg-primary-500/5 border border-primary-500/20">
              <span className="text-sm font-medium text-foreground">{selectedCatIds.size}개 선택</span>
              <button className="ml-auto text-xs px-3 py-1.5 rounded bg-success/20 text-success font-medium hover:bg-success/30 transition-colors" onClick={() => handleBulkToggle(true)}>활성화</button>
              <button className="text-xs px-3 py-1.5 rounded bg-danger-500/20 text-danger-500 font-medium hover:bg-danger-500/30 transition-colors" onClick={() => handleBulkToggle(false)}>비활성화</button>
              <button className="text-xs px-3 py-1.5 rounded bg-bg-tertiary text-text-secondary font-medium hover:bg-bg-secondary transition-colors" onClick={() => setSelectedCatIds(new Set())}>선택 해제</button>
            </div>
          )}

          {canManage ? (
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
          )}
        </div>
      )}
    </div>
  );
}
