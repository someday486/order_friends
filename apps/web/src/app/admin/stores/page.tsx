"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api-client";
import AddStoreModal from "./AddStoreModal";
import { useSelectedBrand } from "@/hooks/useSelectedBrand";
import { useSelectedBranch } from "@/hooks/useSelectedBranch";
import {
  getAdminBrands,
  getAdminBranches,
  invalidateAdminBranches,
  type AdminBrandSummary,
} from "@/lib/adminDataCache";

type Branch = {
  id: string;
  brandId: string;
  name: string;
  slug?: string | null;
  createdAt: string;
};

type Brand = AdminBrandSummary;

function formatDate(iso: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ko-KR");
}

function getBranchOrderUrl(
  brandSlug: string | null,
  branchSlug: string | null | undefined,
  branchId: string,
) {
  if (brandSlug && branchSlug) {
    return `/order/${encodeURIComponent(brandSlug)}/${encodeURIComponent(branchSlug)}`;
  }

  return `/order/branch/${branchId}`;
}

export default function StoresPage() {
  const { brandId, ready, selectBrand, clearBrand } = useSelectedBrand();
  const { selectBranch } = useSelectedBranch();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  const selectedBrand = useMemo(
    () => brands.find((item) => item.id === brandId) ?? null,
    [brands, brandId],
  );

  const filteredBranches = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    if (!query) return branches;

    return branches.filter((branch) =>
      [branch.name, branch.slug ?? "", branch.id].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [branches, searchInput]);

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
    const fetchBranches = async (selectedBrandId: string) => {
      try {
        setLoadingBranches(true);
        setError(null);
        const data = await getAdminBranches(selectedBrandId);
        setBranches(data);
      } catch (e: unknown) {
        const err = e as Error;
        setError(err?.message ?? "매장 목록을 불러오지 못했습니다.");
        setBranches([]);
      } finally {
        setLoadingBranches(false);
      }
    };

    if (!ready) return;

    if (!brandId) {
      setBranches([]);
      setLoadingBranches(false);
      return;
    }

    void fetchBranches(brandId);
  }, [brandId, ready]);

  const handleDelete = async (branchIdToDelete: string, branchName: string) => {
    if (
      !confirm(
        `"${branchName}" 매장을 삭제하시겠습니까?\n관련된 데이터가 모두 삭제되며 복구할 수 없습니다.`,
      )
    ) {
      return;
    }

    try {
      await apiClient.delete(`/admin/branches/${branchIdToDelete}`);
      invalidateAdminBranches(brandId);
      setBranches((prev) => prev.filter((branch) => branch.id !== branchIdToDelete));
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err?.message ?? "매장 삭제에 실패했습니다.");
    }
  };

  if (!ready) return null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-[22px] font-extrabold text-foreground">매장관리</h1>
          <p className="mt-1 text-[13px] text-text-secondary">
            {brandId
              ? `총 ${filteredBranches.length}개 / 전체 ${branches.length}개 매장`
              : "브랜드를 선택하면 매장 목록이 표시됩니다."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="h-9 rounded-lg border border-border bg-transparent px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-bg-tertiary disabled:opacity-50"
            onClick={() => clearBrand()}
            disabled={!brandId}
          >
            브랜드 선택 해제
          </button>
          <button
            type="button"
            className="btn-primary h-9 px-4 text-[13px] disabled:opacity-50"
            onClick={() => setShowAddForm(true)}
            disabled={!brandId}
          >
            + 매장 추가
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-border bg-bg-secondary p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="w-full lg:max-w-[280px]">
            <label className="mb-1.5 block text-xs font-semibold text-text-secondary">
              브랜드 선택
            </label>
            <select
              value={brandId ?? ""}
              onChange={(e) => {
                const nextBrandId = e.target.value;
                if (!nextBrandId) {
                  clearBrand();
                  return;
                }

                selectBrand(nextBrandId);
              }}
              className="input-field h-10 w-full text-sm"
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

          <div className="min-w-0 flex-1">
            <label className="mb-1.5 block text-xs font-semibold text-text-secondary">
              검색
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setSearchInput("");
                }}
                placeholder="매장명, 슬러그, ID 검색"
                aria-label="매장 검색"
                className="input-field h-10 w-full pl-10 pr-10 text-sm"
                disabled={!brandId}
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-foreground"
                  aria-label="검색어 지우기"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {selectedBrand ? (
          <div className="mt-3 text-xs font-semibold text-text-secondary">
            결제 운영 방식: {selectedBrand.billingTier === "NON_PG" ? "무통장 전용" : "PG 이용"}
          </div>
        ) : null}
        <div className="mt-3 text-xs text-text-secondary">
          {selectedBrand
            ? `현재 선택한 브랜드: ${selectedBrand.name}`
            : "브랜드를 먼저 선택하면 매장을 검색하고 관리할 수 있습니다."}
        </div>
      </div>

      {brandId && (
        <AddStoreModal
          key={showAddForm ? "store-modal-open" : "store-modal-closed"}
          open={showAddForm}
          brandId={brandId}
          billingTier={selectedBrand?.billingTier ?? "PG"}
          adding={adding}
          onClose={() => setShowAddForm(false)}
          onSubmit={async ({
            name,
            slug,
            enabledFulfillmentTypes,
            transferAccount,
            pickupTimeConfig,
            depositSheetName,
            depositSheetUrl,
            contactPhone,
            kakaoChannelUrl,
          }) => {
            if (!name.trim() || !slug.trim()) return;
            if (enabledFulfillmentTypes.length === 0) return;

            try {
              setAdding(true);

              const data = await apiClient.post<Branch>("/admin/branches", {
                brandId,
                name,
                slug,
                enabledFulfillmentTypes,
                transferAccount,
                pickupTimeConfig,
                depositSheetName: depositSheetName || null,
                depositSheetUrl: depositSheetUrl || null,
                contactPhone: contactPhone || null,
                kakaoChannelUrl: kakaoChannelUrl || null,
              });

              invalidateAdminBranches(brandId);
              setBranches((prev) => [data, ...prev]);
              setShowAddForm(false);
            } catch (e: unknown) {
              const err = e as Error;
              toast.error(err?.message ?? "매장 추가에 실패했습니다.");
            } finally {
              setAdding(false);
            }
          }}
        />
      )}

      {error && <p className="mb-4 text-danger-500">{error}</p>}

      {!brandId ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-text-tertiary">
          브랜드를 먼저 선택해주세요.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full border-collapse">
            <thead className="bg-bg-tertiary">
              <tr>
                <th className="px-3.5 py-3 text-left text-xs font-bold text-text-secondary">
                  매장명
                </th>
                <th className="px-3.5 py-3 text-left text-xs font-bold text-text-secondary">
                  매장 URL
                </th>
                <th className="px-3.5 py-3 text-left text-xs font-bold text-text-secondary">
                  생성일
                </th>
                <th className="px-3.5 py-3 text-center text-xs font-bold text-text-secondary">
                  관리
                </th>
              </tr>
            </thead>
            <tbody>
              {loadingBranches && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3.5 py-3 text-center text-[13px] text-text-tertiary"
                  >
                    불러오는 중...
                  </td>
                </tr>
              )}

              {!loadingBranches && filteredBranches.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3.5 py-3 text-center text-[13px] text-text-tertiary"
                  >
                    {searchInput.trim() ? "검색 결과가 없습니다." : "매장이 없습니다."}
                  </td>
                </tr>
              )}

              {!loadingBranches &&
                filteredBranches.map((branch) => (
                  <tr key={branch.id} className="border-t border-border">
                    <td className="px-3.5 py-3 text-[13px] text-foreground">
                      <Link
                        href={`/admin/stores/${branch.id}`}
                        className="text-foreground no-underline transition-colors hover:text-primary-500"
                        onClick={() => selectBranch(branch.id)}
                      >
                        {branch.name}
                      </Link>
                    </td>
                    <td className="px-3.5 py-3 text-xs text-text-secondary">
                      {getBranchOrderUrl(selectedBrand?.slug ?? null, branch.slug, branch.id)}
                    </td>
                    <td className="px-3.5 py-3 text-[13px] text-text-secondary">
                      {formatDate(branch.createdAt)}
                    </td>
                    <td className="px-3.5 py-3 text-center text-[13px]">
                      <Link
                        href={`/admin/stores/${branch.id}`}
                        onClick={() => selectBranch(branch.id)}
                      >
                        <button className="rounded-md border border-border bg-transparent px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-bg-tertiary">
                          수정
                        </button>
                      </Link>
                      <button
                        className="ml-1.5 rounded-md border border-border bg-transparent px-2.5 py-1 text-xs font-medium text-danger-500 transition-colors hover:bg-bg-tertiary"
                        onClick={() => handleDelete(branch.id, branch.name)}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
