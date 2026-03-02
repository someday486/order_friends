import { expect, test } from '@playwright/test';

const API_BASE = 'http://localhost:4000';

const MOCK_BRANCH = {
  id: 'branch-1',
  name: '강남 메인',
  slug: 'gangnam-main',
  enabledFulfillmentTypes: ['PICKUP', 'DELIVERY'],
  allowedPaymentMethods: ['CARD', 'CASH'],
};

const MOCK_PRODUCTS = [
  {
    id: 'product-1',
    name: '아메리카노',
    base_price: 4500,
    price: 4500,
    description: '진한 에스프레소',
    imageUrl: null,
    is_available: true,
    category_id: 'cat-1',
    options: [],
    badges: [],
    stock: { available: 10 },
  },
  {
    id: 'product-2',
    name: '카페라떼',
    base_price: 5500,
    price: 5500,
    description: '부드러운 우유와 에스프레소',
    imageUrl: null,
    is_available: true,
    category_id: 'cat-1',
    options: [],
    badges: [],
    stock: { available: 5 },
  },
];

test.describe('Order menu page (branch ID route)', () => {
  test('displays product list when API responds', async ({ page }) => {
    await page.route(
      `${API_BASE}/public/branches/branch-1`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_BRANCH),
        });
      },
    );

    await page.route(
      `${API_BASE}/public/branches/branch-1/products`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_PRODUCTS),
        });
      },
    );

    await page.goto('/order/branch/branch-1');

    await expect(page.getByText('아메리카노')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('카페라떼')).toBeVisible();
  });

  test('shows not-found when branch API returns 404', async ({ page }) => {
    await page.route(
      `${API_BASE}/public/brands/unknown-brand/branches/unknown-branch`,
      async (route) => {
        await route.fulfill({ status: 404, body: 'Not Found' });
      },
    );

    const response = await page.goto('/order/unknown-brand/unknown-branch');

    // Next.js should return 404 status
    expect(response?.status()).toBe(404);
  });

  test('shows product prices formatted in Korean won', async ({ page }) => {
    await page.route(
      `${API_BASE}/public/branches/branch-1`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_BRANCH),
        });
      },
    );

    await page.route(
      `${API_BASE}/public/branches/branch-1/products`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([MOCK_PRODUCTS[0]]),
        });
      },
    );

    await page.goto('/order/branch/branch-1');

    // Price should be displayed in Korean won format
    await expect(page.getByText(/4,500원|4500원/)).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe('Order menu page (brand/branch slug route)', () => {
  test('displays products from brand/branch slug route', async ({ page }) => {
    await page.route(
      `${API_BASE}/public/brands/test-cafe/branches/gangnam-main`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_BRANCH),
        });
      },
    );

    await page.route(
      `${API_BASE}/public/branches/branch-1/products`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_PRODUCTS),
        });
      },
    );

    await page.goto('/order/test-cafe/gangnam-main');

    await expect(page.getByText('아메리카노')).toBeVisible({ timeout: 5000 });
  });
});
