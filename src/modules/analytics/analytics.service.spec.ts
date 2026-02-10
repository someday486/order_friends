import { AnalyticsService } from './analytics.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { BusinessException } from '../../common/exceptions/business.exception';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockSb: any;
  let chain: any;

  const makeChain = () => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
  });

  const setup = () => {
    chain = makeChain();
    mockSb = { from: jest.fn(() => chain) };
    const supabase = { adminClient: jest.fn(() => mockSb) };
    service = new AnalyticsService(supabase as SupabaseService);
  };

  beforeEach(() => {
    setup();
    jest.clearAllMocks();
  });

  it('getDateRange should use defaults when no dates provided', () => {
    const result = (service as any).getDateRange();
    expect(new Date(result.start).getTime()).toBeLessThanOrEqual(
      new Date(result.end).getTime(),
    );
    expect(result.days).toBeGreaterThan(0);
  });

  it('getDateRange should respect provided dates', () => {
    const result = (service as any).getDateRange('2024-01-01', '2024-01-02');
    expect(result.start.startsWith('2024-01-01')).toBe(true);
    expect(result.end.startsWith('2024-01-02')).toBe(true);
  });

  it('getSalesAnalytics should aggregate orders', async () => {
    chain.in.mockResolvedValueOnce({
      data: [
        { total_amount: 100, created_at: '2024-01-01T00:00:00Z' },
        { total_amount: 50, created_at: '2024-01-02T00:00:00Z' },
      ],
      error: null,
    });

    const result = await service.getSalesAnalytics(
      'token',
      'b1',
      '2024-01-01',
      '2024-01-03',
    );

    expect(result.totalRevenue).toBe(150);
    expect(result.orderCount).toBe(2);
    expect(result.avgOrderValue).toBe(75);
    expect(result.revenueByDay).toHaveLength(2);
  });

  it('getSalesAnalytics should handle empty orders', async () => {
    chain.in.mockResolvedValueOnce({ data: [], error: null });

    const result = await service.getSalesAnalytics(
      'token',
      'b1',
      '2024-01-01',
      '2024-01-02',
    );

    expect(result.totalRevenue).toBe(0);
    expect(result.orderCount).toBe(0);
    expect(result.avgOrderValue).toBe(0);
    expect(result.revenueByDay).toHaveLength(0);
  });

  it('getSalesAnalytics should treat null data as empty list', async () => {
    chain.in.mockResolvedValueOnce({ data: null, error: null });

    const result = await service.getSalesAnalytics(
      'token',
      'b1',
      '2024-01-01',
      '2024-01-02',
    );

    expect(result.orderCount).toBe(0);
    expect(result.totalRevenue).toBe(0);
    expect(result.avgOrderValue).toBe(0);
    expect(result.revenueByDay).toHaveLength(0);
  });

  it('getSalesAnalytics should treat missing totals as zero', async () => {
    chain.in.mockResolvedValueOnce({
      data: [
        { total_amount: undefined, created_at: '2024-01-01T00:00:00Z' },
        { total_amount: null, created_at: '2024-01-01T12:00:00Z' },
      ],
      error: null,
    });

    const result = await service.getSalesAnalytics(
      'token',
      'b1',
      '2024-01-01',
      '2024-01-02',
    );

    expect(result.totalRevenue).toBe(0);
    expect(result.orderCount).toBe(2);
    expect(result.avgOrderValue).toBe(0);
    expect(result.revenueByDay[0].revenue).toBe(0);
  });

  it('getSalesAnalytics should throw BusinessException on query error', async () => {
    chain.in.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(
      service.getSalesAnalytics('token', 'b1'),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('getSalesAnalytics should wrap unexpected errors', async () => {
    const supabase = {
      adminClient: jest.fn(() => ({
        from: () => {
          throw new Error('boom');
        },
      })),
    };
    service = new AnalyticsService(supabase as SupabaseService);

    await expect(
      service.getSalesAnalytics('token', 'b1'),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('getProductAnalytics should aggregate items', async () => {
    chain.in.mockResolvedValueOnce({
      data: [
        {
          product_id: 'p1',
          product_name_snapshot: 'P1',
          qty: 2,
          unit_price: 10,
        },
        {
          product_id: 'p2',
          product_name_snapshot: 'P2',
          qty: 1,
          unit_price: 5,
        },
      ],
      error: null,
    });

    const result = await service.getProductAnalytics(
      'token',
      'b1',
      '2024-01-01',
      '2024-01-02',
    );

    expect(result.topProducts).toHaveLength(2);
    expect(result.salesByProduct[0].revenue).toBeGreaterThan(0);
    expect(result.inventoryTurnover.periodDays).toBeGreaterThan(0);
  });

  it('getProductAnalytics should handle null data', async () => {
    chain.in.mockResolvedValueOnce({ data: null, error: null });

    const result = await service.getProductAnalytics(
      'token',
      'b1',
      '2024-01-01',
      '2024-01-02',
    );

    expect(result.topProducts).toHaveLength(0);
    expect(result.salesByProduct).toHaveLength(0);
  });

  it('getProductAnalytics should handle zero revenue and zero days', async () => {
    jest.spyOn(service as any, 'getDateRange').mockReturnValue({
      start: '2024-01-01T00:00:00Z',
      end: '2024-01-01T00:00:00Z',
      days: 0,
    });
    chain.in.mockResolvedValueOnce({
      data: [
        {
          product_id: null,
          product_name_snapshot: null,
          qty: 0,
          unit_price: 0,
        },
      ],
      error: null,
    });

    const result = await service.getProductAnalytics(
      'token',
      'b1',
      '2024-01-01',
      '2024-01-01',
    );

    expect(result.salesByProduct[0].revenuePercentage).toBe(0);
    expect(result.inventoryTurnover.averageTurnoverRate).toBe(0);
  });

  it('getProductAnalytics should throw on query error', async () => {
    chain.in.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(
      service.getProductAnalytics('token', 'b1'),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('getProductAnalytics should wrap unexpected errors', async () => {
    const supabase = {
      adminClient: jest.fn(() => ({
        from: () => {
          throw new Error('boom');
        },
      })),
    };
    service = new AnalyticsService(supabase as SupabaseService);

    await expect(
      service.getProductAnalytics('token', 'b1'),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('getOrderAnalytics should compute distributions', async () => {
    chain.lte.mockResolvedValueOnce({
      data: [
        { status: 'COMPLETED', created_at: '2024-01-01T01:00:00Z' },
        { status: 'CANCELLED', created_at: '2024-01-01T02:00:00Z' },
      ],
      error: null,
    });

    const result = await service.getOrderAnalytics(
      'token',
      'b1',
      '2024-01-01',
      '2024-01-02',
    );

    expect(result.statusDistribution).toHaveLength(2);
    expect(result.ordersByDay[0].orderCount).toBe(2);
    expect(result.peakHours).toHaveLength(2);
  });

  it('getOrderAnalytics should handle unknown status', async () => {
    chain.lte.mockResolvedValueOnce({
      data: [{ status: undefined, created_at: '2024-01-01T01:00:00Z' }],
      error: null,
    });

    const result = await service.getOrderAnalytics(
      'token',
      'b1',
      '2024-01-01',
      '2024-01-02',
    );

    expect(result.statusDistribution[0].status).toBe('UNKNOWN');
  });

  it('getOrderAnalytics should handle empty orders', async () => {
    chain.lte.mockResolvedValueOnce({ data: [], error: null });

    const result = await service.getOrderAnalytics(
      'token',
      'b1',
      '2024-01-01',
      '2024-01-02',
    );

    expect(result.statusDistribution).toHaveLength(0);
    expect(result.ordersByDay).toHaveLength(0);
    expect(result.peakHours).toHaveLength(0);
  });

  it('getOrderAnalytics should handle null data', async () => {
    chain.lte.mockResolvedValueOnce({ data: null, error: null });

    const result = await service.getOrderAnalytics(
      'token',
      'b1',
      '2024-01-01',
      '2024-01-02',
    );

    expect(result.statusDistribution).toHaveLength(0);
    expect(result.ordersByDay).toHaveLength(0);
    expect(result.peakHours).toHaveLength(0);
  });

  it('getOrderAnalytics should throw on query error', async () => {
    chain.lte.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(
      service.getOrderAnalytics('token', 'b1'),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('getOrderAnalytics should wrap unexpected errors', async () => {
    const supabase = {
      adminClient: jest.fn(() => ({
        from: () => {
          throw new Error('boom');
        },
      })),
    };
    service = new AnalyticsService(supabase as SupabaseService);

    await expect(
      service.getOrderAnalytics('token', 'b1'),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('getCustomerAnalytics should compute customer stats', async () => {
    chain.in
      .mockResolvedValueOnce({
        data: [
          {
            customer_phone: '1',
            total_amount: 10,
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            customer_phone: '1',
            total_amount: 5,
            created_at: '2024-01-02T00:00:00Z',
          },
          {
            customer_phone: '2',
            total_amount: 7,
            created_at: '2024-01-02T00:00:00Z',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            customer_phone: '1',
            total_amount: 10,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
        error: null,
      });

    const result = await service.getCustomerAnalytics(
      'token',
      'b1',
      '2024-01-01',
      '2024-01-03',
    );

    expect(result.totalCustomers).toBe(2);
    expect(result.returningCustomers).toBe(1);
    expect(result.newCustomers).toBe(1);
  });

  it('getCustomerAnalytics should handle missing phones and totals', async () => {
    chain.in
      .mockResolvedValueOnce({
        data: [
          {
            customer_phone: null,
            total_amount: undefined,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            customer_phone: null,
            total_amount: undefined,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
        error: null,
      });

    const result = await service.getCustomerAnalytics(
      'token',
      'b1',
      '2024-01-01',
      '2024-01-02',
    );

    expect(result.totalCustomers).toBe(1);
    expect(result.newCustomers).toBe(0);
  });

  it('getCustomerAnalytics should handle null allOrders and missing first order', async () => {
    chain.in
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: [
          {
            customer_phone: undefined,
            total_amount: 5,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
        error: null,
      });

    const result = await service.getCustomerAnalytics(
      'token',
      'b1',
      '2024-01-01',
      '2024-01-02',
    );

    expect(result.totalCustomers).toBe(0);
    expect(result.newCustomers).toBe(0);
  });

  it('getCustomerAnalytics should handle null period orders', async () => {
    chain.in
      .mockResolvedValueOnce({
        data: [
          {
            customer_phone: '1',
            total_amount: 10,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });

    const result = await service.getCustomerAnalytics(
      'token',
      'b1',
      '2024-01-01',
      '2024-01-02',
    );

    expect(result.newCustomers).toBe(0);
  });

  it('getCustomerAnalytics should handle empty datasets', async () => {
    chain.in
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const result = await service.getCustomerAnalytics(
      'token',
      'b1',
      '2024-01-01',
      '2024-01-02',
    );

    expect(result.totalCustomers).toBe(0);
    expect(result.newCustomers).toBe(0);
    expect(result.returningCustomers).toBe(0);
    expect(result.clv).toBe(0);
    expect(result.repeatCustomerRate).toBe(0);
    expect(result.avgOrdersPerCustomer).toBe(0);
  });

  it('getCustomerAnalytics should throw on period query error', async () => {
    chain.in
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(
      service.getCustomerAnalytics('token', 'b1'),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('getCustomerAnalytics should throw on query error', async () => {
    chain.in.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(
      service.getCustomerAnalytics('token', 'b1'),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('getCustomerAnalytics should wrap unexpected errors', async () => {
    const supabase = {
      adminClient: jest.fn(() => ({
        from: () => {
          throw new Error('boom');
        },
      })),
    };
    service = new AnalyticsService(supabase as SupabaseService);

    await expect(
      service.getCustomerAnalytics('token', 'b1'),
    ).rejects.toBeInstanceOf(BusinessException);
  });
});
