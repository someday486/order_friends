import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MeOrdersService } from './me-orders.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { PublicOrderService } from './public-order.service';
import { PaymentsService } from '../payments/payments.service';

describe('MeOrdersService', () => {
  let service: MeOrdersService;
  let fromMock: jest.Mock;
  let orderLookupResult: { data: any; error: any };
  let orderUpdateResult: { error: any };

  const publicOrderService = {
    createOrder: jest.fn(),
    getOrder: jest.fn(),
    getOrderForAuthenticatedUser: jest.fn(),
  };

  const paymentsService = {
    refundOrderPaymentForCancellation: jest.fn(),
  };

  beforeEach(async () => {
    orderLookupResult = { data: null, error: null };
    orderUpdateResult = { error: null };

    fromMock = jest.fn((table: string) => {
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
        maybeSingle: jest.fn(),
        update: jest.fn().mockReturnThis(),
      };
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeOrdersService,
        {
          provide: SupabaseService,
          useValue: {
            adminClient: () => ({
              from: fromMock,
            }),
          },
        },
        { provide: PublicOrderService, useValue: publicOrderService },
        { provide: PaymentsService, useValue: paymentsService },
      ],
    }).compile();

    service = module.get(MeOrdersService);
    jest.clearAllMocks();
  });

  it('createMyOrder should delegate to public order service with user id', async () => {
    publicOrderService.createOrder.mockResolvedValue({ id: 'order-1' });

    const result = await service.createMyOrder('user-1', {
      branchId: 'b1',
    } as any);

    expect(result).toEqual({ id: 'order-1' });
    expect(publicOrderService.createOrder).toHaveBeenCalledWith(
      { branchId: 'b1' },
      'user-1',
    );
  });

  it('cancelMyOrder should cancel a created order and return refreshed order', async () => {
    orderLookupResult = {
      data: {
        id: 'order-1',
        branch_id: 'branch-1',
        order_no: 'ORD-1',
        status: 'CREATED',
        user_id: 'user-1',
      },
      error: null,
    };
    publicOrderService.getOrderForAuthenticatedUser.mockResolvedValue({
      id: 'order-1',
      status: 'CANCELLED',
    });

    const result = await service.cancelMyOrder('user-1', 'order-1');

    expect(
      paymentsService.refundOrderPaymentForCancellation,
    ).toHaveBeenCalledWith('order-1', 'branch-1', '구매자 직접 주문 취소');
    expect(result).toEqual({ id: 'order-1', status: 'CANCELLED' });
  });

  it('cancelMyOrder should throw when order is not found', async () => {
    orderLookupResult = { data: null, error: null };

    await expect(
      service.cancelMyOrder('user-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cancelMyOrder should reject non-cancellable status', async () => {
    orderLookupResult = {
      data: {
        id: 'order-1',
        branch_id: 'branch-1',
        order_no: 'ORD-1',
        status: 'READY',
        user_id: 'user-1',
      },
      error: null,
    };

    await expect(
      service.cancelMyOrder('user-1', 'order-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cancelMyOrder should reject legacy orders without linked user', async () => {
    orderLookupResult = {
      data: {
        id: 'order-1',
        branch_id: 'branch-1',
        order_no: 'ORD-1',
        status: 'CREATED',
        user_id: null,
      },
      error: null,
    };

    await expect(service.cancelMyOrder('user-1', 'order-1')).rejects.toThrow(
      '로그인 연동 이전 주문은 직접 취소할 수 없습니다. 매장에 문의해주세요.',
    );
  });
  it('getMyOrder should return an owned order', async () => {
    orderLookupResult = {
      data: {
        id: 'order-1',
        user_id: 'user-1',
      },
      error: null,
    };
    publicOrderService.getOrderForAuthenticatedUser.mockResolvedValue({
      id: 'order-1',
      status: 'CREATED',
    });

    const result = await service.getMyOrder('user-1', 'order-1');

    expect(result).toEqual({ id: 'order-1', status: 'CREATED' });
    expect(
      publicOrderService.getOrderForAuthenticatedUser,
    ).toHaveBeenCalledWith('order-1');
  });

  it('getMyOrder should reject a different user order', async () => {
    orderLookupResult = {
      data: {
        id: 'order-1',
        user_id: 'user-2',
      },
      error: null,
    };

    await expect(
      service.getMyOrder('user-1', 'order-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
