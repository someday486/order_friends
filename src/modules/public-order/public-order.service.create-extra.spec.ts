import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PublicOrderService } from './public-order.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { InventoryService } from '../inventory/inventory.service';

describe('PublicOrderService - Create Order Branches', () => {
  let service: PublicOrderService;
  let anonChains: Record<string, any>;
  let adminChains: Record<string, any>;

  const makeChain = () => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    single: jest.fn(),
  });

  beforeEach(async () => {
    anonChains = {
      products: makeChain(),
      orders: makeChain(),
      order_items: makeChain(),
      order_item_options: makeChain(),
    };
    adminChains = {
      product_inventory: makeChain(),
      inventory_logs: makeChain(),
      orders: makeChain(),
      order_items: makeChain(),
    };

    const anonClient = { from: jest.fn((table: string) => anonChains[table]) };
    const adminClient = { from: jest.fn((table: string) => adminChains[table]) };

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

  it('should throw when inventory query fails', async () => {
    const dto = {
      branchId: 'b1',
      customerName: 'Customer',
      items: [{ productId: 'p1', qty: 1 }],
    } as any;

    anonChains.products.in.mockResolvedValueOnce({
      data: [{ id: 'p1', name: 'P', branch_id: 'b1' }],
      error: null,
    });

    adminChains.product_inventory.in.mockReturnValueOnce(adminChains.product_inventory);
    adminChains.product_inventory.eq.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(service.createOrder(dto)).rejects.toBeInstanceOf(BadRequestException);
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

    await expect(service.createOrder(dto)).rejects.toBeInstanceOf(BadRequestException);
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

    adminChains.product_inventory.in.mockReturnValueOnce(adminChains.product_inventory);
    adminChains.product_inventory.eq.mockResolvedValueOnce({
      data: [{ product_id: 'p1', qty_available: 10, qty_reserved: 0 }],
      error: null,
    });

    anonChains.orders.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(service.createOrder(dto)).rejects.toBeInstanceOf(BadRequestException);
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

    let eqCallCount = 0;
    adminChains.product_inventory.in.mockReturnValueOnce(adminChains.product_inventory);
    adminChains.product_inventory.eq.mockImplementation(() => {
      eqCallCount += 1;
      if (eqCallCount === 1) {
        return Promise.resolve({
          data: [
            { product_id: 'p1', qty_available: 10, qty_reserved: 0 },
            { product_id: 'p2', qty_available: 10, qty_reserved: 0 },
          ],
          error: null,
        });
      }
      return adminChains.product_inventory;
    });

    anonChains.orders.single.mockResolvedValueOnce({
      data: { id: 'o1', order_no: 'O-1', status: 'CREATED', total_amount: 50, created_at: 't' },
      error: null,
    });

    anonChains.order_items.single
      .mockResolvedValueOnce({ data: null, error: { message: 'fail' } })
      .mockResolvedValueOnce({ data: { id: 'item-2' }, error: null });

    adminChains.product_inventory.update.mockReturnValue(adminChains.product_inventory);
    adminChains.inventory_logs.insert.mockResolvedValue({ data: {}, error: null });

    await expect(service.createOrder(dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
