'use client';

import { apiClient } from '@/lib/api-client';

const CUSTOMER_ROUTE_PREFETCH_TTL_MS = 20_000;

function prefetchCustomerRequest(path: string) {
  void apiClient
    .get(path, { cacheTtlMs: CUSTOMER_ROUTE_PREFETCH_TTL_MS })
    .catch(() => {});
}

export function prefetchCustomerRouteData(
  href: string,
  options?: {
    brandId?: string | null;
    branchId?: string | null;
  },
) {
  const route = href.split('?')[0];
  const brandId = options?.brandId ?? null;
  const branchId = options?.branchId ?? null;

  if (route === '/customer') {
    prefetchCustomerRequest('/customer/dashboard');
    prefetchCustomerRequest('/customer/inventory/alerts');
    return;
  }

  if (route === '/customer/analytics/brand') {
    prefetchCustomerRequest('/customer/brands');
    return;
  }

  if (route === '/customer/brands') {
    prefetchCustomerRequest('/customer/brands');
    return;
  }

  if (route === '/customer/branches') {
    prefetchCustomerRequest('/customer/brands');
    if (brandId) {
      prefetchCustomerRequest(
        `/customer/branches?brandId=${encodeURIComponent(brandId)}`,
      );
    } else {
      prefetchCustomerRequest('/customer/branches');
    }
    return;
  }

  if (route === '/customer/permissions') {
    prefetchCustomerRequest('/customer/brands');
    if (brandId) {
      prefetchCustomerRequest(
        `/customer/branches?brandId=${encodeURIComponent(brandId)}`,
      );
    }
    return;
  }

  if (route === '/customer/categories') {
    prefetchCustomerRequest('/customer/branches');
    if (branchId) {
      prefetchCustomerRequest(
        `/customer/products/categories?branchId=${encodeURIComponent(branchId)}`,
      );
    }
    return;
  }

  if (route === '/customer/products') {
    prefetchCustomerRequest('/customer/brands');
    if (brandId) {
      prefetchCustomerRequest(
        `/customer/branches?brandId=${encodeURIComponent(brandId)}`,
      );
      prefetchCustomerRequest(
        `/customer/products/brand-templates?brandId=${encodeURIComponent(
          brandId,
        )}`,
      );
    }
    if (branchId) {
      prefetchCustomerRequest(
        `/customer/products/categories?branchId=${encodeURIComponent(branchId)}`,
      );
    }
    return;
  }

  if (route === '/customer/inventory') {
    prefetchCustomerRequest('/customer/brands');
    if (brandId) {
      prefetchCustomerRequest(
        `/customer/branches?brandId=${encodeURIComponent(brandId)}`,
      );
    }
    if (branchId) {
      prefetchCustomerRequest(
        `/customer/inventory?branchId=${encodeURIComponent(branchId)}`,
      );
      prefetchCustomerRequest(
        `/customer/products/categories?branchId=${encodeURIComponent(branchId)}`,
      );
    }
    return;
  }

  if (route === '/customer/orders') {
    prefetchCustomerRequest('/customer/brands');
    prefetchCustomerRequest('/customer/branches');

    const params = new URLSearchParams({
      page: '1',
      limit: '20',
    });

    if (branchId) {
      params.set('branchId', branchId);
    }

    prefetchCustomerRequest(`/customer/orders?${params.toString()}`);
    return;
  }

  if (route === '/customer/order') {
    prefetchCustomerRequest('/customer/brands');
    prefetchCustomerRequest('/customer/branches');
    return;
  }

  if (route === '/customer/mypage') {
    prefetchCustomerRequest('/me/profile');
    prefetchCustomerRequest('/customer/brands');
    prefetchCustomerRequest('/customer/branches');
  }
}
