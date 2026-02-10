import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';

describe('InventoryService', () => {
  let service: InventoryService;
  let mockSb: any;
  let chains: Record<string, any>;

  const makeChain = () => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  });

  const setup = () => {
    chains = {
      branches: makeChain(),
      products: makeChain(),
      product_inventory: makeChain(),
      inventory_logs: makeChain(),
    };
    mockSb = {
      from: jest.fn((table: string) => chains[table]),
    };
    const supabase = { adminClient: jest.fn(() => mockSb) };
    service = new InventoryService(supabase as SupabaseService);
  };

  beforeEach(() => {
    setup();
    jest.clearAllMocks();
  });

  it('checkBranchAccess should return branch membership', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });

    const result = await (service as any).checkBranchAccess(
      'b1',
      'u1',
      [],
      [{ branch_id: 'b1', role: 'STAFF' }],
    );

    expect(result.role).toBe('STAFF');
  });

  it('checkBranchAccess should return brand membership', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });

    const result = await (service as any).checkBranchAccess(
      'b1',
      'u1',
      [{ brand_id: 'brand-1', role: 'OWNER' }],
      [],
    );

    expect(result.role).toBe('OWNER');
  });

  it('checkBranchAccess should throw when no access', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });

    await expect(
      (service as any).checkBranchAccess('b1', 'u1', [], []),
    ).rejects.toThrow(ForbiddenException);
  });

  it('checkBranchAccess should throw when branch not found', async () => {
    chains.branches.single.mockResolvedValueOnce({ data: null, error: { message: 'missing' } });

    await expect(
      (service as any).checkBranchAccess('b1', 'u1', [], []),
    ).rejects.toThrow(NotFoundException);
  });

  it('checkProductAccess should return branch membership', async () => {
    chains.products.single.mockResolvedValueOnce({
      data: { id: 'p1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });

    const result = await (service as any).checkProductAccess(
      'p1',
      'u1',
      [],
      [{ branch_id: 'b1', role: 'ADMIN' }],
    );

    expect(result.role).toBe('ADMIN');
  });

  it('checkProductAccess should return brand membership', async () => {
    chains.products.single.mockResolvedValueOnce({
      data: { id: 'p1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });

    const result = await (service as any).checkProductAccess(
      'p1',
      'u1',
      [{ brand_id: 'brand-1', role: 'OWNER' }],
      [],
    );

    expect(result.role).toBe('OWNER');
  });

  it('checkProductAccess should throw when no access', async () => {
    chains.products.single.mockResolvedValueOnce({
      data: { id: 'p1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });

    await expect(
      (service as any).checkProductAccess('p1', 'u1', [], []),
    ).rejects.toThrow(ForbiddenException);
  });

  it('checkProductAccess should throw when not found', async () => {
    chains.products.single.mockResolvedValueOnce({ data: null, error: { message: 'missing' } });

    await expect(
      (service as any).checkProductAccess('p1', 'u1', [], []),
    ).rejects.toThrow(NotFoundException);
  });

  it('checkModificationPermission should reject non-admin roles', () => {
    expect(() =>
      (service as any).checkModificationPermission('STAFF', 'update inventory', 'u1'),
    ).toThrow(ForbiddenException);
  });

  it('createInventoryLog should swallow errors', async () => {
    chains.inventory_logs.insert.mockResolvedValueOnce({ error: { message: 'fail' } });
    await (service as any).createInventoryLog('p1', 'b1', 'ADJUST', 1, 0, 1, 'u1');
  });

  it('getInventoryList should return mapped items', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });
    chains.product_inventory.order.mockResolvedValueOnce({
      data: [
        {
          id: 'i1',
          product_id: 'p1',
          branch_id: 'b1',
          qty_available: 1,
          qty_reserved: 1,
          qty_sold: 0,
          low_stock_threshold: 2,
          created_at: 't',
          updated_at: 't',
          products: { name: 'P', image_url: 'img', product_categories: { name: 'C' } },
        },
      ],
      error: null,
    });

    const result = await service.getInventoryList('u1', 'b1', [], [{ branch_id: 'b1', role: 'OWNER' }]);

    expect(result[0].is_low_stock).toBe(true);
    expect(result[0].category).toBe('C');
  });

  it('getInventoryList should return empty list when data is null', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });
    chains.product_inventory.order.mockResolvedValueOnce({ data: null, error: null });

    const result = await service.getInventoryList('u1', 'b1', [], [{ branch_id: 'b1', role: 'OWNER' }]);

    expect(result).toHaveLength(0);
  });

  it('getInventoryList should map unknown product fields', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });
    chains.product_inventory.order.mockResolvedValueOnce({
      data: [
        {
          id: 'i1',
          product_id: 'p1',
          branch_id: 'b1',
          qty_available: 1,
          qty_reserved: 0,
          qty_sold: 0,
          low_stock_threshold: 2,
          created_at: 't',
          updated_at: 't',
          products: null,
        },
      ],
      error: null,
    });

    const result = await service.getInventoryList('u1', 'b1', [], [{ branch_id: 'b1', role: 'OWNER' }]);

    expect(result[0].product_name).toBe('Unknown');
    expect(result[0].category).toBeUndefined();
  });

  it('getInventoryList should throw on error', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });
    chains.product_inventory.order.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(
      service.getInventoryList('u1', 'b1', [], [{ branch_id: 'b1', role: 'OWNER' }]),
    ).rejects.toThrow('Failed to fetch inventory');
  });

  it('getInventoryByProduct should return existing inventory', async () => {
    chains.products.single.mockResolvedValueOnce({
      data: { id: 'p1', name: 'P', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });
    chains.product_inventory.single.mockResolvedValueOnce({
      data: {
        id: 'i1',
        product_id: 'p1',
        branch_id: 'b1',
        qty_available: 1,
        qty_reserved: 0,
        qty_sold: 0,
        low_stock_threshold: 2,
        created_at: 't',
        updated_at: 't',
      },
      error: null,
    });

    const result = await service.getInventoryByProduct('u1', 'p1', [], [{ branch_id: 'b1', role: 'OWNER' }]);
    expect(result.id).toBe('i1');
  });

  it('getInventoryByProduct should create inventory when missing', async () => {
    chains.products.single.mockResolvedValueOnce({
      data: { id: 'p1', name: 'P', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });
    chains.product_inventory.single
      .mockResolvedValueOnce({ data: null, error: { message: 'missing' } })
      .mockResolvedValueOnce({
        data: {
          id: 'i1',
          product_id: 'p1',
          branch_id: 'b1',
          qty_available: 0,
          qty_reserved: 0,
          qty_sold: 0,
          low_stock_threshold: 10,
          created_at: 't',
          updated_at: 't',
        },
        error: null,
      });

    const result = await service.getInventoryByProduct('u1', 'p1', [], [{ branch_id: 'b1', role: 'OWNER' }]);
    expect(result.id).toBe('i1');
  });

  it('getInventoryByProduct should throw if create fails', async () => {
    chains.products.single.mockResolvedValueOnce({
      data: { id: 'p1', name: 'P', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });
    chains.product_inventory.single
      .mockResolvedValueOnce({ data: null, error: { message: 'missing' } })
      .mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(
      service.getInventoryByProduct('u1', 'p1', [], [{ branch_id: 'b1', role: 'OWNER' }]),
    ).rejects.toThrow('Failed to get or create inventory');
  });

  it('updateInventory should return current when no updates', async () => {
    chains.products.single.mockResolvedValueOnce({
      data: { id: 'p1', name: 'P', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });
    chains.product_inventory.single.mockResolvedValueOnce({
      data: { id: 'i1', product_id: 'p1', branch_id: 'b1', qty_available: 1, qty_reserved: 0, qty_sold: 0, low_stock_threshold: 2 },
      error: null,
    });

    const spy = jest.spyOn(service, 'getInventoryByProduct').mockResolvedValueOnce({ id: 'i1' } as any);

    const result = await service.updateInventory('u1', 'p1', {}, [], [{ branch_id: 'b1', role: 'OWNER' }]);
    expect(result.id).toBe('i1');
    expect(spy).toHaveBeenCalled();
  });

  it('updateInventory should throw when inventory missing', async () => {
    chains.products.single.mockResolvedValueOnce({
      data: { id: 'p1', name: 'P', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });
    chains.product_inventory.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'missing' },
    });

    await expect(
      service.updateInventory('u1', 'p1', { qty_available: 1 } as any, [], [{ branch_id: 'b1', role: 'OWNER' }]),
    ).rejects.toThrow(NotFoundException);
  });

  it('updateInventory should throw on update error and create log on change', async () => {
    chains.products.single.mockResolvedValueOnce({
      data: { id: 'p1', name: 'P', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });
    chains.product_inventory.single.mockResolvedValueOnce({
      data: { id: 'i1', product_id: 'p1', branch_id: 'b1', qty_available: 1, qty_reserved: 0, qty_sold: 0, low_stock_threshold: 2 },
      error: null,
    });
    chains.product_inventory.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(
      service.updateInventory('u1', 'p1', { qty_available: 2 } as any, [], [{ branch_id: 'b1', role: 'OWNER' }]),
    ).rejects.toThrow('Failed to update inventory');
  });

  it('updateInventory should log when qty changes', async () => {
    chains.products.single.mockResolvedValueOnce({
      data: { id: 'p1', name: 'P', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });
    chains.product_inventory.single
      .mockResolvedValueOnce({
        data: { id: 'i1', product_id: 'p1', branch_id: 'b1', qty_available: 1, qty_reserved: 0, qty_sold: 0, low_stock_threshold: 2 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'i1', product_id: 'p1', branch_id: 'b1' },
        error: null,
      });
    const logSpy = jest
      .spyOn(service as any, 'createInventoryLog')
      .mockResolvedValueOnce(undefined);
    const detailSpy = jest
      .spyOn(service, 'getInventoryByProduct')
      .mockResolvedValueOnce({ id: 'i1' } as any);

    const result = await service.updateInventory(
      'u1',
      'p1',
      { qty_available: 2 } as any,
      [],
      [{ branch_id: 'b1', role: 'OWNER' }],
    );

    expect(result.id).toBe('i1');
    expect(logSpy).toHaveBeenCalled();
    expect(detailSpy).toHaveBeenCalled();
  });

  it('updateInventory should update low stock threshold without logging', async () => {
    chains.products.single.mockResolvedValueOnce({
      data: { id: 'p1', name: 'P', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });
    chains.product_inventory.single
      .mockResolvedValueOnce({
        data: { id: 'i1', product_id: 'p1', branch_id: 'b1', qty_available: 1, qty_reserved: 0, qty_sold: 0, low_stock_threshold: 2 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'i1', product_id: 'p1', branch_id: 'b1' },
        error: null,
      });

    const logSpy = jest.spyOn(service as any, 'createInventoryLog').mockResolvedValueOnce(undefined);
    const detailSpy = jest
      .spyOn(service, 'getInventoryByProduct')
      .mockResolvedValueOnce({ id: 'i1' } as any);

    const result = await service.updateInventory(
      'u1',
      'p1',
      { low_stock_threshold: 3 } as any,
      [],
      [{ branch_id: 'b1', role: 'OWNER' }],
    );

    expect(result.id).toBe('i1');
    expect(logSpy).not.toHaveBeenCalled();
    expect(detailSpy).toHaveBeenCalled();
  });

  it('adjustInventory should throw when qty would go negative', async () => {
    chains.products.single.mockResolvedValueOnce({
      data: { id: 'p1', name: 'P', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });
    chains.product_inventory.single.mockResolvedValueOnce({
      data: { id: 'i1', product_id: 'p1', branch_id: 'b1', qty_available: 1 },
      error: null,
    });

    await expect(
      service.adjustInventory('u1', 'p1', { qty_change: -2, transaction_type: 'ADJUST' } as any, [], [{ branch_id: 'b1', role: 'OWNER' }]),
    ).rejects.toThrow(BadRequestException);
  });

  it('adjustInventory should throw when inventory missing', async () => {
    chains.products.single.mockResolvedValueOnce({
      data: { id: 'p1', name: 'P', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });
    chains.product_inventory.single.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await expect(
      service.adjustInventory('u1', 'p1', { qty_change: 1, transaction_type: 'ADJUST' } as any, [], [{ branch_id: 'b1', role: 'OWNER' }]),
    ).rejects.toThrow(NotFoundException);
  });

  it('adjustInventory should throw on update error', async () => {
    chains.products.single.mockResolvedValueOnce({
      data: { id: 'p1', name: 'P', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });
    chains.product_inventory.single.mockResolvedValueOnce({
      data: { id: 'i1', product_id: 'p1', branch_id: 'b1', qty_available: 1 },
      error: null,
    });
    chains.product_inventory.eq
      .mockReturnValueOnce(chains.product_inventory)
      .mockReturnValueOnce(chains.product_inventory)
      .mockResolvedValueOnce({ error: { message: 'fail' } });

    await expect(
      service.adjustInventory(
        'u1',
        'p1',
        { qty_change: 1, transaction_type: 'ADJUST' } as any,
        [],
        [{ branch_id: 'b1', role: 'OWNER' }],
      ),
    ).rejects.toThrow('Failed to adjust inventory');
  });

  it('adjustInventory should update and return detail', async () => {
    chains.products.single.mockResolvedValueOnce({
      data: { id: 'p1', name: 'P', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });
    chains.product_inventory.single.mockResolvedValueOnce({
      data: { id: 'i1', product_id: 'p1', branch_id: 'b1', qty_available: 1 },
      error: null,
    });
    chains.product_inventory.eq
      .mockReturnValueOnce(chains.product_inventory)
      .mockReturnValueOnce(chains.product_inventory)
      .mockResolvedValueOnce({ error: null });
    const detailSpy = jest
      .spyOn(service, 'getInventoryByProduct')
      .mockResolvedValueOnce({ id: 'i1' } as any);

    const result = await service.adjustInventory(
      'u1',
      'p1',
      { qty_change: 1, transaction_type: 'ADJUST' } as any,
      [],
      [{ branch_id: 'b1', role: 'OWNER' }],
    );
    expect(result.id).toBe('i1');
    expect(detailSpy).toHaveBeenCalled();
  });

  it('getLowStockAlerts should return filtered items', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', name: 'B', brand_id: 'brand-1' },
      error: null,
    });
    chains.product_inventory.order.mockResolvedValueOnce({
      data: [
        { product_id: 'p1', branch_id: 'b1', qty_available: 1, low_stock_threshold: 2, products: { name: 'P' } },
        { product_id: 'p2', branch_id: 'b1', qty_available: 5, low_stock_threshold: 2, products: { name: 'Q' } },
      ],
      error: null,
    });

    const result = await service.getLowStockAlerts('u1', 'b1', [], [{ branch_id: 'b1', role: 'OWNER' }]);
    expect(result).toHaveLength(1);
    expect(result[0].product_id).toBe('p1');
  });

  it('getLowStockAlerts should return empty when data is null', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', name: 'B', brand_id: 'brand-1' },
      error: null,
    });
    chains.product_inventory.order.mockResolvedValueOnce({ data: null, error: null });

    const result = await service.getLowStockAlerts('u1', 'b1', [], [{ branch_id: 'b1', role: 'OWNER' }]);

    expect(result).toHaveLength(0);
  });

  it('getLowStockAlerts should map unknown product names', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', name: 'B', brand_id: 'brand-1' },
      error: null,
    });
    chains.product_inventory.order.mockResolvedValueOnce({
      data: [
        { product_id: 'p1', branch_id: 'b1', qty_available: 1, low_stock_threshold: 2, products: null },
      ],
      error: null,
    });

    const result = await service.getLowStockAlerts('u1', 'b1', [], [{ branch_id: 'b1', role: 'OWNER' }]);
    expect(result[0].product_name).toBe('Unknown');
  });

  it('getLowStockAlerts should throw on error', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', name: 'B', brand_id: 'brand-1' },
      error: null,
    });
    chains.product_inventory.order.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(
      service.getLowStockAlerts('u1', 'b1', [], [{ branch_id: 'b1', role: 'OWNER' }]),
    ).rejects.toThrow('Failed to fetch low stock alerts');
  });

  it('getInventoryLogs should require branchId or productId', async () => {
    await expect(service.getInventoryLogs('u1')).rejects.toThrow(BadRequestException);
  });

  it('getInventoryLogs should fetch by branch and product', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });
    chains.products.single.mockResolvedValueOnce({
      data: { id: 'p1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });
    chains.inventory_logs.eq
      .mockReturnValueOnce(chains.inventory_logs)
      .mockResolvedValueOnce({ data: [{ id: 'l1' }], error: null });

    const result = await service.getInventoryLogs('u1', 'b1', 'p1', [], [{ branch_id: 'b1', role: 'OWNER' }]);
    expect(result).toHaveLength(1);
  });

  it('getInventoryLogs should fetch by branch only with default memberships', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });
    chains.inventory_logs.eq.mockResolvedValueOnce({ data: [{ id: 'l1' }], error: null });

    const result = await service.getInventoryLogs(
      'u1',
      'b1',
      undefined,
      undefined,
      [{ branch_id: 'b1', role: 'OWNER' }],
    );

    expect(result).toHaveLength(1);
  });

  it('getInventoryLogs should fetch by product only and return empty on null data', async () => {
    chains.products.single.mockResolvedValueOnce({
      data: { id: 'p1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });
    chains.inventory_logs.eq.mockResolvedValueOnce({ data: null, error: null });

    const result = await service.getInventoryLogs(
      'u1',
      undefined,
      'p1',
      [{ brand_id: 'brand-1', role: 'OWNER' }],
      undefined,
    );

    expect(result).toHaveLength(0);
  });

  it('getInventoryLogs should throw on error', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });
    chains.inventory_logs.eq.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(
      service.getInventoryLogs('u1', 'b1', undefined, [], [{ branch_id: 'b1', role: 'OWNER' }]),
    ).rejects.toThrow('Failed to fetch inventory logs');
  });
});
