'use client';

import { apiClient } from '@/lib/api-client';

const ADMIN_DATA_TTL_MS = 30_000;
const ADMIN_ROUTE_PREFETCH_TTL_MS = 20_000;
const ALL_BRANCHES_VALUE = '__ALL_BRANCHES__';

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export type AdminBrandSummary = {
  id: string;
  name: string;
  isActive: boolean;
  slug: string | null;
  bizName?: string | null;
  bizRegNo?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  createdAt: string;
};

export type AdminBranchSummary = {
  id: string;
  brandId: string;
  name: string;
  slug: string | null;
  createdAt: string;
};

let brandsCache: CacheEntry<AdminBrandSummary[]> | null = null;
let brandsPromise: Promise<AdminBrandSummary[]> | null = null;

const branchesCache = new Map<string, CacheEntry<AdminBranchSummary[]>>();
const branchesPromise = new Map<string, Promise<AdminBranchSummary[]>>();

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return value;
}

function isFresh<T>(entry: CacheEntry<T> | null | undefined) {
  return !!entry && entry.expiresAt > Date.now();
}

function cacheValue<T>(value: T): CacheEntry<T> {
  return {
    value,
    expiresAt: Date.now() + ADMIN_DATA_TTL_MS,
  };
}

export async function getAdminBrands(options?: {
  force?: boolean;
}): Promise<AdminBrandSummary[]> {
  if (!options?.force && isFresh(brandsCache)) {
    return cloneValue(brandsCache!.value);
  }

  if (!options?.force && brandsPromise) {
    return brandsPromise.then((value) => cloneValue(value));
  }

  brandsPromise = apiClient
    .get<AdminBrandSummary[]>('/admin/brands')
    .then((value) => {
      brandsCache = cacheValue(value);
      return value;
    })
    .finally(() => {
      brandsPromise = null;
    });

  return brandsPromise.then((value) => cloneValue(value));
}

export async function getAdminBranches(
  brandId: string,
  options?: { force?: boolean },
): Promise<AdminBranchSummary[]> {
  if (!brandId) return [];

  const cached = branchesCache.get(brandId);
  if (!options?.force && isFresh(cached)) {
    return cloneValue(cached!.value);
  }

  const pending = branchesPromise.get(brandId);
  if (!options?.force && pending) {
    return pending.then((value) => cloneValue(value));
  }

  const promise = apiClient
    .get<AdminBranchSummary[]>(
      `/admin/branches?brandId=${encodeURIComponent(brandId)}`,
    )
    .then((value) => {
      branchesCache.set(brandId, cacheValue(value));
      return value;
    })
    .finally(() => {
      branchesPromise.delete(brandId);
    });

  branchesPromise.set(brandId, promise);
  return promise.then((value) => cloneValue(value));
}

export function prefetchAdminBrands() {
  void getAdminBrands().catch(() => {});
}

export function prefetchAdminBranches(brandId: string | null | undefined) {
  if (!brandId) return;
  void getAdminBranches(brandId).catch(() => {});
}

export function invalidateAdminBrands() {
  brandsCache = null;
  brandsPromise = null;
}

export function invalidateAdminBranches(brandId?: string | null) {
  if (!brandId) {
    branchesCache.clear();
    branchesPromise.clear();
    return;
  }

  branchesCache.delete(brandId);
  branchesPromise.delete(brandId);
}

function prefetchAdminRequest(path: string) {
  void apiClient
    .get(path, { cacheTtlMs: ADMIN_ROUTE_PREFETCH_TTL_MS })
    .catch(() => {});
}

export function prefetchAdminRouteData(
  href: string,
  options?: {
    brandId?: string | null;
    branchId?: string | null;
  },
) {
  const route = href.split('?')[0];
  const brandId = options?.brandId ?? null;
  const branchId = options?.branchId ?? null;

  if (route === '/admin' && brandId) {
    prefetchAdminRequest(
      `/admin/dashboard/stats?brandId=${encodeURIComponent(brandId)}`,
    );
    return;
  }

  if (route === '/admin/members') {
    prefetchAdminRequest('/admin/members/pending');

    if (brandId) {
      prefetchAdminRequest(
        `/admin/members/brand/${encodeURIComponent(brandId)}`,
      );
    }

    if (branchId && branchId !== ALL_BRANCHES_VALUE) {
      prefetchAdminRequest(
        `/admin/members/branch/${encodeURIComponent(branchId)}`,
      );
    }

    return;
  }

  if (
    route === '/admin/orders' &&
    branchId &&
    branchId !== ALL_BRANCHES_VALUE
  ) {
    prefetchAdminRequest(
      `/admin/orders?branchId=${encodeURIComponent(branchId)}`,
    );
    return;
  }

  if (
    route === '/admin/products' &&
    branchId &&
    branchId !== ALL_BRANCHES_VALUE
  ) {
    prefetchAdminRequest(
      `/admin/products?branchId=${encodeURIComponent(branchId)}`,
    );
  }
}
