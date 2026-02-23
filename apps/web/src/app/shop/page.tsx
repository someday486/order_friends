"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { KakaoQuickLoginButton } from "@/components/auth/KakaoQuickLoginButton";

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
            SHOP
          </div>
          <h1 className="mt-3 text-2xl md:text-3xl font-extrabold">브랜드 온라인샵</h1>
          <p className="mt-2 text-sm text-text-secondary">
            브랜드를 선택하고 배송 주문을 시작하세요.
          </p>
          <KakaoQuickLoginButton className="mt-4 max-w-md" />
        </header>

        <div className="mb-6">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="브랜드 검색"
            className="input-field h-11 w-full max-w-md"
            aria-label="브랜드 검색"
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="h-48 rounded-xl border border-border bg-bg-secondary animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="card p-5 text-sm text-danger-500">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="card p-6 text-center text-text-secondary">
            검색 조건에 맞는 브랜드가 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((brand) => {
              const shopPath = getBrandShopPath(brand);
              const card = (
                <article
                  className={`overflow-hidden rounded-xl border border-border bg-bg-secondary transition-colors ${
                    shopPath
                      ? "hover:border-primary-400"
                      : "opacity-75 cursor-not-allowed"
                  }`}
                >
                  <div className="relative h-28 bg-bg-tertiary">
                    {brand.coverImageUrl ? (
                      <Image
                        src={brand.coverImageUrl}
                        alt={brand.name}
                        fill
                        sizes="(max-width: 1024px) 100vw, 33vw"
                        className="object-cover"
                        unoptimized
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                    <span className="absolute right-2 top-2 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white">
                      지점 {brand.branchCount}개
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      {brand.logoUrl ? (
                        <Image
                          src={brand.logoUrl}
                          alt={brand.name}
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded-full border border-border object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full border border-border bg-bg-tertiary flex items-center justify-center text-sm font-bold">
                          {brand.name.slice(0, 1)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-bold">{brand.name}</h2>
                        <p className="text-xs text-text-secondary truncate">
                          {shopPath || "브랜드 URL(slug) 설정 후 온라인샵 이용 가능"}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`mt-3 text-sm font-semibold ${
                        shopPath ? "text-primary-500" : "text-text-secondary"
                      }`}
                    >
                      {shopPath ? "온라인샵 입장" : "온라인샵 URL 설정 필요"}
                    </div>
                  </div>
                </article>
              );

              if (!shopPath) {
                return <div key={brand.id}>{card}</div>;
              }

              return (
                <Link key={brand.id} href={shopPath} className="group no-underline">
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
