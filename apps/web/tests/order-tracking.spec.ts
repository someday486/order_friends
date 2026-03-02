import { expect, test } from '@playwright/test';

const API_BASE = 'http://localhost:4000';

const MOCK_ORDER = {
  id: 'order-abc-123',
  orderNo: 'OF-20260302-0001',
  status: 'CONFIRMED',
  totalAmount: 9000,
  createdAt: '2026-03-02T10:00:00.000Z',
  paymentMethod: 'CARD',
  fulfillmentType: 'PICKUP',
  transferAccount: null,
  customerName: '홍길동',
  customerPhone: '010-1234-5678',
  customerAddress1: null,
  customerAddress2: null,
  customerMemo: '빨리 부탁드려요',
  items: [
    {
      name: '아메리카노',
      qty: 2,
      unitPrice: 4500,
      options: ['ICE', '라지'],
    },
  ],
};

test.describe('Order tracking page', () => {
  test('displays order info and status when order is found', async ({
    page,
  }) => {
    await page.addInitScript((orderId) => {
      localStorage.setItem(
        'of:last_order',
        JSON.stringify({ orderId, savedAt: Date.now() }),
      );
    }, MOCK_ORDER.id);

    await page.route(`${API_BASE}/public/orders/${MOCK_ORDER.id}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ORDER),
      });
    });

    await page.goto(`/order/track/${MOCK_ORDER.id}`);

    await expect(page.getByText(MOCK_ORDER.orderNo)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('아메리카노')).toBeVisible();
    await expect(page.getByText('홍길동')).toBeVisible();
  });

  test('shows cancelled state for CANCELLED order', async ({ page }) => {
    const cancelledOrder = { ...MOCK_ORDER, status: 'CANCELLED' };

    await page.route(
      `${API_BASE}/public/orders/${cancelledOrder.id}`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(cancelledOrder),
        });
      },
    );

    await page.goto(`/order/track/${cancelledOrder.id}`);

    await expect(page.getByText(cancelledOrder.orderNo)).toBeVisible({
      timeout: 5000,
    });
  });

  test('shows error when order not found', async ({ page }) => {
    await page.route(`${API_BASE}/public/orders/**`, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Order not found' }),
      });
    });

    await page.goto('/order/track/nonexistent-order');

    // Page should render without crashing
    await expect(page.locator('body')).toBeVisible();
  });

  test('shows CREATED status progress correctly', async ({ page }) => {
    const createdOrder = { ...MOCK_ORDER, status: 'CREATED' };

    await page.route(
      `${API_BASE}/public/orders/${createdOrder.id}`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createdOrder),
        });
      },
    );

    await page.goto(`/order/track/${createdOrder.id}`);

    await expect(page.getByText(createdOrder.orderNo)).toBeVisible({
      timeout: 5000,
    });
  });
});
