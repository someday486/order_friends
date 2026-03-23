import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CustomerOrdersService } from './customer-orders.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { OrderStatus } from '../../modules/orders/order-status.enum';
import { PaymentsService } from '../payments/payments.service';

describe('CustomerOrdersService', () => {
  let service: CustomerOrdersService;
  let ordersChain: any;
  let branchesChain: any;
  let orderItemsChain: any;
  let paymentsChain: any;
  let depositMatchesChain: any;
  let inventoryChain: any;
  let inventoryLogsChain: any;
  let mockSb: any;
  let mockPaymentsService: { refundOrderPaymentForCancellation: jest.Mock };

  const makeChain = () => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
  });

  const setup = () => {
    ordersChain = makeChain();
    branchesChain = makeChain();
    orderItemsChain = makeChain();
    paymentsChain = makeChain();
    depositMatchesChain = makeChain();
    inventoryChain = makeChain();
    inventoryLogsChain = {
      insert: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    orderItemsChain.in.mockResolvedValue({ data: [], error: null });
    paymentsChain.in.mockResolvedValue({ data: [], error: null });
    depositMatchesChain.in.mockReturnValue(depositMatchesChain);
    depositMatchesChain.eq.mockResolvedValue({ data: [], error: null });
    mockPaymentsService = {
      refundOrderPaymentForCancellation: jest.fn().mockResolvedValue(undefined),
    };
    mockSb = {
      from: jest.fn((table: string) => {
        if (table === 'orders') return ordersChain;
        if (table === 'branches') return branchesChain;
        if (table === 'order_items') return orderItemsChain;
        if (table === 'payments') return paymentsChain;
        if (table === 'deposit_match_rows') return depositMatchesChain;
        if (table === 'product_inventory') return inventoryChain;
        if (table === 'inventory_logs') return inventoryLogsChain;
        return ordersChain;
      }),
    };
    const supabase = { adminClient: jest.fn(() => mockSb) };
    service = new CustomerOrdersService(
      supabase as SupabaseService,
      mockPaymentsService as unknown as PaymentsService,
    );
  };

  beforeEach(() => {
    setup();
    jest.clearAllMocks();
  });

  it('isUuid should validate uuid', () => {
    expect((service as any).isUuid('not-uuid')).toBe(false);
    expect(
      (service as any).isUuid('123e4567-e89b-12d3-a456-426614174000'),
    ).toBe(true);
  });

  it('should convert KST day boundaries to UTC timestamps', () => {
    expect((service as any).getKstDayStartUtc('2026-03-24')).toBe(
      '2026-03-23T15:00:00.000Z',
    );
    expect((service as any).getNextKstDayStartUtc('2026-03-24')).toBe(
      '2026-03-24T15:00:00.000Z',
    );
  });

  it('resolveOrderId should resolve by uuid and order_no', async () => {
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'o2' }, error: null });

    const byId = await (service as any).resolveOrderId(
      mockSb,
      '123e4567-e89b-12d3-a456-426614174000',
    );
    const byNo = await (service as any).resolveOrderId(mockSb, 'ORD-1');

    expect(byId).toBe('o1');
    expect(byNo).toBe('o2');
  });

  it('resolveOrderId should apply branch filter for uuid', async () => {
    ordersChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'o1' },
      error: null,
    });

    const result = await (service as any).resolveOrderId(
      mockSb,
      '123e4567-e89b-12d3-a456-426614174000',
      'b1',
    );

    expect(result).toBe('o1');
    expect(ordersChain.eq).toHaveBeenCalledWith('branch_id', 'b1');
  });

  it('resolveOrderId should fall back to order_no when uuid lookup fails and apply branch filter', async () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: 'o2' }, error: null });

    const result = await (service as any).resolveOrderId(mockSb, uuid, 'b1');

    expect(result).toBe('o2');
    expect(ordersChain.eq).toHaveBeenCalledWith('branch_id', 'b1');
  });

  it('checkBranchAccess should return branch membership', async () => {
    branchesChain.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });

    const result = await (service as any).checkBranchAccess(
      'b1',
      'user-1',
      [],
      [{ branch_id: 'b1', role: 'STAFF', status: 'ACTIVE' }],
    );

    expect(result.branchMembership.role).toBe('STAFF');
  });

  it('checkBranchAccess should return brand membership', async () => {
    branchesChain.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });

    const result = await (service as any).checkBranchAccess(
      'b1',
      'user-1',
      [{ brand_id: 'brand-1', role: 'OWNER', status: 'ACTIVE' }],
      [],
    );

    expect(result.brandMembership.role).toBe('OWNER');
  });

  it('checkBranchAccess should throw when forbidden', async () => {
    branchesChain.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });

    await expect(
      (service as any).checkBranchAccess('b1', 'user-1', [], []),
    ).rejects.toThrow(ForbiddenException);
  });

  it('checkBranchAccess should throw when branch missing', async () => {
    branchesChain.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'missing' },
    });

    await expect(
      (service as any).checkBranchAccess('b1', 'user-1', [], []),
    ).rejects.toThrow(NotFoundException);
  });

  it('getAccessibleBranchIds should include brand branches', async () => {
    branchesChain.in.mockResolvedValueOnce({
      data: [{ id: 'b2' }],
      error: null,
    });

    const ids = await (service as any).getAccessibleBranchIds(
      [{ brand_id: 'brand-1' }],
      [{ branch_id: 'b1' }],
    );

    expect(ids.sort()).toEqual(['b1', 'b2']);
  });

  it('getAccessibleBranchIds should ignore missing brand branches', async () => {
    branchesChain.in.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const ids = await (service as any).getAccessibleBranchIds(
      [{ brand_id: 'brand-1' }],
      [{ branch_id: 'b1' }],
    );

    expect(ids).toEqual(['b1']);
  });

  it('getAccessibleBranchIds should return branch memberships only when no brands', async () => {
    const ids = await (service as any).getAccessibleBranchIds(
      [],
      [{ branch_id: 'b1' }, { branch_id: 'b2' }],
    );

    expect(ids.sort()).toEqual(['b1', 'b2']);
  });

  it('getMyOrders should return empty when no accessible branches', async () => {
    const result = await service.getMyOrders('user-1', undefined, [], [], {});
    expect(result.data).toEqual([]);
  });

  it('getMyOrders should return paginated orders', async () => {
    branchesChain.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });

    ordersChain.in
      .mockResolvedValueOnce({ count: 1, error: null }) // count
      .mockReturnValueOnce(ordersChain); // data query
    ordersChain.order.mockReturnValueOnce(ordersChain);
    ordersChain.range.mockResolvedValueOnce({
      data: [
        {
          id: 'o1',
          status: OrderStatus.CREATED,
          created_at: 't',
          total_amount: 10,
          branch_id: 'b1',
          branches: { name: 'Gangnam' },
        },
      ],
      error: null,
    });

    const result = await service.getMyOrders(
      'user-1',
      'b1',
      [],
      [{ branch_id: 'b1', role: 'OWNER', status: 'ACTIVE' }],
      { page: 1, limit: 10 },
    );

    expect(result.data).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
  });

  it('getMyOrders should use default pagination when undefined', async () => {
    branchesChain.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });

    ordersChain.in
      .mockResolvedValueOnce({ count: 1, error: null })
      .mockReturnValueOnce(ordersChain);
    ordersChain.order.mockReturnValueOnce(ordersChain);
    ordersChain.range.mockResolvedValueOnce({
      data: [
        {
          id: 'o1',
          status: OrderStatus.CREATED,
          created_at: 't',
          total_amount: 10,
          branch_id: 'b1',
          branches: { name: 'Gangnam' },
        },
      ],
      error: null,
    });

    const result = await service.getMyOrders(
      'user-1',
      'b1',
      [],
      [{ branch_id: 'b1', role: 'OWNER', status: 'ACTIVE' }],
      undefined as any,
    );

    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(20);
  });

  it('getMyOrders should handle null data with zero count', async () => {
    branchesChain.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });

    ordersChain.in
      .mockResolvedValueOnce({ count: 0, error: null })
      .mockReturnValueOnce(ordersChain);
    ordersChain.order.mockReturnValueOnce(ordersChain);
    ordersChain.range.mockResolvedValueOnce({ data: null, error: null });

    const result = await service.getMyOrders(
      'user-1',
      'b1',
      [],
      [{ branch_id: 'b1', role: 'OWNER', status: 'ACTIVE' }],
      { page: 1, limit: 10 },
    );

    expect(result.data).toEqual([]);
    expect(result.pagination.total).toBe(0);
  });

  it('getMyOrders should apply KST date range filters', async () => {
    branchesChain.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });

    ordersChain.in
      .mockReturnValueOnce(ordersChain)
      .mockReturnValueOnce(ordersChain);
    ordersChain.order.mockReturnValueOnce(ordersChain);
    ordersChain.range.mockReturnValueOnce(ordersChain);
    ordersChain.gte.mockReturnValue(ordersChain);
    ordersChain.lt
      .mockResolvedValueOnce({ count: 1, error: null })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'o1',
            status: OrderStatus.CREATED,
            created_at: '2026-03-23T15:14:00.000Z',
            total_amount: 60000,
            branch_id: 'b1',
          },
        ],
        error: null,
      });

    await service.getMyOrders(
      'user-1',
      'b1',
      [],
      [{ branch_id: 'b1', role: 'OWNER', status: 'ACTIVE' }],
      { page: 1, limit: 10 },
      undefined,
      undefined,
      '2026-03-24',
      '2026-03-24',
    );

    expect(ordersChain.gte).toHaveBeenCalledWith(
      'created_at',
      '2026-03-23T15:00:00.000Z',
    );
    expect(ordersChain.lt).toHaveBeenCalledWith(
      'created_at',
      '2026-03-24T15:00:00.000Z',
    );
  });

  it('getMyOrders should map defaults when nullable fields are missing', async () => {
    branchesChain.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });

    ordersChain.in
      .mockResolvedValueOnce({ count: 1, error: null })
      .mockReturnValueOnce(ordersChain);
    ordersChain.order.mockReturnValueOnce(ordersChain);
    ordersChain.range.mockResolvedValueOnce({
      data: [
        {
          id: 'o1',
          order_no: null,
          status: OrderStatus.CREATED,
          created_at: null,
          total_amount: null,
          customer_name: null,
          branch_id: 'b1',
          branches: { name: 'Gangnam' },
        },
      ],
      error: null,
    });

    const result = await service.getMyOrders(
      'user-1',
      'b1',
      [],
      [{ branch_id: 'b1', role: 'OWNER', status: 'ACTIVE' }],
      { page: 1, limit: 10 },
    );

    expect(result.data[0]).toEqual({
      id: 'o1',
      orderNo: null,
      orderedAt: '',
      customerName: '',
      totalAmount: 0,
      fulfillmentType: null,
      paymentMethod: null,
      paymentStatus: null,
      depositMatchStatus: null,
      branchId: 'b1',
      branchName: 'Gangnam',
      itemCount: 0,
      firstItemName: null,
      firstItemQty: null,
      itemsSummary: '',
      status: OrderStatus.CREATED,
    });
  });

  it('getMyOrders should include branch and item summary fields', async () => {
    branchesChain.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });

    ordersChain.in
      .mockResolvedValueOnce({ count: 1, error: null })
      .mockReturnValueOnce(ordersChain);
    ordersChain.order.mockReturnValueOnce(ordersChain);
    ordersChain.range.mockResolvedValueOnce({
      data: [
        {
          id: 'o1',
          status: OrderStatus.CREATED,
          created_at: 't',
          total_amount: 10,
          customer_name: 'Customer',
          branch_id: 'b1',
          branches: { name: 'Gangnam' },
        },
      ],
      error: null,
    });
    orderItemsChain.in.mockResolvedValueOnce({
      data: [
        { order_id: 'o1', product_name_snapshot: 'Americano', qty: 1 },
        { order_id: 'o1', product_name_snapshot: '移댄럹?쇰뼹', qty: 2 },
      ],
      error: null,
    });

    const result = await service.getMyOrders(
      'user-1',
      'b1',
      [],
      [{ branch_id: 'b1', role: 'OWNER', status: 'ACTIVE' }],
      { page: 1, limit: 10 },
    );

    expect(result.data[0]).toMatchObject({
      branchId: 'b1',
      branchName: 'Gangnam',
      itemCount: 2,
      firstItemName: 'Americano',
      firstItemQty: 1,
      itemsSummary: 'Americano 1, 移댄럹?쇰뼹 2',
    });
  });

  it('getMyOrders should truncate itemsSummary and append remaining count', async () => {
    branchesChain.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });

    ordersChain.in
      .mockResolvedValueOnce({ count: 1, error: null })
      .mockReturnValueOnce(ordersChain);
    ordersChain.order.mockReturnValueOnce(ordersChain);
    ordersChain.range.mockResolvedValueOnce({
      data: [
        {
          id: 'o1',
          status: OrderStatus.CREATED,
          created_at: 't',
          total_amount: 10,
          customer_name: 'Customer',
          branch_id: 'b1',
          branches: { name: 'Gangnam' },
        },
      ],
      error: null,
    });
    orderItemsChain.in.mockResolvedValueOnce({
      data: [
        { order_id: 'o1', product_name_snapshot: '?곹뭹1', qty: 1 },
        { order_id: 'o1', product_name_snapshot: '?곹뭹2', qty: 1 },
        { order_id: 'o1', product_name_snapshot: '?곹뭹3', qty: 1 },
        { order_id: 'o1', product_name_snapshot: '?곹뭹4', qty: 1 },
        { order_id: 'o1', product_name_snapshot: '?곹뭹5', qty: 1 },
        { order_id: 'o1', product_name_snapshot: '?곹뭹6', qty: 1 },
        { order_id: 'o1', product_name_snapshot: '?곹뭹7', qty: 1 },
      ],
      error: null,
    });

    const result = await service.getMyOrders(
      'user-1',
      'b1',
      [],
      [{ branch_id: 'b1', role: 'OWNER', status: 'ACTIVE' }],
      { page: 1, limit: 10 },
    );

    expect(result.data[0].itemsSummary).toBe(
      '?곹뭹1 1, ?곹뭹2 1, ?곹뭹3 1, ?곹뭹4 1, ?곹뭹5 1, ?곹뭹6 1, +1',
    );
    expect(result.data[0].itemCount).toBe(7);
  });

  it('getMyOrders should throw on order item summary fetch error', async () => {
    branchesChain.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });

    ordersChain.in
      .mockResolvedValueOnce({ count: 1, error: null })
      .mockReturnValueOnce(ordersChain);
    ordersChain.order.mockReturnValueOnce(ordersChain);
    ordersChain.range.mockResolvedValueOnce({
      data: [
        {
          id: 'o1',
          status: OrderStatus.CREATED,
          created_at: 't',
          total_amount: 10,
          branch_id: 'b1',
          branches: { name: 'Gangnam' },
        },
      ],
      error: null,
    });
    orderItemsChain.in.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(
      service.getMyOrders(
        'user-1',
        'b1',
        [],
        [{ branch_id: 'b1', role: 'OWNER', status: 'ACTIVE' }],
        {},
      ),
    ).rejects.toThrow('Failed to fetch order item summaries');
  });

  it('getMyOrders should use accessible branches when branchId is omitted', async () => {
    branchesChain.in.mockResolvedValueOnce({
      data: [{ id: 'b2' }],
      error: null,
    });

    ordersChain.in
      .mockResolvedValueOnce({ count: 1, error: null })
      .mockReturnValueOnce(ordersChain);
    ordersChain.order.mockReturnValueOnce(ordersChain);
    ordersChain.range.mockResolvedValueOnce({
      data: [
        {
          id: 'o1',
          status: OrderStatus.CREATED,
          created_at: 't',
          total_amount: 10,
          branch_id: 'b1',
          branches: { name: 'Gangnam' },
        },
      ],
      error: null,
    });

    const result = await service.getMyOrders(
      'user-1',
      undefined,
      [{ brand_id: 'brand-1', role: 'OWNER', status: 'ACTIVE' }],
      [{ branch_id: 'b1', role: 'OWNER', status: 'ACTIVE' }],
      { page: 1, limit: 10 },
    );

    expect(result.data).toHaveLength(1);
  });

  it('getMyOrders should apply status filter', async () => {
    branchesChain.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });

    ordersChain.in
      .mockReturnValueOnce(ordersChain)
      .mockReturnValueOnce(ordersChain);
    ordersChain.eq
      .mockResolvedValueOnce({ count: 1, error: null })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'o1',
            status: OrderStatus.CONFIRMED,
            created_at: 't',
            total_amount: 10,
            branch_id: 'b1',
            branches: { name: 'Gangnam' },
          },
        ],
        error: null,
      });
    ordersChain.order.mockReturnValueOnce(ordersChain);
    ordersChain.range.mockReturnValueOnce(ordersChain);

    const result = await service.getMyOrders(
      'user-1',
      'b1',
      [],
      [{ branch_id: 'b1', role: 'OWNER', status: 'ACTIVE' }],
      { page: 1, limit: 10 },
      OrderStatus.CONFIRMED,
    );

    expect(result.data[0].status).toBe(OrderStatus.CONFIRMED);
  });

  it('getMyOrders should throw on count error', async () => {
    branchesChain.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });

    ordersChain.in.mockResolvedValueOnce({
      count: null,
      error: { message: 'fail' },
    });

    await expect(
      service.getMyOrders(
        'user-1',
        'b1',
        [],
        [{ branch_id: 'b1', role: 'OWNER', status: 'ACTIVE' }],
        {},
      ),
    ).rejects.toThrow('Failed to count orders');
  });

  it('getMyOrders should throw on data fetch error', async () => {
    branchesChain.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });

    ordersChain.in
      .mockResolvedValueOnce({ count: 1, error: null })
      .mockReturnValueOnce(ordersChain);
    ordersChain.order.mockReturnValueOnce(ordersChain);
    ordersChain.range.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(
      service.getMyOrders(
        'user-1',
        'b1',
        [],
        [{ branch_id: 'b1', role: 'OWNER', status: 'ACTIVE' }],
        {},
      ),
    ).rejects.toThrow('Failed to fetch orders');
  });

  it('getMyOrders should apply fulfillmentType filter', async () => {
    branchesChain.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });

    ordersChain.in
      .mockReturnValueOnce(ordersChain)
      .mockReturnValueOnce(ordersChain);
    ordersChain.eq
      .mockResolvedValueOnce({ count: 1, error: null })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'o1',
            status: OrderStatus.CREATED,
            created_at: '2026-02-18T10:00:00.000Z',
            total_amount: 10,
            branch_id: 'b1',
            branches: { name: 'Gangnam' },
            fulfillment_type: 'DELIVERY',
          },
        ],
        error: null,
      });
    ordersChain.order.mockReturnValueOnce(ordersChain);
    ordersChain.range.mockReturnValueOnce(ordersChain);

    const result = await service.getMyOrders(
      'user-1',
      'b1',
      [],
      [{ branch_id: 'b1', role: 'OWNER', status: 'ACTIVE' }],
      { page: 1, limit: 10 },
      undefined,
      'DELIVERY',
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].fulfillmentType).toBe('DELIVERY');
    expect(ordersChain.eq).toHaveBeenCalledWith('fulfillment_type', 'DELIVERY');
  });

  it('getMyOrders should expose deposit match status only for transfer payments', async () => {
    branchesChain.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });

    ordersChain.in
      .mockResolvedValueOnce({ count: 2, error: null })
      .mockReturnValueOnce(ordersChain);
    ordersChain.order.mockReturnValueOnce(ordersChain);
    ordersChain.range.mockResolvedValueOnce({
      data: [
        {
          id: 'o-transfer',
          status: OrderStatus.CREATED,
          created_at: '2026-02-18T10:00:00.000Z',
          total_amount: 10,
          customer_name: 'Transfer User',
          branch_id: 'b1',
        },
        {
          id: 'o-cash',
          status: OrderStatus.CREATED,
          created_at: '2026-02-18T10:05:00.000Z',
          total_amount: 20,
          customer_name: 'Cash User',
          branch_id: 'b1',
        },
      ],
      error: null,
    });
    paymentsChain.in
      .mockResolvedValueOnce({
        data: [
          { order_id: 'o-transfer', payment_method: 'TRANSFER' },
          { order_id: 'o-cash', payment_method: 'CASH' },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          { order_id: 'o-transfer', status: 'PENDING' },
          { order_id: 'o-cash', status: 'PENDING' },
        ],
        error: null,
      });
    depositMatchesChain.in.mockReturnValueOnce(depositMatchesChain);
    depositMatchesChain.eq.mockResolvedValueOnce({
      data: [
        { matched_order_id: 'o-transfer' },
        { matched_order_id: 'o-cash' },
      ],
      error: null,
    });

    const result = await service.getMyOrders(
      'user-1',
      'b1',
      [],
      [{ branch_id: 'b1', role: 'OWNER', status: 'ACTIVE' }],
      { page: 1, limit: 10 },
    );

    expect(result.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'o-transfer',
          paymentMethod: 'TRANSFER',
          depositMatchStatus: 'AUTO_MATCHED',
        }),
        expect.objectContaining({
          id: 'o-cash',
          paymentMethod: 'CASH',
          depositMatchStatus: null,
        }),
      ]),
    );
  });

  it('checkOrderAccess should throw when order not found', async () => {
    ordersChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      (service as any).checkOrderAccess('missing', 'user-1', [], []),
    ).rejects.toThrow(NotFoundException);
  });

  it('checkOrderAccess should return branch membership', async () => {
    ordersChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'o1' },
      error: null,
    });
    ordersChain.single.mockResolvedValueOnce({
      data: { id: 'o1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });

    const result = await (service as any).checkOrderAccess(
      'ORD-1',
      'user-1',
      [],
      [{ branch_id: 'b1', role: 'ADMIN', status: 'ACTIVE' }],
    );

    expect(result.role).toBe('ADMIN');
  });

  it('checkOrderAccess should throw when order fetch fails', async () => {
    ordersChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'o1' },
      error: null,
    });
    ordersChain.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(
      (service as any).checkOrderAccess('o1', 'user-1', [], []),
    ).rejects.toThrow(NotFoundException);
  });

  it('checkOrderAccess should throw when forbidden', async () => {
    ordersChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'o1' },
      error: null,
    });
    ordersChain.single.mockResolvedValueOnce({
      data: { id: 'o1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });

    await expect(
      (service as any).checkOrderAccess('ORD-1', 'user-1', [], []),
    ).rejects.toThrow(ForbiddenException);
  });

  it('getMyOrder should return order detail', async () => {
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: 'O-1',
          status: OrderStatus.CREATED,
          created_at: 't',
          customer_name: 'A',
          customer_phone: '1',
          delivery_address: 'addr',
          delivery_memo: 'memo',
          subtotal: 10,
          delivery_fee: 0,
          discount_total: 0,
          total_amount: 10,
          items: [
            {
              id: 'i1',
              product_name_snapshot: 'P',
              qty: 1,
              unit_price_snapshot: 10,
              options: [],
            },
          ],
        },
        error: null,
      });
    ordersChain.single.mockResolvedValueOnce({
      data: { id: 'o1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });

    const result = await service.getMyOrder(
      'user-1',
      'o1',
      [{ brand_id: 'brand-1', role: 'OWNER', status: 'ACTIVE' }],
      [],
    );

    expect(result.id).toBe('o1');
    expect(result.items).toHaveLength(1);
    expect(result.myRole).toBe('OWNER');
  });

  it('getMyOrder should fall back to order payment method when payment row is missing', async () => {
    jest
      .spyOn(service as any, 'getOrderPaymentMethodMap')
      .mockResolvedValueOnce(new Map([['o1', 'TRANSFER']]));
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: 'O-1',
          status: OrderStatus.CREATED,
          created_at: 't',
          payment_method: 'TRANSFER',
          customer_name: 'Kim',
          customer_phone: '010',
          delivery_address: 'addr',
          delivery_memo: null,
          subtotal: 10,
          delivery_fee: 0,
          discount_total: 0,
          total_amount: 10,
          items: [],
        },
        error: null,
      });
    ordersChain.single.mockResolvedValueOnce({
      data: { id: 'o1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });

    const result = await service.getMyOrder(
      'user-1',
      'o1',
      [{ brand_id: 'brand-1', role: 'OWNER', status: 'ACTIVE' }],
      [],
    );

    expect(result.payment.method).toBe('TRANSFER');
    expect(result.paymentStatus).toBeNull();
    expect(result.depositMatchStatus).toBe('PENDING');
  });

  it('getMyOrder should prefer order payment method over payment row method', async () => {
    jest
      .spyOn(service as any, 'getOrderPaymentMethodMap')
      .mockResolvedValueOnce(new Map([['o1', 'TRANSFER']]));
    jest
      .spyOn(service as any, 'getPaymentMethodMap')
      .mockResolvedValueOnce(new Map([['o1', 'CARD']]));
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: 'O-1',
          status: OrderStatus.CREATED,
          created_at: 't',
          customer_name: 'Kim',
          customer_phone: '010',
          delivery_address: 'addr',
          delivery_memo: null,
          subtotal: 10,
          delivery_fee: 0,
          discount_total: 0,
          total_amount: 10,
          items: [],
        },
        error: null,
      });
    ordersChain.single.mockResolvedValueOnce({
      data: { id: 'o1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });

    const result = await service.getMyOrder(
      'user-1',
      'o1',
      [{ brand_id: 'brand-1', role: 'OWNER', status: 'ACTIVE' }],
      [],
    );

    expect(result.payment.method).toBe('TRANSFER');
  });

  it('getMyOrder should keep payment method null when no stored payment method exists', async () => {
    jest
      .spyOn(service as any, 'getOrderPaymentMethodMap')
      .mockResolvedValueOnce(new Map());
    jest
      .spyOn(service as any, 'getPaymentMethodMap')
      .mockResolvedValueOnce(new Map());
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: 'O-1',
          status: OrderStatus.CREATED,
          created_at: 't',
          customer_name: 'Kim',
          customer_phone: '010',
          delivery_address: 'addr',
          delivery_memo: null,
          subtotal: 10,
          delivery_fee: 0,
          discount_total: 0,
          total_amount: 10,
          items: [],
        },
        error: null,
      });
    ordersChain.single.mockResolvedValueOnce({
      data: { id: 'o1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });

    const result = await service.getMyOrder(
      'user-1',
      'o1',
      [{ brand_id: 'brand-1', role: 'OWNER', status: 'ACTIVE' }],
      [],
    );

    expect(result.payment.method).toBeNull();
    expect(result.depositMatchStatus).toBeNull();
  });

  it('getMyOrder should map defaults and option names', async () => {
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: null,
          status: OrderStatus.CREATED,
          created_at: null,
          customer_name: null,
          customer_phone: null,
          delivery_address: null,
          delivery_memo: null,
          subtotal: null,
          delivery_fee: null,
          discount_total: null,
          total_amount: null,
          items: [
            {
              id: 'i1',
              product_name_snapshot: null,
              qty: null,
              unit_price_snapshot: null,
              options: [
                { option_name_snapshot: null },
                { option_name_snapshot: 'Opt-A' },
              ],
            },
          ],
        },
        error: null,
      });
    ordersChain.single.mockResolvedValueOnce({
      data: { id: 'o1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });

    const result = await service.getMyOrder(
      'user-1',
      'o1',
      [{ brand_id: 'brand-1', role: 'OWNER', status: 'ACTIVE' }],
      [],
    );

    expect(result.orderNo).toBeNull();
    expect(result.orderedAt).toBe('');
    expect(result.customer.name).toBe('');
    expect(result.customer.phone).toBe('');
    expect(result.customer.address1).toBe('');
    expect(result.customer.memo).toBeUndefined();
    expect(result.payment.subtotal).toBe(0);
    expect(result.payment.shippingFee).toBe(0);
    expect(result.payment.discount).toBe(0);
    expect(result.payment.total).toBe(0);
    expect(result.items[0].name).toBe('');
    expect(result.items[0].qty).toBe(0);
    expect(result.items[0].unitPrice).toBe(0);
    expect(result.items[0].option).toBe('Opt-A');
  });

  it('getMyOrder should omit option when options are missing', async () => {
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: 'O-1',
          status: OrderStatus.CREATED,
          created_at: 't',
          customer_name: 'A',
          customer_phone: '1',
          delivery_address: 'addr',
          delivery_memo: null,
          subtotal: 10,
          delivery_fee: 0,
          discount_total: 0,
          total_amount: 10,
          items: [
            {
              id: 'i1',
              product_name_snapshot: 'P',
              qty: 1,
              unit_price_snapshot: 10,
              options: undefined,
            },
          ],
        },
        error: null,
      });
    ordersChain.single.mockResolvedValueOnce({
      data: { id: 'o1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });

    const result = await service.getMyOrder(
      'user-1',
      'o1',
      [{ brand_id: 'brand-1', role: 'OWNER', status: 'ACTIVE' }],
      [],
    );

    expect(result.items[0].option).toBeUndefined();
  });

  it('getMyOrder should return empty items when missing', async () => {
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: 'O-1',
          status: OrderStatus.CREATED,
          created_at: 't',
          customer_name: 'A',
          customer_phone: '1',
          delivery_address: 'addr',
          delivery_memo: null,
          subtotal: 10,
          delivery_fee: 0,
          discount_total: 0,
          total_amount: 10,
          items: undefined,
        },
        error: null,
      });
    ordersChain.single.mockResolvedValueOnce({
      data: { id: 'o1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });

    const result = await service.getMyOrder(
      'user-1',
      'o1',
      [{ brand_id: 'brand-1', role: 'OWNER', status: 'ACTIVE' }],
      [],
    );

    expect(result.items).toEqual([]);
  });

  it('getMyOrder should throw when detail fetch fails', async () => {
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'fail' } });
    ordersChain.single.mockResolvedValueOnce({
      data: { id: 'o1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });

    await expect(
      service.getMyOrder(
        'user-1',
        'o1',
        [{ brand_id: 'brand-1', role: 'OWNER', status: 'ACTIVE' }],
        [],
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('getMyOrder should throw when order missing', async () => {
    ordersChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      service.getMyOrder('user-1', 'missing', [], []),
    ).rejects.toThrow(NotFoundException);
  });

  it('getMyOrder should throw when access is forbidden', async () => {
    ordersChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'o1' },
      error: null,
    });
    ordersChain.single.mockResolvedValueOnce({
      data: { id: 'o1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });

    await expect(service.getMyOrder('user-1', 'o1', [], [])).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('updateMyOrderStatus should update status', async () => {
    ordersChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'o1' },
      error: null,
    });
    ordersChain.single
      .mockResolvedValueOnce({
        data: { id: 'o1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          status: OrderStatus.READY,
          created_at: 't',
          customer_name: 'A',
          total_amount: 10,
        },
        error: null,
      });

    const result = await service.updateMyOrderStatus(
      'user-1',
      'o1',
      OrderStatus.READY,
      [{ brand_id: 'brand-1', role: 'OWNER', status: 'ACTIVE' }],
      [],
    );

    expect(result.status).toBe(OrderStatus.READY);
  });

  it('updateMyOrderStatus should refund and release inventory on cancellation', async () => {
    ordersChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'o1' },
      error: null,
    });
    ordersChain.single
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: 'ORD-1',
          branch_id: 'b1',
          branches: { brand_id: 'brand-1' },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: 'ORD-1',
          status: OrderStatus.CANCELLED,
          created_at: 't',
          customer_name: 'A',
          total_amount: 10,
        },
        error: null,
      });

    orderItemsChain.eq.mockResolvedValueOnce({
      data: [{ product_id: 'product-1', qty: 2 }],
      error: null,
    });
    inventoryChain.in.mockReturnValue(inventoryChain);
    let inventoryEqCalls = 0;
    inventoryChain.eq.mockImplementation(() => {
      inventoryEqCalls += 1;
      if (inventoryEqCalls === 1) {
        return Promise.resolve({
          data: [
            {
              product_id: 'product-1',
              qty_available: 5,
              qty_reserved: 2,
            },
          ],
          error: null,
        });
      }
      if (inventoryEqCalls === 2) {
        return inventoryChain;
      }
      if (inventoryEqCalls === 3) {
        return Promise.resolve({ data: {}, error: null });
      }
      return inventoryChain;
    });

    const result = await service.updateMyOrderStatus(
      'user-1',
      'o1',
      OrderStatus.CANCELLED,
      [{ brand_id: 'brand-1', role: 'OWNER', status: 'ACTIVE' }],
      [],
    );

    expect(result.status).toBe(OrderStatus.CANCELLED);
    expect(
      mockPaymentsService.refundOrderPaymentForCancellation,
    ).toHaveBeenCalledWith('o1', 'b1');
    expect(inventoryLogsChain.insert).toHaveBeenCalled();
  });

  it('updateMyOrderStatus should map nullable fields', async () => {
    ordersChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'o1' },
      error: null,
    });
    ordersChain.single
      .mockResolvedValueOnce({
        data: { id: 'o1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: null,
          status: OrderStatus.READY,
          created_at: null,
          customer_name: null,
          total_amount: null,
        },
        error: null,
      });

    const result = await service.updateMyOrderStatus(
      'user-1',
      'o1',
      OrderStatus.READY,
      [{ brand_id: 'brand-1', role: 'OWNER', status: 'ACTIVE' }],
      [],
    );

    expect(result.orderNo).toBeNull();
    expect(result.orderedAt).toBe('');
    expect(result.customerName).toBe('');
    expect(result.totalAmount).toBe(0);
  });

  it('updateMyOrderStatus should throw when order not found', async () => {
    ordersChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      service.updateMyOrderStatus(
        'user-1',
        'missing',
        OrderStatus.READY,
        [],
        [],
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('updateMyOrderStatus should throw for insufficient role (VIEWER)', async () => {
    ordersChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'o1' },
      error: null,
    });
    ordersChain.single.mockResolvedValueOnce({
      data: { id: 'o1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });

    await expect(
      service.updateMyOrderStatus(
        'user-1',
        'o1',
        OrderStatus.READY,
        [],
        [{ branch_id: 'b1', role: 'VIEWER', status: 'ACTIVE' }],
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('updateMyOrderStatus should throw on update error', async () => {
    ordersChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'o1' },
      error: null,
    });
    ordersChain.single
      .mockResolvedValueOnce({
        data: { id: 'o1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(
      service.updateMyOrderStatus(
        'user-1',
        'o1',
        OrderStatus.READY,
        [{ brand_id: 'brand-1', role: 'OWNER', status: 'ACTIVE' }],
        [],
      ),
    ).rejects.toThrow('Failed to update order status');
  });

  it('updateMyOrdersStatusBulk should update selected orders', async () => {
    ordersChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'o2' }, error: null });
    ordersChain.single
      .mockResolvedValueOnce({
        data: { id: 'o1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'o2', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
        error: null,
      });

    const result = await service.updateMyOrdersStatusBulk(
      'user-1',
      ['o1', 'o2'],
      OrderStatus.READY,
      [{ brand_id: 'brand-1', role: 'OWNER', status: 'ACTIVE' }],
      [],
    );

    expect(ordersChain.in).toHaveBeenCalledWith('id', ['o1', 'o2']);
    expect(result.updatedCount).toBe(2);
    expect(result.status).toBe(OrderStatus.READY);
    expect(result.orderIds).toEqual(['o1', 'o2']);
  });

  it('updateMyOrdersStatusBulk should route cancellations through single-order flow', async () => {
    const spy = jest
      .spyOn(service, 'updateMyOrderStatus')
      .mockResolvedValueOnce({
        id: 'o1',
        orderNo: 'ORD-1',
        orderedAt: 't',
        customerName: 'A',
        totalAmount: 10,
        status: OrderStatus.CANCELLED,
      })
      .mockResolvedValueOnce({
        id: 'o2',
        orderNo: 'ORD-2',
        orderedAt: 't',
        customerName: 'B',
        totalAmount: 20,
        status: OrderStatus.CANCELLED,
      });

    const result = await service.updateMyOrdersStatusBulk(
      'user-1',
      ['o1', 'o2'],
      OrderStatus.CANCELLED,
      [{ brand_id: 'brand-1', role: 'OWNER', status: 'ACTIVE' }],
      [],
    );

    expect(spy).toHaveBeenCalledTimes(2);
    expect(result.updatedCount).toBe(2);
    expect(result.orderIds).toEqual(['o1', 'o2']);
  });

  it('updateMyOrdersStatusBulk should throw for insufficient role', async () => {
    ordersChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'o1' },
      error: null,
    });
    ordersChain.single.mockResolvedValueOnce({
      data: { id: 'o1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });

    await expect(
      service.updateMyOrdersStatusBulk(
        'user-1',
        ['o1'],
        OrderStatus.READY,
        [],
        [{ branch_id: 'b1', role: 'VIEWER', status: 'ACTIVE' }],
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('updateMyOrdersStatusBulk should throw on update error', async () => {
    ordersChain.select
      .mockReturnValueOnce(ordersChain)
      .mockReturnValueOnce(ordersChain)
      .mockResolvedValueOnce({ data: null, error: { message: 'fail' } });
    ordersChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'o1' },
      error: null,
    });
    ordersChain.single.mockResolvedValueOnce({
      data: { id: 'o1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });

    await expect(
      service.updateMyOrdersStatusBulk(
        'user-1',
        ['o1'],
        OrderStatus.READY,
        [{ brand_id: 'brand-1', role: 'OWNER', status: 'ACTIVE' }],
        [],
      ),
    ).rejects.toThrow('Failed to bulk update order status');
  });

  it('checkModificationPermission should allow admin roles', () => {
    expect(() =>
      (service as any).checkModificationPermission('ADMIN', 'update', 'user-1'),
    ).not.toThrow();
  });
});
