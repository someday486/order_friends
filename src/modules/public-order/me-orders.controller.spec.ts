import { Test, TestingModule } from '@nestjs/testing';
import { MeOrdersController } from './me-orders.controller';
import { MeOrdersService } from './me-orders.service';
import { AuthGuard } from '../../common/guards/auth.guard';

describe('MeOrdersController', () => {
  let controller: MeOrdersController;

  const mockService = {
    createMyOrder: jest.fn(),
    getMyOrder: jest.fn(),
    cancelMyOrder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeOrdersController],
      providers: [{ provide: MeOrdersService, useValue: mockService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get(MeOrdersController);
    jest.clearAllMocks();
  });

  it('createOrder should delegate to service with current user id', async () => {
    mockService.createMyOrder.mockResolvedValue({ id: 'order-1' });

    const result = await controller.createOrder({ id: 'user-1' }, {
      customerName: 'Lee',
    } as any);

    expect(result).toEqual({ id: 'order-1' });
    expect(mockService.createMyOrder).toHaveBeenCalledWith('user-1', {
      customerName: 'Lee',
    });
  });

  it('cancelOrder should delegate to service with current user id', async () => {
    mockService.cancelMyOrder.mockResolvedValue({ id: 'order-1' });

    const result = await controller.cancelOrder({ id: 'user-1' }, 'order-1');

    expect(result).toEqual({ id: 'order-1' });
    expect(mockService.cancelMyOrder).toHaveBeenCalledWith('user-1', 'order-1');
  });

  it('getOrder should delegate to service with current user id', async () => {
    mockService.getMyOrder.mockResolvedValue({ id: 'order-1' });

    const result = await controller.getOrder({ id: 'user-1' }, 'order-1');

    expect(result).toEqual({ id: 'order-1' });
    expect(mockService.getMyOrder).toHaveBeenCalledWith('user-1', 'order-1');
  });
});
