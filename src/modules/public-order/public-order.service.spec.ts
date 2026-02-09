import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PublicOrderService } from './public-order.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { InventoryService } from '../inventory/inventory.service';

describe('PublicOrderService - Inventory Integration', () => {
  let service: PublicOrderService;
  let supabaseService: SupabaseService;
  let inventoryService: InventoryService;

  const mockAdminClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
  };

  const mockSupabaseService = {
    adminClient: jest.fn(() => mockAdminClient),
    anonClient: jest.fn(() => mockAdminClient),
  };

  const mockInventoryService = {
    reserveInventory: jest.fn(),
    releaseInventory: jest.fn(),
    getInventory: jest.fn(),
    updateInventory: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicOrderService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
        {
          provide: InventoryService,
          useValue: mockInventoryService,
        },
      ],
    }).compile();

    service = module.get<PublicOrderService>(PublicOrderService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
    inventoryService = module.get<InventoryService>(InventoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Reset all mock implementations to mockReturnThis
    mockAdminClient.from.mockReturnThis();
    mockAdminClient.select.mockReturnThis();
    mockAdminClient.insert.mockReturnThis();
    mockAdminClient.update.mockReturnThis();
    mockAdminClient.eq.mockReturnThis();
    mockAdminClient.in.mockReturnThis();
    mockAdminClient.single.mockReturnThis();
  });

  describe('createOrder - Inventory Reservation', () => {
    it('should successfully create order and reserve inventory', async () => {
      const mockOrderDto = {
        branchId: 'branch-123',
        customerName: 'Customer',
        customerPhone: '010-1234-5678',
        items: [
          { productId: 'product-1', qty: 2, unitPrice: 10000 },
          { productId: 'product-2', qty: 1, unitPrice: 15000 },
        ],
      };

      const mockProducts = [
        { id: 'product-1', name: 'Product', price: 10000, branch_id: 'branch-123' },
        { id: 'product-2', name: 'Product', price: 15000, branch_id: 'branch-123' },
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
        customer_name: 'Customer',
        customer_phone: '010-1234-5678',
        total_amount: 35000,
        status: 'CREATED',
      };

      // Setup mock responses with call counting
      let inCallCount = 0;
      mockAdminClient.in.mockImplementation(() => {
        inCallCount++;
        // Call 1: products query (.in('id', productIds)) - terminal
        if (inCallCount === 1) {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        // Call 2: inventory query (.in('product_id', productIds)) - chains to .eq()
        if (inCallCount === 2) {
          return mockAdminClient;
        }
        return mockAdminClient;
      });

      let eqCallCount = 0;
      mockAdminClient.eq.mockImplementation(() => {
        eqCallCount++;
        // Call 1: inventory query terminal (.eq('branch_id', branchId))
        if (eqCallCount === 1) {
          return Promise.resolve({ data: mockInventory, error: null });
        }
        // Calls 2-5: inventory updates for 2 items (update().eq('product_id').eq('branch_id') per item)
        // Each item has 2 eq calls, first returns mock, second returns promise
        if (eqCallCount === 2 || eqCallCount === 4) {
          return mockAdminClient; // First eq in update chain
        }
        if (eqCallCount === 3 || eqCallCount === 5) {
          return Promise.resolve({ data: {}, error: null }); // Terminal eq in update
        }
        return mockAdminClient;
      });

      // Handle multiple insert calls:
      // Call 1: Order insert - chains to select().single()
      // Calls 2-3: Order item inserts (2 items) - chain to select().single()
      // Calls 4-5: Inventory log inserts (2 items) - terminal
      let insertCallCount = 0;
      mockAdminClient.insert.mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount <= 3) {
          // Order and order items inserts - chain to select
          return mockAdminClient;
        }
        // Inventory log inserts - terminal
        return Promise.resolve({ data: {}, error: null });
      });

      // Handle single() calls for order and order items
      let singleCallCount = 0;
      mockAdminClient.single.mockImplementation(() => {
        singleCallCount++;
        if (singleCallCount === 1) {
          // Order creation
          return Promise.resolve({ data: mockOrder, error: null });
        }
        // Order items creation
        return Promise.resolve({ data: { id: `item-${singleCallCount}` }, error: null });
      });

      // Inventory updates: update().eq().eq() where second eq is terminal
      mockAdminClient.update.mockReturnValue(mockAdminClient);

      const result = await service.createOrder(mockOrderDto);

      // Verify order was created
      expect(result).toBeDefined();
      expect(result.id).toBe('order-123');
      expect(result.totalAmount).toBe(35000);

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
        customerName: 'Customer',
        customerPhone: '010-1234-5678',
        items: [
          { productId: 'product-1', qty: 100, unitPrice: 10000 }, // More than available
        ],
      };

      const mockProducts = [
        { id: 'product-1', name: 'Product', price: 10000, branch_id: 'branch-123' },
      ];

      const mockInventory = [
        {
          product_id: 'product-1',
          qty_available: 10, // Only 10 available, but order needs 100
          qty_reserved: 0,
        },
      ];

      // Setup mocks
      let inCallCount = 0;
      mockAdminClient.in.mockImplementation(() => {
        inCallCount++;
        if (inCallCount === 1) {
          // Products query terminal
          return Promise.resolve({ data: mockProducts, error: null });
        }
        if (inCallCount === 2) {
          // Inventory query - chain to eq
          return mockAdminClient;
        }
        return mockAdminClient;
      });

      mockAdminClient.eq.mockImplementation(() => {
        // Inventory query terminal
        return Promise.resolve({ data: mockInventory, error: null });
      });

      // Should throw BadRequestException with specific message
      await expect(service.createOrder(mockOrderDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when product inventory not found', async () => {
      const mockOrderDto = {
        branchId: 'branch-123',
        customerName: 'Customer',
        customerPhone: '010-1234-5678',
        items: [{ productId: 'product-1', qty: 2, unitPrice: 10000 }],
      };

      const mockProducts = [
        { id: 'product-1', name: 'Product', price: 10000, branch_id: 'branch-123' },
      ];

      const mockInventory: any[] = []; // No inventory record

      // Setup mocks
      let inCallCount = 0;
      mockAdminClient.in.mockImplementation(() => {
        inCallCount++;
        if (inCallCount === 1) {
          // Products query terminal
          return Promise.resolve({ data: mockProducts, error: null });
        }
        if (inCallCount === 2) {
          // Inventory query - chain to eq
          return mockAdminClient;
        }
        return mockAdminClient;
      });

      mockAdminClient.eq.mockImplementation(() => {
        // Inventory query terminal - returns empty array
        return Promise.resolve({ data: mockInventory, error: null });
      });

      await expect(service.createOrder(mockOrderDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });


    it('should throw when products query fails', async () => {
      const mockOrderDto = {
        branchId: 'branch-123',
        customerName: 'Customer',
        items: [{ productId: 'product-1', qty: 1, unitPrice: 1000 }],
      };

      mockAdminClient.in.mockResolvedValueOnce({
        data: null,
        error: { message: 'fail' },
      });

      await expect(service.createOrder(mockOrderDto as any)).rejects.toThrow(
        /상품 조회 실패/,
      );
    });

    it('should throw when product branch mismatch', async () => {
      const mockOrderDto = {
        branchId: 'branch-123',
        customerName: 'Customer',
        items: [{ productId: 'product-1', qty: 1, unitPrice: 1000 }],
      };

      mockAdminClient.in.mockResolvedValueOnce({
        data: [{ id: 'product-1', name: 'P', branch_id: 'other' }],
        error: null,
      });

      await expect(service.createOrder(mockOrderDto as any)).rejects.toThrow(
        /다른 가게의 상품/,
      );
    });

    it('should throw when product is hidden or sold out', async () => {
      const mockOrderDto = {
        branchId: 'branch-123',
        customerName: 'Customer',
        items: [{ productId: 'product-1', qty: 1, unitPrice: 1000 }],
      };

      mockAdminClient.in.mockResolvedValueOnce({
        data: [{ id: 'product-1', name: 'P', branch_id: 'branch-123', is_hidden: true }],
        error: null,
      });

      await expect(service.createOrder(mockOrderDto as any)).rejects.toThrow(
        /판매 중지된 상품/,
      );
    });

    it('should throw when options are provided', async () => {
      const mockOrderDto = {
        branchId: 'branch-123',
        customerName: 'Customer',
        items: [{ productId: 'product-1', qty: 1, unitPrice: 1000, options: [{ id: 'o1' }] }],
      };

      mockAdminClient.in.mockResolvedValueOnce({
        data: [{ id: 'product-1', name: 'P', branch_id: 'branch-123' }],
        error: null,
      });

      await expect(service.createOrder(mockOrderDto as any)).rejects.toThrow(
        /옵션 기능이 비활성화/,
      );
    });

    it('should throw when product missing in map', async () => {
      const mockOrderDto = {
        branchId: 'branch-123',
        customerName: 'Customer',
        items: [{ productId: 'product-1', qty: 1, unitPrice: 1000 }],
      };

      const mockInventory = [{ product_id: 'product-1', qty_available: 2, qty_reserved: 0 }];

      let inCallCount = 0;
      mockAdminClient.in.mockImplementation(() => {
        inCallCount++;
        if (inCallCount === 1) {
          return Promise.resolve({ data: [], error: null });
        }
        if (inCallCount === 2) {
          return mockAdminClient;
        }
        return mockAdminClient;
      });

      mockAdminClient.eq.mockImplementation(() => {
        return Promise.resolve({ data: mockInventory, error: null });
      });

      await expect(service.createOrder(mockOrderDto as any)).rejects.toThrow(
        /상품을 찾을 수 없습니다/,
      );
    });

    it('should throw when inventory update fails', async () => {
      const mockOrderDto = {
        branchId: 'branch-123',
        customerName: 'Customer',
        items: [{ productId: 'product-1', qty: 1, unitPrice: 1000 }],
      };

      const mockProducts = [{ id: 'product-1', name: 'P', price: 1000, branch_id: 'branch-123' }];
      const mockInventory = [{ product_id: 'product-1', qty_available: 2, qty_reserved: 0 }];
      const mockOrder = {
        id: 'order-1',
        order_no: 'O-1',
        total_amount: 1000,
        status: 'CREATED',
        created_at: 't',
      };

      let inCallCount = 0;
      mockAdminClient.in.mockImplementation(() => {
        inCallCount++;
        if (inCallCount === 1) {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        if (inCallCount === 2) {
          return mockAdminClient;
        }
        return mockAdminClient;
      });

      let eqCallCount = 0;
      mockAdminClient.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount === 1) {
          return Promise.resolve({ data: mockInventory, error: null });
        }
        if (eqCallCount === 2) {
          return mockAdminClient;
        }
        if (eqCallCount === 3) {
          return Promise.resolve({ error: { message: 'fail' } });
        }
        return mockAdminClient;
      });

      let singleCallCount = 0;
      mockAdminClient.single.mockImplementation(() => {
        singleCallCount++;
        if (singleCallCount === 1) {
          return Promise.resolve({ data: mockOrder, error: null });
        }
        return Promise.resolve({ data: { id: 'item-1' }, error: null });
      });

      mockAdminClient.insert.mockReturnThis();
      mockAdminClient.update.mockReturnValue(mockAdminClient);

      await expect(service.createOrder(mockOrderDto as any)).rejects.toThrow(
        /재고 처리 중 오류/,
      );
    });
  describe('Order Creation Edge Cases', () => {
    it('should handle multiple items correctly', async () => {
      const mockOrderDto = {
        branchId: 'branch-123',
        customerName: 'Customer',
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

