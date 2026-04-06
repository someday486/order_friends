import { expect, test } from '@playwright/test';

test.describe('Home page', () => {
  test('renders the project introduction and primary entry actions', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', {
        name: /브랜드 소개부터 주문 접수, 운영 관리까지 하나의 흐름으로/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByText('브랜드 소개와 주문 진입을 한 화면에서'),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: '운영자 로그인' }),
    ).toHaveAttribute('href', '/login');
    await expect(
      page.getByRole('link', { name: '고객 주문 화면 보기' }),
    ).toHaveAttribute('href', '/shop');
  });
});
