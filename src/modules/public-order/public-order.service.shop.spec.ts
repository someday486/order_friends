import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PublicOrderService } from './public-order.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { InventoryService } from '../inventory/inventory.service';
import { StampsService } from '../stamps/stamps.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('PublicOrderService - Shop Flow', () => {
  let service: PublicOrderService;
  let adminChains: Record<string, any>;
  let stampsService: { earnStamps: jest.Mock };
  let notificationsService: { sendOrderCompletionKakao: jest.Mock };

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
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  });

  beforeEach(async () => {
    adminChains = {
      brands: makeChain(),
      branches: makeChain(),
      brand_subscriptions: makeChain(),
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
    notificationsService = {
      sendOrderCompletionKakao: jest.fn().mockResolvedValue({
        success: true,
      }),
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
        { provide: NotificationsService, useValue: notificationsService },
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
          cash_receipt_enabled: true,
          logo_url: 'logo',
          cover_image_url: 'cover',
        },
      ],
      error: null,
    });
    adminChains.branches.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'branch-1',
          name: '강남점',
          slug: 'gangnam',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      error: null,
    });
    adminChains.branches.maybeSingle.mockResolvedValueOnce({
      data: { id: 'branch-1', allowed_payment_methods: ['CARD', 'TRANSFER'] },
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
          image_url: 'prod-img-2',
          category_id: 'cat-1',
          is_hidden: false,
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
    expect(result.billingTier).toBe('PG');
    expect(result.cashReceiptEnabled).toBe(true);
    expect(result.fulfillmentType).toBe('SHIPPING');
    expect(result.paymentMethods).toEqual(expect.arrayContaining(['CARD']));
    expect(result.products).toHaveLength(2);
    expect(result.products[0]).toEqual(
      expect.objectContaining({
        id: 'tpl-1',
        name: 'Americano',
        price: 5500,
        categoryName: 'Coffee',
      }),
    );
  });

  it('getShopBrandBySlug should hide non-pg brands without an active subscription', async () => {
    adminChains.brands.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'brand-1',
          name: 'Transfer Brand',
          slug: 'transfer-brand',
          shop_payment_methods: ['TRANSFER'],
          logo_url: null,
          cover_image_url: null,
        },
      ],
      error: null,
    });
    adminChains.brands.maybeSingle.mockResolvedValueOnce({
      data: { billing_tier: 'NON_PG' },
      error: null,
    });
    adminChains.brand_subscriptions.limit.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    await expect(service.getShopBrandBySlug('transfer-brand')).rejects.toThrow(
      '온라인샵 브랜드를 찾을 수 없습니다.',
    );
  });

  it('getShopBrandBySlug should allow non-pg brands with an active subscription', async () => {
    adminChains.brands.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'brand-1',
          name: 'Transfer Brand',
          slug: 'transfer-brand',
          shop_payment_methods: ['TRANSFER'],
          cash_receipt_enabled: false,
          logo_url: null,
          cover_image_url: null,
        },
      ],
      error: null,
    });
    adminChains.brands.maybeSingle.mockResolvedValueOnce({
      data: { billing_tier: 'NON_PG' },
      error: null,
    });
    adminChains.brand_subscriptions.limit.mockResolvedValueOnce({
      data: [{ brand_id: 'brand-1' }],
      error: null,
    });
    adminChains.branches.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'branch-1',
          name: 'Branch',
          slug: 'branch',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      error: null,
    });
    adminChains.branches.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'branch-1',
        allowed_payment_methods: ['TRANSFER'],
        transfer_account: {
          bank_name: 'NH',
          account_number: '123-456',
          account_holder: 'Transfer Brand',
        },
      },
      error: null,
    });
    adminChains.brand_products.limit.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const result = await service.getShopBrandBySlug('transfer-brand');

    expect(result.billingTier).toBe('NON_PG');
    expect(result.paymentMethods).toEqual(['TRANSFER']);
  });

  it('getShopBrandBySlug should fall back to dedicated online shop branch when regular branches miss linked products', async () => {
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
      data: [
        {
          id: 'branch-1',
          name: '강남점',
          slug: 'gangnam',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      error: null,
    });
    adminChains.branches.maybeSingle
      .mockResolvedValueOnce({
        data: { id: 'branch-1', allowed_payment_methods: ['CARD'] },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'branch-shop', allowed_payment_methods: ['CARD'] },
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
      ],
      error: null,
    });
    adminChains.products.limit
      .mockResolvedValueOnce({
        data: [],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'prod-shop-1',
            brand_product_id: 'tpl-1',
            is_hidden: false,
            is_sold_out: false,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'prod-shop-1',
            brand_product_id: 'tpl-1',
            is_hidden: false,
            is_sold_out: false,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'prod-shop-1',
            brand_product_id: 'tpl-1',
            base_price: 5000,
            image_url: 'img-1',
            category_id: null,
            is_hidden: false,
            is_sold_out: false,
          },
        ],
        error: null,
      });

    const ensureCandidateSpy = jest
      .spyOn<any, any>(service as any, 'ensureOnlineShopCandidate')
      .mockResolvedValue({
        branchId: 'branch-shop',
        paymentMethods: ['CARD'],
        supportsDelivery: true,
        hasDeliveryChannel: true,
        createdAt: '2026-01-02T00:00:00.000Z',
      });

    const result = await service.getShopBrandBySlug('test-brand');

    expect(ensureCandidateSpy).toHaveBeenCalled();
    expect(result.products).toEqual([
      expect.objectContaining({
        id: 'tpl-1',
        name: 'Americano',
        price: 5000,
      }),
    ]);
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
      data: [
        {
          id: 'branch-1',
          name: '강남점',
          slug: 'gangnam',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
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
      cashReceipt: {
        requested: true,
        type: 'EXPENSE_PROOF',
        identityType: 'BUSINESS_NUMBER',
        identityValue: '1234567890',
      },
      items: [{ productId: 'tpl-1', qty: 1 }],
    });

    expect(createOrderSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: 'branch-1',
        fulfillmentType: 'SHIPPING',
        cashReceipt: {
          requested: true,
          type: 'EXPENSE_PROOF',
          identityType: 'BUSINESS_NUMBER',
          identityValue: '1234567890',
        },
        items: [{ productId: 'prod-1', qty: 1 }],
      }),
      undefined,
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
      data: [
        {
          id: 'branch-1',
          name: '강남점',
          slug: 'gangnam',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
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
        fulfillmentType: 'SHIPPING',
        __allowDeliveryOverride: true,
      }),
      undefined,
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
      data: [
        {
          id: 'branch-1',
          name: '강남점',
          slug: 'gangnam',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
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
        data: [
          {
            id: 'branch-auto',
            name: 'No Branch Brand 온라인샵',
            slug: null,
            created_at: '2026-01-01T00:00:00.000Z',
          },
        ],
        error: null,
      });
    adminChains.branches.single.mockResolvedValueOnce({
      data: {
        id: 'branch-auto',
        name: 'No Branch Brand 온라인샵',
        slug: null,
        created_at: '2026-01-01T00:00:00.000Z',
      },
      error: null,
    });
    adminChains.order_channels.eq
      .mockReturnValueOnce(adminChains.order_channels)
      .mockResolvedValueOnce({
        data: [{ id: 'ch-shipping', type: 'SHIPPING', is_active: true }],
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

  it('createShopOrderByBrandSlug should fall back to dedicated online shop branch when regular branches miss linked products', async () => {
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
      data: [
        {
          id: 'branch-1',
          name: '강남점',
          slug: 'gangnam',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      error: null,
    });
    adminChains.branches.maybeSingle
      .mockResolvedValueOnce({
        data: { id: 'branch-1', allowed_payment_methods: ['CARD'] },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'branch-shop', allowed_payment_methods: ['CARD'] },
        error: null,
      });
    adminChains.brand_products.limit.mockResolvedValueOnce({
      data: [{ id: 'tpl-1' }],
      error: null,
    });
    adminChains.products.limit
      .mockResolvedValueOnce({
        data: [],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'prod-shop-1',
            brand_product_id: 'tpl-1',
            is_hidden: false,
            is_sold_out: false,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [],
        error: null,
      });

    jest
      .spyOn<any, any>(service as any, 'ensureOnlineShopCandidate')
      .mockResolvedValue({
        branchId: 'branch-shop',
        paymentMethods: ['CARD'],
        supportsDelivery: true,
        hasDeliveryChannel: true,
        createdAt: '2026-01-02T00:00:00.000Z',
      });

    const createOrderSpy = jest
      .spyOn(service, 'createOrder')
      .mockResolvedValue({
        id: 'order-1',
        orderNo: 'order-1',
        status: 'CREATED',
        totalAmount: 5000,
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
        branchId: 'branch-shop',
        fulfillmentType: 'SHIPPING',
        items: [{ productId: 'prod-shop-1', qty: 1 }],
      }),
      undefined,
    );
  });
});
