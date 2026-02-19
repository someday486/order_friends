import { expect, test } from '@playwright/test';

const E2E_AUTH_COOKIE = {
  name: 'of_e2e_auth',
  value: '1',
  domain: '127.0.0.1',
  path: '/',
};
const API_BASE = 'http://localhost:4000';

test.beforeEach(async ({ page }) => {
  await page.context().addCookies([E2E_AUTH_COOKIE]);
});

test.describe('Admin/Customer URL display', () => {
  test('admin brand list shows order URL text', async ({ page }) => {
    await page.route(`${API_BASE}/admin/brands`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'brand-1',
            name: 'Test Cafe Chain',
            slug: 'test-cafe-chain',
            createdAt: '2026-02-16T00:00:00.000Z',
          },
        ]),
      });
    });

    await page.goto('/admin/brand');

    await expect(page.getByText('/order/test-cafe-chain')).toBeVisible();
  });

  test('admin stores list shows composed order URL text', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('of:selectedBrandId', 'brand-1');
    });

    await page.route(`${API_BASE}/admin/brands`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'brand-1',
            slug: 'test-cafe-chain',
          },
        ]),
      });
    });

    await page.route(`${API_BASE}/admin/branches?**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'branch-1',
            brandId: 'brand-1',
            name: 'Gangnam Main',
            slug: 'gangnam-main',
            createdAt: '2026-02-16T00:00:00.000Z',
          },
        ]),
      });
    });

    await page.goto('/admin/stores');

    await expect(
      page.getByText('/order/test-cafe-chain/gangnam-main'),
    ).toBeVisible();
  });

  test('customer brands list shows order URL text', async ({ page }) => {
    await page.route(`${API_BASE}/customer/brands`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'brand-1',
            name: 'Test Cafe Chain',
            slug: 'test-cafe-chain',
            biz_name: null,
            logo_url: null,
            created_at: '2026-02-16T00:00:00.000Z',
            myRole: 'OWNER',
          },
        ]),
      });
    });

    await page.goto('/customer/brands');

    await expect(page.getByText('/order/test-cafe-chain')).toBeVisible();
  });

  test('customer branches list shows composed order URL text', async ({
    page,
  }) => {
    await page.route(`${API_BASE}/customer/brands`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'brand-1',
            name: 'Test Cafe Chain',
            slug: 'test-cafe-chain',
          },
        ]),
      });
    });

    await page.route(`${API_BASE}/customer/branches?**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'branch-1',
            brandId: 'brand-1',
            name: 'Gangnam Main',
            slug: 'gangnam-main',
            myRole: 'OWNER',
            createdAt: '2026-02-16T00:00:00.000Z',
          },
        ]),
      });
    });

    await page.goto('/customer/branches');

    await expect(
      page.getByText('/order/test-cafe-chain/gangnam-main'),
    ).toBeVisible();
  });

  test('customer orders page does not throw useRouter reference error', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await page.route(`${API_BASE}/customer/branches**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route(`${API_BASE}/customer/orders?**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/customer/orders');
    await expect(page).toHaveURL(/\/customer\/orders/);

    expect(
      pageErrors.some((message) =>
        message.includes('useRouter is not defined'),
      ),
    ).toBe(false);
  });
});
