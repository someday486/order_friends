import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CustomerGuard } from '../../common/guards/customer.guard';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;

  const mockService = {
    getSalesAnalytics: jest.fn(),
    getProductAnalytics: jest.fn(),
    getOrderAnalytics: jest.fn(),
    getCustomerAnalytics: jest.fn(),
  };
  const mockGuard = { canActivate: jest.fn(() => true) };

  const makeReq = (overrides: Record<string, any> = {}) =>
    ({ accessToken: 'token', ...overrides }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: AnalyticsService, useValue: mockService },
        { provide: AuthGuard, useValue: mockGuard },
        { provide: CustomerGuard, useValue: mockGuard },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockGuard)
      .overrideGuard(CustomerGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    jest.clearAllMocks();
  });

  it('getSalesAnalytics should call service and return result', async () => {
    mockService.getSalesAnalytics.mockResolvedValue({ totalRevenue: 0 });

    const result = await controller.getSalesAnalytics(
      makeReq(),
      'branch-1',
      '2026-01-01',
      '2026-01-31',
    );

    expect(result).toEqual({ totalRevenue: 0 });
    expect(mockService.getSalesAnalytics).toHaveBeenCalledWith(
      'token',
      'branch-1',
      '2026-01-01',
      '2026-01-31',
    );
  });

  it('getSalesAnalytics should throw when access token is missing', async () => {
    await expect(
      controller.getSalesAnalytics(
        makeReq({ accessToken: undefined }),
        'branch-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('getSalesAnalytics should throw when branchId is missing', async () => {
    await expect(
      controller.getSalesAnalytics(makeReq(), ''),
    ).rejects.toThrow('branchId is required');
  });

  it('getProductAnalytics should call service and return result', async () => {
    mockService.getProductAnalytics.mockResolvedValue({ topProducts: [] });

    const result = await controller.getProductAnalytics(
      makeReq(),
      'branch-1',
      '2026-01-01',
      '2026-01-31',
    );

    expect(result).toEqual({ topProducts: [] });
    expect(mockService.getProductAnalytics).toHaveBeenCalledWith(
      'token',
      'branch-1',
      '2026-01-01',
      '2026-01-31',
    );
  });

  it('getProductAnalytics should throw when access token is missing', async () => {
    await expect(
      controller.getProductAnalytics(
        makeReq({ accessToken: undefined }),
        'branch-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('getProductAnalytics should throw when branchId is missing', async () => {
    await expect(
      controller.getProductAnalytics(makeReq(), ''),
    ).rejects.toThrow('branchId is required');
  });

  it('getOrderAnalytics should call service and return result', async () => {
    mockService.getOrderAnalytics.mockResolvedValue({ ordersByDay: [] });

    const result = await controller.getOrderAnalytics(
      makeReq(),
      'branch-1',
      '2026-01-01',
      '2026-01-31',
    );

    expect(result).toEqual({ ordersByDay: [] });
    expect(mockService.getOrderAnalytics).toHaveBeenCalledWith(
      'token',
      'branch-1',
      '2026-01-01',
      '2026-01-31',
    );
  });

  it('getOrderAnalytics should throw when access token is missing', async () => {
    await expect(
      controller.getOrderAnalytics(
        makeReq({ accessToken: undefined }),
        'branch-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('getOrderAnalytics should throw when branchId is missing', async () => {
    await expect(
      controller.getOrderAnalytics(makeReq(), ''),
    ).rejects.toThrow('branchId is required');
  });

  it('getCustomerAnalytics should call service and return result', async () => {
    mockService.getCustomerAnalytics.mockResolvedValue({ totalCustomers: 0 });

    const result = await controller.getCustomerAnalytics(
      makeReq(),
      'branch-1',
      '2026-01-01',
      '2026-01-31',
    );

    expect(result).toEqual({ totalCustomers: 0 });
    expect(mockService.getCustomerAnalytics).toHaveBeenCalledWith(
      'token',
      'branch-1',
      '2026-01-01',
      '2026-01-31',
    );
  });

  it('getCustomerAnalytics should throw when access token is missing', async () => {
    await expect(
      controller.getCustomerAnalytics(
        makeReq({ accessToken: undefined }),
        'branch-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('getCustomerAnalytics should throw when branchId is missing', async () => {
    await expect(
      controller.getCustomerAnalytics(makeReq(), ''),
    ).rejects.toThrow('branchId is required');
  });
});
