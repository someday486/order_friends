import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PublicOrderService } from './public-order.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { InventoryService } from '../inventory/inventory.service';

describe('PublicOrderService - Create Order Branches', () => {
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
      order_dedup_logs: makeChain(),
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

  it('should throw when product is sold out', async () => {
    const dto = {
      branchId: 'b1',
      customerName: 'Customer',
      items: [{ productId: 'p1', qty: 1 }],
    } as any;

    anonChains.products.in.mockResolvedValueOnce({
      data: [{ id: 'p1', name: 'P', branch_id: 'b1', is_sold_out: true }],
      error: null,
    });

    await expect(service.createOrder(dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should throw when product query fails', async () => {
    const dto = {
      branchId: 'b1',
      customerName: 'Customer',
      items: [{ productId: 'p1', qty: 1 }],
    } as any;

    anonChains.products.in.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(service.createOrder(dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should throw when product belongs to another branch', async () => {
    const dto = {
      branchId: 'b1',
      customerName: 'Customer',
      items: [{ productId: 'p1', qty: 1 }],
    } as any;

    anonChains.products.in.mockResolvedValueOnce({
      data: [{ id: 'p1', name: 'P', branch_id: 'b2', base_price: 10 }],
      error: null,
    });

    await expect(service.createOrder(dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should throw when product is missing from product map', async () => {
    const dto = {
      branchId: 'b1',
      customerName: 'Customer',
      items: [
        { productId: 'p1', qty: 1 },
        { productId: 'p2', qty: 1 },
      ],
    } as any;

    anonChains.products.in.mockResolvedValueOnce({
      data: [{ id: 'p1', name: 'P', branch_id: 'b1', base_price: 10 }],
      error: null,
    });

    await expect(service.createOrder(dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should throw when options are provided', async () => {
    const dto = {
      branchId: 'b1',
      customerName: 'Customer',
      items: [{ productId: 'p1', qty: 1, options: [{ id: 'o1' }] }],
    } as any;

    anonChains.products.in.mockResolvedValueOnce({
      data: [{ id: 'p1', name: 'P', branch_id: 'b1' }],
      error: null,
    });

    await expect(service.createOrder(dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should throw when order insert fails', async () => {
    const dto = {
      branchId: 'b1',
      customerName: 'Customer',
      items: [{ productId: 'p1', qty: 1 }],
    } as any;

    anonChains.products.in.mockResolvedValueOnce({
      data: [{ id: 'p1', name: 'P', branch_id: 'b1' }],
      error: null,
    });

    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });
    anonChains.orders.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(service.createOrder(dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should throw when idempotency key payload signature mismatches', async () => {
    const dto = {
      branchId: 'b1',
      customerName: 'Customer',
      idempotencyKey: 'idem-1',
      items: [{ productId: 'p1', qty: 2 }],
    } as any;

    anonChains.products.in.mockResolvedValueOnce({
      data: [{ id: 'p1', name: 'P1', branch_id: 'b1', base_price: 1000 }],
      error: null,
    });

    adminChains.orders.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'o1',
          order_no: 'O-1',
          status: 'CREATED',
          total_amount: 2000,
          created_at: 't',
          order_items: [
            {
              product_id: 'p2',
              product_name_snapshot: 'P2',
              qty: 1,
              unit_price: 2000,
              order_item_options: [],
            },
          ],
        },
      ],
      error: null,
    });

    await expect(service.createOrder(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('should rollback when order item insert fails', async () => {
    const dto = {
      branchId: 'b1',
      customerName: 'Customer',
      items: [
        { productId: 'p1', qty: 1 },
        { productId: 'p2', qty: 2 },
      ],
    } as any;

    anonChains.products.in.mockResolvedValueOnce({
      data: [
        { id: 'p1', name: 'P1', branch_id: 'b1', base_price: 10 },
        { id: 'p2', name: 'P2', branch_id: 'b1', base_price: 20 },
      ],
      error: null,
    });

    adminChains.orders.limit.mockResolvedValueOnce({ data: [], error: null });
    anonChains.orders.single.mockResolvedValueOnce({
      data: { id: 'o1', order_no: 'O-1', status: 'CREATED', total_amount: 50, created_at: 't' },
      error: null,
    });

    anonChains.order_items.single
      .mockResolvedValueOnce({ data: null, error: { message: 'fail' } })
      .mockResolvedValueOnce({ data: { id: 'item-2' }, error: null });

    await expect(service.createOrder(dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(adminClient.rpc).not.toHaveBeenCalled();
  });

  it('should return existing order on unique constraint race', async () => {
    const dto = {
      branchId: 'b1',
      customerName: 'Customer',
      idempotencyKey: 'idem-1',
      items: [{ productId: 'p1', qty: 1 }],
    } as any;

    anonChains.products.in.mockResolvedValueOnce({
      data: [{ id: 'p1', name: 'P1', branch_id: 'b1', base_price: 1000 }],
      error: null,
    });

    adminChains.orders.limit
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    anonChains.orders.single.mockResolvedValueOnce({
      data: null,
      error: { code: '23505', message: 'dup' },
    });

    adminChains.orders.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'o1',
          order_no: 'O-1',
          status: 'CREATED',
          total_amount: 1000,
          created_at: 't',
          order_items: [
            {
              product_id: 'p1',
              product_name_snapshot: 'P1',
              qty: 1,
              unit_price: 1000,
              order_item_options: [],
            },
          ],
        },
      ],
      error: null,
    });

    const result = await service.createOrder(dto);
    expect(result.id).toBe('o1');
    expect(anonChains.order_items.insert).not.toHaveBeenCalled();
  });

  it('should throw when unique constraint race has no existing order', async () => {
    const dto = {
      branchId: 'b1',
      customerName: 'Customer',
      idempotencyKey: 'idem-1',
      items: [{ productId: 'p1', qty: 1 }],
    } as any;

    anonChains.products.in.mockResolvedValueOnce({
      data: [{ id: 'p1', name: 'P1', branch_id: 'b1', base_price: 1000 }],
      error: null,
    });

    adminChains.orders.limit
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    anonChains.orders.single.mockResolvedValueOnce({
      data: null,
      error: { code: '23505', message: 'dup' },
    });

    await expect(service.createOrder(dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should return duplicate order when only name is provided', async () => {
    const dto = {
      branchId: 'b1',
      customerName: 'Customer',
      items: [{ productId: 'p1', qty: 2 }],
    } as any;

    anonChains.products.in.mockResolvedValueOnce({
      data: [{ id: 'p1', name: 'P1', branch_id: 'b1', base_price: 1000 }],
      error: null,
    });

    adminChains.orders.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'o1',
          order_no: 'O-1',
          status: 'CREATED',
          total_amount: 2000,
          created_at: 't',
          order_items: [
            {
              product_id: 'p1',
              product_name_snapshot: 'P1',
              qty: 2,
              unit_price: 1000,
              order_item_options: [],
            },
          ],
        },
      ],
      error: null,
    });

    const result = await service.createOrder(dto);

    expect(result.id).toBe('o1');
    expect(result.totalAmount).toBe(2000);
    expect(result.items).toHaveLength(1);
    expect(anonChains.orders.insert).not.toHaveBeenCalled();
  });

  it('should return duplicate order when only phone is provided', async () => {
    const dto = {
      branchId: 'b1',
      customerPhone: '010-1111-2222',
      items: [{ productId: 'p1', qty: 1 }],
    } as any;

    anonChains.products.in.mockResolvedValueOnce({
      data: [{ id: 'p1', name: 'P1', branch_id: 'b1', base_price: 1000 }],
      error: null,
    });

    adminChains.orders.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'o1',
          order_no: 'O-1',
          status: 'CREATED',
          total_amount: 1000,
          created_at: 't',
          order_items: [
            {
              product_id: 'p1',
              product_name_snapshot: 'P1',
              qty: 1,
              unit_price: 1000,
              order_item_options: [],
            },
          ],
        },
      ],
      error: null,
    });

    const result = await service.createOrder(dto);
    expect(result.id).toBe('o1');
    expect(anonChains.orders.insert).not.toHaveBeenCalled();
  });
});
