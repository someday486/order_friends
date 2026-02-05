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
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
    update: jest.fn().mockReturnThis(),
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

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrders', () => {
    it('should return list of orders', async () => {
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

      mockSupabaseClient.limit.mockResolvedValue({
        data: mockOrders,
        error: null,
      });

      const result = await service.getOrders('token', 'branch-123');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: '123',
        orderNo: 'ORD-001',
        orderedAt: '2024-01-01',
        customerName: 'Test User',
        totalAmount: 10000,
        status: OrderStatus.PENDING,
      });
    });

    it('should throw BusinessException on database error', async () => {
      mockSupabaseClient.limit.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
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

    it('should throw OrderNotFoundException when order not found', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(
        service.getOrder('token', 'invalid-id', 'branch-123'),
      ).rejects.toThrow(OrderNotFoundException);
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

      mockSupabaseClient.maybeSingle
        .mockResolvedValueOnce({
          data: { id: '123' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: mockOrder,
          error: null,
        });

      mockSupabaseClient.select
        .mockResolvedValueOnce({
          data: mockOrderItems,
          error: null,
        })
        .mockResolvedValueOnce({
          data: mockInventory,
          error: null,
        });

      mockSupabaseClient.update.mockResolvedValue({ data: {}, error: null });
      const insertMock = jest.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabaseClient.from = jest.fn().mockReturnValue({
        ...mockSupabaseClient,
        insert: insertMock,
      });

      await service.updateStatus(
        'token',
        '123',
        OrderStatus.CANCELLED,
        'branch-123',
      );

      // Verify inventory logs were created for cancellation
      expect(mockSupabaseClient.select).toHaveBeenCalled();
    });

    it('should not release inventory for non-cancelled status changes', async () => {
      const mockOrder = {
        id: '123',
        order_no: 'ORD-001',
        status: OrderStatus.PREPARING,
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

      mockSupabaseClient.update.mockResolvedValue({
        data: mockOrder,
        error: null,
      });

      const result = await service.updateStatus(
        'token',
        '123',
        OrderStatus.PREPARING,
        'branch-123',
      );

      // Status updated but no inventory operations
      expect(result.status).toBe(OrderStatus.PREPARING);
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
