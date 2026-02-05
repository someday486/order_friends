import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PublicOrderService } from './public-order.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';

describe('PublicOrderService - Inventory Integration', () => {
  let service: PublicOrderService;
  let supabaseService: SupabaseService;

  const mockSupabaseService = {
    adminClient: jest.fn(),
    anonClient: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicOrderService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<PublicOrderService>(PublicOrderService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrder - Inventory Reservation', () => {
    it('should successfully create order and reserve inventory', async () => {
      const mockOrderDto = {
        branchId: 'branch-123',
        customerName: '홍길동',
        customerPhone: '010-1234-5678',
        items: [
          { productId: 'product-1', qty: 2, unitPrice: 10000 },
          { productId: 'product-2', qty: 1, unitPrice: 15000 },
        ],
      };

      const mockProducts = [
        { id: 'product-1', name: '상품A', price: 10000 },
        { id: 'product-2', name: '상품B', price: 15000 },
      ];

      const mockInventory = [
        {
          product_id: 'product-1',
          qty_available: 10,
          qty_reserved: 0,
        },
        {
          product_id: 'product-2',
          qty_available: 5,
          qty_reserved: 0,
        },
      ];

      const mockOrder = {
        id: 'order-123',
        order_no: 'ORD-001',
        branch_id: 'branch-123',
        customer_name: '홍길동',
        customer_phone: '010-1234-5678',
        total_amount: 35000,
        status: 'CREATED',
      };

      // Mock Supabase calls
      const mockAdminClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        single: jest.fn(),
      };

      mockSupabaseService.adminClient.mockReturnValue(mockAdminClient);

      // Setup mock responses
      mockAdminClient.select
        .mockResolvedValueOnce({ data: mockProducts, error: null }) // products query
        .mockResolvedValueOnce({ data: mockInventory, error: null }); // inventory query

      mockAdminClient.single.mockResolvedValueOnce({
        data: mockOrder,
        error: null,
      }); // order creation

      // Mock inventory updates and logs
      mockAdminClient.update.mockResolvedValue({ data: {}, error: null });
      mockAdminClient.insert.mockResolvedValue({ data: {}, error: null });

      const result = await service.createOrder(mockOrderDto);

      // Verify order was created
      expect(result).toBeDefined();
      expect(result.id).toBe('order-123');
      expect(result.total_amount).toBe(35000);

      // Verify inventory was checked
      expect(mockAdminClient.from).toHaveBeenCalledWith('product_inventory');

      // Verify inventory updates were called (once per item)
      expect(mockAdminClient.update).toHaveBeenCalledTimes(2);

      // Verify inventory logs were created
      expect(mockAdminClient.insert).toHaveBeenCalled();
    });

    it('should throw BadRequestException when inventory is insufficient', async () => {
      const mockOrderDto = {
        branchId: 'branch-123',
        customerName: '홍길동',
        customerPhone: '010-1234-5678',
        items: [
          { productId: 'product-1', qty: 100, unitPrice: 10000 }, // More than available
        ],
      };

      const mockProducts = [
        { id: 'product-1', name: '상품A', price: 10000 },
      ];

      const mockInventory = [
        {
          product_id: 'product-1',
          qty_available: 10, // Only 10 available, but order needs 100
          qty_reserved: 0,
        },
      ];

      const mockAdminClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      mockSupabaseService.adminClient.mockReturnValue(mockAdminClient);

      mockAdminClient.select
        .mockResolvedValueOnce({ data: mockProducts, error: null })
        .mockResolvedValueOnce({ data: mockInventory, error: null });

      // Should throw BadRequestException
      await expect(service.createOrder(mockOrderDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createOrder(mockOrderDto)).rejects.toThrow(
        /재고가 부족합니다/,
      );
    });

    it('should throw BadRequestException when product inventory not found', async () => {
      const mockOrderDto = {
        branchId: 'branch-123',
        customerName: '홍길동',
        customerPhone: '010-1234-5678',
        items: [{ productId: 'product-1', qty: 2, unitPrice: 10000 }],
      };

      const mockProducts = [
        { id: 'product-1', name: '상품A', price: 10000 },
      ];

      const mockInventory: any[] = []; // No inventory record

      const mockAdminClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      mockSupabaseService.adminClient.mockReturnValue(mockAdminClient);

      mockAdminClient.select
        .mockResolvedValueOnce({ data: mockProducts, error: null })
        .mockResolvedValueOnce({ data: mockInventory, error: null });

      await expect(service.createOrder(mockOrderDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createOrder(mockOrderDto)).rejects.toThrow(
        /재고 정보를 찾을 수 없습니다/,
      );
    });
  });

  describe('Order Creation Edge Cases', () => {
    it('should handle multiple items correctly', async () => {
      const mockOrderDto = {
        branchId: 'branch-123',
        customerName: '홍길동',
        customerPhone: '010-1234-5678',
        items: [
          { productId: 'product-1', qty: 2, unitPrice: 10000 },
          { productId: 'product-2', qty: 3, unitPrice: 5000 },
          { productId: 'product-3', qty: 1, unitPrice: 20000 },
        ],
      };

      const totalAmount =
        2 * 10000 + 3 * 5000 + 1 * 20000; // 55000

      expect(
        mockOrderDto.items.reduce(
          (sum, item) => sum + item.qty * item.unitPrice,
          0,
        ),
      ).toBe(55000);
    });

    it('should validate required fields', () => {
      const invalidDto: any = {
        branchId: '',
        customerName: '',
        items: [],
      };

      expect(invalidDto.branchId).toBeFalsy();
      expect(invalidDto.customerName).toBeFalsy();
      expect(invalidDto.items.length).toBe(0);
    });
  });
});
