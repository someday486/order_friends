"use client";

import Link from "next/link";

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
};

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

function getBrandOrderPath(brandSlug: string | null) {
  if (!brandSlug) {
    return null;
  }

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
}: OrderLauncherProps) {
  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold mb-8 text-foreground">{title}</h1>
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
        <h1 className="text-2xl font-extrabold mb-4 text-foreground">{title}</h1>
        <div className="border border-danger-500 rounded-md p-4 bg-danger-500/10 text-danger-500">{error}</div>
      </div>
    );
  }

  const hasBranches = sections.some((section) => section.branches.length > 0);

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-4 text-foreground">{title}</h1>
      {description ? <p className="text-text-secondary mb-6">{description}</p> : null}

      {!hasBranches ? (
        <div className="card p-12 text-center text-text-tertiary">
          <div className="text-base">{isEmptyText}</div>
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map((section) => (
            <section
              key={section.brand.id}
              className="border border-border rounded-md bg-bg-secondary overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-border bg-bg-tertiary">
                <div className="font-bold text-sm text-foreground">{section.brand.name}</div>
                <div className="text-xs text-text-tertiary mt-1">
                  Brand URL: {getBrandOrderPath(section.brand.slug) ?? "not set"}
                </div>
              </div>

              <div className="p-3">
                {section.branches.length === 0 ? (
                  <div className="text-text-tertiary text-sm py-2">No branches.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {section.branches.map((branch) => (
                      <Link
                        key={branch.id}
                        href={getBranchOrderUrl(section.brand.slug, branch.slug, branch.id)}
                        className="card p-3 block no-underline text-foreground hover:bg-bg-tertiary transition-colors"
                        {...(openInNewTab
                          ? {
                              target: "_blank",
                              rel: "noopener noreferrer",
                            }
                          : {})}
                      >
                        <div className="font-semibold">{branch.name}</div>
                        <div className="text-xs text-text-secondary mt-1">
                          Order URL: {getBranchOrderUrl(section.brand.slug, branch.slug, branch.id)}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
