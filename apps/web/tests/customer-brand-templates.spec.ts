import { expect, test } from '@playwright/test';

const API_BASE = 'http://localhost:4000';
const E2E_AUTH_COOKIE = {
  name: 'of_e2e_auth',
  value: '1',
  domain: '127.0.0.1',
  path: '/',
};

test.beforeEach(async ({ page }) => {
  await page.context().addCookies([E2E_AUTH_COOKIE]);
});

test.describe('Customer brand menu templates', () => {
  test('creates and edits template with branch checklist table', async ({
    page,
  }) => {
    const branches = [
      {
        id: 'branch-1',
        name: 'Gangnam Main',
        brandId: 'brand-1',
        myRole: 'OWNER',
      },
      {
        id: 'branch-2',
        name: 'Jamsil East',
        brandId: 'brand-1',
        myRole: 'OWNER',
      },
    ];

    const templates: Array<Record<string, unknown>> = [];
    let createPayload: Record<string, unknown> | null = null;
    let editPayload: Record<string, unknown> | null = null;

    await page.route(`${API_BASE}/customer/brands`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'brand-1',
            name: 'Test Cafe',
            myRole: 'OWNER',
          },
        ]),
      });
    });

    await page.route(`${API_BASE}/customer/branches?**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(branches),
      });
    });

    await page.route(
      `${API_BASE}/customer/products/categories?**`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      },
    );

    await page.route(
      `${API_BASE}/customer/products/brand-templates?**`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(templates),
        });
      },
    );

    await page.route(
      `${API_BASE}/customer/products/brand-templates`,
      async (route) => {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        createPayload = body;
        const branchIds =
          (body.branchIds as string[]) ?? branches.map((b) => b.id);

        templates.push({
          id: 'tpl-1',
          brandId: 'brand-1',
          name: body.name,
          description: body.description ?? null,
          price: body.price,
          imageUrl: body.imageUrl ?? null,
          isActive: true,
          sortOrder: 0,
          inventoryMode: body.inventoryMode ?? 'PRODUCT',
          appliedBranchIds: branchIds,
          appliedBranchCount: branchIds.length,
          totalBranchCount: branches.length,
        });

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(templates[0]),
        });
      },
    );

    await page.route(
      `${API_BASE}/customer/products/brand-templates/tpl-1`,
      async (route) => {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        editPayload = body;
        const branchIds = (body.branchIds as string[]) ?? [];

        templates[0] = {
          ...templates[0],
          name: body.name,
          description: body.description ?? null,
          price: body.price,
          imageUrl: body.imageUrl ?? null,
          isActive: body.isActive,
          inventoryMode: body.inventoryMode ?? 'PRODUCT',
          appliedBranchIds: branchIds,
          appliedBranchCount: branchIds.length,
        };

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(templates[0]),
        });
      },
    );

    await page.goto('/customer/products');

    await expect(page.getByText('상품 관리')).toBeVisible();
    await page.getByRole('button', { name: '펼치기' }).click();

    const jamsilRow = page.locator('tr', { hasText: 'Jamsil East' }).first();
    const jamsilCheckbox = jamsilRow.locator('input[type="checkbox"]');
    await expect(jamsilCheckbox).toBeChecked();
    await jamsilCheckbox.click();

    await page.getByPlaceholder('메뉴명').first().fill('신메뉴');
    await page.getByPlaceholder('가격').first().fill('4900');
    await page
      .locator('select')
      .filter({ has: page.locator('option[value="NONE"]') })
      .first()
      .selectOption('NONE');
    await page.getByRole('button', { name: '메뉴 등록' }).click();

    await expect(page.getByText('신메뉴')).toBeVisible();
    await expect(page.getByText('1 / 2 매장')).toBeVisible();
    const createdRow = page.locator('tbody tr', { hasText: '신메뉴' }).first();
    await expect(createdRow.getByText('미사용', { exact: true })).toBeVisible();
    expect(createPayload?.inventoryMode).toBe('NONE');

    await page.getByRole('button', { name: '수정' }).click();

    const editPanel = page.locator('tr', {
      has: page.getByRole('button', { name: '저장' }),
    });
    const editJamsilCheckbox = editPanel
      .locator('tr', { hasText: 'Jamsil East' })
      .locator('input[type="checkbox"]')
      .first();
    await editJamsilCheckbox.click();
    await editPanel
      .locator('select')
      .filter({ has: page.locator('option[value="NONE"]') })
      .first()
      .selectOption('PRODUCT');

    await page.getByRole('button', { name: '저장' }).click();

    await expect(page.getByText('2 / 2 매장')).toBeVisible();
    await expect(createdRow.getByText('사용', { exact: true })).toBeVisible();
    expect(editPayload?.inventoryMode).toBe('PRODUCT');
  });

  test('bulk update applies inventory mode to selected templates', async ({
    page,
  }) => {
    const branches = [
      {
        id: 'branch-1',
        name: 'Gangnam Main',
        brandId: 'brand-1',
        myRole: 'OWNER',
      },
    ];

    const templates: Array<Record<string, unknown>> = [
      {
        id: 'tpl-1',
        brandId: 'brand-1',
        name: '아메리카노',
        description: null,
        price: 3900,
        imageUrl: null,
        isActive: true,
        sortOrder: 0,
        inventoryMode: 'PRODUCT',
        appliedBranchIds: ['branch-1'],
        appliedBranchCount: 1,
        totalBranchCount: 1,
      },
      {
        id: 'tpl-2',
        brandId: 'brand-1',
        name: '라떼',
        description: null,
        price: 4500,
        imageUrl: null,
        isActive: true,
        sortOrder: 1,
        inventoryMode: 'PRODUCT',
        appliedBranchIds: ['branch-1'],
        appliedBranchCount: 1,
        totalBranchCount: 1,
      },
    ];
    let bulkPayload: Record<string, unknown> | null = null;

    await page.route(`${API_BASE}/customer/brands`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'brand-1',
            name: 'Test Cafe',
            myRole: 'OWNER',
          },
        ]),
      });
    });

    await page.route(`${API_BASE}/customer/branches?**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(branches),
      });
    });

    await page.route(
      `${API_BASE}/customer/products/categories?**`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      },
    );

    await page.route(
      `${API_BASE}/customer/products/brand-templates?**`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(templates),
        });
      },
    );

    await page.route(
      `${API_BASE}/customer/products/brand-templates/bulk/update`,
      async (route) => {
        bulkPayload = route.request().postDataJSON() as Record<string, unknown>;
        const targetIds = new Set((bulkPayload.templateIds as string[]) ?? []);
        const nextMode = bulkPayload.inventoryMode;
        for (const template of templates) {
          if (targetIds.has(String(template.id)) && nextMode) {
            template.inventoryMode = nextMode;
          }
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ updatedCount: targetIds.size }),
        });
      },
    );

    await page.goto('/customer/products');

    const firstRow = page
      .locator('tbody tr')
      .filter({ hasText: '아메리카노' })
      .first();
    await firstRow.locator('input[type="checkbox"]').first().click();

    await page
      .locator('label', { hasText: '재고관리 일괄 변경' })
      .locator('..')
      .locator('select')
      .selectOption('NONE');
    await page
      .getByRole('button', { name: '선택한 메뉴 일괄 변경 실행' })
      .click();

    expect(bulkPayload?.inventoryMode).toBe('NONE');
    expect(bulkPayload?.templateIds).toEqual(['tpl-1']);
    await expect(firstRow.getByText('미사용')).toBeVisible();
  });
});
