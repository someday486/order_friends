"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { HelpCircle, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api-client";
import { useSelectedBrand } from "@/hooks/useSelectedBrand";
import { useSelectedBranch } from "@/hooks/useSelectedBranch";
import { getAdminBrands, getAdminBranches } from "@/lib/adminDataCache";

type Product = {
  id: string;
  name: string;
  description?: string | null;
  categoryId?: string | null;
  price: number;
  isActive: boolean;
  createdAt: string;
};

type Brand = {
  id: string;
  name: string;
  slug?: string | null;
};

type Branch = {
  id: string;
  brandId: string;
  name: string;
  slug?: string | null;
  createdAt: string;
};

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

const ALL_BRANCHES_VALUE = "__ALL_BRANCHES__";

function formatWon(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}

function ProductsPageContent() {
  const { brandId, ready: brandReady, selectBrand, clearBrand } = useSelectedBrand();
  const { branchId, ready: branchReady, selectBranch, clearBranch } = useSelectedBranch();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const selectedBranchValue = branchId ?? "";

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        setLoadingBrands(true);
        setError(null);
        const data = await getAdminBrands();
        setBrands(data);
      } catch (e: unknown) {
        const err = e as Error;
        setError(err?.message ?? "브랜드 목록을 불러오지 못했습니다.");
      } finally {
        setLoadingBrands(false);
      }
    };

    void fetchBrands();
  }, []);

  useEffect(() => {
    if (!brandReady || !branchReady) return;

    if (!brandId) {
      clearBranch();
      setBranches([]);
      setProducts([]);
      setLoadingBranches(false);
      setLoadingProducts(false);
      return;
    }

    const fetchBranches = async () => {
      try {
        setLoadingBranches(true);
        setError(null);
        const data = await getAdminBranches(brandId);
        setBranches(data);

        if (
          branchId &&
          branchId !== ALL_BRANCHES_VALUE &&
          !data.some((branch) => branch.id === branchId)
        ) {
          clearBranch();
        }
      } catch (e: unknown) {
        const err = e as Error;
        setError(err?.message ?? "스토어 목록을 불러오지 못했습니다.");
        setBranches([]);
        setProducts([]);
      } finally {
        setLoadingBranches(false);
      }
    };

    void fetchBranches();
  }, [brandId, brandReady, branchId, branchReady, clearBranch]);

  useEffect(() => {
    if (!brandReady || !branchReady) return;

    if (!brandId || !branchId) {
      setProducts([]);
      setLoadingProducts(false);
      return;
    }

    const fetchProducts = async () => {
      try {
        setLoadingProducts(true);
        setError(null);

        if (branchId === ALL_BRANCHES_VALUE) {
          const perBranchRows = await Promise.all(
            branches.map((branch) =>
              apiClient.get<Product[]>(
                `/admin/products?branchId=${encodeURIComponent(branch.id)}`,
              ),
            ),
          );

          setProducts(perBranchRows.flat());
          return;
        }

        const productRows = await apiClient.get<Product[]>(
          `/admin/products?branchId=${encodeURIComponent(branchId)}`,
        );
        setProducts(productRows);
      } catch (e: unknown) {
        const err = e as Error;
        setError(err?.message ?? "상품 정보를 불러오지 못했습니다.");
        setProducts([]);
      } finally {
        setLoadingProducts(false);
      }
    };

    void fetchProducts();
  }, [brandId, branchId, brandReady, branchReady, branches]);

  const handleDelete = async (productId: string, productName: string) => {
    if (!confirm(`"${productName}" 상품을 삭제하시겠습니까?`)) return;

    try {
      await apiClient.delete(`/admin/products/${productId}`);
      setProducts((prev) => prev.filter((product) => product.id !== productId));
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err?.message ?? "상품 삭제에 실패했습니다.");
    }
  };

  const handleToggleActive = async (product: Product) => {
    try {
      await apiClient.patch(`/admin/products/${product.id}`, {
        isActive: !product.isActive,
      });

      setProducts((prev) =>
        prev.map((item) =>
          item.id === product.id ? { ...item, isActive: !item.isActive } : item,
        ),
      );
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err?.message ?? "상품 상태 변경에 실패했습니다.");
    }
  };

  const filteredProducts = useMemo(() => {
    const query = searchInput.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !query ||
        [product.name, product.description ?? ""].some((value) =>
          value.toLowerCase().includes(query),
        );

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" ? product.isActive : !product.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [products, searchInput, statusFilter]);

  const activeCount = products.filter((product) => product.isActive).length;
  const inactiveCount = products.length - activeCount;
  const newProductHref =
    branchId && branchId !== ALL_BRANCHES_VALUE
      ? `/admin/products/new?branchId=${encodeURIComponent(branchId)}`
      : "/admin/products/new";

  if (!brandReady || !branchReady) return null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="m-0 text-[22px] font-extrabold text-foreground">상품관리</h1>
            <div className="group relative cursor-pointer" tabIndex={0}>
              <HelpCircle
                size={16}
                className="text-text-secondary transition-colors hover:text-foreground"
                aria-label="상품 조회조건 도움말"
              />
              <div className="pointer-events-none absolute left-6 top-1/2 z-50 w-72 -translate-y-1/2 rounded-md border border-border bg-bg-tertiary p-3 text-xs text-text-secondary opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                브랜드를 먼저 고른 뒤 특정 스토어 또는 전체 스토어를 선택하고, 상태와 검색어로
                원하는 상품만 빠르게 찾을 수 있습니다.
              </div>
            </div>
          </div>
          <p className="mt-1 text-[13px] text-text-secondary">
            표시 {filteredProducts.length}개 / 전체 {products.length}개 · 판매중 {activeCount}
            개 · 숨김 {inactiveCount}개
          </p>
        </div>

        <Link href={newProductHref} className="no-underline">
          <button className="btn-primary h-9 px-4 text-[13px]">+ 상품 등록</button>
        </Link>
      </div>

      <div className="mb-4 rounded-xl border border-border bg-bg-secondary p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(220px,260px)_minmax(220px,260px)_140px_minmax(260px,1fr)]">
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-semibold text-text-secondary">브랜드</label>
            <select
              value={brandId ?? ""}
              onChange={(event) => {
                const nextBrandId = event.target.value;

                clearBranch();
                setProducts([]);

                if (!nextBrandId) {
                  clearBrand();
                  setBranches([]);
                  return;
                }

                selectBrand(nextBrandId);
              }}
              className="input-field h-9 w-full text-sm"
              disabled={loadingBrands}
            >
              <option value="">브랜드를 선택하세요</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label className="mb-2 block text-sm font-semibold text-text-secondary">스토어</label>
            <select
              value={selectedBranchValue}
              onChange={(event) => selectBranch(event.target.value)}
              className="input-field h-9 w-full text-sm"
              disabled={!brandId || loadingBranches}
            >
              <option value="">
                {brandId ? "스토어를 선택하세요" : "먼저 브랜드를 선택하세요"}
              </option>
              <option value={ALL_BRANCHES_VALUE}>전체</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0 lg:max-w-[140px]">
            <label className="mb-2 block text-sm font-semibold text-text-secondary">상태</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="input-field h-9 w-full text-sm"
            >
              <option value="ALL">전체</option>
              <option value="ACTIVE">판매중</option>
              <option value="INACTIVE">숨김</option>
            </select>
          </div>

          <div className="min-w-0">
            <label className="mb-2 block text-sm font-semibold text-text-secondary">검색</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setSearchInput("");
                  }
                }}
                placeholder="상품명/설명 검색"
                aria-label="상품 검색"
                className="input-field h-9 w-full pl-10 pr-10 text-sm focus:ring-1 focus:ring-primary-500"
                disabled={!brandId || !branchId}
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary transition-colors hover:text-foreground"
                  aria-label="검색어 지우기"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-danger-500 bg-danger-500/10 p-3 text-danger-500">
          {error}
        </div>
      )}

      {!brandId && (
        <p className="mb-4 text-text-tertiary">브랜드를 선택하면 스토어와 상품 목록이 표시됩니다.</p>
      )}

      {brandId && !branchId && (
        <p className="mb-4 text-text-tertiary">스토어를 선택하면 상품 목록이 표시됩니다.</p>
      )}

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse">
            <thead className="bg-bg-tertiary">
              <tr>
                <th className="px-3.5 py-3 text-left text-xs font-bold text-text-secondary">
                  상품명
                </th>
                <th className="px-3.5 py-3 text-right text-xs font-bold text-text-secondary">
                  가격
                </th>
                <th className="px-3.5 py-3 text-left text-xs font-bold text-text-secondary">
                  상태
                </th>
                <th className="px-3.5 py-3 text-center text-xs font-bold text-text-secondary">
                  관리
                </th>
              </tr>
            </thead>
            <tbody>
              {loadingProducts && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3.5 py-3 text-center text-[13px] text-text-tertiary"
                  >
                    불러오는 중...
                  </td>
                </tr>
              )}

              {!loadingProducts && brandId && branchId && filteredProducts.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3.5 py-3 text-center text-[13px] text-text-tertiary"
                  >
                    {searchInput.trim() || statusFilter !== "ALL"
                      ? "조건에 맞는 상품이 없습니다."
                      : "상품이 없습니다."}
                  </td>
                </tr>
              )}

              {!loadingProducts &&
                filteredProducts.map((product) => (
                  <tr key={product.id} className="border-t border-border">
                    <td className="px-3.5 py-3 text-[13px] text-foreground">
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="text-foreground no-underline transition-colors hover:text-primary-500"
                      >
                        {product.name}
                      </Link>
                      {product.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-text-secondary">
                          {product.description}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3.5 py-3 text-right text-[13px] text-foreground">
                      {formatWon(product.price)}
                    </td>
                    <td className="px-3.5 py-3 text-[13px]">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(product)}
                        className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ${
                          product.isActive
                            ? "bg-success/20 text-success"
                            : "bg-neutral-500/20 text-text-secondary"
                        }`}
                      >
                        {product.isActive ? "판매중" : "숨김"}
                      </button>
                    </td>
                    <td className="px-3.5 py-3 text-center text-[13px]">
                      <Link href={`/admin/products/${product.id}`}>
                        <button
                          type="button"
                          className="rounded-md border border-border bg-transparent px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-bg-tertiary"
                        >
                          수정
                        </button>
                      </Link>
                      <button
                        type="button"
                        className="ml-1.5 rounded-md border border-border bg-transparent px-2.5 py-1 text-xs font-medium text-danger-500 transition-colors hover:bg-bg-tertiary"
                        onClick={() => handleDelete(product.id, product.name)}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="text-muted">로딩 중...</div>}>
      <ProductsPageContent />
    </Suspense>
  );
}
