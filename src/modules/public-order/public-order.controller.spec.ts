import { Test, TestingModule } from '@nestjs/testing';
import { PublicOrderController } from './public-order.controller';
import { PublicOrderService } from './public-order.service';
import { UserRateLimitGuard } from '../../common/guards/user-rate-limit.guard';

describe('PublicOrderController', () => {
  let controller: PublicOrderController;

  const mockService = {
    getBranch: jest.fn(),
    getBranchBySlug: jest.fn(),
    getBranchByBrandSlug: jest.fn(),
    getCategories: jest.fn(),
    getProducts: jest.fn(),
    createOrder: jest.fn(),
    getOrder: jest.fn(),
  };
  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicOrderController],
      providers: [
        { provide: PublicOrderService, useValue: mockService },
        { provide: UserRateLimitGuard, useValue: mockGuard },
      ],
    })
      .overrideGuard(UserRateLimitGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<PublicOrderController>(PublicOrderController);
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

  it('getBranchBySlug should call service and return result', async () => {
    mockService.getBranchBySlug.mockResolvedValue({ id: 'branch-1' });

    const result = await controller.getBranchBySlug('slug');

    expect(result).toEqual({ id: 'branch-1' });
    expect(mockService.getBranchBySlug).toHaveBeenCalledWith('slug');
  });

  it('getBranchBySlug should propagate service error', async () => {
    mockService.getBranchBySlug.mockRejectedValue(new Error('boom'));

    await expect(controller.getBranchBySlug('slug')).rejects.toThrow('boom');
  });

  it('getBranchByBrandSlug should call service and return result', async () => {
    mockService.getBranchByBrandSlug.mockResolvedValue({ id: 'branch-1' });

    const result = await controller.getBranchByBrandSlug('brand', 'branch');

    expect(result).toEqual({ id: 'branch-1' });
    expect(mockService.getBranchByBrandSlug).toHaveBeenCalledWith('brand', 'branch');
  });

  it('getBranchByBrandSlug should propagate service error', async () => {
    mockService.getBranchByBrandSlug.mockRejectedValue(new Error('boom'));

    await expect(controller.getBranchByBrandSlug('brand', 'branch')).rejects.toThrow('boom');
  });

  it('getCategories should call service and return result', async () => {
    mockService.getCategories.mockResolvedValue([{ id: 'cat-1' }]);

    const result = await controller.getCategories('branch-1');

    expect(result).toEqual([{ id: 'cat-1' }]);
    expect(mockService.getCategories).toHaveBeenCalledWith('branch-1');
  });

  it('getCategories should propagate service error', async () => {
    mockService.getCategories.mockRejectedValue(new Error('boom'));

    await expect(controller.getCategories('branch-1')).rejects.toThrow('boom');
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
