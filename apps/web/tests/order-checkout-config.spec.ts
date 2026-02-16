import { expect, test } from '@playwright/test';

type CheckoutDraft = {
  cart: Array<{
    product: {
      id: string;
      name: string;
      price: number;
      options: Array<{ id: string; name: string; priceDelta: number }>;
    };
    qty: number;
    selectedOptions: Array<{ id: string; name: string; priceDelta: number }>;
    itemPrice: number;
  }>;
  branchId: string;
  brandSlug?: string;
  branchSlug?: string;
  enabledFulfillmentTypes: string[];
  allowedPaymentMethods: string[];
  selectedFulfillmentType: string;
  selectedPaymentMethod: string;
  savedAt: number;
};

const CHECKOUT_DRAFT_KEY = 'order:checkout-draft:v1';

function makeDraft(partial?: Partial<CheckoutDraft>): CheckoutDraft {
  return {
    cart: [
      {
        product: {
          id: 'product-1',
          name: '아메리카노',
          price: 4500,
          options: [],
        },
        qty: 1,
        selectedOptions: [],
        itemPrice: 4500,
      },
    ],
    branchId: 'branch-1',
    enabledFulfillmentTypes: ['PICKUP', 'DELIVERY'],
    allowedPaymentMethods: ['CARD', 'CASH'],
    selectedFulfillmentType: 'PICKUP',
    selectedPaymentMethod: 'CARD',
    savedAt: Date.now(),
    ...partial,
  };
}

test.describe('Order checkout config', () => {
  test('sends selected fulfillment/payment to public order API', async ({
    page,
  }) => {
    const draft = makeDraft();

    await page.addInitScript((payload) => {
      localStorage.setItem('order:checkout-draft:v1', JSON.stringify(payload));
      sessionStorage.removeItem('orderCart');
      sessionStorage.removeItem('orderBranchId');
      sessionStorage.removeItem('orderBrandSlug');
      sessionStorage.removeItem('orderBranchSlug');
    }, draft);

    let requestBody: Record<string, unknown> | null = null;
    await page.route('**/public/orders', async (route) => {
      requestBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'order-1' }),
      });
    });

    await page.goto('/order/branch/branch-1/checkout');

    await page.getByTestId('fulfillment-delivery').click();
    await page.getByTestId('payment-cash').click();
    await page.getByTestId('customer-name-input').fill('홍길동');
    await page.getByTestId('customer-address1-input').fill('서울시 강남구');

    await page.getByTestId('submit-order-button').click();

    await expect.poll(() => requestBody).not.toBeNull();
    expect(requestBody?.fulfillmentType).toBe('DELIVERY');
    expect(requestBody?.paymentMethod).toBe('CASH');
    expect(requestBody?.branchId).toBe('branch-1');
  });

  test('hides options not allowed by branch config', async ({ page }) => {
    const draft = makeDraft({
      enabledFulfillmentTypes: ['PICKUP'],
      allowedPaymentMethods: ['CARD'],
      selectedFulfillmentType: 'PICKUP',
      selectedPaymentMethod: 'CARD',
    });

    await page.addInitScript((payload) => {
      localStorage.setItem('order:checkout-draft:v1', JSON.stringify(payload));
      sessionStorage.removeItem('orderCart');
      sessionStorage.removeItem('orderBranchId');
      sessionStorage.removeItem('orderBrandSlug');
      sessionStorage.removeItem('orderBranchSlug');
    }, draft);

    await page.goto('/order/branch/branch-1/checkout');

    await expect(page.getByTestId('fulfillment-pickup')).toBeVisible();
    await expect(page.getByTestId('payment-card')).toBeVisible();
    await expect(page.getByTestId('fulfillment-delivery')).toHaveCount(0);
    await expect(page.getByTestId('payment-cash')).toHaveCount(0);
  });

  test('blocks delivery order when address is empty', async ({ page }) => {
    const draft = makeDraft();

    await page.addInitScript((payload) => {
      localStorage.setItem('order:checkout-draft:v1', JSON.stringify(payload));
      sessionStorage.removeItem('orderCart');
      sessionStorage.removeItem('orderBranchId');
      sessionStorage.removeItem('orderBrandSlug');
      sessionStorage.removeItem('orderBranchSlug');
    }, draft);

    let called = false;
    await page.route('**/public/orders', async (route) => {
      called = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'order-1' }),
      });
    });

    await page.goto('/order/branch/branch-1/checkout');

    await page.getByTestId('fulfillment-delivery').click();
    await page.getByTestId('customer-name-input').fill('홍길동');
    await page.getByTestId('submit-order-button').click();

    await page.waitForTimeout(500);
    expect(called).toBe(false);
    await expect(page).toHaveURL(/\/order\/branch\/branch-1\/checkout/);
  });

  test('redirects to menu page when checkout draft is missing', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('order:checkout-draft:v1');
      sessionStorage.removeItem('orderCart');
      sessionStorage.removeItem('orderBranchId');
      sessionStorage.removeItem('orderBrandSlug');
      sessionStorage.removeItem('orderBranchSlug');
    });

    await page.goto('/order/branch/branch-1/checkout');
    await expect(page).toHaveURL(/\/order\/branch\/branch-1$/);
  });

  test('loads checkout from localStorage draft key', async ({ page }) => {
    const draft = makeDraft();

    await page.addInitScript((payload) => {
      localStorage.setItem('order:checkout-draft:v1', JSON.stringify(payload));
      sessionStorage.removeItem('orderCart');
      sessionStorage.removeItem('orderBranchId');
      sessionStorage.removeItem('orderBrandSlug');
      sessionStorage.removeItem('orderBranchSlug');
    }, draft);

    await page.goto('/order/branch/branch-1/checkout');

    const stored = await page.evaluate(
      (key) => localStorage.getItem(key),
      CHECKOUT_DRAFT_KEY,
    );
    expect(stored).toBeTruthy();
    await expect(page.getByTestId('submit-order-button')).toBeVisible();
  });

  test('supports dine-in checkout on brand/branch slug route without address', async ({
    page,
  }) => {
    const draft = makeDraft({
      brandSlug: 'test-cafe-chain',
      branchSlug: 'gangnam-main',
      enabledFulfillmentTypes: ['PICKUP', 'DELIVERY', 'DINE_IN'],
      selectedFulfillmentType: 'DINE_IN',
      allowedPaymentMethods: ['CARD', 'TRANSFER'],
      selectedPaymentMethod: 'TRANSFER',
    });

    await page.addInitScript((payload) => {
      localStorage.setItem('order:checkout-draft:v1', JSON.stringify(payload));
      sessionStorage.removeItem('orderCart');
      sessionStorage.removeItem('orderBranchId');
      sessionStorage.removeItem('orderBrandSlug');
      sessionStorage.removeItem('orderBranchSlug');
    }, draft);

    let requestBody: Record<string, unknown> | null = null;
    await page.route('**/public/orders', async (route) => {
      requestBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'order-2' }),
      });
    });

    await page.goto('/order/test-cafe-chain/gangnam-main/checkout');
    await page.getByTestId('fulfillment-dine_in').click();
    await page.getByTestId('payment-transfer').click();
    await page.getByTestId('customer-name-input').fill('홍길동');
    await page.getByTestId('submit-order-button').click();

    await expect.poll(() => requestBody).not.toBeNull();
    expect(requestBody?.fulfillmentType).toBe('DINE_IN');
    expect(requestBody?.paymentMethod).toBe('TRANSFER');
    expect(requestBody?.branchId).toBe('branch-1');
    expect(requestBody?.customerAddress1).toBeUndefined();
  });

  test('redirects to menu page when brand/branch slug checkout draft is missing', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('order:checkout-draft:v1');
      sessionStorage.removeItem('orderCart');
      sessionStorage.removeItem('orderBranchId');
      sessionStorage.removeItem('orderBrandSlug');
      sessionStorage.removeItem('orderBranchSlug');
    });

    await page.goto('/order/test-cafe-chain/gangnam-main/checkout');
    await expect(page).toHaveURL(/\/order\/test-cafe-chain\/gangnam-main$/);
  });
});
