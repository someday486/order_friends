'use client';

import { PublicAuthActions } from '@/components/auth/PublicAuthActions';
import { apiClient } from '@/lib/api-client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

export type PublicBrandItem = {
  id: string;
  name: string;
  slug?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  branchCount: number;
  orderPath: string;
};

type ShopPageClientProps = {
  initialBrands: PublicBrandItem[] | null;
};

function getBrandShopPath(brand: PublicBrandItem): string {
  if (brand.slug) {
    return `/shop/${encodeURIComponent(brand.slug)}`;
  }
  return '';
}

function BrandCardSkeleton() {
  return (
    <div className="h-52 animate-pulse rounded-2xl border border-border bg-bg-secondary" />
  );
}

export default function ShopPageClient({
  initialBrands,
}: ShopPageClientProps) {
  const [brands, setBrands] = useState<PublicBrandItem[]>(initialBrands ?? []);
  const [loading, setLoading] = useState(initialBrands === null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (initialBrands !== null) {
      setBrands(initialBrands);
      setLoading(false);
      return;
    }

    const loadBrands = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiClient.get<PublicBrandItem[]>('/public/brands', {
          auth: false,
        });
        setBrands(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : '브랜드 목록을 불러오지 못했습니다.',
        );
      } finally {
        setLoading(false);
      }
    };

    void loadBrands();
  }, [initialBrands]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return brands;
    return brands.filter((brand) => brand.name.toLowerCase().includes(keyword));
  }, [brands, query]);

  const availableCount = filtered.length;
  const totalCount = brands.length;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f3ee_0%,#f3f0eb_28%,#f8f7f5_100%)] text-foreground">
      <div className="mx-auto max-w-[1180px] px-4 py-8 md:px-6 md:py-10">
        <section className="relative overflow-hidden rounded-[32px] border border-black/5 bg-white/90 shadow-[0_32px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(248,113,113,0.12),transparent_26%)]" />
          <div className="relative grid gap-8 px-6 py-8 md:px-8 md:py-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
            <div className="max-w-2xl">
              <div className="inline-flex items-center rounded-full border border-black/10 bg-white/80 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-text-secondary">
                ONLINE SHOP
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground md:text-5xl">
                브랜드 온라인샵
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-text-secondary md:text-base">
                공연 굿즈, 한정 상품, 배송 주문을 한 화면에서 차분하게 고를 수
                있게 정리했습니다. 브랜드를 고르고 바로 주문을 시작해보세요.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <div className="rounded-full border border-black/10 bg-white/85 px-4 py-2 text-xs font-medium text-text-secondary">
                  주문 가능한 브랜드 <span className="font-semibold text-foreground">{totalCount}개</span>
                </div>
                <div className="rounded-full border border-black/10 bg-white/85 px-4 py-2 text-xs font-medium text-text-secondary">
                  배송 주문 전용
                </div>
                <div className="rounded-full border border-black/10 bg-white/85 px-4 py-2 text-xs font-medium text-text-secondary">
                  로그인 시 주문 정보 자동 입력
                </div>
              </div>

              <div className="mt-6 max-w-xl">
                <label htmlFor="shop-brand-search" className="sr-only">
                  브랜드 검색
                </label>
                <div className="relative">
                  <svg
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    id="shop-brand-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="찾고 싶은 브랜드를 검색해보세요"
                    className="input-field h-14 w-full rounded-2xl border-black/10 bg-white/95 pl-11 text-sm shadow-sm"
                    aria-label="브랜드 검색"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-black/8 bg-[#171717] p-5 text-white shadow-[0_24px_60px_rgba(23,23,23,0.18)]">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/65">
                Quick Access
              </div>
              <p className="mt-3 text-sm leading-6 text-white/80">
                카카오로 빠르게 로그인하고, 최근 주문 정보를 이어서 확인할 수
                있어요.
              </p>
              <div className="mt-5">
                <PublicAuthActions />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground md:text-xl">
                주문 가능한 브랜드
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                브랜드별 온라인 배송 주문 페이지로 바로 이동할 수 있습니다.
              </p>
            </div>
            <div className="text-sm text-text-secondary">
              현재 <span className="font-semibold text-foreground">{availableCount}개</span> 브랜드가 보이고 있어요.
            </div>
          </div>
        </section>

        {loading ? (
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <BrandCardSkeleton key={idx} />
            ))}
          </div>
        ) : error ? (
          <div className="mt-5 rounded-[28px] border border-danger-200 bg-white p-6 text-sm text-danger-500 shadow-sm">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-5 rounded-[28px] border border-black/8 bg-white p-12 text-center shadow-sm">
            <div className="mb-3 text-3xl">🔎</div>
            <p className="text-sm text-text-secondary">
              검색 결과가 없습니다.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((brand) => {
              const shopPath = getBrandShopPath(brand);
              const card = (
                <article
                  className={`group overflow-hidden rounded-[28px] border border-black/8 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.07)] transition-all duration-300 ${
                    shopPath
                      ? 'cursor-pointer hover:-translate-y-1 hover:border-black/12 hover:shadow-[0_28px_70px_rgba(15,23,42,0.12)]'
                      : 'cursor-not-allowed opacity-60'
                  }`}
                >
                  <div className="relative h-44 bg-[#f6efe8]">
                    {brand.coverImageUrl ? (
                      <Image
                        src={brand.coverImageUrl}
                        alt={brand.name}
                        fill
                        sizes="(max-width: 1024px) 100vw, 33vw"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(250,204,21,0.18),rgba(244,114,182,0.12),rgba(255,255,255,0.9))]" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
                    <span className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                      지점 {brand.branchCount}개
                    </span>
                    {shopPath && (
                      <span className="absolute bottom-3 left-3 rounded-full bg-white/92 px-3 py-1 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur-sm">
                        온라인 배송 주문
                      </span>
                    )}
                  </div>
                  <div className="flex items-start justify-between gap-4 p-5">
                    <div className="flex min-w-0 items-start gap-3">
                      {brand.logoUrl ? (
                        <Image
                          src={brand.logoUrl}
                          alt={brand.name}
                          width={48}
                          height={48}
                          className="h-12 w-12 flex-shrink-0 rounded-full border border-black/10 object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-black/10 bg-[#f6f1eb] text-sm font-bold">
                          {brand.name.slice(0, 1)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-bold tracking-tight">
                          {brand.name}
                        </h2>
                        <p className="mt-1 text-sm text-text-secondary">
                          {shopPath
                            ? '온라인 배송 주문이 열려 있습니다.'
                            : '온라인샵 준비 중'}
                        </p>
                      </div>
                    </div>
                    {shopPath && (
                      <svg
                        className="mt-1 flex-shrink-0 text-primary-500 transition-transform duration-300 group-hover:translate-x-1"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    )}
                  </div>
                </article>
              );

              if (!shopPath) {
                return <div key={brand.id}>{card}</div>;
              }

              return (
                <Link key={brand.id} href={shopPath} className="no-underline">
                  {card}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
