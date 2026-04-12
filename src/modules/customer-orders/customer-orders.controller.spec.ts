import { Test, TestingModule } from '@nestjs/testing';
import { CustomerOrdersController } from './customer-orders.controller';
import { CustomerOrdersService } from './customer-orders.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CustomerGuard } from '../../common/guards/customer.guard';

describe('CustomerOrdersController', () => {
  let controller: CustomerOrdersController;

  const mockService = {
    getMyOrders: jest.fn(),
    getMyOrder: jest.fn(),
    updateMyOrderDeliveryTracking: jest.fn(),
    updateMyOrderStatus: jest.fn(),
    confirmMyOrderTransferPayment: jest.fn(),
    retryMyOrderCashReceiptIssue: jest.fn(),
    updateMyOrdersStatusBulk: jest.fn(),
  };
  const mockGuard = { canActivate: jest.fn(() => true) };

  const makeReq = (overrides: Record<string, any> = {}) =>
    ({
      user: { id: 'user-1' },
      brandMemberships: [],
      branchMemberships: [],
      ...overrides,
    }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerOrdersController],
      providers: [
        { provide: CustomerOrdersService, useValue: mockService },
        { provide: AuthGuard, useValue: mockGuard },
        { provide: CustomerGuard, useValue: mockGuard },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockGuard)
      .overrideGuard(CustomerGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<CustomerOrdersController>(CustomerOrdersController);
    jest.clearAllMocks();
  });

  it('getOrders should call service and return result', async () => {
    mockService.getMyOrders.mockResolvedValue([{ id: 'order-1' }]);

    const result = await controller.getOrders(makeReq(), {
      branchId: 'branch-1',
      status: 'COMPLETED',
      fulfillmentType: 'DELIVERY',
      dateStart: '2026-03-01',
      dateEnd: '2026-03-21',
      search: 'kim',
      page: 1,
      limit: 10,
    } as any);

    expect(result).toEqual([{ id: 'order-1' }]);
    expect(mockService.getMyOrders).toHaveBeenCalledWith(
      'user-1',
      'branch-1',
      [],
      [],
      { page: 1, limit: 10 },
      'COMPLETED',
      'DELIVERY',
      '2026-03-01',
      '2026-03-21',
      undefined,
      'kim',
    );
  });

  it('getOrders should throw when user is missing', async () => {
    await expect(
      controller.getOrders(makeReq({ user: undefined }), {
        branchId: 'branch-1',
      } as any),
    ).rejects.toThrow('Missing user');
  });

  it('getOrders should allow missing branchId (all branches)', async () => {
    mockService.getMyOrders.mockResolvedValue([{ id: 'order-1' }]);

    const result = await controller.getOrders(makeReq(), {
      page: 1,
      limit: 10,
    } as any);

    expect(result).toEqual([{ id: 'order-1' }]);
    expect(mockService.getMyOrders).toHaveBeenCalledWith(
      'user-1',
      undefined,
      [],
      [],
      { page: 1, limit: 10 },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });

  it('getOrder should call service and return result', async () => {
    mockService.getMyOrder.mockResolvedValue({ id: 'order-1' });

    const result = await controller.getOrder(makeReq(), 'order-1');

    expect(result).toEqual({ id: 'order-1' });
    expect(mockService.getMyOrder).toHaveBeenCalledWith(
      'user-1',
      'order-1',
      [],
      [],
    );
  });

  it('getOrder should throw when user is missing', async () => {
    await expect(
      controller.getOrder(makeReq({ user: undefined }), 'order-1'),
    ).rejects.toThrow('Missing user');
  });

  it('updateDeliveryTracking should call service and return result', async () => {
    mockService.updateMyOrderDeliveryTracking.mockResolvedValue({
      status: 'IN_TRANSIT',
      carrier: 'Carrier X',
      trackingNumber: '1234567890',
      startedAt: '2026-04-12T15:00:00.000Z',
      deliveredAt: null,
      updatedAt: '2026-04-12T15:00:00.000Z',
    });

    const result = await controller.updateDeliveryTracking(
      makeReq(),
      'order-1',
      {
        deliveryStatus: 'IN_TRANSIT',
        deliveryCarrier: 'Carrier X',
        deliveryTrackingNumber: '1234567890',
      } as any,
    );

    expect(result).toEqual({
      status: 'IN_TRANSIT',
      carrier: 'Carrier X',
      trackingNumber: '1234567890',
      startedAt: '2026-04-12T15:00:00.000Z',
      deliveredAt: null,
      updatedAt: '2026-04-12T15:00:00.000Z',
    });
    expect(mockService.updateMyOrderDeliveryTracking).toHaveBeenCalledWith(
      'user-1',
      'order-1',
      {
        deliveryStatus: 'IN_TRANSIT',
        deliveryCarrier: 'Carrier X',
        deliveryTrackingNumber: '1234567890',
      },
      [],
      [],
    );
  });

  it('updateDeliveryTracking should throw when user is missing', async () => {
    await expect(
      controller.updateDeliveryTracking(
        makeReq({ user: undefined }),
        'order-1',
        {
          deliveryStatus: 'IN_TRANSIT',
        } as any,
      ),
    ).rejects.toThrow('Missing user');
  });

  it('updateOrderStatus should call service and return result', async () => {
    mockService.updateMyOrderStatus.mockResolvedValue({
      id: 'order-1',
      status: 'READY',
    });

    const result = await controller.updateOrderStatus(makeReq(), 'order-1', {
      status: 'READY',
    } as any);

    expect(result).toEqual({ id: 'order-1', status: 'READY' });
    expect(mockService.updateMyOrderStatus).toHaveBeenCalledWith(
      'user-1',
      'order-1',
      'READY',
      [],
      [],
    );
  });

  it('updateOrderStatus should throw when user is missing', async () => {
    await expect(
      controller.updateOrderStatus(makeReq({ user: undefined }), 'order-1', {
        status: 'READY',
      } as any),
    ).rejects.toThrow('Missing user');
  });

  it('updateOrderStatusBulk should call service and return result', async () => {
    mockService.updateMyOrdersStatusBulk.mockResolvedValue({
      updatedCount: 2,
      status: 'READY',
      orderIds: ['order-1', 'order-2'],
    });

    const result = await controller.updateOrderStatusBulk(makeReq(), {
      orderIds: ['order-1', 'order-2'],
      status: 'READY',
    } as any);

    expect(result).toEqual({
      updatedCount: 2,
      status: 'READY',
      orderIds: ['order-1', 'order-2'],
    });
    expect(mockService.updateMyOrdersStatusBulk).toHaveBeenCalledWith(
      'user-1',
      ['order-1', 'order-2'],
      'READY',
      [],
      [],
    );
  });

  it('updateOrderStatusBulk should throw when user is missing', async () => {
    await expect(
      controller.updateOrderStatusBulk(makeReq({ user: undefined }), {
        orderIds: ['order-1'],
        status: 'READY',
      } as any),
    ).rejects.toThrow('Missing user');
  });

  it('confirmTransferPayment should call service and return result', async () => {
    mockService.confirmMyOrderTransferPayment.mockResolvedValue({
      id: 'payment-1',
      orderId: 'order-1',
      status: 'SUCCESS',
      amount: 10000,
      paidAt: '2026-03-31T09:30:00.000Z',
    });

    const result = await controller.confirmTransferPayment(
      makeReq(),
      'order-1',
    );

    expect(result).toEqual({
      id: 'payment-1',
      orderId: 'order-1',
      status: 'SUCCESS',
      amount: 10000,
      paidAt: '2026-03-31T09:30:00.000Z',
    });
    expect(mockService.confirmMyOrderTransferPayment).toHaveBeenCalledWith(
      'user-1',
      'order-1',
      [],
      [],
    );
  });

  it('confirmTransferPayment should throw when user is missing', async () => {
    await expect(
      controller.confirmTransferPayment(
        makeReq({ user: undefined }),
        'order-1',
      ),
    ).rejects.toThrow('Missing user');
  });

  it('retryCashReceiptIssue should call service and return result', async () => {
    mockService.retryMyOrderCashReceiptIssue.mockResolvedValue({
      orderId: 'order-1',
      requested: true,
    });

    const result = await controller.retryCashReceiptIssue(makeReq(), 'order-1');

    expect(result).toEqual({
      orderId: 'order-1',
      requested: true,
    });
    expect(mockService.retryMyOrderCashReceiptIssue).toHaveBeenCalledWith(
      'user-1',
      'order-1',
      [],
      [],
    );
  });

  it('retryCashReceiptIssue should throw when user is missing', async () => {
    await expect(
      controller.retryCashReceiptIssue(makeReq({ user: undefined }), 'order-1'),
    ).rejects.toThrow('Missing user');
  });

  it.each([
    {
      name: 'getOrders',
      setup: () =>
        mockService.getMyOrders.mockResolvedValueOnce([{ id: 'order-1' }]),
      call: () =>
        controller.getOrders(
          makeReq({
            brandMemberships: undefined,
            branchMemberships: undefined,
          }),
          {
            branchId: 'branch-1',
            status: 'COMPLETED',
            page: 1,
            limit: 10,
          } as any,
        ),
      expectCall: () =>
        expect(mockService.getMyOrders).toHaveBeenCalledWith(
          'user-1',
          'branch-1',
          [],
          [],
          { page: 1, limit: 10 },
          'COMPLETED',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
        ),
    },
    {
      name: 'getOrder',
      setup: () =>
        mockService.getMyOrder.mockResolvedValueOnce({ id: 'order-1' }),
      call: () =>
        controller.getOrder(
          makeReq({
            brandMemberships: undefined,
            branchMemberships: undefined,
          }),
          'order-1',
        ),
      expectCall: () =>
        expect(mockService.getMyOrder).toHaveBeenCalledWith(
          'user-1',
          'order-1',
          [],
          [],
        ),
    },
    {
      name: 'updateDeliveryTracking',
      setup: () =>
        mockService.updateMyOrderDeliveryTracking.mockResolvedValueOnce({
          status: 'PREPARING_SHIPMENT',
        }),
      call: () =>
        controller.updateDeliveryTracking(
          makeReq({
            brandMemberships: undefined,
            branchMemberships: undefined,
          }),
          'order-1',
          { deliveryStatus: 'PREPARING_SHIPMENT' } as any,
        ),
      expectCall: () =>
        expect(mockService.updateMyOrderDeliveryTracking).toHaveBeenCalledWith(
          'user-1',
          'order-1',
          { deliveryStatus: 'PREPARING_SHIPMENT' },
          [],
          [],
        ),
    },
    {
      name: 'updateOrderStatus',
      setup: () =>
        mockService.updateMyOrderStatus.mockResolvedValueOnce({
          id: 'order-1',
          status: 'READY',
        }),
      call: () =>
        controller.updateOrderStatus(
          makeReq({
            brandMemberships: undefined,
            branchMemberships: undefined,
          }),
          'order-1',
          { status: 'READY' } as any,
        ),
      expectCall: () =>
        expect(mockService.updateMyOrderStatus).toHaveBeenCalledWith(
          'user-1',
          'order-1',
          'READY',
          [],
          [],
        ),
    },
    {
      name: 'updateOrderStatusBulk',
      setup: () =>
        mockService.updateMyOrdersStatusBulk.mockResolvedValueOnce({
          updatedCount: 1,
          status: 'READY',
          orderIds: ['order-1'],
        }),
      call: () =>
        controller.updateOrderStatusBulk(
          makeReq({
            brandMemberships: undefined,
            branchMemberships: undefined,
          }),
          { orderIds: ['order-1'], status: 'READY' } as any,
        ),
      expectCall: () =>
        expect(mockService.updateMyOrdersStatusBulk).toHaveBeenCalledWith(
          'user-1',
          ['order-1'],
          'READY',
          [],
          [],
        ),
    },
  ])(
    'should default memberships for $name',
    async ({ setup, call, expectCall }) => {
      setup();
      await call();
      expectCall();
    },
  );
});
