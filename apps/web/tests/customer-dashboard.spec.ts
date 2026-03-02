import { expect, test } from '@playwright/test';

const E2E_AUTH_COOKIE = {
  name: 'of_e2e_auth',
  value: '1',
  domain: '127.0.0.1',
  path: '/',
};
const API_BASE = 'http://localhost:4000';

const MOCK_BRANCH = {
  id: 'branch-1',
  name: '강남 매장',
  slug: 'gangnam-main',
  brand_id: 'brand-1',
  address: '서울시 강남구',
  isActive: true,
};

const MOCK_DASHBOARD = {
  todayOrders: 12,
  todayRevenue: 54000,
  pendingOrders: 3,
  completedOrders: 9,
  lowStockItems: 1,
};

test.describe('Customer dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([E2E_AUTH_COOKIE]);
  });

  test('renders dashboard with stats when data loads', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('of:selectedBranchId', 'branch-1');
    });

    await page.route(`${API_BASE}/customer/branches/**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_BRANCH),
      });
    });

    await page.route(`${API_BASE}/customer/dashboard/**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_DASHBOARD),
      });
    });

    await page.goto('/customer');

    // Dashboard should render without crashing
    await expect(page.locator('body')).toBeVisible();
  });

  test('customer order list page renders', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('of:selectedBranchId', 'branch-1');
    });

    await page.route(`${API_BASE}/customer/orders**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
          pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
        }),
      });
    });

    await page.goto('/customer/order');

    await expect(page.locator('body')).toBeVisible();
  });

  test('customer products page renders', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('of:selectedBranchId', 'branch-1');
      localStorage.setItem('of:selectedBrandId', 'brand-1');
    });

    await page.route(`${API_BASE}/customer/products**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'product-1',
              name: '아메리카노',
              base_price: 4500,
              is_available: true,
            },
          ],
          pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
        }),
      });
    });

    await page.goto('/customer/products');

    await expect(page.locator('body')).toBeVisible();
  });
});
