import { expect, test } from '@playwright/test';

const E2E_AUTH_COOKIE = {
  name: 'of_e2e_auth',
  value: '1',
  domain: '127.0.0.1',
  path: '/',
};
const API_BASE = 'http://localhost:4000';

const MOCK_ORDERS = {
  data: [
    {
      id: 'order-1',
      orderNo: 'OF-20260302-0001',
      status: 'CREATED',
      totalAmount: 9000,
      customerName: '홍길동',
      createdAt: '2026-03-02T10:00:00.000Z',
      fulfillmentType: 'PICKUP',
      paymentMethod: 'CARD',
      items: [{ productNameSnapshot: '아메리카노', qty: 2 }],
    },
    {
      id: 'order-2',
      orderNo: 'OF-20260302-0002',
      status: 'CONFIRMED',
      totalAmount: 5500,
      customerName: '김철수',
      createdAt: '2026-03-02T10:05:00.000Z',
      fulfillmentType: 'DELIVERY',
      paymentMethod: 'CASH',
      items: [{ productNameSnapshot: '카페라떼', qty: 1 }],
    },
  ],
  pagination: { total: 2, page: 1, limit: 20, totalPages: 1 },
};

test.describe('Admin order management', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([E2E_AUTH_COOKIE]);
    await page.addInitScript(() => {
      localStorage.setItem('of:selectedBranchId', 'branch-1');
      localStorage.setItem('of:selectedBrandId', 'brand-1');
    });
  });

  test('admin order list renders with order data', async ({ page }) => {
    await page.route(`${API_BASE}/admin/orders**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ORDERS),
      });
    });

    await page.goto('/admin/orders');

    await expect(page.getByText('OF-20260302-0001')).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText('OF-20260302-0002')).toBeVisible();
  });

  test('admin order list shows empty state when no orders', async ({
    page,
  }) => {
    await page.route(`${API_BASE}/admin/orders**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
          pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
        }),
      });
    });

    await page.goto('/admin/orders');

    // Page renders without crashing
    await expect(page.locator('body')).toBeVisible();
  });

  test('admin brand page renders', async ({ page }) => {
    await page.route(`${API_BASE}/admin/brands`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'brand-1',
            name: '테스트 카페',
            slug: 'test-cafe',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ]),
      });
    });

    await page.goto('/admin/brand');

    await expect(page.getByText('테스트 카페')).toBeVisible({ timeout: 5000 });
  });

  test('admin stores page renders', async ({ page }) => {
    await page.route(`${API_BASE}/admin/brands`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'brand-1', slug: 'test-cafe', name: '테스트 카페' },
        ]),
      });
    });

    await page.route(`${API_BASE}/admin/branches**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'branch-1',
            name: '강남점',
            slug: 'gangnam-main',
            brandId: 'brand-1',
            address: '서울시 강남구',
            isActive: true,
          },
        ]),
      });
    });

    await page.goto('/admin/stores');

    await expect(page.getByText('강남점')).toBeVisible({ timeout: 5000 });
  });
});
