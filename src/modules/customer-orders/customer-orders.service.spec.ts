import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CustomerOrdersService } from './customer-orders.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { OrderStatus } from '../../modules/orders/order-status.enum';

describe('CustomerOrdersService', () => {
  let service: CustomerOrdersService;
  let ordersChain: any;
  let branchesChain: any;
  let mockSb: any;

  const makeChain = () => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
  });

  const setup = () => {
    ordersChain = makeChain();
    branchesChain = makeChain();
    mockSb = {
      from: jest.fn((table: string) => {
        if (table === 'orders') return ordersChain;
        if (table === 'branches') return branchesChain;
        return ordersChain;
      }),
    };
    const supabase = { adminClient: jest.fn(() => mockSb) };
    service = new CustomerOrdersService(supabase as SupabaseService);
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
      [{ branch_id: 'b1', role: 'STAFF' }],
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
      [{ brand_id: 'brand-1', role: 'OWNER' }],
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
        },
      ],
      error: null,
    });

    const result = await service.getMyOrders(
      'user-1',
      'b1',
      [],
      [{ branch_id: 'b1', role: 'OWNER' }],
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
        },
      ],
      error: null,
    });

    const result = await service.getMyOrders(
      'user-1',
      'b1',
      [],
      [{ branch_id: 'b1', role: 'OWNER' }],
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
      [{ branch_id: 'b1', role: 'OWNER' }],
      { page: 1, limit: 10 },
    );

    expect(result.data).toEqual([]);
    expect(result.pagination.total).toBe(0);
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
        },
      ],
      error: null,
    });

    const result = await service.getMyOrders(
      'user-1',
      'b1',
      [],
      [{ branch_id: 'b1', role: 'OWNER' }],
      { page: 1, limit: 10 },
    );

    expect(result.data[0]).toEqual({
      id: 'o1',
      orderNo: null,
      orderedAt: '',
      customerName: '',
      totalAmount: 0,
      status: OrderStatus.CREATED,
    });
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
        },
      ],
      error: null,
    });

    const result = await service.getMyOrders(
      'user-1',
      undefined,
      [{ brand_id: 'brand-1', role: 'OWNER' }],
      [{ branch_id: 'b1', role: 'OWNER' }],
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
      [{ branch_id: 'b1', role: 'OWNER' }],
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
        [{ branch_id: 'b1', role: 'OWNER' }],
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
        [{ branch_id: 'b1', role: 'OWNER' }],
        {},
      ),
    ).rejects.toThrow('Failed to fetch orders');
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
      [{ branch_id: 'b1', role: 'ADMIN' }],
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
      [{ brand_id: 'brand-1', role: 'OWNER' }],
      [],
    );

    expect(result.id).toBe('o1');
    expect(result.items).toHaveLength(1);
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
      [{ brand_id: 'brand-1', role: 'OWNER' }],
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
      [{ brand_id: 'brand-1', role: 'OWNER' }],
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
      [{ brand_id: 'brand-1', role: 'OWNER' }],
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
        [{ brand_id: 'brand-1', role: 'OWNER' }],
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
      [{ brand_id: 'brand-1', role: 'OWNER' }],
      [],
    );

    expect(result.status).toBe(OrderStatus.READY);
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
      [{ brand_id: 'brand-1', role: 'OWNER' }],
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
        [{ branch_id: 'b1', role: 'VIEWER' }],
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
        [{ brand_id: 'brand-1', role: 'OWNER' }],
        [],
      ),
    ).rejects.toThrow('Failed to update order status');
  });

  it('checkModificationPermission should allow admin roles', () => {
    expect(() =>
      (service as any).checkModificationPermission('ADMIN', 'update', 'user-1'),
    ).not.toThrow();
  });
});
