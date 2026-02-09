import { Test, TestingModule } from '@nestjs/testing';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

describe('PublicController', () => {
  let controller: PublicController;

  const mockService = {
    getBranch: jest.fn(),
    getProducts: jest.fn(),
    createOrder: jest.fn(),
    getOrder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicController],
      providers: [{ provide: PublicService, useValue: mockService }],
    }).compile();

    controller = module.get<PublicController>(PublicController);
    jest.clearAllMocks();
  });

  it('getBranch should call service and return result', async () => {
    mockService.getBranch.mockResolvedValue({ id: 'branch-1' });

    const result = await controller.getBranch('branch-1');

    expect(result).toEqual({ id: 'branch-1' });
    expect(mockService.getBranch).toHaveBeenCalledWith('branch-1');
  });

  it('getBranch should propagate service error', async () => {
    mockService.getBranch.mockRejectedValue(new Error('boom'));

    await expect(controller.getBranch('branch-1')).rejects.toThrow('boom');
  });

  it('getProducts should call service and return result', async () => {
    mockService.getProducts.mockResolvedValue([{ id: 'prod-1' }]);

    const result = await controller.getProducts('branch-1');

    expect(result).toEqual([{ id: 'prod-1' }]);
    expect(mockService.getProducts).toHaveBeenCalledWith('branch-1');
  });

  it('getProducts should propagate service error', async () => {
    mockService.getProducts.mockRejectedValue(new Error('boom'));

    await expect(controller.getProducts('branch-1')).rejects.toThrow('boom');
  });

  it('createOrder should call service and return result', async () => {
    mockService.createOrder.mockResolvedValue({ id: 'order-1' });

    const dto = { customerName: 'Lee' } as any;
    const result = await controller.createOrder(dto);

    expect(result).toEqual({ id: 'order-1' });
    expect(mockService.createOrder).toHaveBeenCalledWith(dto);
  });

  it('createOrder should propagate service error', async () => {
    mockService.createOrder.mockRejectedValue(new Error('boom'));

    await expect(controller.createOrder({} as any)).rejects.toThrow('boom');
  });

  it('getOrder should call service and return result', async () => {
    mockService.getOrder.mockResolvedValue({ id: 'order-1' });

    const result = await controller.getOrder('order-1');

    expect(result).toEqual({ id: 'order-1' });
    expect(mockService.getOrder).toHaveBeenCalledWith('order-1');
  });

  it('getOrder should propagate service error', async () => {
    mockService.getOrder.mockRejectedValue(new Error('boom'));

    await expect(controller.getOrder('order-1')).rejects.toThrow('boom');
  });
});
