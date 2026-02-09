import { PaymentsService } from './payments.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import {
  PaymentNotFoundException,
  PaymentProviderException,
  RefundNotAllowedException,
  RefundAmountExceededException,
  WebhookSignatureVerificationException,
  PaymentNotAllowedException,
  OrderAlreadyPaidException,
  PaymentAmountMismatchException,
} from '../../common/exceptions/payment.exception';
import { OrderNotFoundException } from '../../common/exceptions/order.exception';
import { PaymentStatus } from './dto/payment.dto';
import { BusinessException } from '../../common/exceptions/business.exception';

describe('PaymentsService', () => {
  const originalEnv = process.env;
  let ordersChain: any;
  let paymentsChain: any;
  let webhookChain: any;
  let mockSb: any;

  const makeChain = () => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
    single: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
  });

  const setupService = (env: Record<string, string | undefined> = {}) => {
    process.env = { ...originalEnv, ...env };
    ordersChain = makeChain();
    paymentsChain = makeChain();
    webhookChain = makeChain();

    mockSb = {
      from: jest.fn((table: string) => {
        if (table === 'orders') return ordersChain;
        if (table === 'payments') return paymentsChain;
        if (table === 'payment_webhook_logs') return webhookChain;
        return ordersChain;
      }),
    };

    const supabase = { adminClient: jest.fn(() => mockSb) };
    return new PaymentsService(supabase as SupabaseService);
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('isUuid should validate', () => {
    const service = setupService();
    expect((service as any).isUuid('bad')).toBe(false);
    expect((service as any).isUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
  });

  it('preparePayment should throw when order not found', async () => {
    const service = setupService();
    ordersChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      service.preparePayment({ orderId: 'missing', amount: 10 } as any),
    ).rejects.toThrow(OrderNotFoundException);
  });

  it('preparePayment should return details when valid', async () => {
    const service = setupService();
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: 'O-1',
          total_amount: 10,
          customer_name: 'A',
          customer_phone: '010',
          status: 'CREATED',
          payment_status: 'PENDING',
          items: [{ product_name_snapshot: 'P' }],
        },
        error: null,
      });
    paymentsChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await service.preparePayment({ orderId: 'o1', amount: 10 } as any);
    expect(result.orderId).toBe('o1');
    expect(result.amount).toBe(10);
  });

  it('preparePayment should throw on order fetch error', async () => {
    const service = setupService();
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(
      service.preparePayment({ orderId: 'o1', amount: 10 } as any),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('preparePayment should reject cancelled orders and already paid', async () => {
    const service = setupService();
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: 'O-1',
          total_amount: 10,
          customer_name: 'A',
          customer_phone: '010',
          status: 'CANCELLED',
          payment_status: 'PENDING',
          items: [],
        },
        error: null,
      });

    await expect(
      service.preparePayment({ orderId: 'o1', amount: 10 } as any),
    ).rejects.toBeInstanceOf(PaymentNotAllowedException);

    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: 'O-1',
          total_amount: 10,
          customer_name: 'A',
          customer_phone: '010',
          status: 'CREATED',
          payment_status: 'PAID',
          items: [],
        },
        error: null,
      });

    await expect(
      service.preparePayment({ orderId: 'o1', amount: 10 } as any),
    ).rejects.toBeInstanceOf(OrderAlreadyPaidException);
  });

  it('preparePayment should reject amount mismatch and existing success payment', async () => {
    const service = setupService();
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: 'O-1',
          total_amount: 10,
          customer_name: 'A',
          customer_phone: '010',
          status: 'CREATED',
          payment_status: 'PENDING',
          items: [],
        },
        error: null,
      });

    await expect(
      service.preparePayment({ orderId: 'o1', amount: 5 } as any),
    ).rejects.toBeInstanceOf(PaymentAmountMismatchException);

    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: 'O-1',
          total_amount: 10,
          customer_name: 'A',
          customer_phone: '010',
          status: 'CREATED',
          payment_status: 'PENDING',
          items: [],
        },
        error: null,
      });
    paymentsChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'p1', status: PaymentStatus.SUCCESS },
      error: null,
    });

    await expect(
      service.preparePayment({ orderId: 'o1', amount: 10 } as any),
    ).rejects.toBeInstanceOf(OrderAlreadyPaidException);
  });

  it('confirmPayment should succeed in mock mode', async () => {
    const service = setupService({ TOSS_MOCK_MODE: 'true' });
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: 'O-1',
          total_amount: 10,
          customer_name: 'A',
          customer_phone: '010',
          status: 'CREATED',
          payment_status: 'PENDING',
          items: [],
        },
        error: null,
      });
    paymentsChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    paymentsChain.single.mockResolvedValueOnce({
      data: { id: 'pay1', amount: 10 },
      error: null,
    });

    const result = await service.confirmPayment({ orderId: 'o1', amount: 10, paymentKey: 'pk' } as any);
    expect(result.status).toBe(PaymentStatus.SUCCESS);
  });

  it('confirmPayment should reject when already paid', async () => {
    const service = setupService({ TOSS_MOCK_MODE: 'true' });
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: 'O-1',
          total_amount: 10,
          customer_name: 'A',
          customer_phone: '010',
          status: 'CREATED',
          payment_status: 'PENDING',
          items: [],
        },
        error: null,
      });
    paymentsChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'pay1', status: PaymentStatus.SUCCESS },
      error: null,
    });

    await expect(
      service.confirmPayment({ orderId: 'o1', amount: 10, paymentKey: 'pk' } as any),
    ).rejects.toBeInstanceOf(OrderAlreadyPaidException);
  });

  it('confirmPayment should reject on amount mismatch', async () => {
    const service = setupService({ TOSS_MOCK_MODE: 'true' });
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: 'O-1',
          total_amount: 10,
          customer_name: 'A',
          customer_phone: '010',
          status: 'CREATED',
          payment_status: 'PENDING',
          items: [],
        },
        error: null,
      });

    await expect(
      service.confirmPayment({ orderId: 'o1', amount: 9, paymentKey: 'pk' } as any),
    ).rejects.toBeInstanceOf(PaymentAmountMismatchException);
  });

  it('confirmPayment should update existing payment record', async () => {
    const service = setupService({ TOSS_MOCK_MODE: 'true' });
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: 'O-1',
          total_amount: 10,
          customer_name: 'A',
          customer_phone: '010',
          status: 'CREATED',
          payment_status: 'PENDING',
          items: [],
        },
        error: null,
      });
    paymentsChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'pay1', status: PaymentStatus.PENDING },
      error: null,
    });
    paymentsChain.single.mockResolvedValueOnce({
      data: { id: 'pay1', amount: 10 },
      error: null,
    });

    const result = await service.confirmPayment({ orderId: 'o1', amount: 10, paymentKey: 'pk' } as any);
    expect(result.paymentId).toBe('pay1');
  });

  it('confirmPayment should throw provider exception when api fails', async () => {
    const service = setupService({ TOSS_SECRET_KEY: 'secret', TOSS_MOCK_MODE: 'false' });
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('fail'));

    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: 'O-1',
          total_amount: 10,
          customer_name: 'A',
          customer_phone: '010',
          status: 'CREATED',
          payment_status: 'PENDING',
          items: [],
        },
        error: null,
      });
    paymentsChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    paymentsChain.insert.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      service.confirmPayment({ orderId: 'o1', amount: 10, paymentKey: 'pk' } as any),
    ).rejects.toBeInstanceOf(PaymentProviderException);
  });

  it('confirmPayment should update existing payment and throw on update error', async () => {
    const service = setupService({ TOSS_MOCK_MODE: 'true' });
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: 'O-1',
          total_amount: 10,
          customer_name: 'A',
          customer_phone: '010',
          status: 'CREATED',
          payment_status: 'PENDING',
          items: [],
        },
        error: null,
      });
    paymentsChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'pay1', status: PaymentStatus.PENDING },
      error: null,
    });
    paymentsChain.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(
      service.confirmPayment({ orderId: 'o1', amount: 10, paymentKey: 'pk' } as any),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('confirmPayment should throw when secret key missing in production', async () => {
    const service = setupService({ NODE_ENV: 'production', TOSS_MOCK_MODE: 'false' });
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: 'O-1',
          total_amount: 10,
          customer_name: 'A',
          customer_phone: '010',
          status: 'CREATED',
          payment_status: 'PENDING',
          items: [],
        },
        error: null,
      });
    paymentsChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      service.confirmPayment({ orderId: 'o1', amount: 10, paymentKey: 'pk' } as any),
    ).rejects.toBeInstanceOf(PaymentProviderException);
  });

  it('confirmPayment should succeed with real API response', async () => {
    const service = setupService({ TOSS_SECRET_KEY: 'secret', TOSS_MOCK_MODE: 'false', NODE_ENV: 'production' });
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ paymentKey: 'pk', approvedAt: 't' }),
    });

    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: 'O-1',
          total_amount: 10,
          customer_name: 'A',
          customer_phone: '010',
          status: 'CREATED',
          payment_status: 'PENDING',
          items: [],
        },
        error: null,
      });
    paymentsChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    paymentsChain.single.mockResolvedValueOnce({
      data: { id: 'pay1', amount: 10 },
      error: null,
    });

    const result = await service.confirmPayment({ orderId: 'o1', amount: 10, paymentKey: 'pk' } as any);
    expect(result.paymentId).toBe('pay1');
  });

  it('confirmPayment should throw when insert fails', async () => {
    const service = setupService({ TOSS_SECRET_KEY: 'secret', TOSS_MOCK_MODE: 'false', NODE_ENV: 'production' });
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ paymentKey: 'pk', approvedAt: 't' }),
    });

    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: 'O-1',
          total_amount: 10,
          customer_name: 'A',
          customer_phone: '010',
          status: 'CREATED',
          payment_status: 'PENDING',
          items: [],
        },
        error: null,
      });
    paymentsChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    paymentsChain.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(
      service.confirmPayment({ orderId: 'o1', amount: 10, paymentKey: 'pk' } as any),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('getPaymentStatus should throw when payment missing', async () => {
    const service = setupService();
    ordersChain.maybeSingle.mockResolvedValueOnce({ data: { id: 'o1' }, error: null });
    paymentsChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(service.getPaymentStatus('o1')).rejects.toBeInstanceOf(PaymentNotFoundException);
  });

  it('getPaymentStatus should throw on fetch error', async () => {
    const service = setupService();
    ordersChain.maybeSingle.mockResolvedValueOnce({ data: { id: 'o1' }, error: null });
    paymentsChain.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(service.getPaymentStatus('o1')).rejects.toBeInstanceOf(BusinessException);
  });

  it('getPaymentStatus should throw when order id cannot be resolved', async () => {
    const service = setupService();
    ordersChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(service.getPaymentStatus('ORD-1')).rejects.toBeInstanceOf(
      OrderNotFoundException,
    );
  });

  it('getPayments should return paginated list', async () => {
    const service = setupService();
    paymentsChain.range.mockResolvedValueOnce({
      data: [
        {
          id: 'p1',
          order_id: 'o1',
          amount: 10,
          status: PaymentStatus.SUCCESS,
          provider: 'TOSS',
          payment_method: 'CARD',
          paid_at: 't',
          created_at: 't',
          orders: { order_no: 'O-1', branch_id: 'b1' },
        },
      ],
      error: null,
      count: 1,
    });

    const result = await service.getPayments('b1', { page: 1, limit: 10 });
    expect(result.data).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
  });

  it('getPayments should throw on error', async () => {
    const service = setupService();
    paymentsChain.range.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
      count: null,
    });

    await expect(service.getPayments('b1', { page: 1, limit: 10 })).rejects.toBeInstanceOf(BusinessException);
  });

  it('getPaymentDetail should return detail and throw on not found', async () => {
    const service = setupService();
    paymentsChain.maybeSingle
      .mockResolvedValueOnce({
        data: {
          id: 'p1',
          order_id: 'o1',
          amount: 10,
          currency: 'KRW',
          provider: 'TOSS',
          status: PaymentStatus.SUCCESS,
          payment_method: 'CARD',
          provider_payment_id: 'pid',
          provider_payment_key: 'pk',
          created_at: 't',
          updated_at: 't',
          orders: { order_no: 'O-1', branch_id: 'b1' },
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });

    const result = await service.getPaymentDetail('p1', 'b1');
    expect(result.id).toBe('p1');

    await expect(service.getPaymentDetail('missing', 'b1')).rejects.toBeInstanceOf(PaymentNotFoundException);
  });

  it('getPaymentDetail should throw on fetch error', async () => {
    const service = setupService();
    paymentsChain.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(service.getPaymentDetail('p1', 'b1')).rejects.toBeInstanceOf(BusinessException);
  });

  it('refundPayment should throw on fetch error and not found', async () => {
    const service = setupService({ TOSS_MOCK_MODE: 'true' });
    paymentsChain.maybeSingle
      .mockResolvedValueOnce({ data: null, error: { message: 'fail' } })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(
      service.refundPayment('p1', 'b1', { amount: 1, reason: 'x' } as any),
    ).rejects.toBeInstanceOf(BusinessException);

    await expect(
      service.refundPayment('p1', 'b1', { amount: 1, reason: 'x' } as any),
    ).rejects.toBeInstanceOf(PaymentNotFoundException);
  });

  it('refundPayment should throw when provider payment key missing in non-mock mode', async () => {
    const service = setupService({ TOSS_SECRET_KEY: 'secret', TOSS_MOCK_MODE: 'false', NODE_ENV: 'production' });
    paymentsChain.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'p1',
        amount: 10,
        refund_amount: 0,
        status: PaymentStatus.SUCCESS,
        provider_payment_key: null,
        orders: { branch_id: 'b1' },
      },
      error: null,
    });

    await expect(
      service.refundPayment('p1', 'b1', { amount: 1, reason: 'x' } as any),
    ).rejects.toBeInstanceOf(PaymentProviderException);
  });

  it('refundPayment should update in non-mock mode', async () => {
    const service = setupService({ TOSS_SECRET_KEY: 'secret', TOSS_MOCK_MODE: 'false', NODE_ENV: 'production' });
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true }),
    });

    paymentsChain.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'p1',
        amount: 10,
        refund_amount: 0,
        status: PaymentStatus.SUCCESS,
        provider_payment_key: 'pk',
        orders: { branch_id: 'b1' },
      },
      error: null,
    });
    paymentsChain.single.mockResolvedValueOnce({
      data: { id: 'p1', status: PaymentStatus.REFUNDED },
      error: null,
    });

    const result = await service.refundPayment('p1', 'b1', { amount: 10, reason: 'x' } as any);
    expect(result.status).toBe(PaymentStatus.REFUNDED);
  });

  it('refundPayment should throw on update error', async () => {
    const service = setupService({ TOSS_MOCK_MODE: 'true' });
    paymentsChain.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'p1',
        amount: 10,
        refund_amount: 0,
        status: PaymentStatus.SUCCESS,
        orders: { branch_id: 'b1' },
      },
      error: null,
    });
    paymentsChain.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(
      service.refundPayment('p1', 'b1', { amount: 10, reason: 'x' } as any),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('callTossApi should throw on non-ok response and abort', async () => {
    const service = setupService({ TOSS_SECRET_KEY: 'secret', TOSS_MOCK_MODE: 'false', NODE_ENV: 'production' });
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ message: 'bad' }),
    });

    await expect(
      (service as any).callTossApi('/payments/confirm', { a: 1 }),
    ).rejects.toBeInstanceOf(PaymentProviderException);

    (global as any).fetch = jest.fn().mockRejectedValue({ name: 'AbortError' });

    await expect(
      (service as any).callTossApi('/payments/confirm', { a: 1 }),
    ).rejects.toBeInstanceOf(PaymentProviderException);
  });

  it('callTossApi should return raw body when response is not JSON', async () => {
    const service = setupService({ TOSS_SECRET_KEY: 'secret', TOSS_MOCK_MODE: 'false', NODE_ENV: 'production' });
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => 'not-json',
    });

    const result = await (service as any).callTossApi('/payments/confirm', { a: 1 });
    expect(result).toEqual({ raw: 'not-json' });
  });

  it('callTossApi should throw when secret key is missing', async () => {
    const service = setupService({ TOSS_MOCK_MODE: 'false' });

    await expect(
      (service as any).callTossApi('/payments/confirm', { a: 1 }),
    ).rejects.toBeInstanceOf(PaymentProviderException);
  });

  it('handleTossWebhook should log unhandled events and update log', async () => {
    const service = setupService();
    paymentsChain.maybeSingle.mockResolvedValueOnce({ data: { id: 'p1', order_id: 'o1' }, error: null });

    await service.handleTossWebhook(
      { eventType: 'UNKNOWN', data: { orderId: 'o1', paymentKey: 'pk', status: 'DONE', amount: 10 } } as any,
      { 'toss-signature': 'x' },
      Buffer.from('test'),
    );
  });

  it('handleTossWebhook should process PAYMENT_CONFIRMED with signature', async () => {
    const service = setupService({ TOSS_WEBHOOK_SECRET: 'secret', TOSS_WEBHOOK_SIGNATURE_HEADER: 'toss-signature' });
    const body = Buffer.from('payload');
    const crypto = require('crypto');
    const sig = crypto.createHmac('sha256', 'secret').update(body).digest('hex');

    paymentsChain.eq
      .mockReturnValueOnce(paymentsChain) // payment lookup
      .mockReturnValueOnce(paymentsChain) // update eq order_id
      .mockResolvedValueOnce({ error: null }); // update eq payment_key terminal
    paymentsChain.maybeSingle.mockResolvedValueOnce({ data: { id: 'p1', order_id: 'o1' }, error: null });
    ordersChain.maybeSingle.mockResolvedValueOnce({ data: { id: 'o1' }, error: null });
    webhookChain.insert.mockResolvedValueOnce({ error: null });
    webhookChain.eq.mockReturnValue(webhookChain);

    await service.handleTossWebhook(
      {
        eventType: 'PAYMENT_CONFIRMED',
        data: {
          orderId: '123e4567-e89b-12d3-a456-426614174000',
          paymentKey: 'pk',
          status: 'DONE',
          amount: 10,
        },
      } as any,
      { 'toss-signature': `v1=${sig}` },
      body,
    );
  });

  it('handleTossWebhook should log error when handler fails', async () => {
    const service = setupService();

    paymentsChain.maybeSingle.mockResolvedValueOnce({ data: { id: 'p1', order_id: 'o1' }, error: null });
    ordersChain.maybeSingle.mockResolvedValueOnce({ data: { id: 'o1' }, error: null });

    webhookChain.insert.mockResolvedValueOnce({ error: null });
    webhookChain.update.mockReturnValue(webhookChain);
    webhookChain.eq
      .mockReturnValueOnce(webhookChain)
      .mockResolvedValueOnce({ error: null });

    let eqCount = 0;
    paymentsChain.eq.mockImplementation(() => {
      eqCount += 1;
      if (eqCount === 1) return paymentsChain; // lookup
      if (eqCount === 2) return paymentsChain; // update eq order_id
      if (eqCount === 3) return { error: { message: 'fail' } }; // update eq payment_key terminal
      return paymentsChain;
    });
    paymentsChain.update.mockReturnValue(paymentsChain);

    await expect(
      service.handleTossWebhook(
        {
          eventType: 'PAYMENT_CONFIRMED',
          data: { orderId: 'o1', paymentKey: 'pk', status: 'DONE', amount: 10 },
        } as any,
        {},
        Buffer.from('body'),
      ),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('handleTossWebhook should throw on invalid signature', async () => {
    const service = setupService({ TOSS_WEBHOOK_SECRET: 'secret' });
    const body = Buffer.from('payload');

    await expect(
      service.handleTossWebhook(
        { eventType: 'PAYMENT_CONFIRMED', data: { orderId: 'o1', paymentKey: 'pk', status: 'DONE', amount: 10 } } as any,
        { 'toss-signature': 'bad' },
        body,
      ),
    ).rejects.toBeInstanceOf(WebhookSignatureVerificationException);
  });

  it('handleTossWebhook should process PAYMENT_CANCELLED', async () => {
    const service = setupService();
    let eqCount = 0;
    paymentsChain.eq.mockImplementation(() => {
      eqCount += 1;
      if (eqCount === 1) return paymentsChain; // lookup
      if (eqCount === 2) return paymentsChain; // update order_id
      if (eqCount === 3) return { error: null }; // update payment_key
      return paymentsChain;
    });
    paymentsChain.update.mockReturnValue(paymentsChain);
    paymentsChain.maybeSingle.mockResolvedValueOnce({ data: { id: 'p1', order_id: 'o1' }, error: null });
    ordersChain.maybeSingle.mockResolvedValueOnce({ data: { id: 'o1' }, error: null });

    webhookChain.insert.mockResolvedValueOnce({ error: null });
    webhookChain.update.mockReturnValue(webhookChain);
    webhookChain.eq
      .mockReturnValueOnce(webhookChain)
      .mockResolvedValueOnce({ error: null });

    await service.handleTossWebhook(
      {
        eventType: 'PAYMENT_CANCELLED',
        data: { orderId: '123e4567-e89b-12d3-a456-426614174000', paymentKey: 'pk', status: 'CANCELLED', amount: 10 },
      } as any,
      {},
      Buffer.from('body'),
    );
  });

  it('refundPayment should validate status and amount', async () => {
    const service = setupService({ TOSS_MOCK_MODE: 'true' });
    paymentsChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'p1', amount: 10, refund_amount: 0, status: PaymentStatus.FAILED, orders: { branch_id: 'b1' } },
      error: null,
    });

    await expect(
      service.refundPayment('p1', 'b1', { amount: 5, reason: 'x' } as any),
    ).rejects.toBeInstanceOf(RefundNotAllowedException);

    paymentsChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'p1', amount: 10, refund_amount: 8, status: PaymentStatus.SUCCESS, orders: { branch_id: 'b1' } },
      error: null,
    });

    await expect(
      service.refundPayment('p1', 'b1', { amount: 5, reason: 'x' } as any),
    ).rejects.toBeInstanceOf(RefundAmountExceededException);
  });

  it('refundPayment should update payment in mock mode', async () => {
    const service = setupService({ TOSS_MOCK_MODE: 'true' });
    paymentsChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'p1', amount: 10, refund_amount: 0, status: PaymentStatus.SUCCESS, orders: { branch_id: 'b1' } },
      error: null,
    });
    paymentsChain.single.mockResolvedValueOnce({
      data: { id: 'p1', status: PaymentStatus.REFUNDED },
      error: null,
    });

    const result = await service.refundPayment('p1', 'b1', { amount: 10, reason: 'x' } as any);
    expect(result.status).toBe(PaymentStatus.REFUNDED);
  });

  it('verifyTossWebhookSignature should validate signature', () => {
    const service = setupService({ TOSS_WEBHOOK_SECRET: 'secret', TOSS_WEBHOOK_SIGNATURE_HEADER: 'toss-signature' });
    const body = Buffer.from('test');
    const crypto = require('crypto');
    const sig = crypto.createHmac('sha256', 'secret').update(body).digest('hex');

    const ok = (service as any).verifyTossWebhookSignature(body, { 'toss-signature': `v1=${sig}` });
    const bad = (service as any).verifyTossWebhookSignature(body, { 'toss-signature': 'bad' });

    expect(ok).toBe(true);
    expect(bad).toBe(false);
  });

  it('verifyTossWebhookSignature should return true when secret is missing', () => {
    const service = setupService({ TOSS_WEBHOOK_SECRET: '' });
    const ok = (service as any).verifyTossWebhookSignature(Buffer.from('x'), {});
    expect(ok).toBe(true);
  });

  it('verifyTossWebhookSignature should return false when header missing', () => {
    const service = setupService({ TOSS_WEBHOOK_SECRET: 'secret', TOSS_WEBHOOK_SIGNATURE_HEADER: 'toss-signature' });
    const body = Buffer.from('test');
    const ok = (service as any).verifyTossWebhookSignature(body, {});
    expect(ok).toBe(false);
  });

  it('handleTossWebhook should require signature when secret set', async () => {
    const service = setupService({ TOSS_WEBHOOK_SECRET: 'secret' });
    await expect(
      service.handleTossWebhook({ eventType: 'PAYMENT_CONFIRMED', data: { orderId: 'o1', paymentKey: 'pk', status: 'DONE', amount: 10 } } as any, {}, undefined),
    ).rejects.toBeInstanceOf(WebhookSignatureVerificationException);
  });
});
