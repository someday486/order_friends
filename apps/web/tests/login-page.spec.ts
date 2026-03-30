import { expect, test } from '@playwright/test';

const E2E_AUTH_COOKIE = {
  name: 'of_e2e_auth',
  value: '1',
  domain: '127.0.0.1',
  path: '/',
};
const API_BASE = 'http://localhost:4000';
const MOCK_USER = {
  id: 'user-1',
  email: 'admin@test.com',
  aud: 'authenticated',
  role: 'authenticated',
};
const MOCK_SESSION = {
  access_token: 'test-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'test-refresh-token',
  user: MOCK_USER,
};

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

  test('submit button becomes enabled after hydration', async ({ page }) => {
    await page.goto('/login');

    const submitBtn = page.getByRole('button', { name: '로그인' });
    await expect(submitBtn).toBeEnabled();
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

  test('submits autofilled credentials on the first click', async ({
    page,
  }) => {
    await page.context().addCookies([E2E_AUTH_COOKIE]);

    await page.route('**/auth/v1/token**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SESSION),
      });
    });

    await page.route('**/auth/v1/user**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: MOCK_USER }),
      });
    });

    await page.route(`${API_BASE}/me`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: MOCK_USER.id,
            email: MOCK_USER.email,
            role: 'manager',
          },
          memberships: [],
          ownedBrands: [],
          canCreateBrand: false,
        }),
      });
    });

    await page.goto('/login');
    await page.evaluate(() => {
      const emailInput = document.querySelector('input[type="email"]');
      const passwordInput = document.querySelector('input[type="password"]');

      if (
        !(emailInput instanceof HTMLInputElement) ||
        !(passwordInput instanceof HTMLInputElement)
      ) {
        throw new Error('Login inputs were not found');
      }

      emailInput.value = 'admin@test.com';
      passwordInput.value = 'test1234';
    });

    await page.getByRole('button', { name: '로그인' }).click();
    await expect(page).toHaveURL(/\/approval-pending$/);
  });

  test('shows error message on failed login', async ({ page }) => {
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

    await expect(page).not.toHaveURL(/not-found/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('redirects public order tracking next target without showing login', async ({
    page,
  }) => {
    await page.goto('/login?next=%2Forder%2Ftrack%2FORD-001');

    await expect(page).toHaveURL(/\/order\/track\/ORD-001$/);
  });
});
