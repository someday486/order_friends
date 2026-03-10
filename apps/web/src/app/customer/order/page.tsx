'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';

type Brand = {
  id: string;
  name: string;
  slug: string | null;
};

type Branch = {
  id: string;
  name: string;
  slug: string | null;
  brandId: string;
};

type BrandSection = { brand: Brand; branches: Branch[] };

function getBranchOrderUrl(
  brandSlug: string | null,
  branchSlug: string | null,
  branchId: string,
) {
  if (brandSlug && branchSlug) {
    return `/order/${encodeURIComponent(brandSlug)}/${encodeURIComponent(branchSlug)}`;
  }
  return `/order/branch/${branchId}`;
}

export default function CustomerOrderLauncherPage() {
  const [sections, setSections] = useState<BrandSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [hideEmptyBrands, setHideEmptyBrands] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openBrands, setOpenBrands] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setProgress({ done: 0, total: 2 });

      const [brands, branches] = await Promise.all([
        apiClient.get<Brand[]>('/customer/brands'),
        apiClient.get<Branch[]>('/customer/branches').catch(() => []),
      ]);

      const sortedBrands = brands.sort((a, b) =>
        a.name.localeCompare(b.name, 'ko'),
      );
      setProgress({ done: 1, total: 2 });

      const branchesByBrand: Record<string, Branch[]> = {};
      for (const branch of branches) {
        const current = branchesByBrand[branch.brandId] ?? [];
        current.push(branch);
        branchesByBrand[branch.brandId] = current;
      }

      for (const brandId of Object.keys(branchesByBrand)) {
        branchesByBrand[brandId] = branchesByBrand[brandId].sort((a, b) =>
          a.name.localeCompare(b.name, 'ko'),
        );
      }

      const result = sortedBrands.map((brand) => ({
        brand: { id: brand.id, name: brand.name, slug: brand.slug ?? null },
        branches: branchesByBrand[brand.id] ?? [],
      }));

      setSections(result);
      setProgress({ done: 2, total: 2 });

      setOpenBrands((prev) => {
        const next = { ...prev };
        for (const section of result) {
          if (next[section.brand.id] === undefined) {
            next[section.brand.id] = true;
          }
        }
        return next;
      });
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error
          ? e.message
          : '주문 페이지 정보를 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleBrand = (brandId: string) => {
    setOpenBrands((prev) => ({ ...prev, [brandId]: !prev[brandId] }));
  };

  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    let result: BrandSection[];

    if (!q) {
      result = sections;
    } else {
      result = sections
        .map((section) => {
          if (section.brand.name.toLowerCase().includes(q)) {
            return section;
          }

          const matchedBranches = section.branches.filter((branch) =>
            branch.name.toLowerCase().includes(q),
          );

          return { ...section, branches: matchedBranches };
        })
        .filter((section) => {
          if (section.brand.name.toLowerCase().includes(q)) {
            return true;
          }
          return section.branches.length > 0;
        });
    }

    if (hideEmptyBrands) {
      result = result.filter((section) => section.branches.length > 0);
    }

    return result;
  }, [sections, searchQuery, hideEmptyBrands]);

  const showContent = !loading && !error;

  return (
    <div>
      {loading && (
        <div className="mb-4 p-3 rounded-md bg-bg-tertiary/40 border border-border text-sm text-text-secondary flex items-center gap-2">
          <svg
            className="w-4 h-4 animate-spin text-text-tertiary"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          {progress.total > 0
            ? `목록을 불러오는 중 ${progress.done}/${progress.total}`
            : '불러오는 중입니다.'}
        </div>
      )}

      {!loading && error && (
        <div className="mb-4 p-3 rounded-md border border-danger-500 bg-danger-500/10 text-danger-500 text-sm flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            onClick={() => void load()}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded border border-danger-500/30 bg-danger-500/20 hover:bg-danger-500/30 transition-colors"
          >
            다시 시도
          </button>
        </div>
      )}

      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-foreground">
            브랜드 주문 선택
          </h1>
          <p className="text-text-secondary mt-2">
            원하는 브랜드와 매장을 선택해 주문 페이지로 이동하세요.
          </p>
        </div>
        {showContent && sections.length > 0 && (
          <div className="shrink-0 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-text-secondary select-none">
              <input
                type="checkbox"
                checked={hideEmptyBrands}
                onChange={(e) => setHideEmptyBrands(e.target.checked)}
                className="w-4 h-4 rounded accent-primary"
              />
              매장 없는 브랜드 숨기기
            </label>
          </div>
        )}
      </div>

      {showContent && sections.length > 0 && (
        <div className="mb-4 relative w-full max-w-[360px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="브랜드나 매장 검색"
            className="input-field w-full pl-9 pr-8"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-bg-tertiary text-text-tertiary hover:text-text-secondary transition-colors"
              aria-label="검색 초기화"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-bg-secondary p-4"
            >
              <Skeleton className="h-5 w-40 mb-3" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                <Skeleton className="h-16 rounded-md" />
                <Skeleton className="h-16 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      )}

      {showContent && sections.length === 0 && (
        <div className="card p-12 text-center text-text-tertiary">
          <div className="text-base">현재 등록된 매장이 없습니다.</div>
        </div>
      )}

      {showContent && sections.length > 0 && filteredSections.length === 0 && (
        <div className="card p-12 text-center text-text-tertiary">
          <div className="text-base">
            {searchQuery
              ? '검색 결과가 없습니다.'
              : '표시할 브랜드가 없습니다.'}
          </div>
        </div>
      )}

      {showContent && filteredSections.length > 0 && (
        <div className="space-y-4">
          {filteredSections.map((section) => (
            <div
              key={section.brand.id}
              className="rounded-md border border-border bg-bg-secondary overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleBrand(section.brand.id)}
                className="w-full px-4 py-3 bg-bg-tertiary/60 flex items-center justify-between cursor-pointer hover:bg-bg-tertiary/80 transition-colors"
              >
                <div className="flex items-center gap-3 text-left min-w-0">
                  <span className="font-bold text-foreground truncate">
                    {section.brand.name}
                  </span>
                  <span className="flex-shrink-0 text-xs bg-bg-tertiary border border-border px-2 py-0.5 rounded text-text-secondary">
                    지점 {section.branches.length}개
                  </span>
                </div>
                <div className="flex-shrink-0 ml-2">
                  {openBrands[section.brand.id] ? (
                    <ChevronDown size={16} className="text-text-secondary" />
                  ) : (
                    <ChevronRight size={16} className="text-text-secondary" />
                  )}
                </div>
              </button>

              {openBrands[section.brand.id] && (
                <div className="p-3 transition-all duration-200">
                  {section.branches.length === 0 ? (
                    <div className="text-text-tertiary text-sm py-3 text-center">
                      등록된 지점이 없습니다.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {section.branches.map((branch) => {
                        const url = getBranchOrderUrl(
                          section.brand.slug,
                          branch.slug,
                          branch.id,
                        );
                        return (
                          <Link
                            key={branch.id}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            prefetch={false}
                            className="block p-3 rounded-md border border-border bg-background no-underline transition-all duration-200 hover:bg-bg-tertiary/50 hover:-translate-y-[1px] hover:shadow-sm"
                          >
                            <div className="font-semibold text-sm text-foreground">
                              {branch.name}
                            </div>
                            <div className="text-xs text-text-tertiary mt-1 truncate">
                              {url}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showContent && searchQuery && filteredSections.length > 0 && (
        <div className="mt-3 text-xs text-text-tertiary text-center">
          {filteredSections.length}개 브랜드, 총{' '}
          {filteredSections.reduce(
            (sum, section) => sum + section.branches.length,
            0,
          )}
          개 지점
        </div>
      )}
    </div>
  );
}
