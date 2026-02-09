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
    updateMyOrderStatus: jest.fn(),
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

    const result = await controller.getOrders(
      makeReq(),
      'branch-1',
      'COMPLETED' as any,
      { page: 1, limit: 10 } as any,
    );

    expect(result).toEqual([{ id: 'order-1' }]);
    expect(mockService.getMyOrders).toHaveBeenCalledWith(
      'user-1',
      'branch-1',
      [],
      [],
      { page: 1, limit: 10 },
      'COMPLETED',
    );
  });

  it('getOrders should throw when user is missing', async () => {
    await expect(
      controller.getOrders(makeReq({ user: undefined }), 'branch-1'),
    ).rejects.toThrow('Missing user');
  });

  it('getOrder should call service and return result', async () => {
    mockService.getMyOrder.mockResolvedValue({ id: 'order-1' });

    const result = await controller.getOrder(makeReq(), 'order-1');

    expect(result).toEqual({ id: 'order-1' });
    expect(mockService.getMyOrder).toHaveBeenCalledWith('user-1', 'order-1', [], []);
  });

  it('getOrder should throw when user is missing', async () => {
    await expect(
      controller.getOrder(makeReq({ user: undefined }), 'order-1'),
    ).rejects.toThrow('Missing user');
  });

  it('updateOrderStatus should call service and return result', async () => {
    mockService.updateMyOrderStatus.mockResolvedValue({ id: 'order-1', status: 'DONE' });

    const result = await controller.updateOrderStatus(
      makeReq(),
      'order-1',
      { status: 'DONE' } as any,
    );

    expect(result).toEqual({ id: 'order-1', status: 'DONE' });
    expect(mockService.updateMyOrderStatus).toHaveBeenCalledWith(
      'user-1',
      'order-1',
      'DONE',
      [],
      [],
    );
  });

  it('updateOrderStatus should throw when user is missing', async () => {
    await expect(
      controller.updateOrderStatus(
        makeReq({ user: undefined }),
        'order-1',
        { status: 'DONE' } as any,
      ),
    ).rejects.toThrow('Missing user');
  });
});
