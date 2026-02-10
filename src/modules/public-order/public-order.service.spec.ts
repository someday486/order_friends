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
      products: makeChain(),
      orders: makeChain(),
      order_items: makeChain(),
      order_item_options: makeChain(),
    };
    adminChains = {
      orders: makeChain(),
      order_items: makeChain(),
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
          useValue: { anonClient: () => anonClient, adminClient: () => adminClient },
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
        { id: 'product-1', name: 'Product', price: 10000, branch_id: 'branch-123' },
        { id: 'product-2', name: 'Product', price: 15000, branch_id: 'branch-123' },
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
    expect(adminClient.rpc).toHaveBeenCalledWith('reserve_inventory_for_order', {
      branch_id: 'branch-123',
      order_id: 'order-123',
      order_no: 'ORD-001',
      items: [
        { product_id: 'product-1', qty: 2 },
        { product_id: 'product-2', qty: 1 },
      ],
    });
  });

  it('should insert order item options when present and ignore option insert errors', async () => {
    const mockOrderDto = {
      branchId: 'branch-123',
      customerName: 'Customer',
      customerPhone: '010-1234-5678',
      items: [{ productId: 'product-1', qty: 1 }],
    };

    anonChains.products.in.mockResolvedValueOnce({
      data: [{ id: 'product-1', name: 'Product', price: 1000, branch_id: 'branch-123' }],
      error: null,
    });
    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });
    anonChains.orders.single.mockResolvedValueOnce({
      data: { id: 'order-1', order_no: 'O-1', total_amount: 1000, status: 'CREATED', created_at: 't' },
      error: null,
    });
    anonChains.order_items.single.mockResolvedValueOnce({ data: { id: 'item-1' }, error: null });
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
      data: [{ id: 'product-1', name: 'Product', price: 10000, branch_id: 'branch-123' }],
      error: null,
    });
    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });
    anonChains.orders.single.mockResolvedValueOnce({
      data: { id: 'order-1', order_no: 'O-1', total_amount: 1000, status: 'CREATED', created_at: 't' },
      error: null,
    });
    anonChains.order_items.single.mockResolvedValueOnce({ data: { id: 'item-1' }, error: null });
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
      data: [{ id: 'product-1', name: 'Product', price: 10000, branch_id: 'branch-123' }],
      error: null,
    });
    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });
    anonChains.orders.single.mockResolvedValueOnce({
      data: { id: 'order-1', order_no: 'O-1', total_amount: 1000, status: 'CREATED', created_at: 't' },
      error: null,
    });
    anonChains.order_items.single.mockResolvedValueOnce({ data: { id: 'item-1' }, error: null });
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
      data: [{ id: 'product-1', name: 'Product', price: 10000, branch_id: 'branch-123' }],
      error: null,
    });
    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });
    anonChains.orders.single.mockResolvedValueOnce({
      data: { id: 'order-1', order_no: 'O-1', total_amount: 1000, status: 'CREATED', created_at: 't' },
      error: null,
    });
    anonChains.order_items.single.mockResolvedValueOnce({ data: { id: 'item-1' }, error: null });
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
      data: [{ id: 'product-1', name: 'Product', price: 10000, branch_id: 'branch-123' }],
      error: null,
    });
    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });
    anonChains.orders.single.mockResolvedValueOnce({
      data: { id: 'order-1', order_no: 'O-1', total_amount: 1000, status: 'CREATED', created_at: 't' },
      error: null,
    });
    anonChains.order_items.single.mockResolvedValueOnce({ data: { id: 'item-1' }, error: null });
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
      data: [{ id: 'product-1', name: 'Product', price: 1000, branch_id: 'branch-123' }],
      error: null,
    });
    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });
    anonChains.orders.single.mockResolvedValueOnce({
      data: { id: 'order-1', order_no: 'O-1', total_amount: 1000, status: 'CREATED', created_at: 't' },
      error: null,
    });
    anonChains.order_items.single.mockResolvedValueOnce({ data: { id: 'item-1' }, error: null });
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
      data: [{ id: 'product-1', name: 'Product', price: 1000, branch_id: 'branch-123' }],
      error: null,
    });
    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });
    anonChains.orders.single.mockResolvedValueOnce({
      data: { id: 'order-1', order_no: 'O-1', total_amount: 1000, status: 'CREATED', created_at: 't' },
      error: null,
    });
    anonChains.order_items.single.mockResolvedValueOnce({ data: { id: 'item-1' }, error: null });
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
      data: [{ id: 'product-1', name: 'Product', price: 1000, branch_id: 'branch-123' }],
      error: null,
    });
    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });
    anonChains.orders.single.mockResolvedValueOnce({
      data: { id: 'order-1', order_no: 'O-1', total_amount: 1000, status: 'CREATED', created_at: 't' },
      error: null,
    });
    anonChains.order_items.single.mockResolvedValueOnce({ data: { id: 'item-1' }, error: null });
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
      data: [{ id: 'product-1', name: 'Product', price: 1000, branch_id: 'branch-123' }],
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
            { product_id: 'product-1', product_name_snapshot: 'P', qty: 2, unit_price: 1000 },
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
      data: [{ id: 'product-1', name: 'Product', price: 1000, branch_id: 'branch-123' }],
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
            { product_id: 'product-1', product_name_snapshot: 'P', qty: 2, unit_price: 1000 },
          ],
        },
      ],
      error: null,
    });

    await expect(service.createOrder(mockOrderDto as any)).rejects.toThrow(
      ConflictException,
    );
  });
});
