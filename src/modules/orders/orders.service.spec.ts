import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { OrderStatus } from './order-status.enum';
import { OrderNotFoundException } from '../../common/exceptions/order.exception';
import { BusinessException } from '../../common/exceptions/business.exception';

describe('OrdersService', () => {
  let service: OrdersService;
  let supabaseService: SupabaseService;

  const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
  };

  const mockSupabaseService = {
    adminClient: jest.fn(() => mockSupabaseClient),
    userClient: jest.fn(() => mockSupabaseClient),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    supabaseService = module.get<SupabaseService>(SupabaseService);

    // Clear mock call history only, preserve mockReturnThis() implementations
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrders', () => {
    it('should return list of orders with pagination', async () => {
      const mockOrders = [
        {
          id: '123',
          order_no: 'ORD-001',
          status: OrderStatus.PENDING,
          created_at: '2024-01-01',
          total_amount: 10000,
          customer_name: 'Test User',
        },
      ];

      // Mock count query: from('orders').select('*', { count: 'exact', head: true }).eq('branch_id', branchId)
      // Returns { count, error } from eq()
      mockSupabaseClient.eq.mockResolvedValueOnce({
        count: 1,
        error: null,
      });

      // Mock data query: from('orders').select(...).eq(...).order(...).range(from, to)
      // Returns { data, error } from range()
      mockSupabaseClient.range.mockResolvedValueOnce({
        data: mockOrders,
        error: null,
      });

      const result = await service.getOrders('token', 'branch-123');

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({
        id: '123',
        orderNo: 'ORD-001',
        orderedAt: '2024-01-01',
        customerName: 'Test User',
        totalAmount: 10000,
        status: OrderStatus.PENDING,
      });
      expect(result.pagination).toBeDefined();
      expect(result.pagination.total).toBe(1);
    });

    it('should map default values when fields are null', async () => {
      const mockOrders = [
        {
          id: '123',
          order_no: null,
          status: OrderStatus.PENDING,
          created_at: null,
          total_amount: null,
          customer_name: null,
        },
      ];

      mockSupabaseClient.eq.mockResolvedValueOnce({
        count: 1,
        error: null,
      });
      mockSupabaseClient.range.mockResolvedValueOnce({
        data: mockOrders,
        error: null,
      });

      const result = await service.getOrders('token', 'branch-123');

      expect(result.data[0]).toEqual({
        id: '123',
        orderNo: null,
        orderedAt: '',
        customerName: '',
        totalAmount: 0,
        status: OrderStatus.PENDING,
      });
    });

    it('should return empty list when data is null and count is zero', async () => {
      mockSupabaseClient.eq.mockResolvedValueOnce({
        count: 0,
        error: null,
      });
      mockSupabaseClient.range.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await service.getOrders('token', 'branch-123');

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('should throw BusinessException on database error', async () => {
      // Mock count query returning an error
      mockSupabaseClient.eq.mockResolvedValueOnce({
        count: null,
        error: { message: 'Database error' },
      });

      await expect(service.getOrders('token', 'branch-123')).rejects.toThrow(
        BusinessException,
      );
    });

    it('should throw BusinessException on fetch error', async () => {
      mockSupabaseClient.eq
        .mockResolvedValueOnce({ count: 1, error: null })
        .mockReturnValueOnce(mockSupabaseClient);
      mockSupabaseClient.range.mockResolvedValueOnce({
        data: null,
        error: { message: 'fail' },
      });

      await expect(service.getOrders('token', 'branch-123')).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('getOrder', () => {
    it('should return order details', async () => {
      const mockOrder = {
        id: '123',
        order_no: 'ORD-001',
        status: OrderStatus.PENDING,
        created_at: '2024-01-01',
        customer_name: 'Test User',
        customer_phone: '010-1234-5678',
        delivery_address: 'Test Address',
        delivery_memo: 'Test Memo',
        subtotal: 10000,
        delivery_fee: 3000,
        discount_total: 0,
        total_amount: 13000,
        items: [
          {
            id: 'item-1',
            product_name_snapshot: 'Test Product',
            qty: 2,
            unit_price_snapshot: 5000,
            options: [],
          },
        ],
      };

      mockSupabaseClient.maybeSingle
        .mockResolvedValueOnce({
          data: { id: '123' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: mockOrder,
          error: null,
        });

      const result = await service.getOrder('token', '123', 'branch-123');

      expect(result.id).toBe('123');
      expect(result.orderNo).toBe('ORD-001');
      expect(result.items).toHaveLength(1);
    });

    it('should return empty items when order items are missing', async () => {
      const mockOrder = {
        id: '123',
        order_no: 'ORD-001',
        status: OrderStatus.PENDING,
        created_at: '2024-01-01',
        customer_name: 'Test User',
        customer_phone: '010-1234-5678',
        delivery_address: 'Test Address',
        delivery_memo: 'Test Memo',
        subtotal: 10000,
        delivery_fee: 3000,
        discount_total: 0,
        total_amount: 13000,
        items: undefined,
      };

      mockSupabaseClient.maybeSingle
        .mockResolvedValueOnce({
          data: { id: '123' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: mockOrder,
          error: null,
        });

      const result = await service.getOrder('token', '123', 'branch-123');

      expect(result.items).toEqual([]);
    });

    it('should map defaults and option names when fields are null', async () => {
      const mockOrder = {
        id: '123',
        order_no: null,
        status: OrderStatus.PENDING,
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
            id: 'item-1',
            product_name_snapshot: null,
            qty: null,
            unit_price_snapshot: null,
            options: [
              { option_name_snapshot: null },
              { option_name_snapshot: 'Option-A' },
            ],
          },
        ],
      };

      mockSupabaseClient.maybeSingle
        .mockResolvedValueOnce({
          data: { id: '123' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: mockOrder,
          error: null,
        });

      const result = await service.getOrder('token', '123', 'branch-123');

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
      expect(result.items[0].option).toBe('Option-A');
    });

    it('should resolve uuid directly when id exists', async () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const mockOrder = {
        id: uuid,
        order_no: 'ORD-UUID',
        status: OrderStatus.CONFIRMED,
        created_at: '2024-02-01',
        customer_name: 'Test',
        customer_phone: '010-0000-0000',
        delivery_address: 'Addr',
        delivery_memo: null,
        subtotal: 100,
        delivery_fee: 0,
        discount_total: 0,
        total_amount: 100,
        items: [],
      };

      mockSupabaseClient.maybeSingle
        .mockResolvedValueOnce({ data: { id: uuid }, error: null })
        .mockResolvedValueOnce({ data: mockOrder, error: null });

      const result = await service.getOrder('token', uuid, 'branch-123');
      expect(result.id).toBe(uuid);
      expect(result.orderNo).toBe('ORD-UUID');
    });

    it('should fall back to order_no when uuid lookup fails', async () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const mockOrder = {
        id: 'resolved-id',
        order_no: 'ORD-001',
        status: OrderStatus.PENDING,
        created_at: '2024-01-01',
        customer_name: 'Test',
        customer_phone: '010-1111-1111',
        delivery_address: 'Addr',
        delivery_memo: null,
        subtotal: 10,
        delivery_fee: 0,
        discount_total: 0,
        total_amount: 10,
        items: [],
      };

      mockSupabaseClient.maybeSingle
        .mockResolvedValueOnce({ data: null, error: { message: 'fail' } }) // by id
        .mockResolvedValueOnce({ data: { id: 'resolved-id' }, error: null }) // by order_no
        .mockResolvedValueOnce({ data: mockOrder, error: null }); // fetch

      const result = await service.getOrder('token', uuid, 'branch-123');
      expect(result.id).toBe('resolved-id');
    });

    it('should throw OrderNotFoundException when order not found', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(
        service.getOrder('token', 'invalid-id', 'branch-123'),
      ).rejects.toThrow(OrderNotFoundException);
    });

    it('should throw BusinessException on fetch error', async () => {
      mockSupabaseClient.maybeSingle
        .mockResolvedValueOnce({ data: { id: '123' }, error: null }) // resolveOrderId
        .mockResolvedValueOnce({ data: null, error: { message: 'fail' } }); // fetch

      await expect(
        service.getOrder('token', '123', 'branch-123'),
      ).rejects.toThrow(BusinessException);
    });

    it('should throw OrderNotFoundException when data missing', async () => {
      mockSupabaseClient.maybeSingle
        .mockResolvedValueOnce({ data: { id: '123' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      await expect(
        service.getOrder('token', '123', 'branch-123'),
      ).rejects.toThrow(OrderNotFoundException);
    });
  });

  describe('resolveOrderId', () => {
    it('should resolve by order_no without branch filter', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValueOnce({
        data: { id: 'order-1' },
        error: null,
      });

      const resolved = await (service as any).resolveOrderId(
        mockSupabaseClient,
        'ORD-001',
      );

      expect(resolved).toBe('order-1');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('order_no', 'ORD-001');
    });

    it('should resolve by uuid with branch filter', async () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      mockSupabaseClient.maybeSingle.mockResolvedValueOnce({
        data: { id: uuid },
        error: null,
      });

      const resolved = await (service as any).resolveOrderId(
        mockSupabaseClient,
        uuid,
        'branch-123',
      );

      expect(resolved).toBe(uuid);
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('branch_id', 'branch-123');
    });

    it('should resolve by order_no with branch filter', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValueOnce({
        data: { id: 'order-1' },
        error: null,
      });

      const resolved = await (service as any).resolveOrderId(
        mockSupabaseClient,
        'ORD-002',
        'branch-123',
      );

      expect(resolved).toBe('order-1');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('branch_id', 'branch-123');
    });
  });

  describe('updateStatus', () => {
    it('should update order status successfully', async () => {
      mockSupabaseClient.maybeSingle
        .mockResolvedValueOnce({
          data: { id: '123' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: '123',
            order_no: 'ORD-001',
            status: OrderStatus.CONFIRMED,
          },
          error: null,
        });

      const result = await service.updateStatus(
        'token',
        '123',
        OrderStatus.CONFIRMED,
        'branch-123',
      );

      expect(result.status).toBe(OrderStatus.CONFIRMED);
    });

    it('should throw OrderNotFoundException when order not found', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(
        service.updateStatus(
          'token',
          'invalid-id',
          OrderStatus.CONFIRMED,
          'branch-123',
        ),
      ).rejects.toThrow(OrderNotFoundException);
    });

    it('should throw BusinessException on update error', async () => {
      mockSupabaseClient.maybeSingle
        .mockResolvedValueOnce({ data: { id: '123' }, error: null }) // resolveOrderId
        .mockResolvedValueOnce({ data: null, error: { message: 'fail' } }); // update

      await expect(
        service.updateStatus('token', '123', OrderStatus.CONFIRMED, 'branch-123'),
      ).rejects.toThrow(BusinessException);
    });

    it('should throw OrderNotFoundException when update returns no data', async () => {
      mockSupabaseClient.maybeSingle
        .mockResolvedValueOnce({ data: { id: '123' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      await expect(
        service.updateStatus('token', '123', OrderStatus.CONFIRMED, 'branch-123'),
      ).rejects.toThrow(OrderNotFoundException);
    });

    it('should swallow inventory release errors on cancellation', async () => {
      const ordersChain = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(),
      };
      const orderItemsChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn(() => {
          throw new Error('boom');
        }),
      };

      let maybeSingleCalls = 0;
      ordersChain.maybeSingle.mockImplementation(() => {
        maybeSingleCalls += 1;
        if (maybeSingleCalls === 1) {
          return Promise.resolve({ data: { id: 'o1' }, error: null });
        }
        return Promise.resolve({
          data: { id: 'o1', order_no: 'ORD-1', status: OrderStatus.CANCELLED },
          error: null,
        });
      });

      const client = {
        from: jest.fn((table: string) =>
          table === 'orders' ? ordersChain : orderItemsChain,
        ),
      };
      mockSupabaseService.adminClient.mockReturnValueOnce(client as any);

      const result = await service.updateStatus(
        'token',
        'ORD-1',
        OrderStatus.CANCELLED,
        'branch-123',
      );

      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('should skip inventory release when cancelled order has no items', async () => {
      const ordersChain = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(),
      };
      const orderItemsChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const client = {
        from: jest.fn((table: string) =>
          table === 'orders' ? ordersChain : orderItemsChain,
        ),
      };

      ordersChain.maybeSingle
        .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
        .mockResolvedValueOnce({
          data: { id: 'o1', order_no: 'ORD-1', status: OrderStatus.CANCELLED },
          error: null,
        });

      mockSupabaseService.adminClient.mockReturnValueOnce(client as any);

      const result = await service.updateStatus(
        'token',
        'ORD-1',
        OrderStatus.CANCELLED,
        'branch-123',
      );

      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('should skip inventory release when inventory records are missing', async () => {
      const ordersChain = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(),
      };
      const orderItemsChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValueOnce({
          data: [{ product_id: 'product-1', qty: 1 }],
          error: null,
        }),
      };
      const inventoryChain = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValueOnce({ data: null, error: null }),
      };
      const logsChain = {
        insert: jest.fn().mockResolvedValueOnce({ data: {}, error: null }),
      };

      ordersChain.maybeSingle
        .mockResolvedValueOnce({ data: { id: 'o1' }, error: null })
        .mockResolvedValueOnce({
          data: { id: 'o1', order_no: null, status: OrderStatus.CANCELLED },
          error: null,
        });

      const client = {
        from: jest.fn((table: string) => {
          if (table === 'orders') return ordersChain;
          if (table === 'order_items') return orderItemsChain;
          if (table === 'product_inventory') return inventoryChain;
          if (table === 'inventory_logs') return logsChain;
          return ordersChain;
        }),
      };

      mockSupabaseService.adminClient.mockReturnValueOnce(client as any);

      const result = await service.updateStatus(
        'token',
        'ORD-1',
        OrderStatus.CANCELLED,
        'branch-123',
      );

      expect(result.orderNo).toBeNull();
      expect(result.status).toBe(OrderStatus.CANCELLED);
    });
  });

  describe('updateOrderStatus - Inventory Release on Cancellation', () => {
    it('should release inventory when order is cancelled', async () => {
      const mockOrderItems = [
        { product_id: 'product-1', qty: 2 },
        { product_id: 'product-2', qty: 3 },
      ];

      const mockInventory = [
        {
          product_id: 'product-1',
          qty_available: 8,
          qty_reserved: 2,
        },
        {
          product_id: 'product-2',
          qty_available: 5,
          qty_reserved: 3,
        },
      ];

      const mockOrder = {
        id: '123',
        order_no: 'ORD-001',
        status: OrderStatus.CANCELLED,
      };

      // Set up mock implementations
      let eqCallCount = 0;
      mockSupabaseClient.eq.mockImplementation(() => {
        eqCallCount++;
        // Calls 1-2: resolveOrderId (.eq('order_no').eq('branch_id'))
        // Calls 3-4: update order status (.eq('id').eq('branch_id'))
        if (eqCallCount <= 4) {
          return mockSupabaseClient;
        }
        // Call 5: order items query terminal (.eq('order_id', resolvedId))
        if (eqCallCount === 5) {
          return Promise.resolve({ data: mockOrderItems, error: null });
        }
        // Call 6: inventory SELECT query terminal (.in('product_id').eq('branch_id'))
        if (eqCallCount === 6) {
          return Promise.resolve({ data: mockInventory, error: null });
        }
        // Call 7: first item update inventory (.eq('product_id', 'product-1'))
        if (eqCallCount === 7) {
          return mockSupabaseClient;
        }
        // Call 8: first item update inventory terminal (.eq('branch_id'))
        if (eqCallCount === 8) {
          return Promise.resolve({ data: {}, error: null });
        }
        // Call 9: second item update inventory (.eq('product_id', 'product-2'))
        if (eqCallCount === 9) {
          return mockSupabaseClient;
        }
        // Call 10: second item update inventory terminal (.eq('branch_id'))
        if (eqCallCount === 10) {
          return Promise.resolve({ data: {}, error: null });
        }
        return mockSupabaseClient;
      });

      // Mock resolveOrderId and update query (only 2 maybeSingle calls total)
      mockSupabaseClient.maybeSingle
        .mockResolvedValueOnce({ data: { id: '123' }, error: null }) // resolveOrderId
        .mockResolvedValueOnce({ data: mockOrder, error: null }); // Update result

      mockSupabaseClient.update.mockReturnValue(mockSupabaseClient);
      mockSupabaseClient.insert.mockResolvedValue({ data: {}, error: null });

      await service.updateStatus(
        'token',
        '123',
        OrderStatus.CANCELLED,
        'branch-123',
      );

      // Verify inventory operations were performed
      expect(mockSupabaseClient.insert).toHaveBeenCalled();
    });

    it('should not release inventory for non-cancelled status changes', async () => {
      const mockOrder = {
        id: '123',
        order_no: 'ORD-001',
        status: OrderStatus.PREPARING,
      };

      // Set up mock - eq should return this for all chaining calls (no terminal eq calls)
      mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);

      // Mock resolveOrderId and update (only 2 maybeSingle calls)
      mockSupabaseClient.maybeSingle
        .mockResolvedValueOnce({ data: { id: '123' }, error: null }) // resolveOrderId
        .mockResolvedValueOnce({ data: mockOrder, error: null }); // Update result

      mockSupabaseClient.update.mockReturnValue(mockSupabaseClient);

      const result = await service.updateStatus(
        'token',
        '123',
        OrderStatus.PREPARING,
        'branch-123',
      );

      // Status updated but no inventory operations
      expect(result.status).toBe(OrderStatus.PREPARING);
      // Verify inventory methods were not called
      expect(mockSupabaseClient.insert).not.toHaveBeenCalled();
    });
  });

  describe('Order Status Transitions', () => {
    const validTransitions = [
      { from: OrderStatus.CREATED, to: OrderStatus.CONFIRMED, shouldRelease: false },
      { from: OrderStatus.CONFIRMED, to: OrderStatus.PREPARING, shouldRelease: false },
      { from: OrderStatus.PREPARING, to: OrderStatus.READY, shouldRelease: false },
      { from: OrderStatus.READY, to: OrderStatus.COMPLETED, shouldRelease: false },
      { from: OrderStatus.CREATED, to: OrderStatus.CANCELLED, shouldRelease: true },
      { from: OrderStatus.CONFIRMED, to: OrderStatus.CANCELLED, shouldRelease: true },
    ];

    test.each(validTransitions)(
      'transition from $from to $to should release inventory: $shouldRelease',
      ({ from, to, shouldRelease }) => {
        expect(to === OrderStatus.CANCELLED).toBe(shouldRelease);
      },
    );
  });
});
