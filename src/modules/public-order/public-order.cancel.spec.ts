import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PublicOrderService } from './public-order.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { InventoryService } from '../inventory/inventory.service';
import { StampsService } from '../stamps/stamps.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';

describe('PublicOrderService cancelPublicOrder', () => {
  let service: PublicOrderService;
  let orderLookupResult: { data: any; error: any };
  let orderUpdateResult: { error: any };
  let publicOrderLookupResult: { data: any; error: any };

  const paymentsService = {
    refundOrderPaymentForCancellation: jest.fn(),
  };

  const makeAdminClient = () => ({
    from: jest.fn((table: string) => {
      if (table === 'orders') {
        const selectChain = {
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockImplementation(() => orderLookupResult),
        };
        const updateChain = {
          eq: jest.fn().mockImplementation(() => orderUpdateResult),
        };
        return {
          select: jest.fn().mockReturnValue(selectChain),
          update: jest.fn().mockReturnValue(updateChain),
        };
      }

      if (table === 'order_items') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
            data: [{ product_id: 'product-1', qty: 2 }],
            error: null,
          }),
        };
      }

      if (table === 'product_inventory') {
        const selectChain = {
          in: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
            data: [
              { product_id: 'product-1', qty_available: 10, qty_reserved: 2 },
            ],
            error: null,
          }),
        };
        const updateChain = {
          eq: jest.fn().mockReturnThis(),
        };
        return {
          select: jest.fn().mockReturnValue(selectChain),
          update: jest.fn().mockReturnValue(updateChain),
        };
      }

      if (table === 'inventory_logs') {
        return {
          insert: jest.fn().mockResolvedValue({ error: null }),
        };
      }

      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  });

  const makeAnonClient = () => ({
    from: jest.fn((table: string) => {
      if (table === 'orders') {
        const selectChain = {
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue(publicOrderLookupResult),
        };
        return {
          select: jest.fn().mockReturnValue(selectChain),
        };
      }

      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  });

  beforeEach(async () => {
    orderLookupResult = { data: null, error: null };
    orderUpdateResult = { error: null };
    publicOrderLookupResult = {
      data: {
        id: 'order-1',
        order_no: 'ORD-1',
        status: 'CANCELLED',
        total_amount: 10000,
        created_at: '2026-04-02T00:00:00.000Z',
        branch_id: 'branch-1',
        payment_method: 'CARD',
        fulfillment_type: 'PICKUP',
        requested_time: null,
        customer_name: 'Tester',
        customer_phone: '010-1111-2222',
        customer_address1: null,
        customer_address2: null,
        customer_memo: null,
        order_items: [],
      },
      error: null,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicOrderService,
        {
          provide: SupabaseService,
          useValue: {
            adminClient: () => makeAdminClient(),
            anonClient: () => makeAnonClient(),
          },
        },
        { provide: InventoryService, useValue: {} },
        { provide: StampsService, useValue: { earnStamps: jest.fn() } },
        {
          provide: NotificationsService,
          useValue: { sendOrderCompletionKakao: jest.fn() },
        },
        { provide: PaymentsService, useValue: paymentsService },
      ],
    }).compile();

    service = module.get(PublicOrderService);
    jest.clearAllMocks();
  });

  it('cancels a public order in CREATED status', async () => {
    orderLookupResult = {
      data: {
        id: 'order-1',
        branch_id: 'branch-1',
        order_no: 'ORD-1',
        status: 'CREATED',
      },
      error: null,
    };

    const result = await service.cancelPublicOrder('order-1');

    expect(
      paymentsService.refundOrderPaymentForCancellation,
    ).toHaveBeenCalledWith('order-1', 'branch-1', '구매자 직접 주문 취소');
    expect(result).toEqual(
      expect.objectContaining({
        id: 'order-1',
        status: 'CANCELLED',
      }),
    );
  });

  it('throws when public order is not found', async () => {
    orderLookupResult = { data: null, error: null };

    await expect(service.cancelPublicOrder('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects non-cancellable public orders', async () => {
    orderLookupResult = {
      data: {
        id: 'order-1',
        branch_id: 'branch-1',
        order_no: 'ORD-1',
        status: 'READY',
      },
      error: null,
    };

    await expect(service.cancelPublicOrder('order-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
