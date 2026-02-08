"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

// ============================================================
// Helpers
// ============================================================

async function getAccessToken() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("No access_token (로그인 필요)");
  return token;
}

// ============================================================
// Component
// ============================================================

export default function CustomerCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // New category form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Load branches
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch(`${API_BASE}/customer/branches`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`매장 목록 조회 실패: ${res.status}`);
        const data = await res.json();
        setBranches(data);
        if (data.length > 0) {
          setSelectedBranchId(data[0].id);
          setUserRole(data[0].myRole);
        }
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "매장 목록 조회 중 오류 발생");
      }
    };
    loadBranches();
  }, []);

  // Load categories when branch changes
  useEffect(() => {
    const loadCategories = async () => {
      if (!selectedBranchId) {
        setCategories([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const token = await getAccessToken();
        const res = await fetch(
          `${API_BASE}/customer/products/categories?branchId=${encodeURIComponent(selectedBranchId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) throw new Error(`카테고리 조회 실패: ${res.status}`);
        const data = await res.json();
        setCategories(data);

        const branch = branches.find((b) => b.id === selectedBranchId);
        if (branch) setUserRole(branch.myRole);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "카테고리 조회 중 오류 발생");
      } finally {
        setLoading(false);
      }
    };
    loadCategories();
  }, [selectedBranchId, branches]);

  const canManage = userRole === "OWNER" || userRole === "ADMIN";

  // Add category
  const handleAdd = async () => {
    if (!newCategoryName.trim()) return;
    try {
      setAddLoading(true);
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/customer/products/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          branchId: selectedBranchId,
          name: newCategoryName.trim(),
          sortOrder: categories.length,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`카테고리 생성 실패: ${res.status} ${text}`);
      }
      const created = await res.json();
      setCategories((prev) => [...prev, created]);
      setNewCategoryName("");
      setShowAddForm(false);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "카테고리 생성 실패");
    } finally {
      setAddLoading(false);
    }
  };

  // Update category name
  const handleUpdate = async (categoryId: string) => {
    if (!editName.trim()) return;
    try {
      setEditLoading(true);
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/customer/products/categories/${categoryId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (!res.ok) throw new Error(`카테고리 수정 실패: ${res.status}`);
      const updated = await res.json();
      setCategories((prev) => prev.map((c) => (c.id === categoryId ? updated : c)));
      setEditingId(null);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "카테고리 수정 실패");
    } finally {
      setEditLoading(false);
    }
  };

  // Toggle active
  const handleToggleActive = async (category: Category) => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/customer/products/categories/${category.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !category.isActive }),
      });
      if (!res.ok) throw new Error(`상태 변경 실패: ${res.status}`);
      const updated = await res.json();
      setCategories((prev) => prev.map((c) => (c.id === category.id ? updated : c)));
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "상태 변경 실패");
    }
  };

  // Delete category
  const handleDelete = async (categoryId: string) => {
    if (!confirm("이 카테고리를 삭제하시겠습니까?\n해당 카테고리의 상품은 '카테고리 없음' 상태가 됩니다.")) return;
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/customer/products/categories/${categoryId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`카테고리 삭제 실패: ${res.status}`);
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "카테고리 삭제 실패");
    }
  };

  // Move category up/down
  const moveCategory = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const newList = [...categories];
    [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
    setCategories(newList);

    // Save immediately
    try {
      const token = await getAccessToken();
      const items = newList.map((c, idx) => ({ id: c.id, sortOrder: idx }));
      await fetch(`${API_BASE}/customer/products/categories/reorder`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ branchId: selectedBranchId, items }),
      });
    } catch (e) {
      console.error("순서 저장 실패:", e);
    }
  };

  if (loading && branches.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold mb-8 text-foreground">카테고리 관리</h1>
        <div className="text-text-secondary">로딩 중...</div>
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
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="input-field max-w-[400px]"
        >
          <option value="">매장을 선택하세요</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
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
      {!selectedBranchId ? (
        <div className="card p-12 text-center text-text-tertiary">
          <div className="text-base mb-2">매장을 선택하세요</div>
        </div>
      ) : loading ? (
        <div className="card p-12 text-center text-text-secondary">로딩 중...</div>
      ) : categories.length === 0 ? (
        <div className="card p-12 text-center text-text-tertiary">
          <div className="text-base mb-2">등록된 카테고리가 없습니다</div>
          {canManage && <div className="text-sm">카테고리 추가 버튼을 클릭하여 등록하세요</div>}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {categories.map((category, index) => (
            <div
              key={category.id}
              className={`flex items-center gap-3 p-4 rounded-md border bg-bg-secondary ${
                category.isActive ? "border-border" : "border-border opacity-50"
              }`}
            >
              {/* Order number */}
              <span className="w-8 h-8 flex items-center justify-center rounded-full bg-bg-tertiary text-sm font-bold text-text-secondary flex-shrink-0">
                {index + 1}
              </span>

              {/* Category name (editable) */}
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

              {/* Actions */}
              {canManage && editingId !== category.id && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Up/Down */}
                  <button
                    onClick={() => moveCategory(index, "up")}
                    disabled={index === 0}
                    className={`w-8 h-8 flex items-center justify-center rounded border text-sm transition-colors ${
                      index === 0
                        ? "border-border bg-bg-tertiary text-text-tertiary cursor-not-allowed"
                        : "border-border bg-bg-secondary text-foreground hover:bg-bg-tertiary cursor-pointer"
                    }`}
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveCategory(index, "down")}
                    disabled={index === categories.length - 1}
                    className={`w-8 h-8 flex items-center justify-center rounded border text-sm transition-colors ${
                      index === categories.length - 1
                        ? "border-border bg-bg-tertiary text-text-tertiary cursor-not-allowed"
                        : "border-border bg-bg-secondary text-foreground hover:bg-bg-tertiary cursor-pointer"
                    }`}
                  >
                    ▼
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => { setEditingId(category.id); setEditName(category.name); }}
                    className="w-8 h-8 flex items-center justify-center rounded border border-border bg-bg-secondary text-foreground hover:bg-bg-tertiary cursor-pointer text-sm transition-colors"
                    title="이름 수정"
                  >
                    ✏
                  </button>

                  {/* Toggle active */}
                  <button
                    onClick={() => handleToggleActive(category)}
                    className={`w-8 h-8 flex items-center justify-center rounded border text-sm transition-colors cursor-pointer ${
                      category.isActive
                        ? "border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary"
                        : "border-primary-500/30 bg-primary-500/10 text-primary-500 hover:bg-primary-500/20"
                    }`}
                    title={category.isActive ? "비활성화" : "활성화"}
                  >
                    {category.isActive ? "🔒" : "🔓"}
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="w-8 h-8 flex items-center justify-center rounded border border-danger-500/30 bg-danger-500/10 text-danger-500 hover:bg-danger-500/20 cursor-pointer text-sm transition-colors"
                    title="삭제"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
