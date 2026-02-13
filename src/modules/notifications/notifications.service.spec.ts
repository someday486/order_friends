import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { NotificationType } from './dto/notification.dto';

describe('NotificationsService', () => {
  const makeConfig = (values: Record<string, string | undefined>) =>
    ({
      get: (key: string) => values[key],
    }) as ConfigService;

  it('should send email and sms in mock mode', async () => {
    const service = new NotificationsService(makeConfig({}));

    const emailResult = await service.sendOrderConfirmation(
      'o1',
      {
        orderNo: 'O-1',
        customerName: 'A',
        orderedAt: '2024-01-01T00:00:00Z',
        items: [{ name: 'P', qty: 1, unitPrice: 10 }],
        subtotal: 10,
        shippingFee: 0,
        discount: 0,
        total: 10,
      },
      'a@test.com',
    );

    const smsResult = await service.sendOrderConfirmationSMS(
      'o1',
      { customerName: 'A', orderNo: 'O-1', total: 10 },
      '010',
    );

    expect(emailResult.success).toBe(true);
    expect(emailResult.type).toBe(NotificationType.EMAIL);
    expect(smsResult.success).toBe(true);
    expect(smsResult.type).toBe(NotificationType.SMS);
  });

  it('should send remaining notifications in mock mode', async () => {
    const service = new NotificationsService(makeConfig({}));

    const statusResult = await service.sendOrderStatusUpdate(
      'o2',
      {
        orderNo: 'O-2',
        customerName: 'B',
        oldStatus: 'PENDING',
        newStatus: 'READY',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      'b@test.com',
    );

    const refundResult = await service.sendRefundConfirmation(
      'o2',
      {
        orderNo: 'O-2',
        customerName: 'B',
        refundAmount: 5,
        refundedAt: '2024-01-01T00:00:00Z',
      },
      'b@test.com',
    );

    const lowStockResult = await service.sendLowStockAlert(
      'p1',
      'b1',
      {
        productName: 'P',
        branchName: 'B',
        currentStock: 1,
        minimumStock: 5,
        alertedAt: '2024-01-01T00:00:00Z',
      },
      'b@test.com',
    );

    const readySms = await service.sendOrderReadySMS(
      'o2',
      { orderNo: 'O-2', branchName: 'B' },
      '010',
    );

    const completeSms = await service.sendDeliveryCompleteSMS(
      'o2',
      { orderNo: 'O-2' },
      '010',
    );

    expect(statusResult.success).toBe(true);
    expect(refundResult.success).toBe(true);
    expect(lowStockResult.success).toBe(true);
    expect(readySms.success).toBe(true);
    expect(completeSms.success).toBe(true);
  });

  it('should send email and sms in non-mock mode', async () => {
    const service = new NotificationsService(
      makeConfig({
        SENDGRID_API_KEY: 'sg',
        SMS_API_KEY: 'sms',
        FROM_EMAIL: 'x@test.com',
        FROM_NAME: 'OF',
      }),
    );

    const emailResult = await service.sendPaymentConfirmation(
      'o1',
      {
        orderNo: 'O-1',
        customerName: 'A',
        paymentMethod: 'CARD',
        amount: 10,
        paidAt: '2024-01-01T00:00:00Z',
        transactionId: 't1',
      },
      'a@test.com',
    );

    const smsResult = await service.sendOrderReadySMS(
      'o1',
      { orderNo: 'O-1', branchName: 'B', branchPhone: '010' },
      '010',
    );

    expect(emailResult.success).toBe(true);
    expect(smsResult.success).toBe(true);
  });

  it('should use mock mode when sms key is missing and log N/A text', async () => {
    const service = new NotificationsService(
      makeConfig({
        SENDGRID_API_KEY: 'sg',
      }),
    );

    const result = await (service as any).sendEmail(
      'a@test.com',
      'subj',
      '<p>html</p>',
    );

    expect(result.success).toBe(true);
    expect(result.type).toBe(NotificationType.EMAIL);
  });

  it('should send KakaoTalk in mock mode without Kakao config', async () => {
    const service = new NotificationsService(makeConfig({}));

    const result = await service.sendKakaoTalk(
      '01012345678',
      'Test message',
      'template-1',
    );

    expect(result.success).toBe(true);
    expect(result.type).toBe(NotificationType.KAKAO_TALK);
    expect(result.recipient).toBe('01012345678');
  });

  it('should send KakaoTalk with API mode when configured', async () => {
    const originalFetch = (globalThis as any).fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('{"result":"ok"}'),
    });
    (globalThis as any).fetch = fetchMock;

    const service = new NotificationsService(
      makeConfig({
        SENDGRID_API_KEY: 'sg',
        SMS_API_KEY: 'sms',
        KAKAO_TALK_API_URL: 'https://example.com/kakao/talk/send',
        KAKAO_TALK_ACCESS_TOKEN: 'kakao-token',
      }),
    );

    const result = await service.sendKakaoTalk(
      '01012345678',
      'Test message',
      'template-1',
    );

    try {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/kakao/talk/send',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer kakao-token',
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('"phone":"01012345678"'),
        }),
      );
      expect(result.success).toBe(true);
      expect(result.type).toBe(NotificationType.KAKAO_TALK);
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  it('should render templates without optional fields', () => {
    const service = new NotificationsService(makeConfig({}));

    const statusTemplate = (service as any).getOrderStatusUpdateEmailTemplate({
      orderNo: 'O-2',
      customerName: 'B',
      oldStatus: 'PENDING',
      newStatus: 'READY',
      updatedAt: '2024-01-01T00:00:00Z',
    });

    const paymentTemplate = (
      service as any
    ).getPaymentConfirmationEmailTemplate({
      orderNo: 'O-2',
      customerName: 'B',
      paymentMethod: 'CARD',
      amount: 20,
      paidAt: '2024-01-01T00:00:00Z',
    });

    const refundTemplate = (service as any).getRefundConfirmationEmailTemplate({
      orderNo: 'O-2',
      customerName: 'B',
      refundAmount: 5,
      refundedAt: '2024-01-01T00:00:00Z',
    });

    const lowStockTemplate = (service as any).getLowStockAlertEmailTemplate({
      productName: 'P',
      branchName: 'B',
      currentStock: 1,
      minimumStock: 5,
      alertedAt: '2024-01-01T00:00:00Z',
    });

    expect(statusTemplate.subject).toContain('Order Status Update');
    expect(paymentTemplate.subject).toContain('Payment Confirmation');
    expect(refundTemplate.subject).toContain('Refund Confirmation');
    expect(lowStockTemplate.subject).toContain('Low Stock Alert');
  });

  it('should omit delivery memo when not provided', () => {
    const service = new NotificationsService(makeConfig({}));
    const orderTemplate = (service as any).getOrderConfirmationEmailTemplate({
      orderNo: 'O-1',
      customerName: 'A',
      orderedAt: '2024-01-01T00:00:00Z',
      items: [{ name: 'P', qty: 2, unitPrice: 5 }],
      subtotal: 10,
      shippingFee: 0,
      discount: 0,
      total: 10,
      deliveryAddress: 'Addr',
    });

    expect(orderTemplate.html).toContain('Delivery');
    expect(orderTemplate.html).not.toContain('Note:');
  });

  it('should fallback to raw status when not mapped', () => {
    const service = new NotificationsService(makeConfig({}));
    const statusTemplate = (service as any).getOrderStatusUpdateEmailTemplate({
      orderNo: 'O-9',
      customerName: 'A',
      oldStatus: 'PENDING',
      newStatus: 'CUSTOM',
      updatedAt: '2024-01-01T00:00:00Z',
    });

    expect(statusTemplate.html).toContain('CUSTOM');
    expect(statusTemplate.text).toContain('CUSTOM');
    expect(statusTemplate.text).not.toContain('Message:');
  });

  it('should handle send errors gracefully', async () => {
    const service = new NotificationsService(makeConfig({}));
    const logger = (service as any).logger;
    jest.spyOn(logger, 'log').mockImplementation(() => {
      throw new Error('boom');
    });

    const result = await (service as any).sendEmail(
      'a@test.com',
      'subj',
      '<p>html</p>',
      'text',
    );

    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe('boom');
  });

  it('should build templates with optional sections', () => {
    const service = new NotificationsService(makeConfig({}));
    const orderTemplate = (service as any).getOrderConfirmationEmailTemplate({
      orderNo: 'O-1',
      customerName: 'A',
      orderedAt: '2024-01-01T00:00:00Z',
      items: [{ name: 'P', qty: 2, unitPrice: 5, option: 'Opt' }],
      subtotal: 10,
      shippingFee: 0,
      discount: 1,
      total: 9,
      deliveryAddress: 'Addr',
      deliveryMemo: 'Memo',
    });

    const statusTemplate = (service as any).getOrderStatusUpdateEmailTemplate({
      orderNo: 'O-1',
      customerName: 'A',
      oldStatus: 'PENDING',
      newStatus: 'READY',
      updatedAt: '2024-01-01T00:00:00Z',
      statusMessage: 'ok',
    });

    const paymentTemplate = (
      service as any
    ).getPaymentConfirmationEmailTemplate({
      orderNo: 'O-1',
      customerName: 'A',
      paymentMethod: 'CARD',
      amount: 10,
      paidAt: '2024-01-01T00:00:00Z',
      transactionId: 't1',
    });

    const refundTemplate = (service as any).getRefundConfirmationEmailTemplate({
      orderNo: 'O-1',
      customerName: 'A',
      refundAmount: 5,
      refundedAt: '2024-01-01T00:00:00Z',
      refundReason: 'x',
      transactionId: 't2',
    });

    const lowStockTemplate = (service as any).getLowStockAlertEmailTemplate({
      productName: 'P',
      productSku: 'SKU',
      branchName: 'B',
      currentStock: 1,
      minimumStock: 5,
      alertedAt: '2024-01-01T00:00:00Z',
    });

    expect(orderTemplate.subject).toContain('Order Confirmation');
    expect(statusTemplate.subject).toContain('Order Status Update');
    expect(paymentTemplate.subject).toContain('Payment Confirmation');
    expect(refundTemplate.subject).toContain('Refund Confirmation');
    expect(lowStockTemplate.subject).toContain('Low Stock Alert');
  });

  it('should build SMS templates', () => {
    const service = new NotificationsService(makeConfig({}));

    const confirm = (service as any).getOrderConfirmationSMSTemplate({
      customerName: 'A',
      orderNo: 'O-1',
      total: 10,
    });
    const ready = (service as any).getOrderReadySMSTemplate({
      orderNo: 'O-1',
      branchName: 'B',
      branchPhone: '010',
    });
    const complete = (service as any).getDeliveryCompleteSMSTemplate({
      orderNo: 'O-1',
    });

    expect(confirm).toContain('Order No: O-1');
    expect(ready).toContain('Contact');
    expect(complete).toContain('delivered');
  });

  it('should build SMS template without branch phone', () => {
    const service = new NotificationsService(makeConfig({}));
    const ready = (service as any).getOrderReadySMSTemplate({
      orderNo: 'O-1',
      branchName: 'B',
    });
    expect(ready).toContain('Order O-1 is ready');
  });

  it('should handle sms send errors gracefully', async () => {
    const service = new NotificationsService(makeConfig({}));
    const logger = (service as any).logger;
    jest.spyOn(logger, 'log').mockImplementation(() => {
      throw new Error('boom');
    });

    const result = await (service as any).sendSMS('010', 'msg');
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe('boom');
  });

  it('should return defaults for retry/status', async () => {
    const service = new NotificationsService(makeConfig({}));

    const retry = await service.retryNotification('n1');
    expect(retry.success).toBe(false);

    const status = await service.getNotificationStatus('n1');
    expect(status).toBeNull();
  });
});
