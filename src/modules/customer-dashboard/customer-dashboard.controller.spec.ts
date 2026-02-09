import { Test, TestingModule } from '@nestjs/testing';
import { CustomerDashboardController } from './customer-dashboard.controller';
import { CustomerDashboardService } from './customer-dashboard.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CustomerGuard } from '../../common/guards/customer.guard';

describe('CustomerDashboardController', () => {
  let controller: CustomerDashboardController;

  const mockService = {
    getDashboardStats: jest.fn(),
  };
  const mockGuard = { canActivate: jest.fn(() => true) };

  const makeReq = (overrides: Record<string, any> = {}) =>
    ({
      accessToken: 'token',
      user: { id: 'user-1' },
      brandMemberships: [],
      branchMemberships: [],
      ...overrides,
    }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerDashboardController],
      providers: [
        { provide: CustomerDashboardService, useValue: mockService },
        { provide: AuthGuard, useValue: mockGuard },
        { provide: CustomerGuard, useValue: mockGuard },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockGuard)
      .overrideGuard(CustomerGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<CustomerDashboardController>(CustomerDashboardController);
    jest.clearAllMocks();
  });

  it('getDashboardStats should call service and return result', async () => {
    mockService.getDashboardStats.mockResolvedValue({ totalSales: 1000 });

    const result = await controller.getDashboardStats(makeReq());

    expect(result).toEqual({ totalSales: 1000 });
    expect(mockService.getDashboardStats).toHaveBeenCalledWith('user-1', [], []);
  });

  it('getDashboardStats should throw when access token is missing', async () => {
    await expect(
      controller.getDashboardStats(makeReq({ accessToken: undefined })),
    ).rejects.toThrow('Missing access token');
  });

  it('getDashboardStats should throw when user is missing', async () => {
    await expect(
      controller.getDashboardStats(makeReq({ user: undefined })),
    ).rejects.toThrow('Missing user');
  });
});
