import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CustomerProductsService } from './customer-products.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';

describe('CustomerProductsService', () => {
  let service: CustomerProductsService;
  let mockSb: any;
  let chains: Record<string, any>;

  const makeChain = () => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
  });

  const setup = () => {
    chains = {
      branches: makeChain(),
      products: makeChain(),
      product_categories: makeChain(),
      product_options: makeChain(),
    };
    mockSb = { from: jest.fn((table: string) => chains[table]) };
    const supabase = { adminClient: jest.fn(() => mockSb) };
    service = new CustomerProductsService(supabase as SupabaseService);
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

    expect(result.branchMembership.role).toBe('STAFF');
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

    expect(result.brandMembership.role).toBe('OWNER');
  });

  it('checkBranchAccess should throw when branch missing', async () => {
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

  it('checkProductAccess should throw when no membership', async () => {
    chains.products.single.mockResolvedValueOnce({
      data: { id: 'p1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });

    await expect(
      (service as any).checkProductAccess('p1', 'u1', [], []),
    ).rejects.toThrow(ForbiddenException);
  });

  it('checkBranchAccess should throw when no membership', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });

    await expect(
      (service as any).checkBranchAccess('b1', 'u1', [], []),
    ).rejects.toThrow(ForbiddenException);
  });

  it('checkModificationPermission should reject non-admin roles', () => {
    const warnSpy = jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation(() => undefined);

    expect(() =>
      (service as any).checkModificationPermission('STAFF', 'delete', 'u1'),
    ).toThrow(ForbiddenException);

    expect(warnSpy).toHaveBeenCalled();
  });

  it('getMyProducts should return list when no error', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });
    chains.products.order
      .mockReturnValueOnce(chains.products)
      .mockResolvedValueOnce({ data: [{ id: 'p1' }], error: null });

    const result = await service.getMyProducts('u1', 'b1', [], [
      { branch_id: 'b1', role: 'OWNER' },
    ]);

    expect(result[0].id).toBe('p1');
  });

  it('getMyProduct should include options when available', async () => {
    chains.products.single.mockResolvedValueOnce({
      data: { id: 'p1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });
    chains.product_options.order.mockResolvedValueOnce({
      data: [{ id: 'o1', product_id: 'p1', name: 'Opt' }],
      error: null,
    });

    const result = await service.getMyProduct('u1', 'p1', [], [
      { branch_id: 'b1', role: 'OWNER' },
    ]);
    expect(result.options).toHaveLength(1);
  });

  it('getMyCategories should return mapped categories', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });
    chains.product_categories.order
      .mockReturnValueOnce(chains.product_categories)
      .mockResolvedValueOnce({
        data: [{ id: 'c1', branch_id: 'b1', name: 'C', sort_order: 1, is_active: true, created_at: 't' }],
        error: null,
      });

    const result = await service.getMyCategories('u1', 'b1', [], [{ branch_id: 'b1', role: 'OWNER' }]);
    expect(result[0].id).toBe('c1');
  });

  it('getMyCategories should throw on error', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });
    chains.product_categories.order
      .mockReturnValueOnce(chains.product_categories)
      .mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(
      service.getMyCategories('u1', 'b1', [], [{ branch_id: 'b1', role: 'OWNER' }]),
    ).rejects.toThrow('Failed to fetch categories');
  });

  it('getMyProducts should fallback when sort_order missing', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });
    chains.products.order
      .mockReturnValueOnce(chains.products)
      .mockResolvedValueOnce({ data: null, error: { message: 'sort_order' } })
      .mockResolvedValueOnce({ data: [{ id: 'p1' }], error: null });

    const result = await service.getMyProducts('u1', 'b1', [], [{ branch_id: 'b1', role: 'OWNER' }]);
    expect(result).toHaveLength(1);
  });

  it('getMyProducts should throw on error', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });
    chains.products.order
      .mockReturnValueOnce(chains.products)
      .mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(
      service.getMyProducts('u1', 'b1', [], [{ branch_id: 'b1', role: 'OWNER' }]),
    ).rejects.toThrow('Failed to fetch products');
  });

  it('getMyProduct should include options even on options error', async () => {
    chains.products.single.mockResolvedValueOnce({
      data: { id: 'p1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });
    chains.product_options.order.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    const result = await service.getMyProduct('u1', 'p1', [], [{ branch_id: 'b1', role: 'OWNER' }]);
    expect(result.options).toEqual([]);
  });

  it('createMyProduct should throw when role missing', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });

    await expect(
      service.createMyProduct(
        'u1',
        { branchId: 'b1', name: 'P', categoryId: 'c1', price: 10 } as any,
        [],
        [{ branch_id: 'b1', role: undefined }],
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('createMyProduct should insert options and ignore option errors', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });
    chains.products.single.mockResolvedValueOnce({
      data: { id: 'p1' },
      error: null,
    });
    chains.product_options.insert.mockResolvedValueOnce({ error: { message: 'fail' } });

    const result = await service.createMyProduct(
      'u1',
      {
        branchId: 'b1',
        name: 'P',
        categoryId: 'c1',
        price: 10,
        options: [{ name: 'O1' }],
      } as any,
      [],
      [{ branch_id: 'b1', role: 'OWNER' }],
    );

    expect(result.id).toBe('p1');
  });

  it('createMyProduct should throw on product insert error', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });
    chains.products.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(
      service.createMyProduct(
        'u1',
        { branchId: 'b1', name: 'P', categoryId: 'c1', price: 10 } as any,
        [],
        [{ branch_id: 'b1', role: 'OWNER' }],
      ),
    ).rejects.toThrow('Failed to create product');
  });

  it('updateMyProduct should return current when no fields', async () => {
    chains.products.single.mockResolvedValueOnce({
      data: { id: 'p1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });

    const spy = jest.spyOn(service, 'getMyProduct').mockResolvedValueOnce({ id: 'p1' } as any);

    const result = await service.updateMyProduct('u1', 'p1', {}, [], [{ branch_id: 'b1', role: 'OWNER' }]);
    expect(result.id).toBe('p1');
    expect(spy).toHaveBeenCalled();
  });

  it('updateMyProduct should update and return data', async () => {
    chains.products.single
      .mockResolvedValueOnce({
        data: { id: 'p1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'p1', name: 'Updated' },
        error: null,
      });

    const result = await service.updateMyProduct(
      'u1',
      'p1',
      { name: 'Updated' } as any,
      [],
      [{ branch_id: 'b1', role: 'OWNER' }],
    );
    expect(result.name).toBe('Updated');
  });

  it('updateMyProduct should throw on update error', async () => {
    chains.products.single
      .mockResolvedValueOnce({
        data: { id: 'p1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'fail' },
      });

    await expect(
      service.updateMyProduct(
        'u1',
        'p1',
        { name: 'Updated' } as any,
        [],
        [{ branch_id: 'b1', role: 'OWNER' }],
      ),
    ).rejects.toThrow('Failed to update product');
  });

  it('deleteMyProduct should succeed', async () => {
    chains.products.single.mockResolvedValueOnce({
      data: { id: 'p1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });
    chains.products.eq
      .mockReturnValueOnce(chains.products) // checkProductAccess
      .mockResolvedValueOnce({ error: null }); // delete

    const result = await service.deleteMyProduct('u1', 'p1', [], [
      { branch_id: 'b1', role: 'OWNER' },
    ]);
    expect(result.deleted).toBe(true);
  });

  it('deleteMyProduct should throw on delete error', async () => {
    chains.products.single.mockResolvedValueOnce({
      data: { id: 'p1', branch_id: 'b1', branches: { brand_id: 'brand-1' } },
      error: null,
    });
    chains.products.eq
      .mockReturnValueOnce(chains.products) // checkProductAccess
      .mockResolvedValueOnce({ error: { message: 'fail' } }); // delete

    await expect(
      service.deleteMyProduct('u1', 'p1', [], [{ branch_id: 'b1', role: 'OWNER' }]),
    ).rejects.toThrow('Failed to delete product');
  });

  it('reorderProducts should return list even when update errors occur', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });
    chains.products.eq
      .mockReturnValueOnce(chains.products)
      .mockResolvedValueOnce({ error: { message: 'fail' } });

    const spy = jest
      .spyOn(service, 'getMyProducts')
      .mockResolvedValueOnce([{ id: 'p1' }] as any);

    const result = await service.reorderProducts(
      'u1',
      'b1',
      [{ id: 'p1', sortOrder: 1 }],
      [],
      [{ branch_id: 'b1', role: 'OWNER' }],
    );

    expect(result).toHaveLength(1);
    expect(spy).toHaveBeenCalled();
  });

  it('createCategory should throw on insert error', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });
    chains.product_categories.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(
      service.createCategory(
        'u1',
        'b1',
        'Cat',
        1,
        true,
        [],
        [{ branch_id: 'b1', role: 'OWNER' }],
      ),
    ).rejects.toThrow('Failed to create category');
  });

  it('updateCategory should return current when no fields', async () => {
    chains.product_categories.single.mockResolvedValueOnce({
      data: {
        id: 'c1',
        branch_id: 'b1',
        name: 'Cat',
        sort_order: 2,
        is_active: false,
        created_at: 't',
      },
      error: null,
    });
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });

    const result = await service.updateCategory(
      'u1',
      'c1',
      {},
      [],
      [{ branch_id: 'b1', role: 'OWNER' }],
    );
    expect(result.id).toBe('c1');
  });

  it('updateCategory should throw on update error', async () => {
    chains.product_categories.single
      .mockResolvedValueOnce({
        data: { id: 'c1', branch_id: 'b1', name: 'Cat' },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: 'fail' } });
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });

    await expect(
      service.updateCategory(
        'u1',
        'c1',
        { name: 'New' },
        [],
        [{ branch_id: 'b1', role: 'OWNER' }],
      ),
    ).rejects.toThrow('Failed to update category');
  });

  it('deleteCategory should throw on delete error', async () => {
    chains.product_categories.single.mockResolvedValueOnce({
      data: { id: 'c1', branch_id: 'b1' },
      error: null,
    });
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });
    chains.product_categories.eq
      .mockReturnValueOnce(chains.product_categories)
      .mockResolvedValueOnce({ error: { message: 'fail' } });

    await expect(
      service.deleteCategory(
        'u1',
        'c1',
        [],
        [{ branch_id: 'b1', role: 'OWNER' }],
      ),
    ).rejects.toThrow('Failed to delete category');
  });

  it('reorderCategories should return list', async () => {
    chains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', brand_id: 'brand-1' },
      error: null,
    });
    chains.product_categories.eq
      .mockReturnValueOnce(chains.product_categories)
      .mockResolvedValueOnce({ error: { message: 'fail' } });

    const spy = jest
      .spyOn(service, 'getMyCategories')
      .mockResolvedValueOnce([{ id: 'c1' }] as any);

    const result = await service.reorderCategories(
      'u1',
      'b1',
      [{ id: 'c1', sortOrder: 1 }],
      [],
      [{ branch_id: 'b1', role: 'OWNER' }],
    );
    expect(result).toHaveLength(1);
    expect(spy).toHaveBeenCalled();
  });
});
