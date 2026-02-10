import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

describe('DashboardController', () => {
  let controller: DashboardController;

  const mockService = {
    getStats: jest.fn(),
  };
  const mockGuard = { canActivate: jest.fn(() => true) };

  const makeReq = (overrides: Record<string, any> = {}) =>
    ({ accessToken: 'token', isAdmin: false, ...overrides }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardService, useValue: mockService },
        { provide: AuthGuard, useValue: mockGuard },
        { provide: AdminGuard, useValue: mockGuard },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockGuard)
      .overrideGuard(AdminGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<DashboardController>(DashboardController);
    jest.clearAllMocks();
  });

  it('getStats should call service and return result', async () => {
    mockService.getStats.mockResolvedValue({ totalOrders: 10 });

    const result = await controller.getStats(makeReq(), 'brand-1');

    expect(result).toEqual({ totalOrders: 10 });
    expect(mockService.getStats).toHaveBeenCalledWith(
      'token',
      'brand-1',
      false,
    );
  });

  it('getStats should throw when access token is missing', async () => {
    await expect(
      controller.getStats(makeReq({ accessToken: undefined }), 'brand-1'),
    ).rejects.toThrow('Missing access token');
  });

  it('getStats should throw when brandId is missing', async () => {
    await expect(controller.getStats(makeReq(), '')).rejects.toThrow(
      BadRequestException,
    );
  });
});
