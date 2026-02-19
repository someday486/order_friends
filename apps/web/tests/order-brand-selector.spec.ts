import { expect, test } from '@playwright/test';

const API_BASE = 'http://localhost:4000';

test.describe('Order brand selector', () => {
  test('shows branch cards and builds branch links', async ({ page }) => {
    await page.route(
      `${API_BASE}/public/brands/test-cafe-chain/branches`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            brandSlug: 'test-cafe-chain',
            brandName: 'Test Cafe Chain',
            branches: [
              {
                id: 'branch-1',
                name: 'Gangnam Main',
                slug: 'gangnam-main',
              },
              {
                id: 'branch-2',
                name: 'Sinsa',
                slug: null,
              },
            ],
          }),
        });
      },
    );

    await page.goto('/order/test-cafe-chain');

    const branchWithSlug = page.getByTestId('branch-card-branch-1');
    await expect(branchWithSlug).toBeVisible();
    await expect(branchWithSlug).toHaveAttribute(
      'href',
      '/order/test-cafe-chain/gangnam-main',
    );

    const branchWithoutSlug = page.getByTestId('branch-card-branch-2');
    await expect(branchWithoutSlug).toBeVisible();
    await expect(branchWithoutSlug).toHaveAttribute(
      'href',
      '/order/branch/branch-2',
    );
  });

  test('shows empty state when branch list is empty', async ({ page }) => {
    await page.route(
      `${API_BASE}/public/brands/empty-brand/branches`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            brandSlug: 'empty-brand',
            brandName: 'Empty Brand',
            branches: [],
          }),
        });
      },
    );

    await page.goto('/order/empty-brand');
    await expect(page.getByTestId('branch-selector-empty')).toBeVisible();
  });

  test('shows error state when API call fails', async ({ page }) => {
    await page.route(
      `${API_BASE}/public/brands/missing-brand/branches`,
      async (route) => {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'not found' }),
        });
      },
    );

    await page.goto('/order/missing-brand');
    await expect(page.getByTestId('branch-selector-error')).toBeVisible();
  });
});
