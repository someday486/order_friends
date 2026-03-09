import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { InventoryService } from '../inventory/inventory.service';
import { PublicOrderService } from './public-order.service';
import { StampsService } from '../stamps/stamps.service';

describe('PublicOrderService - Branch Order Config', () => {
  let service: PublicOrderService;
  let anonChains: Record<string, any>;
  let adminChains: Record<string, any>;
  let stampsService: { earnStamps: jest.Mock };

  const makeChain = () => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({ data: [], error: null }),
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
      order_channels: makeChain(),
      branches: makeChain(),
      orders: makeChain(),
      order_items: makeChain(),
      product_inventory: makeChain(),
    };

    const anonClient = { from: jest.fn((table: string) => anonChains[table]) };
    const adminClient = {
      from: jest.fn((table: string) => adminChains[table]),
      rpc: jest.fn(),
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

  function mockProducts() {
    anonChains.products.in.mockResolvedValueOnce({
      data: [
        {
          id: 'product-1',
          name: 'Americano',
          base_price: 4500,
          branch_id: 'branch-1',
        },
      ],
      error: null,
    });
  }

  function mockBranchOrderConfig(input: {
    channels: Array<{ id: string; type: string; is_active: boolean }>;
    allowedPaymentMethods: string[];
  }) {
    adminChains.order_channels.eq
      .mockImplementationOnce(() => adminChains.order_channels)
      .mockImplementationOnce(() =>
        Promise.resolve({ data: input.channels, error: null }),
      );

    adminChains.branches.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'branch-1',
        allowed_payment_methods: input.allowedPaymentMethods,
      },
      error: null,
    });
  }

  it('should reject unsupported payment method by branch config', async () => {
    mockProducts();
    mockBranchOrderConfig({
      channels: [{ id: 'ch-pickup', type: 'PICKUP', is_active: true }],
      allowedPaymentMethods: ['CARD'],
    });

    await expect(
      service.createOrder({
        branchId: 'branch-1',
        customerName: 'Tester',
        paymentMethod: 'CASH' as any,
        fulfillmentType: 'PICKUP' as any,
        items: [{ productId: 'product-1', qty: 1 }],
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject unsupported fulfillment type by branch config', async () => {
    mockProducts();
    mockBranchOrderConfig({
      channels: [{ id: 'ch-pickup', type: 'PICKUP', is_active: true }],
      allowedPaymentMethods: ['CARD', 'TRANSFER'],
    });

    await expect(
      service.createOrder({
        branchId: 'branch-1',
        customerName: 'Tester',
        paymentMethod: 'CARD' as any,
        fulfillmentType: 'DELIVERY' as any,
        items: [{ productId: 'product-1', qty: 1 }],
      } as any),
    ).rejects.toThrow(BadRequestException);
  });
});
