import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

describe('OrdersController', () => {
  let controller: OrdersController;

  const mockService = {
    getOrders: jest.fn(),
    getOrder: jest.fn(),
    updateStatus: jest.fn(),
  };
  const mockGuard = { canActivate: jest.fn(() => true) };

  const makeReq = (overrides: Record<string, any> = {}) =>
    ({ accessToken: 'token', isAdmin: false, ...overrides }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        { provide: OrdersService, useValue: mockService },
        { provide: AuthGuard, useValue: mockGuard },
        { provide: AdminGuard, useValue: mockGuard },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockGuard)
      .overrideGuard(AdminGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<OrdersController>(OrdersController);
    jest.clearAllMocks();
  });

  it('getOrders should call service and return result', async () => {
    mockService.getOrders.mockResolvedValue([{ id: 'order-1' }]);

    const query = { branchId: 'branch-1', page: 1 } as any;
    const result = await controller.getOrders(makeReq(), query);

    expect(result).toEqual([{ id: 'order-1' }]);
    expect(mockService.getOrders).toHaveBeenCalledWith('token', 'branch-1', query);
  });

  it('getOrders should throw when access token is missing', async () => {
    await expect(
      controller.getOrders(makeReq({ accessToken: undefined }), { branchId: 'branch-1' } as any),
    ).rejects.toThrow('Missing access token');
  });

  it('getOrder should call service and return result', async () => {
    mockService.getOrder.mockResolvedValue({ id: 'order-1' });

    const result = await controller.getOrder('order-1', makeReq(), 'branch-1');

    expect(result).toEqual({ id: 'order-1' });
    expect(mockService.getOrder).toHaveBeenCalledWith('token', 'order-1', 'branch-1');
  });

  it('getOrder should throw when branchId is missing', async () => {
    await expect(
      controller.getOrder('order-1', makeReq(), ''),
    ).rejects.toThrow(BadRequestException);
  });

  it('getOrder should throw when access token is missing', async () => {
    await expect(
      controller.getOrder('order-1', makeReq({ accessToken: undefined }), 'branch-1'),
    ).rejects.toThrow('Missing access token');
  });

  it('updateOrderStatus should call service and return result', async () => {
    mockService.updateStatus.mockResolvedValue({ id: 'order-1', status: 'COMPLETED' });

    const result = await controller.updateOrderStatus(
      'order-1',
      { status: 'COMPLETED' } as any,
      makeReq(),
      'branch-1',
    );

    expect(result).toEqual({ id: 'order-1', status: 'COMPLETED' });
    expect(mockService.updateStatus).toHaveBeenCalledWith(
      'token',
      'order-1',
      'COMPLETED',
      'branch-1',
    );
  });

  it('updateOrderStatus should throw when branchId is missing', async () => {
    await expect(
      controller.updateOrderStatus(
        'order-1',
        { status: 'COMPLETED' } as any,
        makeReq(),
        '',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('updateOrderStatus should throw when access token is missing', async () => {
    await expect(
      controller.updateOrderStatus(
        'order-1',
        { status: 'COMPLETED' } as any,
        makeReq({ accessToken: undefined }),
        'branch-1',
      ),
    ).rejects.toThrow('Missing access token');
  });
});
