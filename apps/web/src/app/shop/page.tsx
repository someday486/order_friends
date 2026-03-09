"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";

type PublicBrandItem = {
  id: string;
  name: string;
  slug?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  branchCount: number;
  orderPath: string;
};

function getBrandShopPath(brand: PublicBrandItem): string {
  if (brand.slug) {
    return `/shop/${encodeURIComponent(brand.slug)}`;
  }
  return "";
}

function BrandCardSkeleton() {
  return (
    <div className="h-52 rounded-2xl border border-border bg-bg-secondary animate-pulse" />
  );
}

export default function ShopPage() {
  const [brands, setBrands] = useState<PublicBrandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const loadBrands = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiClient.get<PublicBrandItem[]>("/public/brands", {
          auth: false,
        });
        setBrands(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "브랜드 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void loadBrands();
  }, []);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return brands;
    return brands.filter((brand) => brand.name.toLowerCase().includes(keyword));
  }, [brands, query]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-6">
          <div className="inline-flex items-center rounded-full border border-border bg-bg-secondary px-3 py-1 text-xs text-text-secondary">
            ONLINE SHOP
          </div>
          <h1 className="mt-3 text-2xl md:text-3xl font-extrabold">브랜드 온라인샵</h1>
          <p className="mt-2 text-sm text-text-secondary">
            브랜드를 선택하고 배송 주문을 시작하세요.
          </p>
        </header>

        <div className="mb-6">
          <div className="relative max-w-md">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="브랜드 검색"
              className="input-field h-11 w-full pl-9"
              aria-label="브랜드 검색"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <BrandCardSkeleton key={idx} />
            ))}
          </div>
        ) : error ? (
          <div className="card p-5 text-sm text-danger-500">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="text-3xl mb-3">🔍</div>
            <p className="text-text-secondary text-sm">검색 결과가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((brand) => {
              const shopPath = getBrandShopPath(brand);
              const card = (
                <article
                  className={`group overflow-hidden rounded-2xl border border-border bg-bg-secondary transition-all duration-200 ${
                    shopPath
                      ? "hover:border-primary-400 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
                      : "opacity-60 cursor-not-allowed"
                  }`}
                >
                  <div className="relative h-32 bg-bg-tertiary">
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
                      <div className="absolute inset-0 bg-gradient-to-br from-primary-600/20 via-primary-400/10 to-bg-tertiary" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <span className="absolute right-2 top-2 rounded-lg bg-black/60 px-2 py-1 text-[11px] text-white backdrop-blur-sm">
                      지점 {brand.branchCount}개
                    </span>
                    {shopPath && (
                      <span className="absolute left-2 bottom-2 rounded-lg bg-primary-500/90 px-2 py-0.5 text-[11px] text-white font-semibold backdrop-blur-sm">
                        온라인 배송 주문
                      </span>
                    )}
                  </div>
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {brand.logoUrl ? (
                        <Image
                          src={brand.logoUrl}
                          alt={brand.name}
                          width={40}
                          height={40}
                          className="h-10 w-10 flex-shrink-0 rounded-full border border-border object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="h-10 w-10 flex-shrink-0 rounded-full border border-border bg-bg-tertiary flex items-center justify-center text-sm font-bold">
                          {brand.name.slice(0, 1)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-bold">{brand.name}</h2>
                        <p className="text-xs text-text-tertiary mt-0.5">
                          {shopPath ? "온라인 배송 주문 가능" : "온라인샵 준비 중"}
                        </p>
                      </div>
                    </div>
                    {shopPath && (
                      <svg
                        className="flex-shrink-0 text-primary-500 transition-transform group-hover:translate-x-0.5"
                        width="18"
                        height="18"
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
