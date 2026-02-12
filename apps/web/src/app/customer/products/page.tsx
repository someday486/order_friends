"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { apiClient } from "@/lib/api-client";
import { formatWon } from "@/lib/format";
import toast from "react-hot-toast";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { SearchIcon } from "@/components/ui/icons";
import { DragHandle, SortableList } from "@/components/ui/SortableList";

// ============================================================
// Types
// ============================================================

type Product = {
  id: string;
  branch_id: string;
  name: string;
  description?: string | null;
  category_id?: string | null;
  price: number;
  base_price?: number;
  is_active?: boolean;
  is_hidden?: boolean;
  sort_order?: number;
  image_url?: string | null;
  created_at: string;
};

type Branch = {
  id: string;
  name: string;
  brandId: string;
  myRole: string;
};

type InventoryItem = {
  product_id: string;
  qty_available: number;
};

// ============================================================
// Constants
// ============================================================

// ============================================================
// Helpers
// ============================================================

// TODO(2-D): 상품 다중 매장 일괄 반영 UI/연동은 백엔드 API 계약 확정 후 구현.
const isProductActive = (product: Product) =>
  product.is_active ?? !product.is_hidden;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString();

// ============================================================
// Component
// ============================================================

export default function CustomerProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [productCategories, setProductCategories] = useState<{id:string;name:string}[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [inventoryMap, setInventoryMap] = useState<Record<string, number>>({});
  const [editingInventoryId, setEditingInventoryId] = useState<string | null>(null);
  const [editingInventoryQty, setEditingInventoryQty] = useState("");
  const [inventorySaving, setInventorySaving] = useState(false);

  // Reorder mode
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [reorderList, setReorderList] = useState<Product[]>([]);
  const [reorderSaving, setReorderSaving] = useState(false);

  // Load branches
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const data = await apiClient.get<Branch[]>("/customer/branches");
        setBranches(data);
        if (data.length > 0) {
          setSelectedBranchId(data[0].id);
          setUserRole(data[0].myRole);
        }
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "지점 목록을 불러올 수 없습니다");
      }
    };

    loadBranches();
  }, []);

  // Load products when branch changes
  useEffect(() => {
    const loadProducts = async () => {
      if (!selectedBranchId) return;

      try {
        setLoading(true);
        setError(null);

        const data = await apiClient.get<Product[]>(`/customer/products?branchId=${encodeURIComponent(selectedBranchId)}`);
        setProducts(data);

        apiClient.get<{id:string;name:string}[]>(`/customer/products/categories?branchId=${encodeURIComponent(selectedBranchId)}`)
          .then(cats => setProductCategories(cats))
          .catch(() => {});

        apiClient.get<InventoryItem[]>(`/customer/inventory?branchId=${encodeURIComponent(selectedBranchId)}`)
          .then((items) => {
            const nextMap: Record<string, number> = {};
            items.forEach((item) => {
              nextMap[item.product_id] = item.qty_available;
            });
            setInventoryMap(nextMap);
          })
          .catch(() => setInventoryMap({}));

        const branch = branches.find((item) => item.id === selectedBranchId);
        if (branch) {
          setUserRole(branch.myRole);
        }
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "상품 목록을 불러올 수 없습니다");
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [selectedBranchId, branches]);

  useEffect(() => {
    setSelectedProductIds(new Set());
  }, [selectedBranchId]);

  const canManageProducts =
    userRole === "OWNER" ||
    userRole === "ADMIN" ||
    userRole === "BRANCH_OWNER" ||
    userRole === "BRANCH_ADMIN";

  // Enter reorder mode
  const enterReorderMode = () => {
    setReorderList([...products]);
    setIsReorderMode(true);
  };

  // Cancel reorder
  const cancelReorder = () => {
    setIsReorderMode(false);
    setReorderList([]);
  };

  // Save reorder
  const saveReorder = async () => {
    try {
      setReorderSaving(true);

      const items = reorderList.map((p, idx) => ({
        id: p.id,
        sortOrder: idx,
      }));

      const data = await apiClient.patch<Product[]>("/customer/products/reorder", {
        branchId: selectedBranchId,
        items,
      });

      setProducts(data);
      setIsReorderMode(false);
      setReorderList([]);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "순서 저장에 실패했습니다");
    } finally {
      setReorderSaving(false);
    }
  };

  const handleBulkStatusChange = async (active: boolean) => {
    if (selectedProductIds.size === 0) return;

    try {
      setBulkUpdating(true);
      const results = await Promise.all(
        Array.from(selectedProductIds).map((id) =>
          apiClient.patch<Product>("/customer/products/" + id, { isActive: active }),
        ),
      );
      setProducts((prev) =>
        prev.map((p) => results.find((r) => r.id === p.id) ?? p),
      );
      setSelectedProductIds(new Set());
      toast.success(`${results.length}개 상품을 ${active ? "판매중" : "숨김"}으로 변경했습니다.`);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "일괄 변경에 실패했습니다");
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleStartInventoryEdit = (productId: string, qty: number | undefined) => {
    setEditingInventoryId(productId);
    setEditingInventoryQty((qty ?? 0).toString());
  };

  const handleSaveInventory = async (productId: string) => {
    const nextQty = Number.parseInt(editingInventoryQty, 10);
    if (Number.isNaN(nextQty) || nextQty < 0) {
      toast.error("재고는 0 이상 숫자여야 합니다");
      return;
    }

    try {
      setInventorySaving(true);
      const updated = await apiClient.patch<{ qty_available: number }>(
        `/customer/inventory/${productId}`,
        { qty_available: nextQty },
      );
      setInventoryMap((prev) => ({ ...prev, [productId]: updated.qty_available }));
      setEditingInventoryId(null);
      setEditingInventoryQty("");
      toast.success("재고를 수정했습니다");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "재고 수정에 실패했습니다");
    } finally {
      setInventorySaving(false);
    }
  };

  const filteredProducts = useMemo(
    () =>
      products
        .filter((p) => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .filter((p) => !selectedCategoryId || p.category_id === selectedCategoryId),
    [products, searchQuery, selectedCategoryId],
  );

  useEffect(() => {
    setSelectedProductIds((prev) => {
      if (prev.size === 0) return prev;
      const visibleIds = new Set(filteredProducts.map((p) => p.id));
      return new Set(Array.from(prev).filter((id) => visibleIds.has(id)));
    });
  }, [filteredProducts]);

  const allSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((p) => selectedProductIds.has(p.id));


  if (loading && branches.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold mb-8 text-foreground">상품 관리</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-extrabold m-0 text-foreground">상품 관리</h1>
        <div className="flex gap-2">
          {canManageProducts && selectedBranchId && !isReorderMode && products.length > 1 && (
            <button
              onClick={enterReorderMode}
              className="px-4 py-2.5 text-sm rounded-lg border border-border bg-bg-secondary text-foreground hover:bg-bg-tertiary transition-colors"
            >
              순서 편집
            </button>
          )}
          {canManageProducts && selectedBranchId && !isReorderMode && (
            <Link href={`/customer/products/new?branchId=${selectedBranchId}`} className="no-underline">
              <button className="btn-primary px-5 py-2.5 text-sm">+ 상품 추가</button>
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      {!isReorderMode && (
        <div className="mb-6 flex flex-wrap items-end gap-4">
          <div>
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
          {selectedBranchId && productCategories.length > 0 && (
            <div>
              <label className="block text-sm text-text-secondary mb-2 font-semibold">카테고리</label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="input-field w-auto min-w-[140px]"
              >
                <option value="">전체</option>
                {productCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          )}
          {selectedBranchId && (
            <div className="relative">
              <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="상품명 검색..."
                className="input-field pl-9 w-[200px]"
              />
            </div>
          )}
        </div>
      )}

      {error && <div className="border border-danger-500 rounded-md p-4 bg-danger-500/10 text-danger-500 mb-4">{error}</div>}

      {/* Reorder Mode */}
      {isReorderMode ? (
        <div>
          <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-primary-500/10 border border-primary-500/30">
            <span className="text-sm font-semibold text-foreground">
              드래그 핸들로 순서를 변경하세요
            </span>
            <div className="flex gap-2">
              <button
                onClick={cancelReorder}
                disabled={reorderSaving}
                className="px-4 py-2 text-sm rounded-lg border border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary transition-colors"
              >
                취소
              </button>
              <button
                onClick={saveReorder}
                disabled={reorderSaving}
                className="btn-primary px-4 py-2 text-sm"
              >
                {reorderSaving ? "저장 중..." : "순서 저장"}
              </button>
            </div>
          </div>

          <SortableList
            items={reorderList}
            keyExtractor={(item) => item.id}
            onReorder={setReorderList}
            className="flex flex-col gap-2"
            renderItem={(product, index, dragHandleProps) => (
              <div className="flex items-center gap-3 p-3 rounded-md border border-border bg-bg-secondary">
                <DragHandle {...dragHandleProps} className="flex-shrink-0" />

                <span className="w-8 h-8 flex items-center justify-center rounded-full bg-bg-tertiary text-sm font-bold text-text-secondary flex-shrink-0">
                  {index + 1}
                </span>

                {product.image_url ? (
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-bg-tertiary flex items-center justify-center text-lg flex-shrink-0">
                    📦
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-foreground truncate">{product.name}</div>
                  <div className="text-xs text-text-secondary">{formatWon(product.base_price ?? product.price ?? 0)}</div>
                </div>
              </div>
            )}
          />
        </div>
      ) : branches.length === 0 ? (
        <div className="card p-12 text-center text-text-tertiary">
          <div className="text-base mb-2">등록된 매장이 없습니다</div>
          <div className="text-sm">먼저 매장을 등록해주세요</div>
        </div>
      ) : !selectedBranchId ? (
        <div className="card p-12 text-center text-text-tertiary">
          <div className="text-base mb-2">매장을 선택하세요</div>
          <div className="text-sm">위에서 매장을 선택하면 상품 목록이 표시됩니다</div>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="card p-12 text-center text-text-tertiary">
          <div className="text-base mb-2">등록된 상품이 없습니다</div>
          {canManageProducts && (
            <div className="text-sm">상품 추가 버튼을 클릭하여 상품을 등록하세요</div>
          )}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="card p-12 text-center text-text-tertiary">
          <div className="text-base mb-2">검색 결과가 없습니다</div>
          <div className="text-sm">필터 또는 검색어를 변경해보세요</div>
        </div>
      ) : (
        <div>
          {canManageProducts && selectedProductIds.size > 0 && (
            <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-primary-500/5 border border-primary-500/20">
              <span className="text-sm font-medium text-foreground">{selectedProductIds.size}개 선택</span>
              <button
                className="ml-auto text-xs px-3 py-1.5 rounded bg-success/20 text-success font-medium hover:bg-success/30 transition-colors disabled:opacity-60"
                onClick={() => handleBulkStatusChange(true)}
                disabled={bulkUpdating}
              >
                판매중
              </button>
              <button
                className="text-xs px-3 py-1.5 rounded bg-danger-500/20 text-danger-500 font-medium hover:bg-danger-500/30 transition-colors disabled:opacity-60"
                onClick={() => handleBulkStatusChange(false)}
                disabled={bulkUpdating}
              >
                숨김
              </button>
              <button
                className="text-xs px-3 py-1.5 rounded bg-bg-tertiary text-text-secondary font-medium hover:bg-bg-secondary transition-colors"
                onClick={() => setSelectedProductIds(new Set())}
                disabled={bulkUpdating}
              >
                선택 해제
              </button>
            </div>
          )}

          <div className="border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[760px]">
                <thead className="bg-bg-tertiary">
                  <tr>
                    {canManageProducts && (
                      <th className="w-10 py-3 px-3.5 text-left">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={() => {
                            if (allSelected) {
                              setSelectedProductIds(new Set());
                            } else {
                              setSelectedProductIds(new Set(filteredProducts.map((p) => p.id)));
                            }
                          }}
                          className="w-4 h-4 rounded accent-primary"
                        />
                      </th>
                    )}
                    <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">상품</th>
                    <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">가격</th>
                    <th className="text-right py-3 px-3.5 text-xs font-bold text-text-secondary">재고</th>
                    <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">상태</th>
                    <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">등록일</th>
                    <th className="text-center py-3 px-3.5 text-xs font-bold text-text-secondary">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const active = isProductActive(product);
                    const categoryName =
                      productCategories.find((cat) => cat.id === product.category_id)?.name ?? "미분류";

                    return (
                      <tr key={product.id} className="border-t border-border">
                        {canManageProducts && (
                          <td className="py-3 px-3.5">
                            <input
                              type="checkbox"
                              checked={selectedProductIds.has(product.id)}
                              onChange={() => {
                                setSelectedProductIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(product.id)) next.delete(product.id);
                                  else next.add(product.id);
                                  return next;
                                });
                              }}
                              className="w-4 h-4 rounded accent-primary"
                            />
                          </td>
                        )}
                        <td className="py-3 px-3.5 text-[13px] text-foreground">
                          <div className="flex items-center gap-3">
                            {product.image_url ? (
                              <Image
                                src={product.image_url}
                                alt={product.name}
                                width={40}
                                height={40}
                                className="w-10 h-10 rounded object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded bg-bg-tertiary flex items-center justify-center text-text-tertiary text-xs flex-shrink-0">
                                NO
                              </div>
                            )}
                            <div className="min-w-0">
                              <Link
                                href={`/customer/products/${product.id}`}
                                className="text-foreground no-underline hover:text-primary-500 transition-colors font-semibold truncate block"
                              >
                                {product.name}
                              </Link>
                              <div className="text-2xs text-text-tertiary">{categoryName}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-[13px] text-foreground text-right whitespace-nowrap">
                          {formatWon(product.base_price ?? product.price ?? 0)}
                        </td>
                        <td className="py-3 px-3.5 text-[13px] text-right">
                          {editingInventoryId === product.id ? (
                            <div className="flex justify-end items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                value={editingInventoryQty}
                                onChange={(e) => setEditingInventoryQty(e.target.value)}
                                className="input-field h-8 w-20 text-right"
                              />
                              <button
                                onClick={() => handleSaveInventory(product.id)}
                                disabled={inventorySaving}
                                className="h-8 px-2 text-xs rounded border border-border bg-bg-secondary hover:bg-bg-tertiary transition-colors"
                              >
                                저장
                              </button>
                              <button
                                onClick={() => {
                                  setEditingInventoryId(null);
                                  setEditingInventoryQty("");
                                }}
                                className="h-8 px-2 text-xs rounded border border-border bg-bg-secondary hover:bg-bg-tertiary transition-colors"
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleStartInventoryEdit(product.id, inventoryMap[product.id])}
                              disabled={!canManageProducts}
                              className={`font-semibold ${
                                canManageProducts
                                  ? "cursor-pointer hover:text-primary-500 transition-colors"
                                  : "cursor-default"
                              } ${
                                (inventoryMap[product.id] ?? 0) <= 0
                                  ? "text-danger-500"
                                  : "text-foreground"
                              }`}
                            >
                              {inventoryMap[product.id] ?? "-"}
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-[13px]">
                          <span
                            className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold ${
                              active
                                ? "bg-success/20 text-success"
                                : "bg-neutral-500/20 text-text-secondary"
                            }`}
                          >
                            {active ? "판매중" : "숨김"}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-[13px] text-text-secondary whitespace-nowrap">
                          {formatDate(product.created_at)}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <Link href={`/customer/products/${product.id}`} className="no-underline">
                            <button className="py-1 px-2.5 rounded-md border border-border bg-transparent text-foreground font-medium cursor-pointer text-xs hover:bg-bg-tertiary transition-colors">
                              보기
                            </button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
