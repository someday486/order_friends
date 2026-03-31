'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { ChevronDown, ChevronRight, Copy, Search, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';

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

type RecentVisit = {
  branchId: string;
  branchName: string;
  brandName: string;
  url: string;
  visitedAt: string;
};

const RECENT_VISITS_KEY = 'customer-order-recent-visits';
const MAX_RECENT_VISITS = 3;

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

function getBrandShopUrl(brandSlug: string | null) {
  if (!brandSlug) return null;
  return `/shop/${encodeURIComponent(brandSlug)}`;
}

export default function CustomerOrderLauncherPage() {
  const [sections, setSections] = useState<BrandSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [hideEmptyBrands, setHideEmptyBrands] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openBrands, setOpenBrands] = useState<Record<string, boolean>>({});
  const [recentVisits, setRecentVisits] = useState<RecentVisit[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setProgress({ done: 0, total: 2 });

      const [brands, branches] = await Promise.all([
        apiClient.get<Brand[]>('/customer/brands'),
        apiClient.get<Branch[]>('/customer/branches').catch(() => []),
      ]);

      const sortedBrands = brands.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
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
      setError(e instanceof Error ? e.message : '주문 페이지 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = window.localStorage.getItem(RECENT_VISITS_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored) as RecentVisit[];
      if (!Array.isArray(parsed)) return;

      setRecentVisits(
        parsed.filter(
          (item) =>
            item &&
            typeof item.branchId === 'string' &&
            typeof item.branchName === 'string' &&
            typeof item.brandName === 'string' &&
            typeof item.url === 'string' &&
            typeof item.visitedAt === 'string',
        ),
      );
    } catch (e) {
      console.error(e);
    }
  }, []);

  const toggleBrand = (brandId: string) => {
    setOpenBrands((prev) => ({ ...prev, [brandId]: !prev[brandId] }));
  };

  const handleRecentVisit = (visit: Omit<RecentVisit, 'visitedAt'>) => {
    if (typeof window === 'undefined') return;

    const nextVisit: RecentVisit = {
      ...visit,
      visitedAt: new Date().toISOString(),
    };

    const nextVisits = [
      nextVisit,
      ...recentVisits.filter((item) => item.branchId !== visit.branchId),
    ].slice(0, MAX_RECENT_VISITS);

    setRecentVisits(nextVisits);

    try {
      window.localStorage.setItem(RECENT_VISITS_KEY, JSON.stringify(nextVisits));
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('주문 링크를 복사했습니다.');
    } catch (e) {
      console.error(e);
      toast.error('링크 복사에 실패했습니다.');
    }
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
      result = result.filter(
        (section) =>
          section.branches.length > 0 || getBrandShopUrl(section.brand.slug),
      );
    }

    return result;
  }, [sections, searchQuery, hideEmptyBrands]);

  const showContent = !loading && !error;

  return (
    <div>
      {loading && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-border bg-bg-tertiary/40 p-3 text-sm text-text-secondary">
          <svg
            className="h-4 w-4 animate-spin text-text-tertiary"
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
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-danger-500 bg-danger-500/10 p-3 text-sm text-danger-500">
          <span>{error}</span>
          <button
            onClick={() => void load()}
            className="flex-shrink-0 rounded border border-danger-500/30 bg-danger-500/20 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-danger-500/30"
          >
            다시 시도
          </button>
        </div>
      )}

      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-foreground">주문 페이지 바로가기</h1>
          <p className="mt-2 text-text-secondary">
            원하는 브랜드와 매장을 선택해 주문 페이지로 바로 이동하세요.
          </p>
        </div>
      </div>

      {showContent && sections.length > 0 && (
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-[420px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
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
                className="absolute right-2 top-1/2 rounded p-1 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-secondary"
                aria-label="검색 초기화"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={hideEmptyBrands}
              onChange={(e) => setHideEmptyBrands(e.target.checked)}
              className="h-4 w-4 rounded accent-primary"
            />
            매장 없는 브랜드 숨기기
          </label>
        </div>
      )}

      {showContent && recentVisits.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-bg-secondary/60 px-3 py-2">
          <span className="text-xs font-semibold text-text-tertiary">최근 방문</span>
          {recentVisits.map((visit) => (
            <Link
              key={visit.branchId}
              href={visit.url}
              target="_blank"
              rel="noreferrer"
              prefetch={false}
              className="min-w-0 max-w-[180px] rounded-full border border-border bg-background px-3 py-1.5 no-underline transition-colors hover:bg-bg-tertiary"
            >
              <span className="truncate text-sm font-medium text-foreground">
                {visit.branchName}
              </span>
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              setRecentVisits([]);
              if (typeof window !== 'undefined') {
                window.localStorage.removeItem(RECENT_VISITS_KEY);
              }
            }}
            className="ml-auto text-xs font-medium text-text-secondary transition-colors hover:text-foreground"
          >
            전체 삭제
          </button>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-bg-secondary p-4"
            >
              <Skeleton className="mb-3 h-5 w-40" />
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
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
            {searchQuery ? '검색 결과가 없습니다.' : '표시할 브랜드가 없습니다.'}
          </div>
        </div>
      )}

      {showContent && filteredSections.length > 0 && (
        <div className="space-y-4">
          {filteredSections.map((section) => (
            <div
              key={section.brand.id}
              className="overflow-hidden rounded-md border border-border bg-bg-secondary"
            >
              <div className="flex items-center justify-between gap-3 bg-bg-tertiary/60 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 text-left min-w-0">
                    <span className="truncate font-bold text-foreground">
                      {section.brand.name}
                    </span>
                    <span className="flex-shrink-0 rounded border border-border bg-bg-tertiary px-2 py-0.5 text-xs text-text-secondary">
                      지점 {section.branches.length}개
                    </span>
                  </div>
                  {section.brand.slug && (
                    <div className="mt-1 text-xs text-text-tertiary">
                      온라인샵: {getBrandShopUrl(section.brand.slug)}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => toggleBrand(section.brand.id)}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-border bg-background text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-foreground"
                  aria-label={openBrands[section.brand.id] ? '브랜드 접기' : '브랜드 펼치기'}
                >
                  {openBrands[section.brand.id] ? (
                    <ChevronDown size={16} className="text-current" />
                  ) : (
                    <ChevronRight size={16} className="text-current" />
                  )}
                </button>
              </div>

              {openBrands[section.brand.id] && (
                <div className="p-3 transition-all duration-200">
                  {section.branches.length === 0 &&
                  !getBrandShopUrl(section.brand.slug) ? (
                    <div className="py-3 text-center text-sm text-text-tertiary">
                      등록된 지점이 없습니다.
                    </div>
                  ) : (
                    <>
                      {getBrandShopUrl(section.brand.slug) && (
                        <div className="mb-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                          <Link
                            href={getBrandShopUrl(section.brand.slug)!}
                            target="_blank"
                            rel="noreferrer"
                            prefetch={false}
                            className="block rounded-md border border-primary-200 bg-primary-50/60 p-3 no-underline transition-all duration-200 hover:-translate-y-[1px] hover:bg-primary-50 hover:shadow-sm dark:border-primary-900/40 dark:bg-primary-950/20"
                          >
                            <div className="text-sm font-semibold text-foreground">
                              온라인샵
                            </div>
                            <div className="mt-1 text-xs text-text-secondary">
                              브랜드 단위 주문 링크
                            </div>
                            <div className="mt-2 truncate text-xs text-text-tertiary">
                              {getBrandShopUrl(section.brand.slug)}
                            </div>
                          </Link>
                        </div>
                      )}

                      <div className="mb-3 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-text-tertiary">
                          바로 열기
                        </span>
                        {section.branches.slice(0, 2).map((branch) => {
                          const quickUrl = getBranchOrderUrl(
                            section.brand.slug,
                            branch.slug,
                            branch.id,
                          );

                          return (
                            <Link
                              key={branch.id}
                              href={quickUrl}
                              target="_blank"
                              rel="noreferrer"
                              prefetch={false}
                              onClick={() =>
                                handleRecentVisit({
                                  branchId: branch.id,
                                  branchName: branch.name,
                                  brandName: section.brand.name,
                                  url: quickUrl,
                                })
                              }
                              className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-text-secondary no-underline transition-colors hover:bg-bg-tertiary hover:text-foreground"
                            >
                              {branch.name}
                            </Link>
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
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
                              onClick={() =>
                                handleRecentVisit({
                                  branchId: branch.id,
                                  branchName: branch.name,
                                  brandName: section.brand.name,
                                  url,
                                })
                              }
                              className="block rounded-md border border-border bg-background p-3 no-underline transition-all duration-200 hover:-translate-y-[1px] hover:bg-bg-tertiary/50 hover:shadow-sm"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-foreground">
                                    {branch.name}
                                  </div>
                                  <div className="mt-1 truncate text-xs text-text-tertiary">
                                    {url}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    void handleCopyLink(url);
                                  }}
                                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-border bg-bg-secondary text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-foreground"
                                  aria-label="주문 링크 복사"
                                  title="주문 링크 복사"
                                >
                                  <Copy size={14} />
                                </button>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showContent && searchQuery && filteredSections.length > 0 && (
        <div className="mt-3 text-center text-xs text-text-tertiary">
          {filteredSections.length}개 브랜드, 총{' '}
          {filteredSections.reduce((sum, section) => sum + section.branches.length, 0)}
          개 지점
        </div>
      )}
    </div>
  );
}
