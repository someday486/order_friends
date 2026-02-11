import { ConflictException, NotFoundException } from '@nestjs/common';
import { PublicOrderService } from './public-order.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { InventoryService } from '../inventory/inventory.service';

describe('PublicOrderService - Public Queries', () => {
  let service: PublicOrderService;
  let anonChains: Record<string, any>;
  let adminChains: Record<string, any>;

  const makeChain = () => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
    limit: jest.fn().mockReturnThis(),
  });

  beforeEach(() => {
    anonChains = {
      branches: makeChain(),
      products: makeChain(),
      product_categories: makeChain(),
      orders: makeChain(),
    };
    adminChains = {
      product_categories: makeChain(),
    };

    const anonClient = { from: jest.fn((table: string) => anonChains[table]) };
    const adminClient = {
      from: jest.fn((table: string) => adminChains[table]),
    };

    const supabase = {
      anonClient: jest.fn(() => anonClient),
      adminClient: jest.fn(() => adminClient),
    };

    service = new PublicOrderService(
      supabase as SupabaseService,
      {} as InventoryService,
    );
  });

  it('getBranch should return branch info', async () => {
    anonChains.branches.single.mockResolvedValueOnce({
      data: {
        id: 'b1',
        name: 'Branch',
        logo_url: null,
        cover_image_url: null,
        brands: { name: 'Brand' },
      },
      error: null,
    });

    const result = await service.getBranch('b1');
    expect(result.id).toBe('b1');
    expect(result.brandName).toBe('Brand');
  });

  it('getBranch should throw when missing', async () => {
    anonChains.branches.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });
    await expect(service.getBranch('b1')).rejects.toThrow(NotFoundException);
  });

  it('getBranchBySlug should handle not found and duplicates', async () => {
    anonChains.branches.limit.mockResolvedValueOnce({ data: [], error: null });
    await expect(service.getBranchBySlug('slug')).rejects.toThrow(
      NotFoundException,
    );

    anonChains.branches.limit.mockResolvedValueOnce({
      data: [{ id: 'b1' }, { id: 'b2' }],
      error: null,
    });
    await expect(service.getBranchBySlug('slug')).rejects.toThrow(
      ConflictException,
    );
  });

  it('getBranchBySlug should prefer branch images when present', async () => {
    anonChains.branches.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'b1',
          name: 'Branch',
          slug: 'slug',
          logo_url: 'logo.png',
          cover_image_url: 'cover.png',
          brands: {
            name: undefined,
            logo_url: 'brand-logo',
            cover_image_url: 'brand-cover',
          },
        },
      ],
      error: null,
    });

    const result = await service.getBranchBySlug('slug');

    expect(result.logoUrl).toBe('logo.png');
    expect(result.coverImageUrl).toBe('cover.png');
    expect(result.brandName).toBeUndefined();
  });

  it('getBranchBySlug should throw on error', async () => {
    anonChains.branches.limit.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });
    await expect(service.getBranchBySlug('slug')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('getBranchByBrandSlug should return branch', async () => {
    anonChains.branches.limit.mockResolvedValueOnce({
      data: [{ id: 'b1', name: 'Branch', brands: { name: 'Brand' } }],
      error: null,
    });

    const result = await service.getBranchByBrandSlug('brand', 'branch');
    expect(result.id).toBe('b1');
  });

  it('getBranchByBrandSlug should throw on error', async () => {
    anonChains.branches.limit.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });
    await expect(
      service.getBranchByBrandSlug('brand', 'branch'),
    ).rejects.toThrow(NotFoundException);
  });

  it('getPriceFromRow should handle fallbacks', () => {
    expect((service as any).getPriceFromRow(null)).toBe(0);
    expect((service as any).getPriceFromRow({ base_price: 9 })).toBe(9);
    expect((service as any).getPriceFromRow({ price: 7 })).toBe(7);
    expect((service as any).getPriceFromRow({ price_amount: 3 })).toBe(3);
  });

  it('getProducts should map categories', async () => {
    anonChains.products.order
      .mockReturnValueOnce(anonChains.products)
      .mockResolvedValueOnce({
        data: [{ id: 'p1', name: 'P', category_id: 'c1', base_price: 10 }],
        error: null,
      });
    anonChains.product_categories.in.mockResolvedValueOnce({
      data: [{ id: 'c1', name: 'Cat' }],
      error: null,
    });

    const result = await service.getProducts('b1');
    expect(result[0].categoryName).toBe('Cat');
  });

  it('getProducts should retry when sort_order is missing', async () => {
    let orderCalls = 0;
    anonChains.products.order.mockImplementation(() => {
      orderCalls += 1;
      if (orderCalls === 1) return anonChains.products;
      if (orderCalls === 2) {
        return Promise.resolve({
          data: null,
          error: { message: 'column "sort_order" does not exist' },
        });
      }
      return Promise.resolve({
        data: [{ id: 'p1', name: 'P', price: 5 }],
        error: null,
      });
    });

    const result = await service.getProducts('b1');
    expect(result[0].price).toBe(5);
  });

  it('getProducts should retry when flags are missing', async () => {
    const responses = [
      { data: null, error: { message: 'column "is_hidden" does not exist' } },
      {
        data: null,
        error: { message: 'column "is_sold_out" does not exist' },
      },
      { data: [{ id: 'p1', name: 'P', price_amount: 8 }], error: null },
    ];

    anonChains.products.order.mockImplementation((field: string) => {
      if (field === 'sort_order') return anonChains.products;
      const next = responses.shift();
      return Promise.resolve(next);
    });

    const result = await service.getProducts('b1');
    expect(result[0].price).toBe(8);
  });

  it('getProducts should throw on error', async () => {
    anonChains.products.order
      .mockReturnValueOnce(anonChains.products)
      .mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(service.getProducts('b1')).rejects.toThrow(
      '상품 목록 조회 실패',
    );
  });

  it('getOrder should resolve by id or orderNo', async () => {
    anonChains.orders.maybeSingle
      .mockResolvedValueOnce({
        data: {
          id: 'o0',
          order_no: 'O-0',
          status: 'CREATED',
          total_amount: 1,
          created_at: 't',
          order_items: [
            {
              product_name_snapshot: 'P',
              qty: 1,
              unit_price: 1,
              order_item_options: [{ option_name_snapshot: 'Opt' }],
            },
          ],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: 'O-1',
          status: 'CREATED',
          total_amount: 10,
          created_at: 't',
          order_items: [
            {
              product_name_snapshot: 'P',
              qty: 1,
              unit_price: 10,
              order_item_options: [],
            },
          ],
        },
        error: null,
      });

    const byId = await service.getOrder('o0');
    expect(byId.items[0].options[0]).toBe('Opt');

    const result = await service.getOrder('O-1');
    expect(result.id).toBe('o1');
  });

  it('getOrder should throw when missing', async () => {
    anonChains.orders.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(service.getOrder('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('getCategories should return sorted categories', async () => {
    adminChains.product_categories.order
      .mockReturnValueOnce(adminChains.product_categories)
      .mockResolvedValueOnce({
        data: [{ id: 'c1', name: 'Cat', sort_order: 1 }],
        error: null,
      });

    const result = await service.getCategories('b1');
    expect(result[0].id).toBe('c1');
  });

  it('getCategories should throw on error', async () => {
    adminChains.product_categories.order
      .mockReturnValueOnce(adminChains.product_categories)
      .mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    await expect(service.getCategories('b1')).rejects.toThrow();
  });
});
