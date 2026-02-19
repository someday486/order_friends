import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PublicOrderService } from './public-order.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { InventoryService } from '../inventory/inventory.service';

describe('PublicOrderService - Inventory Integration', () => {
  let service: PublicOrderService;
  let anonChains: Record<string, any>;
  let adminChains: Record<string, any>;
  let adminClient: any;

  const makeChain = () => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    in: jest.fn().mockReturnThis(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
  });

  beforeEach(async () => {
    anonChains = {
      branches: makeChain(),
      products: makeChain(),
      orders: makeChain(),
      order_items: makeChain(),
      order_item_options: makeChain(),
    };
    adminChains = {
      orders: makeChain(),
      order_items: makeChain(),
      product_inventory: makeChain(),
    };

    const anonClient = { from: jest.fn((table: string) => anonChains[table]) };
    adminClient = {
      from: jest.fn((table: string) => adminChains[table]),
      rpc: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicOrderService,
        {
          provide: SupabaseService,
          useValue: {
            anonClient: () => anonClient,
            adminClient: () => adminClient,
          },
        },
        { provide: InventoryService, useValue: {} },
      ],
    }).compile();

    service = module.get<PublicOrderService>(PublicOrderService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully create order and reserve inventory via RPC', async () => {
    const mockOrderDto = {
      branchId: 'branch-123',
      customerName: 'Customer',
      customerPhone: '010-1234-5678',
      items: [
        { productId: 'product-1', qty: 2, unitPrice: 10000 },
        { productId: 'product-2', qty: 1, unitPrice: 15000 },
      ],
    };

    anonChains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'product-1',
          name: 'Product',
          price: 10000,
          branch_id: 'branch-123',
        },
        {
          id: 'product-2',
          name: 'Product',
          price: 15000,
          branch_id: 'branch-123',
        },
      ],
      error: null,
    });

    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });

    anonChains.orders.single.mockResolvedValueOnce({
      data: {
        id: 'order-123',
        order_no: 'ORD-001',
        total_amount: 35000,
        status: 'CREATED',
        created_at: 't',
      },
      error: null,
    });

    anonChains.order_items.single
      .mockResolvedValueOnce({ data: { id: 'item-1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'item-2' }, error: null });

    adminClient.rpc.mockResolvedValueOnce({ data: null, error: null });

    const result = await service.createOrder(mockOrderDto as any);

    expect(result.id).toBe('order-123');
    expect(result.totalAmount).toBe(35000);
    expect(adminClient.rpc).toHaveBeenCalledWith(
      'reserve_inventory_for_order',
      {
        branch_id: 'branch-123',
        order_id: 'order-123',
        order_no: 'ORD-001',
        items: [
          { product_id: 'product-1', qty: 2 },
          { product_id: 'product-2', qty: 1 },
        ],
      },
    );
  });

  it('getBrands should group brands and build order paths', async () => {
    anonChains.branches.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'branch-1',
          slug: 'gangnam',
          brands: {
            id: 'brand-1',
            name: 'Test Cafe',
            slug: 'test-cafe',
            logo_url: 'logo-1',
            cover_image_url: 'cover-1',
          },
        },
        {
          id: 'branch-2',
          slug: 'hongdae',
          brands: {
            id: 'brand-1',
            name: 'Test Cafe',
            slug: 'test-cafe',
            logo_url: 'logo-1',
            cover_image_url: 'cover-1',
          },
        },
        {
          id: 'branch-3',
          slug: 'only-branch',
          brands: {
            id: 'brand-2',
            name: 'No Slug Brand',
            slug: null,
            logo_url: null,
            cover_image_url: null,
          },
        },
      ],
      error: null,
    });

    const result = await service.getBrands();

    expect(result).toEqual([
      {
        id: 'brand-2',
        name: 'No Slug Brand',
        slug: null,
        logoUrl: null,
        coverImageUrl: null,
        branchCount: 1,
        orderPath: '/order/branch/branch-3',
      },
      {
        id: 'brand-1',
        name: 'Test Cafe',
        slug: 'test-cafe',
        logoUrl: 'logo-1',
        coverImageUrl: 'cover-1',
        branchCount: 2,
        orderPath: '/order/test-cafe',
      },
    ]);
  });

  it('getBrands should throw when query fails', async () => {
    anonChains.branches.limit.mockResolvedValueOnce({
      data: null,
      error: { message: 'query failed' },
    });

    await expect(service.getBrands()).rejects.toThrow(
      '브랜드 목록 조회 실패: query failed',
    );
  });

  it('should skip inventory reservation when all ordered products are non-tracked', async () => {
    const mockOrderDto = {
      branchId: 'branch-123',
      customerName: 'Customer',
      customerPhone: '010-1234-5678',
      items: [{ productId: 'product-1', qty: 1 }],
    };

    anonChains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'product-1',
          name: 'Product',
          price: 1000,
          branch_id: 'branch-123',
        },
      ],
      error: null,
    });
    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });
    anonChains.orders.single.mockResolvedValueOnce({
      data: {
        id: 'order-1',
        order_no: 'O-1',
        total_amount: 1000,
        status: 'CREATED',
        created_at: 't',
      },
      error: null,
    });
    anonChains.order_items.single.mockResolvedValueOnce({
      data: { id: 'item-1' },
      error: null,
    });
    adminChains.product_inventory.in.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const result = await service.createOrder(mockOrderDto as any);

    expect(result.id).toBe('order-1');
    expect(adminClient.rpc).not.toHaveBeenCalled();
  });

  it('should reserve only inventory-tracked items in mixed orders', async () => {
    const mockOrderDto = {
      branchId: 'branch-123',
      customerName: 'Customer',
      customerPhone: '010-1234-5678',
      items: [
        { productId: 'product-1', qty: 2 },
        { productId: 'product-2', qty: 1 },
      ],
    };

    anonChains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'product-1',
          name: 'Tracked Product',
          price: 10000,
          branch_id: 'branch-123',
        },
        {
          id: 'product-2',
          name: 'Non-tracked Product',
          price: 15000,
          branch_id: 'branch-123',
        },
      ],
      error: null,
    });
    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });
    anonChains.orders.single.mockResolvedValueOnce({
      data: {
        id: 'order-123',
        order_no: 'ORD-001',
        total_amount: 35000,
        status: 'CREATED',
        created_at: 't',
      },
      error: null,
    });
    anonChains.order_items.single
      .mockResolvedValueOnce({ data: { id: 'item-1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'item-2' }, error: null });
    adminChains.product_inventory.in.mockResolvedValueOnce({
      data: [{ product_id: 'product-1' }],
      error: null,
    });
    adminClient.rpc.mockResolvedValueOnce({ data: null, error: null });

    await service.createOrder(mockOrderDto as any);

    expect(adminClient.rpc).toHaveBeenCalledWith(
      'reserve_inventory_for_order',
      {
        branch_id: 'branch-123',
        order_id: 'order-123',
        order_no: 'ORD-001',
        items: [{ product_id: 'product-1', qty: 2 }],
      },
    );
  });

  it('should rollback order when product inventory lookup fails', async () => {
    const mockOrderDto = {
      branchId: 'branch-123',
      customerName: 'Customer',
      customerPhone: '010-1234-5678',
      items: [{ productId: 'product-1', qty: 1 }],
    };

    anonChains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'product-1',
          name: 'Product',
          price: 1000,
          branch_id: 'branch-123',
        },
      ],
      error: null,
    });
    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });
    anonChains.orders.single.mockResolvedValueOnce({
      data: {
        id: 'order-1',
        order_no: 'O-1',
        total_amount: 1000,
        status: 'CREATED',
        created_at: 't',
      },
      error: null,
    });
    anonChains.order_items.single.mockResolvedValueOnce({
      data: { id: 'item-1' },
      error: null,
    });
    adminChains.product_inventory.in.mockResolvedValueOnce({
      data: null,
      error: { message: 'lookup-fail' },
    });

    await expect(service.createOrder(mockOrderDto as any)).rejects.toThrow(
      BadRequestException,
    );
    expect(adminChains.order_items.eq).toHaveBeenCalledWith(
      'order_id',
      'order-1',
    );
    expect(adminChains.orders.eq).toHaveBeenCalledWith('id', 'order-1');
    expect(adminClient.rpc).not.toHaveBeenCalled();
  });

  it('should continue order when product_inventory table is missing', async () => {
    const mockOrderDto = {
      branchId: 'branch-123',
      customerName: 'Customer',
      customerPhone: '010-1234-5678',
      items: [{ productId: 'product-1', qty: 1 }],
    };

    anonChains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'product-1',
          name: 'Product',
          price: 1000,
          branch_id: 'branch-123',
        },
      ],
      error: null,
    });
    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });
    anonChains.orders.single.mockResolvedValueOnce({
      data: {
        id: 'order-1',
        order_no: 'O-1',
        total_amount: 1000,
        status: 'CREATED',
        created_at: 't',
      },
      error: null,
    });
    anonChains.order_items.single.mockResolvedValueOnce({
      data: { id: 'item-1' },
      error: null,
    });
    adminChains.product_inventory.in.mockResolvedValueOnce({
      data: null,
      error: {
        code: '42P01',
        message: 'relation "product_inventory" does not exist',
      },
    });

    const result = await service.createOrder(mockOrderDto as any);

    expect(result.id).toBe('order-1');
    expect(adminClient.rpc).not.toHaveBeenCalled();
    expect(adminChains.order_items.delete).not.toHaveBeenCalled();
    expect(adminChains.orders.delete).not.toHaveBeenCalled();
  });

  it('should continue order when reserve_inventory_for_order function is missing', async () => {
    const mockOrderDto = {
      branchId: 'branch-123',
      customerName: 'Customer',
      customerPhone: '010-1234-5678',
      items: [{ productId: 'product-1', qty: 1 }],
    };

    anonChains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'product-1',
          name: 'Product',
          price: 1000,
          branch_id: 'branch-123',
        },
      ],
      error: null,
    });
    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });
    anonChains.orders.single.mockResolvedValueOnce({
      data: {
        id: 'order-1',
        order_no: 'O-1',
        total_amount: 1000,
        status: 'CREATED',
        created_at: 't',
      },
      error: null,
    });
    anonChains.order_items.single.mockResolvedValueOnce({
      data: { id: 'item-1' },
      error: null,
    });
    adminChains.product_inventory.in.mockResolvedValueOnce({
      data: [{ product_id: 'product-1' }],
      error: null,
    });
    adminClient.rpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: '42883',
        message:
          'function reserve_inventory_for_order(uuid, uuid, text, jsonb) does not exist',
      },
    });

    const result = await service.createOrder(mockOrderDto as any);

    expect(result.id).toBe('order-1');
    expect(adminClient.rpc).toHaveBeenCalledTimes(1);
    expect(adminChains.order_items.delete).not.toHaveBeenCalled();
    expect(adminChains.orders.delete).not.toHaveBeenCalled();
  });

  it('should insert order item options when present and ignore option insert errors', async () => {
    const mockOrderDto = {
      branchId: 'branch-123',
      customerName: 'Customer',
      customerPhone: '010-1234-5678',
      items: [{ productId: 'product-1', qty: 1 }],
    };

    anonChains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'product-1',
          name: 'Product',
          price: 1000,
          branch_id: 'branch-123',
        },
      ],
      error: null,
    });
    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });
    anonChains.orders.single.mockResolvedValueOnce({
      data: {
        id: 'order-1',
        order_no: 'O-1',
        total_amount: 1000,
        status: 'CREATED',
        created_at: 't',
      },
      error: null,
    });
    anonChains.order_items.single.mockResolvedValueOnce({
      data: { id: 'item-1' },
      error: null,
    });
    anonChains.order_item_options.insert
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'fail' } });
    adminClient.rpc.mockResolvedValueOnce({ data: null, error: null });

    const originalPush = Array.prototype.push;
    Array.prototype.push = function (...args: any[]) {
      const first = args[0];
      if (first && first.product_id && Array.isArray(first.options)) {
        first.options.push({
          product_option_id: 'opt-1',
          option_name_snapshot: 'Opt-1',
          price_delta_snapshot: 0,
        });
        first.options.push({
          product_option_id: 'opt-2',
          option_name_snapshot: 'Opt-2',
          price_delta_snapshot: 0,
        });
      }
      return originalPush.apply(this, args as any);
    };

    try {
      const result = await service.createOrder(mockOrderDto as any);

      expect(result.items[0].options).toEqual(['Opt-1']);
      expect(anonChains.order_item_options.insert).toHaveBeenCalledTimes(2);
    } finally {
      Array.prototype.push = originalPush;
    }
  });

  it('should throw BadRequestException when inventory is insufficient', async () => {
    const mockOrderDto = {
      branchId: 'branch-123',
      customerName: 'Customer',
      customerPhone: '010-1234-5678',
      items: [{ productId: 'product-1', qty: 100 }],
    };

    anonChains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'product-1',
          name: 'Product',
          price: 10000,
          branch_id: 'branch-123',
        },
      ],
      error: null,
    });
    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });
    anonChains.orders.single.mockResolvedValueOnce({
      data: {
        id: 'order-1',
        order_no: 'O-1',
        total_amount: 1000,
        status: 'CREATED',
        created_at: 't',
      },
      error: null,
    });
    anonChains.order_items.single.mockResolvedValueOnce({
      data: { id: 'item-1' },
      error: null,
    });
    adminClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'INSUFFICIENT_INVENTORY:product-1' },
    });

    await expect(service.createOrder(mockOrderDto as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException when product inventory not found', async () => {
    const mockOrderDto = {
      branchId: 'branch-123',
      customerName: 'Customer',
      customerPhone: '010-1234-5678',
      items: [{ productId: 'product-1', qty: 2 }],
    };

    anonChains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'product-1',
          name: 'Product',
          price: 10000,
          branch_id: 'branch-123',
        },
      ],
      error: null,
    });
    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });
    anonChains.orders.single.mockResolvedValueOnce({
      data: {
        id: 'order-1',
        order_no: 'O-1',
        total_amount: 1000,
        status: 'CREATED',
        created_at: 't',
      },
      error: null,
    });
    anonChains.order_items.single.mockResolvedValueOnce({
      data: { id: 'item-1' },
      error: null,
    });
    adminClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'INVENTORY_NOT_FOUND:product-1' },
    });

    await expect(service.createOrder(mockOrderDto as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should include missing inventory id when map lacks product name', async () => {
    const mockOrderDto = {
      branchId: 'branch-123',
      customerName: 'Customer',
      customerPhone: '010-1234-5678',
      items: [{ productId: 'product-1', qty: 2 }],
    };

    anonChains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'product-1',
          name: 'Product',
          price: 10000,
          branch_id: 'branch-123',
        },
      ],
      error: null,
    });
    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });
    anonChains.orders.single.mockResolvedValueOnce({
      data: {
        id: 'order-1',
        order_no: 'O-1',
        total_amount: 1000,
        status: 'CREATED',
        created_at: 't',
      },
      error: null,
    });
    anonChains.order_items.single.mockResolvedValueOnce({
      data: { id: 'item-1' },
      error: null,
    });
    adminClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'INVENTORY_NOT_FOUND:deadbeef' },
    });

    await expect(service.createOrder(mockOrderDto as any)).rejects.toThrow(
      'deadbeef',
    );
  });

  it('should include insufficient inventory id when map lacks product name', async () => {
    const mockOrderDto = {
      branchId: 'branch-123',
      customerName: 'Customer',
      customerPhone: '010-1234-5678',
      items: [{ productId: 'product-1', qty: 2 }],
    };

    anonChains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'product-1',
          name: 'Product',
          price: 10000,
          branch_id: 'branch-123',
        },
      ],
      error: null,
    });
    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });
    anonChains.orders.single.mockResolvedValueOnce({
      data: {
        id: 'order-1',
        order_no: 'O-1',
        total_amount: 1000,
        status: 'CREATED',
        created_at: 't',
      },
      error: null,
    });
    anonChains.order_items.single.mockResolvedValueOnce({
      data: { id: 'item-1' },
      error: null,
    });
    adminClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'INSUFFICIENT_INVENTORY:deadbeef' },
    });

    await expect(service.createOrder(mockOrderDto as any)).rejects.toThrow(
      'deadbeef',
    );
  });

  it('should throw BadRequestException when inventory reservation fails with generic error', async () => {
    const mockOrderDto = {
      branchId: 'branch-123',
      customerName: 'Customer',
      customerPhone: '010-1234-5678',
      items: [{ productId: 'product-1', qty: 1 }],
    };

    anonChains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'product-1',
          name: 'Product',
          price: 1000,
          branch_id: 'branch-123',
        },
      ],
      error: null,
    });
    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });
    anonChains.orders.single.mockResolvedValueOnce({
      data: {
        id: 'order-1',
        order_no: 'O-1',
        total_amount: 1000,
        status: 'CREATED',
        created_at: 't',
      },
      error: null,
    });
    anonChains.order_items.single.mockResolvedValueOnce({
      data: { id: 'item-1' },
      error: null,
    });
    adminClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'UNKNOWN_ERROR' },
    });

    await expect(service.createOrder(mockOrderDto as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException when inventory error message is missing', async () => {
    const mockOrderDto = {
      branchId: 'branch-123',
      customerName: 'Customer',
      customerPhone: '010-1234-5678',
      items: [{ productId: 'product-1', qty: 1 }],
    };

    anonChains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'product-1',
          name: 'Product',
          price: 1000,
          branch_id: 'branch-123',
        },
      ],
      error: null,
    });
    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });
    anonChains.orders.single.mockResolvedValueOnce({
      data: {
        id: 'order-1',
        order_no: 'O-1',
        total_amount: 1000,
        status: 'CREATED',
        created_at: 't',
      },
      error: null,
    });
    anonChains.order_items.single.mockResolvedValueOnce({
      data: { id: 'item-1' },
      error: null,
    });
    adminClient.rpc.mockResolvedValueOnce({
      data: null,
      error: {},
    });

    await expect(service.createOrder(mockOrderDto as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException when inventory reservation throws', async () => {
    const mockOrderDto = {
      branchId: 'branch-123',
      customerName: 'Customer',
      customerPhone: '010-1234-5678',
      items: [{ productId: 'product-1', qty: 1 }],
    };

    anonChains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'product-1',
          name: 'Product',
          price: 1000,
          branch_id: 'branch-123',
        },
      ],
      error: null,
    });
    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });
    anonChains.orders.single.mockResolvedValueOnce({
      data: {
        id: 'order-1',
        order_no: 'O-1',
        total_amount: 1000,
        status: 'CREATED',
        created_at: 't',
      },
      error: null,
    });
    anonChains.order_items.single.mockResolvedValueOnce({
      data: { id: 'item-1' },
      error: null,
    });
    adminClient.rpc.mockRejectedValueOnce(new Error('boom'));

    await expect(service.createOrder(mockOrderDto as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException when products list is null', async () => {
    const mockOrderDto = {
      branchId: 'branch-123',
      customerName: 'Customer',
      customerPhone: '010-1234-5678',
      items: [{ productId: 'product-1', qty: 1 }],
    };

    anonChains.products.in.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await expect(service.createOrder(mockOrderDto as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should return existing order when idempotency key matches', async () => {
    const mockOrderDto = {
      branchId: 'branch-123',
      customerName: 'Customer',
      customerPhone: '010-1234-5678',
      idempotencyKey: 'idem-1',
      items: [{ productId: 'product-1', qty: 2 }],
    };

    anonChains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'product-1',
          name: 'Product',
          price: 1000,
          branch_id: 'branch-123',
        },
      ],
      error: null,
    });

    adminChains.orders.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'order-1',
          order_no: 'O-1',
          status: 'CREATED',
          total_amount: 2000,
          created_at: 't',
          order_items: [
            {
              product_id: 'product-1',
              product_name_snapshot: 'P',
              qty: 2,
              unit_price: 1000,
            },
          ],
        },
      ],
      error: null,
    });

    const result = await service.createOrder(mockOrderDto as any);

    expect(result.id).toBe('order-1');
    expect(anonChains.orders.insert).not.toHaveBeenCalled();
  });

  it('should throw ConflictException when idempotency key payload mismatches', async () => {
    const mockOrderDto = {
      branchId: 'branch-123',
      customerName: 'Customer',
      customerPhone: '010-1234-5678',
      idempotencyKey: 'idem-1',
      items: [{ productId: 'product-1', qty: 1 }],
    };

    anonChains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'product-1',
          name: 'Product',
          price: 1000,
          branch_id: 'branch-123',
        },
      ],
      error: null,
    });

    adminChains.orders.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'order-1',
          order_no: 'O-1',
          status: 'CREATED',
          total_amount: 2000,
          created_at: 't',
          order_items: [
            {
              product_id: 'product-1',
              product_name_snapshot: 'P',
              qty: 2,
              unit_price: 1000,
            },
          ],
        },
      ],
      error: null,
    });

    await expect(service.createOrder(mockOrderDto as any)).rejects.toThrow(
      ConflictException,
    );
  });

  it('should detect and parse missing column from schema cache errors', () => {
    const error = {
      code: 'PGRST204',
      message:
        "Could not find the 'customer_address1' column of 'orders' in the schema cache",
    };

    expect((service as any).isMissingColumnError(error)).toBe(true);
    expect((service as any).getMissingColumnName(error)).toBe(
      'customer_address1',
    );
  });

  it('should retry order insert across multiple schema-cache missing columns', async () => {
    const mockOrderDto = {
      branchId: 'branch-123',
      customerName: 'Customer',
      customerPhone: '010-1234-5678',
      customerAddress1: 'Seoul',
      customerAddress2: '101',
      customerMemo: 'Leave at door',
      items: [{ productId: 'product-1', qty: 1 }],
    };

    anonChains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'product-1',
          name: 'Product',
          price: 1000,
          branch_id: 'branch-123',
        },
      ],
      error: null,
    });

    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });

    anonChains.orders.single
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: 'PGRST204',
          message:
            "Could not find the 'customer_address1' column of 'orders' in the schema cache",
        },
      })
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: 'PGRST204',
          message:
            "Could not find the 'customer_address2' column of 'orders' in the schema cache",
        },
      })
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: 'PGRST204',
          message:
            "Could not find the 'customer_memo' column of 'orders' in the schema cache",
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: 'order-1',
          order_no: 'O-1',
          total_amount: 1000,
          status: 'CREATED',
          created_at: 't',
        },
        error: null,
      });

    anonChains.order_items.single.mockResolvedValueOnce({
      data: { id: 'item-1' },
      error: null,
    });
    adminClient.rpc.mockResolvedValueOnce({ data: null, error: null });

    const result = await service.createOrder(mockOrderDto as any);

    expect(result.id).toBe('order-1');
    expect(anonChains.orders.single).toHaveBeenCalledTimes(4);
    expect(anonChains.orders.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        delivery_address: 'Seoul',
        delivery_memo: 'Leave at door',
      }),
    );
  });

  it('should fallback to admin client when anon insert is blocked by RLS', async () => {
    const mockOrderDto = {
      branchId: 'branch-123',
      customerName: 'Customer',
      items: [{ productId: 'product-1', qty: 1 }],
    };

    anonChains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'product-1',
          name: 'Product',
          price: 1000,
          branch_id: 'branch-123',
        },
      ],
      error: null,
    });

    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });

    anonChains.orders.single.mockResolvedValueOnce({
      data: null,
      error: {
        code: '42501',
        message:
          'new row violates row-level security policy for table "orders"',
      },
    });

    adminChains.orders.single.mockResolvedValueOnce({
      data: {
        id: 'order-admin-1',
        order_no: 'OA-1',
        total_amount: 1000,
        status: 'CREATED',
        created_at: 't',
      },
      error: null,
    });

    adminChains.order_items.single.mockResolvedValueOnce({
      data: { id: 'item-admin-1' },
      error: null,
    });
    adminClient.rpc.mockResolvedValueOnce({ data: null, error: null });

    const result = await service.createOrder(mockOrderDto as any);

    expect(result.id).toBe('order-admin-1');
    expect(anonChains.orders.insert).toHaveBeenCalledTimes(1);
    expect(adminChains.orders.insert).toHaveBeenCalledTimes(1);
    expect(adminChains.order_items.insert).toHaveBeenCalledTimes(1);
    expect(anonChains.order_items.insert).not.toHaveBeenCalled();
  });

  it('should retry order item insert when unit_price is missing in schema cache', async () => {
    const mockOrderDto = {
      branchId: 'branch-123',
      customerName: 'Customer',
      items: [{ productId: 'product-1', qty: 1 }],
    };

    anonChains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'product-1',
          name: 'Product',
          price: 1000,
          branch_id: 'branch-123',
        },
      ],
      error: null,
    });

    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });

    anonChains.orders.single.mockResolvedValueOnce({
      data: {
        id: 'order-1',
        order_no: 'O-1',
        total_amount: 1000,
        status: 'CREATED',
        created_at: 't',
      },
      error: null,
    });

    anonChains.order_items.single
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: 'PGRST204',
          message:
            "Could not find the 'unit_price' column of 'order_items' in the schema cache",
        },
      })
      .mockResolvedValueOnce({
        data: { id: 'item-1' },
        error: null,
      });

    adminClient.rpc.mockResolvedValueOnce({ data: null, error: null });

    const result = await service.createOrder(mockOrderDto as any);

    expect(result.id).toBe('order-1');
    expect(anonChains.order_items.single).toHaveBeenCalledTimes(2);
    expect(anonChains.order_items.insert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        unit_price_snapshot: 1000,
        line_total: 1000,
      }),
    );
  });

  it('should fallback DINE_IN fulfillment to PICKUP when enum is not supported', async () => {
    const mockOrderDto = {
      branchId: 'branch-123',
      customerName: 'Customer',
      fulfillmentType: 'DINE_IN',
      items: [{ productId: 'product-1', qty: 1 }],
    };

    anonChains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'product-1',
          name: 'Product',
          price: 1000,
          branch_id: 'branch-123',
        },
      ],
      error: null,
    });

    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });

    anonChains.orders.single
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: '22P02',
          message: 'invalid input value for enum fulfillment_type: "DINE_IN"',
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: 'order-1',
          order_no: 'O-1',
          total_amount: 1000,
          status: 'CREATED',
          created_at: 't',
        },
        error: null,
      });

    anonChains.order_items.single.mockResolvedValueOnce({
      data: { id: 'item-1' },
      error: null,
    });
    adminClient.rpc.mockResolvedValueOnce({ data: null, error: null });

    const result = await service.createOrder(mockOrderDto as any);

    expect(result.id).toBe('order-1');
    expect(anonChains.orders.single).toHaveBeenCalledTimes(2);
    expect(anonChains.orders.insert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        fulfillment_type: 'PICKUP',
      }),
    );
  });
});
