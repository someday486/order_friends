import { expect, test } from '@playwright/test';

test.describe('404 Not Found page', () => {
  test('shows 404 message for unknown routes', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-at-all-xyz');

    await expect(page.getByText('404')).toBeVisible();
    await expect(page.getByText('페이지를 찾을 수 없습니다')).toBeVisible();
    await expect(page.getByRole('link', { name: /홈으로/ })).toBeVisible();
  });

  test('404 page has a link back to home', async ({ page }) => {
    await page.goto('/non-existent-route-1234');

    const homeLink = page.getByRole('link', { name: /홈으로/ });
    await expect(homeLink).toHaveAttribute('href', '/');
  });
});
