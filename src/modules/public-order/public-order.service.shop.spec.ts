import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PublicOrderService } from './public-order.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { InventoryService } from '../inventory/inventory.service';
import { StampsService } from '../stamps/stamps.service';

describe('PublicOrderService - Shop Flow', () => {
  let service: PublicOrderService;
  let adminChains: Record<string, any>;
  let stampsService: { earnStamps: jest.Mock };

  const makeChain = () => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn(),
    in: jest.fn().mockReturnThis(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
  });

  beforeEach(async () => {
    adminChains = {
      brands: makeChain(),
      branches: makeChain(),
      order_channels: makeChain(),
      brand_products: makeChain(),
      products: makeChain(),
      product_categories: makeChain(),
    };

    const adminClient = {
      from: jest.fn((table: string) => adminChains[table]),
      rpc: jest.fn(),
    };
    const anonClient = {
      from: jest.fn((table: string) => adminChains[table]),
    };
    stampsService = {
      earnStamps: jest.fn().mockResolvedValue(undefined),
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
        { provide: StampsService, useValue: stampsService },
      ],
    }).compile();

    service = module.get<PublicOrderService>(PublicOrderService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('getShopBrandBySlug should return brand products mapped to delivery branch products', async () => {
    adminChains.brands.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'brand-1',
          name: 'Test Brand',
          slug: 'test-brand',
          logo_url: 'logo',
          cover_image_url: 'cover',
        },
      ],
      error: null,
    });
    adminChains.branches.limit.mockResolvedValueOnce({
      data: [{ id: 'branch-1', created_at: '2026-01-01T00:00:00.000Z' }],
      error: null,
    });
    adminChains.branches.maybeSingle.mockResolvedValueOnce({
      data: { id: 'branch-1', allowed_payment_methods: ['CARD', 'CASH'] },
      error: null,
    });
    adminChains.brand_products.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'tpl-1',
          name: 'Americano',
          description: 'Hot',
          base_price: 5000,
          image_url: 'img-1',
          sort_order: 1,
          created_at: '2026-01-01',
        },
        {
          id: 'tpl-2',
          name: 'Latte',
          description: 'Milk',
          base_price: 6000,
          image_url: 'img-2',
          sort_order: 2,
          created_at: '2026-01-01',
        },
      ],
      error: null,
    });
    adminChains.products.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'prod-1',
          brand_product_id: 'tpl-1',
          base_price: 5500,
          image_url: 'prod-img-1',
          category_id: 'cat-1',
          is_hidden: false,
          is_sold_out: false,
        },
        {
          id: 'prod-2',
          brand_product_id: 'tpl-2',
          base_price: 6000,
          is_hidden: true,
          is_sold_out: false,
        },
      ],
      error: null,
    });
    adminChains.product_categories.limit.mockResolvedValueOnce({
      data: [{ id: 'cat-1', name: 'Coffee' }],
      error: null,
    });

    const result = await service.getShopBrandBySlug('test-brand');

    expect(result.brandId).toBe('brand-1');
    expect(result.brandSlug).toBe('test-brand');
    expect(result.fulfillmentType).toBe('DELIVERY');
    expect(result.paymentMethods).toEqual(expect.arrayContaining(['CARD']));
    expect(result.products).toHaveLength(1);
    expect(result.products[0]).toEqual(
      expect.objectContaining({
        id: 'tpl-1',
        name: 'Americano',
        price: 5500,
        categoryName: 'Coffee',
      }),
    );
  });

  it('createShopOrderByBrandSlug should map template product ids to branch product ids', async () => {
    adminChains.brands.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'brand-1',
          name: 'Test Brand',
          slug: 'test-brand',
          logo_url: null,
          cover_image_url: null,
        },
      ],
      error: null,
    });
    adminChains.branches.limit.mockResolvedValueOnce({
      data: [{ id: 'branch-1', created_at: '2026-01-01T00:00:00.000Z' }],
      error: null,
    });
    adminChains.branches.maybeSingle.mockResolvedValueOnce({
      data: { id: 'branch-1', allowed_payment_methods: ['CARD'] },
      error: null,
    });
    adminChains.brand_products.limit.mockResolvedValueOnce({
      data: [{ id: 'tpl-1' }],
      error: null,
    });
    adminChains.products.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'prod-1',
          brand_product_id: 'tpl-1',
          is_hidden: false,
          is_sold_out: false,
        },
      ],
      error: null,
    });

    const createOrderSpy = jest
      .spyOn(service, 'createOrder')
      .mockResolvedValue({
        id: 'order-1',
        orderNo: 'order-1',
        status: 'CREATED',
        totalAmount: 5500,
        createdAt: '2026-01-01T00:00:00.000Z',
        items: [],
      });

    await service.createShopOrderByBrandSlug('test-brand', {
      customerName: 'Lee',
      customerPhone: '010-1234-5678',
      customerAddress1: 'Seoul',
      paymentMethod: 'CARD' as any,
      items: [{ productId: 'tpl-1', qty: 1 }],
    });

    expect(createOrderSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: 'branch-1',
        fulfillmentType: 'DELIVERY',
        items: [{ productId: 'prod-1', qty: 1 }],
      }),
    );
  });

  it('createShopOrderByBrandSlug should allow delivery override when branch delivery is disabled', async () => {
    adminChains.brands.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'brand-1',
          name: 'Test Brand',
          slug: 'test-brand',
          logo_url: null,
          cover_image_url: null,
        },
      ],
      error: null,
    });
    adminChains.branches.limit.mockResolvedValueOnce({
      data: [{ id: 'branch-1', created_at: '2026-01-01T00:00:00.000Z' }],
      error: null,
    });
    adminChains.order_channels.eq
      .mockReturnValueOnce(adminChains.order_channels)
      .mockResolvedValueOnce({
        data: [{ id: 'ch-pickup', type: 'PICKUP', is_active: true }],
        error: null,
      });
    adminChains.branches.maybeSingle.mockResolvedValueOnce({
      data: { id: 'branch-1', allowed_payment_methods: ['CARD'] },
      error: null,
    });
    adminChains.brand_products.limit.mockResolvedValueOnce({
      data: [{ id: 'tpl-1' }],
      error: null,
    });
    adminChains.products.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'prod-1',
          brand_product_id: 'tpl-1',
          is_hidden: false,
          is_sold_out: false,
        },
      ],
      error: null,
    });

    const createOrderSpy = jest
      .spyOn(service, 'createOrder')
      .mockResolvedValue({
        id: 'order-1',
        orderNo: 'order-1',
        status: 'CREATED',
        totalAmount: 5500,
        createdAt: '2026-01-01T00:00:00.000Z',
        items: [],
      });

    await service.createShopOrderByBrandSlug('test-brand', {
      customerName: 'Lee',
      customerPhone: '010-1234-5678',
      customerAddress1: 'Seoul',
      paymentMethod: 'CARD' as any,
      items: [{ productId: 'tpl-1', qty: 1 }],
    });

    expect(createOrderSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: 'branch-1',
        fulfillmentType: 'DELIVERY',
        __allowDeliveryOverride: true,
      }),
    );
  });

  it('createShopOrderByBrandSlug should require address for delivery', async () => {
    adminChains.brands.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'brand-1',
          name: 'Test Brand',
          slug: 'test-brand',
          logo_url: null,
          cover_image_url: null,
        },
      ],
      error: null,
    });
    adminChains.branches.limit.mockResolvedValueOnce({
      data: [{ id: 'branch-1', created_at: '2026-01-01T00:00:00.000Z' }],
      error: null,
    });
    adminChains.branches.maybeSingle.mockResolvedValueOnce({
      data: { id: 'branch-1', allowed_payment_methods: ['CARD'] },
      error: null,
    });

    await expect(
      service.createShopOrderByBrandSlug('test-brand', {
        customerName: 'Lee',
        customerPhone: '010-1234-5678',
        customerAddress1: '',
        items: [{ productId: 'tpl-1', qty: 1 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('getShopBrandBySlug should auto-create online shop branch when brand has no branch', async () => {
    adminChains.brands.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'brand-1',
          name: 'No Branch Brand',
          slug: 'no-branch-brand',
          logo_url: null,
          cover_image_url: null,
        },
      ],
      error: null,
    });
    adminChains.branches.limit
      .mockResolvedValueOnce({
        data: [],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ id: 'branch-auto', created_at: '2026-01-01T00:00:00.000Z' }],
        error: null,
      });
    adminChains.branches.single.mockResolvedValueOnce({
      data: { id: 'branch-auto', created_at: '2026-01-01T00:00:00.000Z' },
      error: null,
    });
    adminChains.order_channels.eq
      .mockReturnValueOnce(adminChains.order_channels)
      .mockResolvedValueOnce({
        data: [{ id: 'ch-delivery', type: 'DELIVERY', is_active: true }],
        error: null,
      });
    adminChains.branches.maybeSingle.mockResolvedValueOnce({
      data: { id: 'branch-auto', allowed_payment_methods: ['CARD'] },
      error: null,
    });
    adminChains.brand_products.limit.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const ensureReadySpy = jest
      .spyOn<any, any>(service as any, 'ensureOnlineShopBranchReady')
      .mockResolvedValue(undefined);

    const result = await service.getShopBrandBySlug('no-branch-brand');

    expect(adminChains.branches.insert).toHaveBeenCalled();
    expect(ensureReadySpy).toHaveBeenCalledWith(
      expect.anything(),
      'brand-1',
      'branch-auto',
    );
    expect(result.brandId).toBe('brand-1');
    expect(result.products).toEqual([]);
  });
});
