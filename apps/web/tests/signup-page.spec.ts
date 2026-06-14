import { expect, test } from '@playwright/test';

test.describe('Signup page', () => {
  test('renders manager signup form', async ({ page }) => {
    await page.goto('/signup');

    await expect(page.getByText('관리자 회원가입')).toBeVisible();
    await expect(page.getByPlaceholder('manager@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('8자 이상 입력')).toBeVisible();
    await expect(
      page.getByPlaceholder('비밀번호를 다시 입력해 주세요'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '회원가입' })).toBeVisible();
  });

  test('submit button is disabled when fields are empty', async ({ page }) => {
    await page.goto('/signup');

    await expect(page.getByRole('button', { name: '회원가입' })).toBeDisabled();
  });

  test('shows password mismatch error before requesting signup', async ({
    page,
  }) => {
    await page.goto('/signup');

    await page
      .getByPlaceholder('manager@example.com')
      .fill('manager@example.com');
    await page.getByPlaceholder('8자 이상 입력').fill('Password123');
    await page
      .getByPlaceholder('비밀번호를 다시 입력해 주세요')
      .fill('Password999');
    await page.getByRole('button', { name: '회원가입' }).click();

    await expect(page.getByText('비밀번호가 일치하지 않습니다.')).toBeVisible();
  });
});
