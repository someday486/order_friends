import { Test, TestingModule } from '@nestjs/testing';
import { PublicOrderController } from './public-order.controller';
import { PublicOrderService } from './public-order.service';
import { UserRateLimitGuard } from '../../common/guards/user-rate-limit.guard';
import { StampsService } from '../stamps/stamps.service';

describe('PublicOrderController', () => {
  let controller: PublicOrderController;

  const mockService = {
    getBrands: jest.fn(),
    getShopBrandBySlug: jest.fn(),
    createShopOrderByBrandSlug: jest.fn(),
    getBranch: jest.fn(),
    getBranchBySlug: jest.fn(),
    getBranchByBrandSlug: jest.fn(),
    getBranchesByBrandSlug: jest.fn(),
    getCategories: jest.fn(),
    getProducts: jest.fn(),
    createOrder: jest.fn(),
    cancelPublicOrder: jest.fn(),
    getOrder: jest.fn(),
  };
  const mockGuard = { canActivate: jest.fn(() => true) };
  const mockStampsService = {
    getPublicStampInfo: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicOrderController],
      providers: [
        { provide: PublicOrderService, useValue: mockService },
        { provide: StampsService, useValue: mockStampsService },
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

  it('getBrands should call service and return result', async () => {
    mockService.getBrands.mockResolvedValue([{ id: 'brand-1' }]);

    const result = await controller.getBrands();

    expect(result).toEqual([{ id: 'brand-1' }]);
    expect(mockService.getBrands).toHaveBeenCalledWith();
  });

  it('getBrands should propagate service error', async () => {
    mockService.getBrands.mockRejectedValue(new Error('boom'));

    await expect(controller.getBrands()).rejects.toThrow('boom');
  });

  it('getShopBrand should call service and return result', async () => {
    mockService.getShopBrandBySlug.mockResolvedValue({ brandSlug: 'test' });

    const result = await controller.getShopBrand('test');

    expect(result).toEqual({ brandSlug: 'test' });
    expect(mockService.getShopBrandBySlug).toHaveBeenCalledWith('test');
  });

  it('getShopBrand should propagate service error', async () => {
    mockService.getShopBrandBySlug.mockRejectedValue(new Error('boom'));

    await expect(controller.getShopBrand('test')).rejects.toThrow('boom');
  });

  it('createShopOrder should call service and return result', async () => {
    const dto = { customerName: 'Lee' } as any;
    mockService.createShopOrderByBrandSlug.mockResolvedValue({ id: 'order-2' });

    const result = await controller.createShopOrder('test', dto);

    expect(result).toEqual({ id: 'order-2' });
    expect(mockService.createShopOrderByBrandSlug).toHaveBeenCalledWith(
      'test',
      dto,
    );
  });

  it('createShopOrder should propagate service error', async () => {
    mockService.createShopOrderByBrandSlug.mockRejectedValue(new Error('boom'));

    await expect(controller.createShopOrder('test', {} as any)).rejects.toThrow(
      'boom',
    );
  });

  it('getBranch should propagate service error', async () => {
    mockService.getBranch.mockRejectedValue(new Error('boom'));

    await expect(controller.getBranch('branch-1')).rejects.toThrow('boom');
  });

  it('getBranchLegacy should call service and return result', async () => {
    mockService.getBranch.mockResolvedValue({ id: 'branch-legacy' });

    const result = await controller.getBranchLegacy('branch-legacy');

    expect(result).toEqual({ id: 'branch-legacy' });
    expect(mockService.getBranch).toHaveBeenCalledWith('branch-legacy');
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
    expect(mockService.getBranchByBrandSlug).toHaveBeenCalledWith(
      'brand',
      'branch',
    );
  });

  it('getBranchByBrandSlug should propagate service error', async () => {
    mockService.getBranchByBrandSlug.mockRejectedValue(new Error('boom'));

    await expect(
      controller.getBranchByBrandSlug('brand', 'branch'),
    ).rejects.toThrow('boom');
  });

  it('getBranchesByBrandSlug should call service and return result', async () => {
    mockService.getBranchesByBrandSlug.mockResolvedValue({
      brandSlug: 'brand',
      branches: [{ id: 'b1' }],
    });

    const result = await controller.getBranchesByBrandSlug('brand');

    expect(result).toEqual({ brandSlug: 'brand', branches: [{ id: 'b1' }] });
    expect(mockService.getBranchesByBrandSlug).toHaveBeenCalledWith('brand');
  });

  it('getBranchesByBrandSlug should propagate service error', async () => {
    mockService.getBranchesByBrandSlug.mockRejectedValue(new Error('boom'));

    await expect(controller.getBranchesByBrandSlug('brand')).rejects.toThrow(
      'boom',
    );
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

  it('getProductsLegacy should call service and return result', async () => {
    mockService.getProducts.mockResolvedValue([{ id: 'prod-legacy' }]);

    const result = await controller.getProductsLegacy('branch-legacy');

    expect(result).toEqual([{ id: 'prod-legacy' }]);
    expect(mockService.getProducts).toHaveBeenCalledWith('branch-legacy');
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

  it('cancelOrder should call service and return result', async () => {
    mockService.cancelPublicOrder.mockResolvedValue({
      id: 'order-1',
      status: 'CANCELLED',
    });

    const result = await controller.cancelOrder('order-1');

    expect(result).toEqual({ id: 'order-1', status: 'CANCELLED' });
    expect(mockService.cancelPublicOrder).toHaveBeenCalledWith('order-1');
  });

  it('cancelOrder should propagate service error', async () => {
    mockService.cancelPublicOrder.mockRejectedValue(new Error('boom'));

    await expect(controller.cancelOrder('order-1')).rejects.toThrow('boom');
  });
});
