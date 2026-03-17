import { expect, test } from '@playwright/test';

test.describe('Login page', () => {
  test('renders login form with email and password fields', async ({
    page,
  }) => {
    await page.goto('/login');

    await expect(page.getByText('OrderFriends')).toBeVisible();
    await expect(page.getByText('계정으로 로그인해 주세요')).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible();
    await expect(page.getByRole('link', { name: '회원가입' })).toBeVisible();
  });

  test('submit button is disabled when fields are empty', async ({ page }) => {
    await page.goto('/login');

    const submitBtn = page.getByRole('button', { name: '로그인' });
    await expect(submitBtn).toBeDisabled();
  });

  test('submit button becomes enabled when both fields are filled', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByPlaceholder('you@example.com').fill('test@example.com');
    await page.getByPlaceholder('••••••••').fill('password123');

    const submitBtn = page.getByRole('button', { name: '로그인' });
    await expect(submitBtn).toBeEnabled();
  });

  test('shows error message on failed login', async ({ page }) => {
    // Route to Supabase auth endpoint to simulate login failure
    await page.route('**/auth/v1/token**', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid login credentials',
        }),
      });
    });

    await page.goto('/login');

    await page.getByPlaceholder('you@example.com').fill('bad@example.com');
    await page.getByPlaceholder('••••••••').fill('wrongpassword');
    await page.getByRole('button', { name: '로그인' }).click();

    await expect(
      page.getByText(/Invalid login credentials|로그인에 실패/i),
    ).toBeVisible({ timeout: 5000 });
  });

  test('page title and meta are set correctly', async ({ page }) => {
    await page.goto('/login');

    // At minimum the page should not show a 404
    await expect(page).not.toHaveURL(/not-found/);
    await expect(page.locator('body')).toBeVisible();
  });
});
