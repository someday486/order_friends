import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PublicOrderService } from './public-order.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { InventoryService } from '../inventory/inventory.service';

describe('PublicOrderService - Branch Coverage', () => {
  const originalEnv = process.env;
  let service: PublicOrderService;
  let anonChains: Record<string, any>;
  let adminChains: Record<string, any>;
  let adminClient: any;

  const makeChain = () => {
    const chain: any = {
      _results: [] as any[],
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
      then: (resolve: any, reject: any) => {
        const result = chain._results.shift() ?? { data: [], error: null };
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return chain;
  };

  beforeEach(async () => {
    anonChains = {
      branches: makeChain(),
      products: makeChain(),
      product_categories: makeChain(),
      orders: makeChain(),
    };
    adminChains = {
      orders: makeChain(),
      order_dedup_logs: makeChain(),
      product_categories: makeChain(),
    };

    const anonClient = { from: jest.fn((table: string) => anonChains[table]) };
    adminClient = { from: jest.fn((table: string) => adminChains[table]) };

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
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  it('constructor should apply env overrides and defaults', () => {
    process.env = {
      ...originalEnv,
      PUBLIC_ORDER_DUPLICATE_WINDOW_MS: '30000',
      PUBLIC_ORDER_ANON_DUPLICATE_WINDOW_MS: '10000',
      PUBLIC_ORDER_DUPLICATE_LOOKBACK_LIMIT: '50',
    };
    const withOverrides = new PublicOrderService({} as any, {} as any);
    expect((withOverrides as any).duplicateWindowMs).toBe(30000);
    expect((withOverrides as any).weakDuplicateWindowMs).toBe(10000);
    expect((withOverrides as any).duplicateLookbackLimit).toBe(20);

    process.env = {
      ...originalEnv,
      PUBLIC_ORDER_DUPLICATE_WINDOW_MS: '-1',
      PUBLIC_ORDER_ANON_DUPLICATE_WINDOW_MS: '0',
      PUBLIC_ORDER_DUPLICATE_LOOKBACK_LIMIT: 'abc',
    };
    const withDefaults = new PublicOrderService({} as any, {} as any);
    expect((withDefaults as any).duplicateWindowMs).toBe(60000);
    expect((withDefaults as any).weakDuplicateWindowMs).toBe(20000);
    expect((withDefaults as any).duplicateLookbackLimit).toBe(5);
  });

  it('constructor should fallback when env values are NaN', () => {
    process.env = {
      ...originalEnv,
      PUBLIC_ORDER_DUPLICATE_WINDOW_MS: 'abc',
      PUBLIC_ORDER_ANON_DUPLICATE_WINDOW_MS: 'def',
      PUBLIC_ORDER_DUPLICATE_LOOKBACK_LIMIT: '0',
    };

    const withNaN = new PublicOrderService({} as any, {} as any);
    expect((withNaN as any).duplicateWindowMs).toBe(60000);
    expect((withNaN as any).weakDuplicateWindowMs).toBe(20000);
    expect((withNaN as any).duplicateLookbackLimit).toBe(5);
  });

  it('rollbackOrder should swallow rollback failures', async () => {
    const failingAdmin = {
      from: jest.fn(() => {
        throw new Error('boom');
      }),
    };

    await expect(
      (service as any).rollbackOrder(failingAdmin, 'order-1'),
    ).resolves.toBeUndefined();
  });

  it('getBranch should map brand info and fallbacks', async () => {
    anonChains.branches.single.mockResolvedValueOnce({
      data: {
        id: 'b1',
        name: 'Branch',
        logo_url: 'logo',
        cover_image_url: null,
        brands: { name: 'Brand', logo_url: 'brand-logo', cover_image_url: 'brand-cover' },
      },
      error: null,
    });

    const result = await service.getBranch('b1');
    expect(result.brandName).toBe('Brand');
    expect(result.logoUrl).toBe('logo');
    expect(result.coverImageUrl).toBe('brand-cover');
  });

  it('getBranch should fallback to brand assets', async () => {
    anonChains.branches.single.mockResolvedValueOnce({
      data: {
        id: 'b1',
        name: 'Branch',
        logo_url: null,
        cover_image_url: null,
        brands: { name: 'Brand', logo_url: 'brand-logo', cover_image_url: 'brand-cover' },
      },
      error: null,
    });

    const result = await service.getBranch('b1');
    expect(result.logoUrl).toBe('brand-logo');
    expect(result.coverImageUrl).toBe('brand-cover');
  });

  it('getBranch should handle missing brand and logos', async () => {
    anonChains.branches.single.mockResolvedValueOnce({
      data: { id: 'b1', name: 'Branch', logo_url: null, cover_image_url: null, brands: null },
      error: null,
    });

    const result = await service.getBranch('b1');
    expect(result.brandName).toBeUndefined();
    expect(result.logoUrl).toBeNull();
    expect(result.coverImageUrl).toBeNull();
  });

  it('getBranchBySlug should throw on duplicates', async () => {
    anonChains.branches.limit.mockResolvedValueOnce({
      data: [{ id: 'b1' }, { id: 'b2' }],
      error: null,
    });

    await expect(service.getBranchBySlug('slug')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('getBranchBySlug should throw when not found', async () => {
    anonChains.branches.limit.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    await expect(service.getBranchBySlug('slug')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('getBranchBySlug should return branch with brand fallbacks', async () => {
    anonChains.branches.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'b1',
          name: 'Branch',
          logo_url: null,
          cover_image_url: null,
          brands: { name: 'Brand', logo_url: 'brand-logo', cover_image_url: 'brand-cover' },
        },
      ],
      error: null,
    });

    const result = await service.getBranchBySlug('slug');
    expect(result.brandName).toBe('Brand');
    expect(result.logoUrl).toBe('brand-logo');
    expect(result.coverImageUrl).toBe('brand-cover');
  });

  it('getBranchBySlug should return null assets when both branch and brand are missing', async () => {
    anonChains.branches.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'b1',
          name: 'Branch',
          logo_url: null,
          cover_image_url: null,
          brands: { name: null, logo_url: null, cover_image_url: null },
        },
      ],
      error: null,
    });

    const result = await service.getBranchBySlug('slug');
    expect(result.brandName).toBeUndefined();
    expect(result.logoUrl).toBeNull();
    expect(result.coverImageUrl).toBeNull();
  });

  it('getBranchByBrandSlug should map brand fallback logo', async () => {
    anonChains.branches.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'b1',
          name: 'Branch',
          logo_url: null,
          cover_image_url: null,
          brands: { name: 'Brand', logo_url: 'brand-logo', cover_image_url: null },
        },
      ],
      error: null,
    });

    const result = await service.getBranchByBrandSlug('brand', 'branch');
    expect(result.brandName).toBe('Brand');
    expect(result.logoUrl).toBe('brand-logo');
    expect(result.coverImageUrl).toBeNull();
  });

  it('getBranchByBrandSlug should handle missing brand name', async () => {
    anonChains.branches.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'b1',
          name: 'Branch',
          logo_url: null,
          cover_image_url: null,
          brands: { name: null, logo_url: null, cover_image_url: null },
        },
      ],
      error: null,
    });

    const result = await service.getBranchByBrandSlug('brand', 'branch');
    expect(result.brandName).toBeUndefined();
    expect(result.logoUrl).toBeNull();
    expect(result.coverImageUrl).toBeNull();
  });

  it('getBranchByBrandSlug should throw on duplicates', async () => {
    anonChains.branches.limit.mockResolvedValueOnce({
      data: [{ id: 'b1' }, { id: 'b2' }],
      error: null,
    });

    await expect(
      service.getBranchByBrandSlug('brand', 'branch'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('getBranchByBrandSlug should throw when not found', async () => {
    anonChains.branches.limit.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    await expect(
      service.getBranchByBrandSlug('brand', 'branch'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getProducts should retry on missing columns and map categories', async () => {
    anonChains.products._results = [
      { data: null, error: { message: 'column \"is_hidden\" does not exist' } },
      { data: null, error: { message: 'column \"is_sold_out\" does not exist' } },
      { data: null, error: { message: 'column \"sort_order\" does not exist' } },
      {
        data: [
          { id: 'p1', name: 'Product', base_price: 1000, category_id: 'c1' },
        ],
        error: null,
      },
    ];

    anonChains.product_categories._results = [
      { data: [{ id: 'c1', name: 'Category' }], error: null },
    ];

    const result = await service.getProducts('b1');
    expect(result).toHaveLength(1);
    expect(result[0].categoryName).toBe('Category');
  });

  it('getProducts should handle missing category lookup data', async () => {
    anonChains.products._results = [
      {
        data: [
          {
            id: 'p1',
            name: 'Product',
            price: 1000,
            image_url: 'img',
            category_id: 'c1',
            sort_order: null,
          },
        ],
        error: null,
      },
    ];

    anonChains.product_categories._results = [
      { data: null, error: null },
    ];

    const result = await service.getProducts('b1');
    expect(result[0].imageUrl).toBe('img');
    expect(result[0].categoryName).toBeNull();
    expect(result[0].sortOrder).toBe(0);
  });

  it('getProducts should throw when error is not retried', async () => {
    anonChains.products._results = [
      { data: null, error: { message: 'other failure' } },
    ];

    await expect(service.getProducts('b1')).rejects.toThrow(
      '상품 목록 조회 실패',
    );
  });

  it('getProducts should throw when error message is missing', async () => {
    anonChains.products._results = [{ data: null, error: {} }];

    await expect(service.getProducts('b1')).rejects.toThrow(
      '상품 목록 조회 실패',
    );
  });

  it('getProducts should return empty when no data', async () => {
    anonChains.products._results = [{ data: null, error: null }];
    const result = await service.getProducts('b1');
    expect(result).toEqual([]);
  });

  it('fetchOrderByIdempotencyKey should return null without key or on error', async () => {
    const noKey = await (service as any).fetchOrderByIdempotencyKey(
      adminClient,
      'b1',
      undefined,
    );
    expect(noKey).toBeNull();

    adminChains.orders.limit.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });
    const onError = await (service as any).fetchOrderByIdempotencyKey(
      adminClient,
      'b1',
      'idem-1',
    );
    expect(onError).toBeNull();
  });

  it('fetchOrderByIdempotencyKey should return null on empty result', async () => {
    adminChains.orders.limit.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const result = await (service as any).fetchOrderByIdempotencyKey(
      adminClient,
      'b1',
      'idem-1',
    );
    expect(result).toBeNull();
  });

  it('fetchOrderByIdempotencyKey should return latest order', async () => {
    adminChains.orders.limit.mockResolvedValueOnce({
      data: [{ id: 'o1' }],
      error: null,
    });
    const result = await (service as any).fetchOrderByIdempotencyKey(
      adminClient,
      'b1',
      'idem-1',
    );
    expect(result.id).toBe('o1');
  });

  it('logDedupEvent should insert payload with defaults and handle errors', async () => {
    adminChains.order_dedup_logs.insert.mockResolvedValueOnce({ error: null });
    await (service as any).logDedupEvent(adminClient, {
      branchId: 'b1',
      orderId: 'o1',
      matchedOrderId: 'o2',
      idempotencyKey: 'idem',
      signature: 'sig',
      totalAmount: 1000,
      customerName: 'Name',
      customerPhone: '010',
      customerAddress1: 'addr',
      paymentMethod: 'CARD',
      strategy: 'IDEMPOTENCY_KEY',
      reason: 'MATCHED',
      metadata: { source: 'test' },
    });

    adminChains.order_dedup_logs.insert.mockRejectedValueOnce(new Error('fail'));
    await (service as any).logDedupEvent(adminClient, {
      branchId: 'b1',
      strategy: 'ANON',
      reason: 'SKIP',
    });
  });

  it('buildSignatureFromOrder should handle missing order_items', () => {
    const signature = (service as any).buildSignatureFromOrder({ id: 'o1' });
    const expected = (service as any).buildOrderSignature([]);
    expect(signature).toBe(expected);
  });

  it('buildOrderResponse should handle missing order_items', () => {
    const response = (service as any).buildOrderResponse({
      id: 'o1',
      order_no: 'O-1',
      status: 'CREATED',
      total_amount: 1000,
      created_at: 't',
      order_items: undefined,
    });

    expect(response.items).toEqual([]);
  });

  it('findRecentDuplicateOrder should use name+phone strategy and return matching order', async () => {
    const dto = {
      branchId: 'b1',
      customerName: 'Name',
      customerPhone: '010',
      items: [{ productId: 'p1', qty: 1 }],
    } as any;
    const signature = (service as any).buildOrderSignature(dto.items);

    adminChains.orders.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'o1',
          order_no: 'O-1',
          status: 'CREATED',
          total_amount: 1000,
          created_at: 't',
          order_items: [
            { product_id: 'p2', product_name_snapshot: 'P2', qty: 1, unit_price: 1000 },
          ],
        },
        {
          id: 'o2',
          order_no: 'O-2',
          status: 'CREATED',
          total_amount: 1000,
          created_at: 't',
          order_items: [
            { product_id: 'p1', product_name_snapshot: 'P1', qty: 1, unit_price: 1000 },
          ],
        },
      ],
      error: null,
    });

    const result = await (service as any).findRecentDuplicateOrder(
      adminClient,
      dto,
      1000,
      signature,
    );

    expect(result.strategy).toBe('NAME_PHONE');
    expect(result.order.id).toBe('o2');
    expect(result.metadata.windowMs).toBe((service as any).duplicateWindowMs);
  });

  it('findRecentDuplicateOrder should handle different strategies with no matches', async () => {
    adminChains.orders.limit
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    await (service as any).findRecentDuplicateOrder(
      adminClient,
      {
        branchId: 'b1',
        customerPhone: '010',
        items: [{ productId: 'p1', qty: 1 }],
      },
      1000,
      'sig',
    );

    await (service as any).findRecentDuplicateOrder(
      adminClient,
      {
        branchId: 'b1',
        customerName: 'Name',
        customerAddress1: 'Addr',
        items: [{ productId: 'p1', qty: 1 }],
      },
      1000,
      'sig',
    );

    const result = await (service as any).findRecentDuplicateOrder(
      adminClient,
      {
        branchId: 'b1',
        paymentMethod: undefined,
        items: [{ productId: 'p1', qty: 1 }],
      },
      1000,
      'sig',
    );
    expect(result).toBeNull();
  });

  it('findRecentDuplicateOrder should use payment method filter when no customer info', async () => {
    const dto = {
      branchId: 'b1',
      items: [{ productId: 'p1', qty: 1 }],
    } as any;
    const signature = (service as any).buildOrderSignature(dto.items);

    adminChains.orders.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'o1',
          order_no: 'O-1',
          status: 'CREATED',
          total_amount: 1000,
          created_at: 't',
          order_items: [
            { product_id: 'p1', product_name_snapshot: 'P1', qty: 1, unit_price: 1000 },
          ],
        },
      ],
      error: null,
    });

    const result = await (service as any).findRecentDuplicateOrder(
      adminClient,
      dto,
      1000,
      signature,
    );

    expect(adminChains.orders.eq).toHaveBeenCalledWith('payment_method', 'CARD');
    expect(result?.strategy).toBe('ANON');
    expect(result?.metadata.paymentMethod).toBe('CARD');
  });

  it('findRecentDuplicateOrder should default payment method when policy omits it', async () => {
    const dto = {
      branchId: 'b1',
      items: [{ productId: 'p1', qty: 1 }],
    } as any;
    const signature = (service as any).buildOrderSignature(dto.items);

    const policySpy = jest.spyOn(service as any, 'getDuplicatePolicy').mockReturnValue({
      strategy: 'ANON',
      windowMs: 1000,
      lookbackLimit: 1,
      filters: {},
      paymentMethod: undefined,
      customerName: undefined,
      customerPhone: undefined,
      customerAddress1: undefined,
      dedupKey: 'anon',
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
            { product_id: 'p1', product_name_snapshot: 'P1', qty: 1, unit_price: 1000 },
          ],
        },
      ],
      error: null,
    });

    let result: any;
    try {
      result = await (service as any).findRecentDuplicateOrder(
        adminClient,
        dto,
        1000,
        signature,
      );
    } finally {
      policySpy.mockRestore();
    }

    expect(adminChains.orders.eq).toHaveBeenCalledWith('payment_method', 'CARD');
    expect(result?.metadata.paymentMethod).toBeNull();
  });

  it('findRecentDuplicateOrder should use name+address strategy', async () => {
    const dto = {
      branchId: 'b1',
      customerName: 'Name',
      customerAddress1: 'Addr',
      items: [{ productId: 'p1', qty: 1 }],
    } as any;
    const signature = (service as any).buildOrderSignature(dto.items);

    adminChains.orders.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'o1',
          order_no: 'O-1',
          status: 'CREATED',
          total_amount: 1000,
          created_at: 't',
          order_items: [
            { product_id: 'p1', product_name_snapshot: 'P1', qty: 1, unit_price: 1000 },
          ],
        },
      ],
      error: null,
    });

    const result = await (service as any).findRecentDuplicateOrder(
      adminClient,
      dto,
      1000,
      signature,
    );

    expect(result?.strategy).toBe('NAME_ADDRESS');
    expect(result?.order.id).toBe('o1');
    expect(result?.metadata.dedupKey).toContain('name_address');
  });

  it('findRecentDuplicateOrder should use phone+address strategy', async () => {
    const dto = {
      branchId: 'b1',
      customerPhone: '010',
      customerAddress1: 'Addr',
      items: [{ productId: 'p1', qty: 1 }],
    } as any;
    const signature = (service as any).buildOrderSignature(dto.items);

    adminChains.orders.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'o1',
          order_no: 'O-1',
          status: 'CREATED',
          total_amount: 1000,
          created_at: 't',
          order_items: [
            { product_id: 'p1', product_name_snapshot: 'P1', qty: 1, unit_price: 1000 },
          ],
        },
      ],
      error: null,
    });

    const result = await (service as any).findRecentDuplicateOrder(
      adminClient,
      dto,
      1000,
      signature,
    );

    expect(result?.strategy).toBe('PHONE_ADDRESS');
    expect(result?.metadata.dedupKey).toContain('phone_address');
  });

  it('findRecentDuplicateOrder should use address-only strategy when customer info missing', async () => {
    const dto = {
      branchId: 'b1',
      customerAddress1: 'Addr',
      items: [{ productId: 'p1', qty: 1 }],
    } as any;
    const signature = (service as any).buildOrderSignature(dto.items);

    adminChains.orders.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'o1',
          order_no: 'O-1',
          status: 'CREATED',
          total_amount: 1000,
          created_at: 't',
          order_items: [
            { product_id: 'p1', product_name_snapshot: 'P1', qty: 1, unit_price: 1000 },
          ],
        },
      ],
      error: null,
    });

    const result = await (service as any).findRecentDuplicateOrder(
      adminClient,
      dto,
      1000,
      signature,
    );

    expect(result?.strategy).toBe('ADDRESS_ONLY');
    expect(result?.metadata.lookbackLimit).toBeLessThanOrEqual(3);
  });

  it('getOrder should resolve by order_no and map options', async () => {
    anonChains.orders.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: 'O-1',
          status: 'CREATED',
          total_amount: 1000,
          created_at: 't',
          order_items: [
            {
              product_name_snapshot: 'P1',
              qty: 1,
              unit_price: 1000,
              order_item_options: [{ option_name_snapshot: 'Opt' }],
            },
            {
              product_name_snapshot: 'P2',
              qty: 1,
              unit_price: 500,
              order_item_options: undefined,
            },
          ],
        },
        error: null,
      });

    const result = await service.getOrder('O-1');
    expect(result.orderNo).toBe('O-1');
    expect(result.items[0].options).toEqual(['Opt']);
  });

  it('getOrder should handle missing order items', async () => {
    anonChains.orders.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'o1',
          order_no: 'O-1',
          status: 'CREATED',
          total_amount: 1000,
          created_at: 't',
          order_items: undefined,
        },
        error: null,
      });

    const result = await service.getOrder('O-1');
    expect(result.items).toEqual([]);
  });

  it('getOrder should throw when missing', async () => {
    anonChains.orders.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(service.getOrder('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('getCategories should map sort order defaults', async () => {
    adminChains.product_categories._results = [
      { data: [{ id: 'c1', name: 'Cat', sort_order: null }], error: null },
    ];

    const result = await service.getCategories('b1');
    expect(result[0].sortOrder).toBe(0);
  });

  it('getCategories should return empty when data is null', async () => {
    adminChains.product_categories._results = [
      { data: null, error: null },
    ];

    const result = await service.getCategories('b1');
    expect(result).toEqual([]);
  });

  it('getCategories should throw on error', async () => {
    adminChains.product_categories._results = [
      { data: null, error: { message: 'fail' } },
    ];

    await expect(service.getCategories('b1')).rejects.toThrow(
      '카테고리 목록 조회 실패',
    );
  });
});
