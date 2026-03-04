"use client";

import type React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";

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

type BrandSection = {
  brand: Brand;
  branches: Branch[];
};

type OrderLauncherProps = {
  title: string;
  description?: string;
  sections: BrandSection[];
  loading: boolean;
  error: string | null;
  isEmptyText: string;
  openInNewTab?: boolean;

  // ✅ 헤더 우측(같은 행) 슬롯
  headerRight?: React.ReactNode;
};

function getBranchOrderUrl(brandSlug: string | null, branchSlug: string | null, branchId: string) {
  if (brandSlug && branchSlug) {
    return `/order/${encodeURIComponent(brandSlug)}/${encodeURIComponent(branchSlug)}`;
  }
  return `/order/branch/${branchId}`;
}

function getBrandOrderPath(brandSlug: string | null) {
  if (!brandSlug) return null;
  return `/order/${encodeURIComponent(brandSlug)}`;
}

export default function OrderLauncher({
  title,
  description,
  sections,
  loading,
  error,
  isEmptyText,
  openInNewTab = false,
  headerRight,
}: OrderLauncherProps) {
  // ✅ 훅은 항상 컴포넌트 최상단에서 호출
  const [openBrands, setOpenBrands] = useState<Record<string, boolean>>({});

  // ✅ sections 바뀔 때: 기존 상태 유지 + 새 브랜드만 true로 추가
  useEffect(() => {
    setOpenBrands((prev) => {
      const next = { ...prev };
      for (const s of sections) {
        if (next[s.brand.id] === undefined) next[s.brand.id] = true;
      }
      // sections에서 사라진 브랜드 정리(선택)
      for (const key of Object.keys(next)) {
        if (!sections.some((s) => s.brand.id === key)) delete next[key];
      }
      return next;
    });
  }, [sections]);

  const toggleBrand = (brandId: string) => {
    setOpenBrands((prev) => ({
      ...prev,
      [brandId]: !prev[brandId],
    }));
  };

  const hasBranches = sections.some((section) => section.branches.length > 0);

  // --- 아래는 그대로, early return은 훅 아래에서 OK ---
  if (loading) {
    return (
      <div>
        {/* ✅ 헤더: 타이틀 좌측 / headerRight 우측 (같은 행) */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold text-foreground">{title}</h1>
          </div>
          {headerRight ? <div className="shrink-0 pt-1">{headerRight}</div> : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-24 rounded-md border border-border bg-bg-secondary animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {/* ✅ 헤더: 타이틀 좌측 / headerRight 우측 (같은 행) */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold text-foreground">{title}</h1>
          </div>
          {headerRight ? <div className="shrink-0 pt-1">{headerRight}</div> : null}
        </div>

        <div className="border border-danger-500 rounded-md p-4 bg-danger-500/10 text-danger-500">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ✅ 헤더: 타이틀/설명 좌측 + headerRight 우측 (같은 행) */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-foreground">{title}</h1>
          {description ? <p className="text-text-secondary mt-2">{description}</p> : null}
        </div>

        {headerRight ? <div className="shrink-0 pt-1">{headerRight}</div> : null}
      </div>

      {!hasBranches ? (
        <div className="card bg-white dark:bg-bg-secondary p-12 text-center text-text-tertiary">
          <div className="text-base">{isEmptyText}</div>
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map((section) => (
            <section
              key={section.brand.id}
              className="border border-border rounded-md bg-bg-secondary overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleBrand(section.brand.id)}
                className="w-full px-4 py-3 border-b border-border bg-bg-tertiary flex items-center justify-between cursor-pointer hover:bg-bg-tertiary/80 transition-colors"
              >
                <div className="text-left">
                  <div className="font-bold text-sm text-foreground">{section.brand.name}</div>
                  <div className="text-xs text-text-secondary mt-1 opacity-90">
                    Brand URL: {getBrandOrderPath(section.brand.slug) ?? "not set"}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs bg-bg-tertiary border border-border px-2 py-1 rounded text-text-secondary">
                    {section.branches.length}
                  </span>
                  {openBrands[section.brand.id] ? (
                    <ChevronDown size={16} className="text-text-secondary" />
                  ) : (
                    <ChevronRight size={16} className="text-text-secondary" />
                  )}
                </div>
              </button>

              {openBrands[section.brand.id] && (
                <div className="p-4 bg-white dark:bg-bg-secondary border-t border-border transition-all duration-200">
                  {section.branches.length === 0 ? (
                    <div className="text-text-tertiary text-sm py-2">No branches.</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {section.branches.map((branch) => (
                        <Link
                          key={branch.id}
                          href={getBranchOrderUrl(section.brand.slug, branch.slug, branch.id)}
                          className="card bg-white dark:bg-bg-secondary p-3 block no-underline text-text-primary hover:bg-gray-50 dark:hover:bg-bg-tertiary transition-colors"
                          {...(openInNewTab
                            ? { target: "_blank", rel: "noopener noreferrer" }
                            : {})}
                        >
                          <div className="font-semibold">{branch.name}</div>
                          <div className="text-xs text-text-secondary mt-1 opacity-90">
                            Order URL:{" "}
                            {getBranchOrderUrl(section.brand.slug, branch.slug, branch.id)}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}