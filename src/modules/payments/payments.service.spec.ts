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

  it('constructor should honor timeout and mock mode env', () => {
    const service = setupService({ TOSS_TIMEOUT_MS: '12000', TOSS_MOCK_MODE: 'yes' });
    expect((service as any).tossTimeoutMs).toBe(12000);
    expect((service as any).tossMockMode).toBe(true);

    const productionService = setupService({
      TOSS_TIMEOUT_MS: '-1',
      TOSS_MOCK_MODE: undefined,
      TOSS_SECRET_KEY: '',
      NODE_ENV: 'production',
    });
    expect((productionService as any).tossTimeoutMs).toBe(15000);
    expect((productionService as any).tossMockMode).toBe(false);
  });

  it('constructor should use explicit secrets and base url', () => {
    const service = setupService({
      TOSS_SECRET_KEY: 'sk',
      TOSS_CLIENT_KEY: 'ck',
      TOSS_API_BASE_URL: 'https://example.com',
      TOSS_WEBHOOK_SECRET: 'wh',
      TOSS_WEBHOOK_SIGNATURE_HEADER: 'X-SIGN',
      TOSS_TIMEOUT_MS: '5000',
      NODE_ENV: 'production',
    });

    expect((service as any).tossSecretKey).toBe('sk');
    expect((service as any).tossClientKey).toBe('ck');
    expect((service as any).tossApiBaseUrl).toBe('https://example.com');
    expect((service as any).tossWebhookSecret).toBe('wh');
    expect((service as any).tossWebhookSignatureHeader).toBe('x-sign');
    expect((service as any).tossTimeoutMs).toBe(5000);
  });

  it('resolveOrderId should resolve uuid with branch filter', async () => {
    const service = setupService();
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    ordersChain.maybeSingle.mockResolvedValueOnce({ data: { id: uuid }, error: null });

    const resolved = await (service as any).resolveOrderId(
      mockSb,
      uuid,
      'branch-1',
    );

    expect(resolved).toBe(uuid);
    expect(ordersChain.eq).toHaveBeenCalledWith('branch_id', 'branch-1');
  });

  it('resolveOrderId should return null when no branch filter and no match', async () => {
    const service = setupService();
    ordersChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const resolved = await (service as any).resolveOrderId(mockSb, 'ORD-1');
    expect(resolved).toBeNull();
    expect(ordersChain.eq).toHaveBeenCalledWith('order_no', 'ORD-1');
  });

  it('getOrderForPayment should throw when order is missing', async () => {
    const service = setupService();
    ordersChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect((service as any).getOrderForPayment('missing')).rejects.toBeInstanceOf(
      OrderNotFoundException,
    );
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
    paymentsChain.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    const result = await service.preparePayment({ orderId: 'o1', amount: 10 } as any);
    expect(result.orderId).toBe('o1');
    expect(result.amount).toBe(10);
  });

  it('preparePayment should build order name for multiple items', async () => {
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
          items: [
            { product_name_snapshot: 'Coffee' },
            { product_name_snapshot: 'Tea' },
          ],
        },
        error: null,
      });
    paymentsChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await service.preparePayment({ orderId: 'o1', amount: 10 } as any);
    expect(result.orderName).toBe('Coffee 외 1건');
  });

  it('preparePayment should fall back to default names and contact', async () => {
    const service = setupService();
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: null,
          total_amount: 10,
          customer_name: null,
          customer_phone: null,
          status: 'CREATED',
          payment_status: 'PENDING',
          items: [{ product_name_snapshot: null }],
        },
        error: null,
      });
    paymentsChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await service.preparePayment({ orderId: 'o1', amount: 10 } as any);
    expect(result.orderName).toBe('상품');
    expect(result.orderNo).toBeNull();
    expect(result.customerName).toBe('怨좉컼');
    expect(result.customerPhone).toBe('');
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

  it('confirmPayment should throw when orderId cannot be resolved', async () => {
    const service = setupService({ TOSS_MOCK_MODE: 'true' });
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(
      service.confirmPayment({ orderId: 'missing', amount: 10, paymentKey: 'pk' } as any),
    ).rejects.toBeInstanceOf(OrderNotFoundException);
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

  it('confirmPayment should return existing payment when already paid', async () => {
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
      data: { id: 'pay1', status: PaymentStatus.SUCCESS, amount: 10, paid_at: 't' },
      error: null,
    });
    const result = await service.confirmPayment({
      orderId: 'o1',
      amount: 10,
      paymentKey: 'pk',
    } as any);
    expect(result.paymentId).toBe('pay1');
    expect(result.paidAt).toBe('t');
  });

  it('confirmPayment should return existing payment for idempotency key', async () => {
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
      data: {
        id: 'pay1',
        order_id: 'o1',
        status: PaymentStatus.SUCCESS,
        amount: 10,
        paid_at: 't',
        idempotency_key: 'idem-1',
      },
      error: null,
    });

    const result = await service.confirmPayment({
      orderId: 'o1',
      amount: 10,
      paymentKey: 'pk',
      idempotencyKey: 'idem-1',
    } as any);

    expect(result.paymentId).toBe('pay1');
    expect(result.paidAt).toBe('t');
  });

  it('confirmPayment should default amount and paidAt for idempotent success', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-02-10T00:00:00.000Z'));
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
      data: {
        id: 'pay1',
        order_id: 'o1',
        status: PaymentStatus.SUCCESS,
        amount: null,
        paid_at: null,
        idempotency_key: 'idem-1',
      },
      error: null,
    });

    const result = await service.confirmPayment({
      orderId: 'o1',
      amount: 10,
      paymentKey: 'pk',
      idempotencyKey: 'idem-1',
    } as any);

    expect(result.amount).toBe(10);
    expect(result.paidAt).toBe('2026-02-10T00:00:00.000Z');
    jest.useRealTimers();
  });

  it('confirmPayment should throw when idempotency key used by another order', async () => {
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
      data: {
        id: 'pay1',
        order_id: 'o2',
        status: PaymentStatus.PENDING,
        amount: 10,
        paid_at: null,
        idempotency_key: 'idem-1',
      },
      error: null,
    });

    await expect(
      service.confirmPayment({
        orderId: 'o1',
        amount: 10,
        paymentKey: 'pk',
        idempotencyKey: 'idem-1',
      } as any),
    ).rejects.toBeInstanceOf(PaymentNotAllowedException);
  });

  it('confirmPayment should throw when idempotency amount mismatches', async () => {
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
      data: {
        id: 'pay1',
        order_id: 'o1',
        status: PaymentStatus.PENDING,
        amount: 9,
        paid_at: null,
        idempotency_key: 'idem-1',
      },
      error: null,
    });

    await expect(
      service.confirmPayment({
        orderId: 'o1',
        amount: 10,
        paymentKey: 'pk',
        idempotencyKey: 'idem-1',
      } as any),
    ).rejects.toBeInstanceOf(PaymentAmountMismatchException);
  });

  it('confirmPayment should update pending idempotent payment', async () => {
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
      data: {
        id: 'pay1',
        order_id: 'o1',
        status: PaymentStatus.PENDING,
        amount: 10,
        paid_at: null,
        idempotency_key: 'idem-1',
      },
      error: null,
    });
    paymentsChain.single.mockResolvedValueOnce({
      data: { id: 'pay1', amount: 10 },
      error: null,
    });

    const result = await service.confirmPayment({
      orderId: 'o1',
      amount: 10,
      paymentKey: 'pk',
      idempotencyKey: 'idem-1',
    } as any);

    expect(result.paymentId).toBe('pay1');
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

  it('confirmPayment should throw when existing success payment amount mismatches', async () => {
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
      data: { id: 'pay1', status: PaymentStatus.SUCCESS, amount: 5, paid_at: 't' },
      error: null,
    });

    await expect(
      service.confirmPayment({ orderId: 'o1', amount: 10, paymentKey: 'pk' } as any),
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

  it('confirmPayment should mark existing payment as failed on provider error', async () => {
    const service = setupService({ TOSS_SECRET_KEY: 'secret', TOSS_MOCK_MODE: 'false' });
    (service as any).callTossPaymentsConfirmApi = jest
      .fn()
      .mockRejectedValue(new Error('provider down'));

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
      data: { id: 'pay1', order_id: 'o1', status: PaymentStatus.PENDING, idempotency_key: 'idem-1' },
      error: null,
    });

    await expect(
      service.confirmPayment({
        orderId: 'o1',
        amount: 10,
        paymentKey: 'pk',
        idempotencyKey: 'idem-1',
      } as any),
    ).rejects.toBeInstanceOf(PaymentProviderException);

    expect(paymentsChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: PaymentStatus.FAILED }),
    );
  });

  it('confirmPayment should store null idempotency key when provider error and existing payment lacks key', async () => {
    const service = setupService({
      TOSS_SECRET_KEY: 'secret',
      TOSS_MOCK_MODE: 'false',
      NODE_ENV: 'production',
    });
    jest
      .spyOn(service as any, 'callTossPaymentsConfirmApi')
      .mockRejectedValueOnce(new Error('provider down'));

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
      data: { id: 'pay1', order_id: 'o1', status: PaymentStatus.PENDING, idempotency_key: null },
      error: null,
    });

    await expect(
      service.confirmPayment({ orderId: 'o1', amount: 10, paymentKey: 'pk' } as any),
    ).rejects.toBeInstanceOf(PaymentProviderException);

    expect(paymentsChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ idempotency_key: null }),
    );
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

  it('confirmPayment should use dto paymentKey when provider response lacks key', async () => {
    const service = setupService({ TOSS_SECRET_KEY: 'secret', TOSS_MOCK_MODE: 'false', NODE_ENV: 'production' });
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ approvedAt: 't' }),
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

    await service.confirmPayment({ orderId: 'o1', amount: 10, paymentKey: 'pk' } as any);

    expect(paymentsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ provider_payment_id: 'pk' }),
    );
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

  it('confirmPayment should return idempotent payment on unique constraint', async () => {
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
      data: null,
      error: { code: '23505', message: 'dup' },
    });
    paymentsChain.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'pay1',
        order_id: 'o1',
        status: PaymentStatus.SUCCESS,
        amount: 10,
        paid_at: 't',
      },
      error: null,
    });

    const result = await service.confirmPayment({
      orderId: 'o1',
      amount: 10,
      paymentKey: 'pk',
      idempotencyKey: 'idem-1',
    } as any);

    expect(result.paymentId).toBe('pay1');
    expect(result.paidAt).toBe('t');
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

  it('getPaymentStatus should return status when payment exists', async () => {
    const service = setupService();
    ordersChain.maybeSingle.mockResolvedValueOnce({ data: { id: 'o1' }, error: null });
    paymentsChain.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'p1',
        order_id: 'o1',
        status: PaymentStatus.SUCCESS,
        amount: 10,
        paid_at: 't',
        failure_reason: 'none',
      },
      error: null,
    });

    const result = await service.getPaymentStatus('o1');
    expect(result.status).toBe(PaymentStatus.SUCCESS);
    expect(result.paidAt).toBe('t');
    expect(result.failureReason).toBe('none');
  });

  it('getPaymentStatus should throw when order id cannot be resolved', async () => {
    const service = setupService();
    ordersChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(service.getPaymentStatus('ORD-1')).rejects.toBeInstanceOf(
      OrderNotFoundException,
    );
  });

  it('getPaymentStatus should map defaults when nullable fields are missing', async () => {
    const service = setupService();
    ordersChain.maybeSingle.mockResolvedValueOnce({ data: { id: 'o1' }, error: null });
    paymentsChain.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'p1',
        order_id: 'o1',
        status: PaymentStatus.SUCCESS,
        amount: 10,
        paid_at: null,
        failure_reason: null,
      },
      error: null,
    });

    const result = await service.getPaymentStatus('o1');
    expect(result.paidAt).toBeUndefined();
    expect(result.failureReason).toBeUndefined();
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

  it('getPayments should map defaults when join data is missing', async () => {
    const service = setupService();
    paymentsChain.range.mockResolvedValueOnce({
      data: [
        {
          id: 'p1',
          order_id: 'o1',
          amount: 10,
          status: PaymentStatus.SUCCESS,
          provider: 'TOSS',
          payment_method: null,
          paid_at: null,
          created_at: 't',
          orders: null,
        },
      ],
      error: null,
      count: 1,
    });

    const result = await service.getPayments('b1', { page: 1, limit: 10 });
    expect(result.data[0].orderNo).toBeNull();
    expect(result.data[0].paymentMethod).toBeNull();
    expect(result.data[0].paidAt).toBeUndefined();
  });

  it('getPayments should use default pagination and handle missing count', async () => {
    const service = setupService();
    paymentsChain.range.mockResolvedValueOnce({
      data: [
        {
          id: 'p1',
          order_id: 'o1',
          amount: 10,
          status: PaymentStatus.SUCCESS,
          provider: 'TOSS',
          payment_method: null,
          paid_at: null,
          created_at: 't',
          orders: null,
        },
      ],
      error: null,
      count: null,
    });

    const result = await service.getPayments('b1');
    expect(result.pagination.total).toBe(0);
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

  it('getPaymentDetail should map defaults when nullable fields missing', async () => {
    const service = setupService();
    paymentsChain.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'p1',
        order_id: 'o1',
        amount: 10,
        currency: 'KRW',
        provider: 'TOSS',
        status: PaymentStatus.SUCCESS,
        payment_method: null,
        payment_method_detail: null,
        provider_payment_id: null,
        provider_payment_key: null,
        paid_at: null,
        failed_at: null,
        cancelled_at: null,
        refunded_at: null,
        failure_reason: null,
        cancellation_reason: null,
        refund_amount: null,
        refund_reason: null,
        metadata: null,
        created_at: 't',
        updated_at: 't',
        orders: { order_no: null, branch_id: 'b1' },
      },
      error: null,
    });

    const result = await service.getPaymentDetail('p1', 'b1');
    expect(result.paymentMethod).toBeNull();
    expect(result.providerPaymentId).toBeUndefined();
    expect(result.providerPaymentKey).toBeUndefined();
    expect(result.paidAt).toBeUndefined();
    expect(result.failedAt).toBeUndefined();
    expect(result.cancelledAt).toBeUndefined();
    expect(result.refundedAt).toBeUndefined();
    expect(result.failureReason).toBeUndefined();
    expect(result.cancellationReason).toBeUndefined();
    expect(result.refundAmount).toBe(0);
    expect(result.refundReason).toBeUndefined();
    expect(result.metadata).toBeUndefined();
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

  it('refundPayment should throw when secret key is missing in non-mock mode', async () => {
    const service = setupService({ TOSS_MOCK_MODE: 'false', NODE_ENV: 'production' });
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

  it('refundPayment should throw when refund api fails with non-provider error', async () => {
    const service = setupService({ TOSS_SECRET_KEY: 'secret', TOSS_MOCK_MODE: 'false', NODE_ENV: 'production' });
    (service as any).callTossPaymentsRefundApi = jest.fn().mockRejectedValue(new Error('boom'));

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

    await expect(
      service.refundPayment('p1', 'b1', { amount: 1, reason: 'x' } as any),
    ).rejects.toBeInstanceOf(PaymentProviderException);
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

  it('callTossApi should rethrow unexpected error', async () => {
    const service = setupService({ TOSS_SECRET_KEY: 'secret', TOSS_MOCK_MODE: 'false', NODE_ENV: 'production' });
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('boom'));

    await expect(
      (service as any).callTossApi('/payments/confirm', { a: 1 }),
    ).rejects.toThrow('boom');
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

  it('callTossApi should return null on empty response body', async () => {
    const service = setupService({ TOSS_SECRET_KEY: 'secret', TOSS_MOCK_MODE: 'false', NODE_ENV: 'production' });
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    });

    const result = await (service as any).callTossApi('/payments/confirm', { a: 1 });
    expect(result).toBeNull();
  });

  it('callTossApi should use HTTP status when error body is empty', async () => {
    const service = setupService({ TOSS_SECRET_KEY: 'secret', TOSS_MOCK_MODE: 'false', NODE_ENV: 'production' });
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => '',
    });

    await expect(
      (service as any).callTossApi('/payments/confirm', { a: 1 }),
    ).rejects.toBeInstanceOf(PaymentProviderException);
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

  it('handleTossWebhook should skip processed update when payment is missing', async () => {
    const service = setupService();
    paymentsChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    webhookChain.insert.mockResolvedValueOnce({ error: null });
    webhookChain.update.mockReturnValue(webhookChain);

    await service.handleTossWebhook(
      { eventType: 'UNKNOWN', data: { orderId: 'o1', paymentKey: 'pk', status: 'DONE', amount: 10 } } as any,
      {},
      Buffer.from('test'),
    );

    expect(webhookChain.update).not.toHaveBeenCalled();
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
    paymentsChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'p1', order_id: 'o1', status: PaymentStatus.PENDING, amount: 10 },
      error: null,
    });
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'o1', total_amount: 10 }, error: null });
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

  it('handlePaymentConfirmedWebhook should return when already success', async () => {
    const service = setupService();
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'o1', total_amount: 10 }, error: null });

    await (service as any).handlePaymentConfirmedWebhook(
      {
        eventType: 'PAYMENT_CONFIRMED',
        data: { orderId: 'o1', paymentKey: 'pk', status: 'DONE', amount: 10 },
      } as any,
      { id: 'p1', status: PaymentStatus.SUCCESS, amount: 10 },
    );

    expect(paymentsChain.update).not.toHaveBeenCalled();
  });

  it('handlePaymentConfirmedWebhook should ignore cancelled payment', async () => {
    const service = setupService();
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'o1', total_amount: 10 }, error: null });

    await (service as any).handlePaymentConfirmedWebhook(
      {
        eventType: 'PAYMENT_CONFIRMED',
        data: { orderId: 'o1', paymentKey: 'pk', status: 'DONE', amount: 10 },
      } as any,
      { id: 'p1', status: PaymentStatus.CANCELLED, amount: 10 },
    );

    expect(paymentsChain.update).not.toHaveBeenCalled();
  });

  it('handlePaymentConfirmedWebhook should throw when payment amount mismatches', async () => {
    const service = setupService();
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'o1', total_amount: 9 }, error: null });

    await expect(
      (service as any).handlePaymentConfirmedWebhook(
        {
          eventType: 'PAYMENT_CONFIRMED',
          data: { orderId: 'o1', paymentKey: 'pk', status: 'DONE', amount: 9 },
        } as any,
        { id: 'p1', status: PaymentStatus.PENDING, amount: 10 },
      ),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('handlePaymentConfirmedWebhook should create payment when missing', async () => {
    const service = setupService();
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'o1', total_amount: 10 }, error: null });
    paymentsChain.insert.mockResolvedValueOnce({ error: null });

    await (service as any).handlePaymentConfirmedWebhook(
      {
        eventType: 'PAYMENT_CONFIRMED',
        data: { orderId: 'o1', paymentKey: 'pk', status: 'DONE', amount: 10 },
      } as any,
      null,
    );

    expect(paymentsChain.insert).toHaveBeenCalled();
  });

  it('handlePaymentConfirmedWebhook should return when order cannot be resolved', async () => {
    const service = setupService();
    ordersChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await (service as any).handlePaymentConfirmedWebhook(
      {
        eventType: 'PAYMENT_CONFIRMED',
        data: { orderId: 'missing', paymentKey: 'pk', status: 'DONE', amount: 10 },
      } as any,
      null,
    );

    expect(paymentsChain.update).not.toHaveBeenCalled();
  });

  it('handlePaymentConfirmedWebhook should throw on order fetch error', async () => {
    const service = setupService();
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(
      (service as any).handlePaymentConfirmedWebhook(
        {
          eventType: 'PAYMENT_CONFIRMED',
          data: { orderId: 'o1', paymentKey: 'pk', status: 'DONE', amount: 10 },
        } as any,
        null,
      ),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('handlePaymentConfirmedWebhook should throw on insert error', async () => {
    const service = setupService();
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'o1', total_amount: 10 }, error: null });
    paymentsChain.insert.mockResolvedValueOnce({ error: { message: 'fail' } });

    await expect(
      (service as any).handlePaymentConfirmedWebhook(
        {
          eventType: 'PAYMENT_CONFIRMED',
          data: { orderId: 'o1', paymentKey: 'pk', status: 'DONE', amount: 10 },
        } as any,
        null,
      ),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('handlePaymentConfirmedWebhook should throw on amount mismatch', async () => {
    const service = setupService();
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'o1', total_amount: 10 }, error: null });

    await expect(
      (service as any).handlePaymentConfirmedWebhook(
        {
          eventType: 'PAYMENT_CONFIRMED',
          data: { orderId: 'o1', paymentKey: 'pk', status: 'DONE', amount: 9 },
        } as any,
        null,
      ),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('handleTossWebhook should log error when handler fails', async () => {
    const service = setupService();

    paymentsChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'p1', order_id: 'o1', status: PaymentStatus.PENDING, amount: 10 },
      error: null,
    });
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'o1', total_amount: 10 }, error: null });

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
    paymentsChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'p1', order_id: 'o1', status: PaymentStatus.PENDING, amount: 10 },
      error: null,
    });
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

  it('handlePaymentCancelledWebhook should return when already cancelled', async () => {
    const service = setupService();
    ordersChain.maybeSingle.mockResolvedValueOnce({ data: { id: 'o1' }, error: null });

    await (service as any).handlePaymentCancelledWebhook(
      {
        eventType: 'PAYMENT_CANCELLED',
        data: { orderId: 'o1', paymentKey: 'pk', status: 'CANCELLED', amount: 10 },
      } as any,
      { id: 'p1', status: PaymentStatus.CANCELLED },
    );

    expect(paymentsChain.update).not.toHaveBeenCalled();
  });

  it('handlePaymentCancelledWebhook should create payment when missing', async () => {
    const service = setupService();
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'o1', total_amount: 10 }, error: null });
    paymentsChain.insert.mockResolvedValueOnce({ error: null });

    await (service as any).handlePaymentCancelledWebhook(
      {
        eventType: 'PAYMENT_CANCELLED',
        data: { orderId: 'o1', paymentKey: 'pk', status: 'CANCELLED', amount: 10 },
      } as any,
      null,
    );

    expect(paymentsChain.insert).toHaveBeenCalled();
  });

  it('handlePaymentCancelledWebhook should return when order is missing', async () => {
    const service = setupService();
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    await (service as any).handlePaymentCancelledWebhook(
      {
        eventType: 'PAYMENT_CANCELLED',
        data: { orderId: 'o1', paymentKey: 'pk', status: 'CANCELLED', amount: 10 },
      } as any,
      null,
    );

    expect(paymentsChain.insert).not.toHaveBeenCalled();
  });

  it('handlePaymentCancelledWebhook should throw on order fetch error', async () => {
    const service = setupService();
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(
      (service as any).handlePaymentCancelledWebhook(
        {
          eventType: 'PAYMENT_CANCELLED',
          data: { orderId: 'o1', paymentKey: 'pk', status: 'CANCELLED', amount: 10 },
        } as any,
        null,
      ),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('handlePaymentCancelledWebhook should default amount when missing', async () => {
    const service = setupService();
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'o1', total_amount: 20 }, error: null });
    paymentsChain.insert.mockResolvedValueOnce({ error: null });

    await (service as any).handlePaymentCancelledWebhook(
      {
        eventType: 'PAYMENT_CANCELLED',
        data: { orderId: 'o1', paymentKey: 'pk', status: 'CANCELLED', amount: undefined },
      } as any,
      null,
    );

    expect(paymentsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 20 }),
    );
  });

  it('handlePaymentCancelledWebhook should throw on insert error', async () => {
    const service = setupService();
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'o1', total_amount: 10 }, error: null });
    paymentsChain.insert.mockResolvedValueOnce({ error: { message: 'fail' } });

    await expect(
      (service as any).handlePaymentCancelledWebhook(
        {
          eventType: 'PAYMENT_CANCELLED',
          data: { orderId: 'o1', paymentKey: 'pk', status: 'CANCELLED', amount: 10 },
        } as any,
        null,
      ),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('handlePaymentCancelledWebhook should throw on update error', async () => {
    const service = setupService();
    ordersChain.maybeSingle.mockResolvedValueOnce({ data: { id: 'o1' }, error: null });

    let eqCount = 0;
    paymentsChain.eq.mockImplementation(() => {
      eqCount += 1;
      if (eqCount === 1) return paymentsChain;
      if (eqCount === 2) return { error: { message: 'fail' } };
      return paymentsChain;
    });
    paymentsChain.update.mockReturnValue(paymentsChain);

    await expect(
      (service as any).handlePaymentCancelledWebhook(
        {
          eventType: 'PAYMENT_CANCELLED',
          data: { orderId: 'o1', paymentKey: 'pk', status: 'CANCELLED', amount: 10 },
        } as any,
        { id: 'p1', status: PaymentStatus.PENDING, amount: 10 },
      ),
    ).rejects.toBeInstanceOf(BusinessException);
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

  it('refundPayment should return partial refunded when amount is smaller', async () => {
    const service = setupService({ TOSS_MOCK_MODE: 'true' });
    paymentsChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'p1', amount: 10, refund_amount: 0, status: PaymentStatus.SUCCESS, orders: { branch_id: 'b1' } },
      error: null,
    });
    paymentsChain.single.mockResolvedValueOnce({
      data: { id: 'p1', status: PaymentStatus.PARTIAL_REFUNDED },
      error: null,
    });

    const result = await service.refundPayment('p1', 'b1', { amount: 5, reason: 'x' } as any);
    expect(result.status).toBe(PaymentStatus.PARTIAL_REFUNDED);
    expect(result.refundAmount).toBe(5);
  });

  it('refundPayment should use full amount when dto amount is missing', async () => {
    const service = setupService({ TOSS_MOCK_MODE: 'true' });
    paymentsChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'p1', amount: 10, refund_amount: 0, status: PaymentStatus.SUCCESS, orders: { branch_id: 'b1' } },
      error: null,
    });
    paymentsChain.single.mockResolvedValueOnce({
      data: { id: 'p1', status: PaymentStatus.REFUNDED },
      error: null,
    });

    const result = await service.refundPayment('p1', 'b1', { reason: 'x' } as any);
    expect(result.refundAmount).toBe(10);
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

  it('verifyTossWebhookSignature should accept array header', () => {
    const service = setupService({ TOSS_WEBHOOK_SECRET: 'secret', TOSS_WEBHOOK_SIGNATURE_HEADER: 'toss-signature' });
    const body = Buffer.from('test');
    const crypto = require('crypto');
    const sig = crypto.createHmac('sha256', 'secret').update(body).digest('hex');

    const ok = (service as any).verifyTossWebhookSignature(body, {
      'toss-signature': [`v1=${sig}`],
    });

    expect(ok).toBe(true);
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

  it('updateOrderPaymentStatus should swallow update errors', async () => {
    const service = setupService();
    const failingSb = {
      from: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValueOnce({ error: { message: 'fail' } }),
      })),
    };

    await expect(
      (service as any).updateOrderPaymentStatus(failingSb, 'o1', 'PAID', 'test'),
    ).resolves.toBeUndefined();
  });

  it('updateOrderPaymentStatus should swallow thrown errors', async () => {
    const service = setupService();
    const failingSb = {
      from: jest.fn(() => {
        throw new Error('boom');
      }),
    };

    await expect(
      (service as any).updateOrderPaymentStatus(failingSb, 'o1', 'PAID', 'test'),
    ).resolves.toBeUndefined();
  });

  describe('additional branch coverage', () => {
    it('constructor should fall back on non-numeric timeout', () => {
      const service = setupService({
        TOSS_TIMEOUT_MS: 'abc',
        TOSS_SECRET_KEY: '',
        NODE_ENV: 'production',
      });

      expect((service as any).tossTimeoutMs).toBe(15000);
    });

    it('resolveOrderId should fall back to order_no when uuid lookup fails', async () => {
      const service = setupService();
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      ordersChain.maybeSingle
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: 'o2' }, error: null });

      const resolved = await (service as any).resolveOrderId(mockSb, uuid, 'branch-1');

      expect(resolved).toBe('o2');
      expect(ordersChain.eq).toHaveBeenCalledWith('branch_id', 'branch-1');
    });

    it('preparePayment should use default order name when items are missing', async () => {
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
      paymentsChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      const result = await service.preparePayment({ orderId: 'o1', amount: 10 } as any);
      expect(result.orderName).toBe('주문');
    });

    it('confirmPayment should return existing payment with fallback amount and paidAt', async () => {
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
        data: { id: 'pay1', status: PaymentStatus.SUCCESS, amount: null, paid_at: null },
        error: null,
      });

      const result = await service.confirmPayment({
        orderId: 'o1',
        paymentKey: 'pk',
        amount: 10,
      } as any);

      expect(result.amount).toBe(10);
      expect(result.paidAt).toBeTruthy();
    });

    it('confirmPayment should update failure record when provider error has no message', async () => {
      const service = setupService({
        TOSS_SECRET_KEY: 'secret',
        TOSS_MOCK_MODE: 'false',
        NODE_ENV: 'production',
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
      paymentsChain.maybeSingle.mockResolvedValueOnce({
        data: { id: 'pay1', status: PaymentStatus.PENDING, idempotency_key: 'existing-key' },
        error: null,
      });

      jest
        .spyOn(service as any, 'callTossPaymentsConfirmApi')
        .mockRejectedValueOnce({});

      await expect(
        service.confirmPayment({
          orderId: 'o1',
          paymentKey: 'pk',
          amount: 10,
        } as any),
      ).rejects.toThrow('Payment confirmation failed');

      expect(paymentsChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          failure_reason: 'Payment confirmation failed',
          idempotency_key: 'existing-key',
        }),
      );
    });

    it('confirmPayment should insert failure with default reason when no existing payment and error has no message', async () => {
      const service = setupService({
        TOSS_SECRET_KEY: 'secret',
        TOSS_MOCK_MODE: 'false',
        NODE_ENV: 'production',
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

      jest
        .spyOn(service as any, 'callTossPaymentsConfirmApi')
        .mockRejectedValueOnce({});

      await expect(
        service.confirmPayment({
          orderId: 'o1',
          paymentKey: 'pk',
          amount: 10,
        } as any),
      ).rejects.toThrow('Payment confirmation failed');

      expect(paymentsChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          failure_reason: 'Payment confirmation failed',
          idempotency_key: null,
        }),
      );
    });

    it('confirmPayment should throw when unique constraint occurs without idempotency key', async () => {
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
        data: null,
        error: { code: '23505', message: 'dup' },
      });

      await expect(
        service.confirmPayment({
          orderId: 'o1',
          paymentKey: 'pk',
          amount: 10,
        } as any),
      ).rejects.toBeInstanceOf(BusinessException);
    });

    it('confirmPayment should throw when idempotent payment is not successful', async () => {
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
      paymentsChain.maybeSingle
        .mockResolvedValueOnce({ data: null, error: null }) // idempotency check
        .mockResolvedValueOnce({ data: null, error: null }) // payment by order
        .mockResolvedValueOnce({
          data: { id: 'pay1', status: PaymentStatus.PENDING },
          error: null,
        }); // idempotent payment after insert error
      paymentsChain.single.mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'dup' },
      });

      await expect(
        service.confirmPayment({
          orderId: 'o1',
          paymentKey: 'pk',
          amount: 10,
          idempotencyKey: 'idem-1',
        } as any),
      ).rejects.toBeInstanceOf(BusinessException);
    });

    it('confirmPayment should use fallback amount for idempotent success on unique constraint', async () => {
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
      paymentsChain.maybeSingle
        .mockResolvedValueOnce({ data: null, error: null }) // idempotency check
        .mockResolvedValueOnce({ data: null, error: null }) // payment by order
        .mockResolvedValueOnce({
          data: {
            id: 'pay1',
            order_id: 'o1',
            status: PaymentStatus.SUCCESS,
            amount: null,
            paid_at: null,
          },
          error: null,
        }); // idempotent payment after insert error
      paymentsChain.single.mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'dup' },
      });

      const result = await service.confirmPayment({
        orderId: 'o1',
        paymentKey: 'pk',
        amount: 10,
        idempotencyKey: 'idem-1',
      } as any);

      expect(result.amount).toBe(10);
      expect(result.paidAt).toBeTruthy();
    });

    it('getPayments should handle null data and count', async () => {
      const service = setupService();
      paymentsChain.range.mockResolvedValueOnce({
        data: null,
        error: null,
        count: 0,
      });

      const result = await service.getPayments('branch-1', { page: 1, limit: 10 });

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('refundPayment should rethrow provider exceptions', async () => {
      const service = setupService({
        TOSS_SECRET_KEY: 'secret',
        TOSS_MOCK_MODE: 'false',
        NODE_ENV: 'production',
      });
      paymentsChain.maybeSingle.mockResolvedValueOnce({
        data: {
          id: 'pay1',
          order_id: 'o1',
          status: PaymentStatus.SUCCESS,
          amount: 100,
          refund_amount: 0,
          provider_payment_key: 'pk',
        },
        error: null,
      });

      jest
        .spyOn(service as any, 'callTossPaymentsRefundApi')
        .mockRejectedValueOnce(
          new PaymentProviderException('TOSS' as any, 'fail'),
        );

      await expect(
        service.refundPayment('pay1', 'branch-1', { amount: 10, reason: 'r' } as any),
      ).rejects.toBeInstanceOf(PaymentProviderException);
    });

    it('refundPayment should wrap unknown errors with default message', async () => {
      const service = setupService({
        TOSS_SECRET_KEY: 'secret',
        TOSS_MOCK_MODE: 'false',
        NODE_ENV: 'production',
      });
      paymentsChain.maybeSingle.mockResolvedValueOnce({
        data: {
          id: 'pay1',
          order_id: 'o1',
          status: PaymentStatus.SUCCESS,
          amount: 100,
          refund_amount: 0,
          provider_payment_key: 'pk',
        },
        error: null,
      });

      jest
        .spyOn(service as any, 'callTossPaymentsRefundApi')
        .mockRejectedValueOnce({});

      await expect(
        service.refundPayment('pay1', 'branch-1', { amount: 10, reason: 'r' } as any),
      ).rejects.toThrow('Refund failed');
    });

    it('handleTossWebhook should route confirmed and cancelled events', async () => {
      const service = setupService({ TOSS_WEBHOOK_SECRET: '' });
      const confirmSpy = jest
        .spyOn(service as any, 'handlePaymentConfirmedWebhook')
        .mockResolvedValueOnce(undefined);
      const cancelSpy = jest
        .spyOn(service as any, 'handlePaymentCancelledWebhook')
        .mockResolvedValueOnce(undefined);

      paymentsChain.maybeSingle
        .mockResolvedValueOnce({
          data: { id: 'pay1', order_id: 'o1', status: PaymentStatus.PENDING, amount: 10 },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'pay2', order_id: 'o2', status: PaymentStatus.PENDING, amount: 10 },
          error: null,
        });

      await service.handleTossWebhook(
        { eventType: 'PAYMENT_CONFIRMED', data: { orderId: 'o1', paymentKey: 'pk', status: 'DONE', amount: 10 } } as any,
        {},
        undefined,
      );
      await service.handleTossWebhook(
        { eventType: 'PAYMENT_CANCELLED', data: { orderId: 'o2', paymentKey: 'pk2', status: 'CANCELLED' } } as any,
        {},
        undefined,
      );

      expect(confirmSpy).toHaveBeenCalled();
      expect(cancelSpy).toHaveBeenCalled();
    });

    it('handleTossWebhook should pass null payment when lookup misses', async () => {
      const service = setupService({ TOSS_WEBHOOK_SECRET: '' });
      const confirmSpy = jest
        .spyOn(service as any, 'handlePaymentConfirmedWebhook')
        .mockResolvedValueOnce(undefined);
      const cancelSpy = jest
        .spyOn(service as any, 'handlePaymentCancelledWebhook')
        .mockResolvedValueOnce(undefined);

      paymentsChain.maybeSingle
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });
      webhookChain.insert.mockResolvedValueOnce({ error: null });
      webhookChain.insert.mockResolvedValueOnce({ error: null });

      await service.handleTossWebhook(
        { eventType: 'PAYMENT_CONFIRMED', data: { orderId: 'o1', paymentKey: 'pk', status: 'DONE', amount: 10 } } as any,
        {},
        undefined,
      );
      await service.handleTossWebhook(
        { eventType: 'PAYMENT_CANCELLED', data: { orderId: 'o2', paymentKey: 'pk2', status: 'CANCELLED' } } as any,
        {},
        undefined,
      );

      expect(confirmSpy).toHaveBeenCalledWith(expect.anything(), null);
      expect(cancelSpy).toHaveBeenCalledWith(expect.anything(), null);
    });

    it('handleTossWebhook should update log when handler throws', async () => {
      const service = setupService({ TOSS_WEBHOOK_SECRET: '' });
      jest
        .spyOn(service as any, 'handlePaymentConfirmedWebhook')
        .mockRejectedValueOnce(new Error('boom'));

      paymentsChain.maybeSingle.mockResolvedValueOnce({
        data: { id: 'pay1', order_id: 'o1', status: PaymentStatus.PENDING, amount: 10 },
        error: null,
      });

      await expect(
        service.handleTossWebhook(
          { eventType: 'PAYMENT_CONFIRMED', data: { orderId: 'o1', paymentKey: 'pk', status: 'DONE', amount: 10 } } as any,
          {},
          undefined,
        ),
      ).rejects.toThrow('boom');

      expect(webhookChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ error_message: 'boom' }),
      );
    });

    it('handleTossWebhook should skip error log update when paymentId is missing', async () => {
      const service = setupService({ TOSS_WEBHOOK_SECRET: '' });
      jest
        .spyOn(service as any, 'handlePaymentConfirmedWebhook')
        .mockRejectedValueOnce(new Error('boom'));

      paymentsChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      webhookChain.insert.mockResolvedValueOnce({ error: null });
      webhookChain.update.mockReturnValue(webhookChain);

      await expect(
        service.handleTossWebhook(
          { eventType: 'PAYMENT_CONFIRMED', data: { orderId: 'o1', paymentKey: 'pk', status: 'DONE', amount: 10 } } as any,
          {},
          undefined,
        ),
      ).rejects.toThrow('boom');

      expect(webhookChain.update).not.toHaveBeenCalled();
    });

    it('handlePaymentConfirmedWebhook should return when order is missing', async () => {
      const service = setupService({ TOSS_WEBHOOK_SECRET: '' });
      ordersChain.maybeSingle
        .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      await expect(
        (service as any).handlePaymentConfirmedWebhook(
          { data: { orderId: 'o1', paymentKey: 'pk' } } as any,
          null,
        ),
      ).resolves.toBeUndefined();
    });

    it('handlePaymentConfirmedWebhook should use order total when amount is missing', async () => {
      const service = setupService({ TOSS_WEBHOOK_SECRET: '' });
      ordersChain.maybeSingle
        .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'o1', total_amount: 120 }, error: null });
      paymentsChain.insert.mockResolvedValueOnce({ error: null });

      await (service as any).handlePaymentConfirmedWebhook(
        { data: { orderId: 'o1', paymentKey: 'pk' } } as any,
        null,
      );

      expect(paymentsChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 120 }),
      );
    });

    it('handlePaymentCancelledWebhook should return when order cannot be resolved', async () => {
      const service = setupService({ TOSS_WEBHOOK_SECRET: '' });
      ordersChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      await expect(
        (service as any).handlePaymentCancelledWebhook(
          { data: { orderId: 'ORD-1', paymentKey: 'pk' } } as any,
          null,
        ),
      ).resolves.toBeUndefined();

      expect(paymentsChain.update).not.toHaveBeenCalled();
    });

    it('callTossApi should return raw body when JSON parse fails', async () => {
      const service = setupService({
        TOSS_SECRET_KEY: 'secret',
        TOSS_MOCK_MODE: 'false',
        NODE_ENV: 'production',
      });

      const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'not-json',
      } as any);

      const result = await (service as any).callTossApi('/payments/confirm', { foo: 'bar' });

      expect(result).toEqual({ raw: 'not-json' });
      fetchSpy.mockRestore();
    });
  });
});
