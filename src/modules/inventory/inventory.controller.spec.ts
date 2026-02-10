import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CustomerGuard } from '../../common/guards/customer.guard';

describe('InventoryController', () => {
  let controller: InventoryController;

  const mockService = {
    getInventoryList: jest.fn(),
    getLowStockAlerts: jest.fn(),
    getInventoryLogs: jest.fn(),
    getInventoryByProduct: jest.fn(),
    updateInventory: jest.fn(),
    adjustInventory: jest.fn(),
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
      controllers: [InventoryController],
      providers: [
        { provide: InventoryService, useValue: mockService },
        { provide: AuthGuard, useValue: mockGuard },
        { provide: CustomerGuard, useValue: mockGuard },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockGuard)
      .overrideGuard(CustomerGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<InventoryController>(InventoryController);
    jest.clearAllMocks();
  });

  it('getInventoryList should call service and return result', async () => {
    mockService.getInventoryList.mockResolvedValue([{ id: 'inv-1' }]);

    const result = await controller.getInventoryList(makeReq(), 'branch-1');

    expect(result).toEqual([{ id: 'inv-1' }]);
    expect(mockService.getInventoryList).toHaveBeenCalledWith(
      'user-1',
      'branch-1',
      [],
      [],
    );
  });

  it('getInventoryList should throw when branchId is missing', async () => {
    await expect(
      controller.getInventoryList(makeReq(), ''),
    ).rejects.toThrow(BadRequestException);
  });

  it('getLowStockAlerts should call service and return result', async () => {
    mockService.getLowStockAlerts.mockResolvedValue([{ id: 'alert-1' }]);

    const result = await controller.getLowStockAlerts(makeReq(), 'branch-1');

    expect(result).toEqual([{ id: 'alert-1' }]);
    expect(mockService.getLowStockAlerts).toHaveBeenCalledWith(
      'user-1',
      'branch-1',
      [],
      [],
    );
  });

  it('getLowStockAlerts should throw when branchId is missing', async () => {
    await expect(
      controller.getLowStockAlerts(makeReq(), ''),
    ).rejects.toThrow(BadRequestException);
  });

  it('getInventoryLogs should call service and return result', async () => {
    mockService.getInventoryLogs.mockResolvedValue([{ id: 'log-1' }]);

    const result = await controller.getInventoryLogs(makeReq(), 'branch-1', 'prod-1');

    expect(result).toEqual([{ id: 'log-1' }]);
    expect(mockService.getInventoryLogs).toHaveBeenCalledWith(
      'user-1',
      'branch-1',
      'prod-1',
      [],
      [],
    );
  });

  it('getInventoryLogs should throw when user is missing', async () => {
    await expect(
      controller.getInventoryLogs(makeReq({ user: undefined }), 'branch-1', 'prod-1'),
    ).rejects.toThrow('Missing user');
  });

  it('getInventoryByProduct should call service and return result', async () => {
    mockService.getInventoryByProduct.mockResolvedValue({ id: 'inv-1' });

    const result = await controller.getInventoryByProduct(makeReq(), 'prod-1');

    expect(result).toEqual({ id: 'inv-1' });
    expect(mockService.getInventoryByProduct).toHaveBeenCalledWith(
      'user-1',
      'prod-1',
      [],
      [],
    );
  });

  it('getInventoryByProduct should throw when user is missing', async () => {
    await expect(
      controller.getInventoryByProduct(makeReq({ user: undefined }), 'prod-1'),
    ).rejects.toThrow('Missing user');
  });

  it('updateInventory should call service and return result', async () => {
    mockService.updateInventory.mockResolvedValue({ id: 'inv-1' });

    const dto = { qty: 10 } as any;
    const result = await controller.updateInventory(makeReq(), 'prod-1', dto);

    expect(result).toEqual({ id: 'inv-1' });
    expect(mockService.updateInventory).toHaveBeenCalledWith(
      'user-1',
      'prod-1',
      dto,
      [],
      [],
    );
  });

  it('updateInventory should throw when user is missing', async () => {
    await expect(
      controller.updateInventory(makeReq({ user: undefined }), 'prod-1', {} as any),
    ).rejects.toThrow('Missing user');
  });

  it('adjustInventory should call service and return result', async () => {
    mockService.adjustInventory.mockResolvedValue({ id: 'inv-1' });

    const dto = { change: 2 } as any;
    const result = await controller.adjustInventory(makeReq(), 'prod-1', dto);

    expect(result).toEqual({ id: 'inv-1' });
    expect(mockService.adjustInventory).toHaveBeenCalledWith(
      'user-1',
      'prod-1',
      dto,
      [],
      [],
    );
  });

  it('adjustInventory should throw when user is missing', async () => {
    await expect(
      controller.adjustInventory(makeReq({ user: undefined }), 'prod-1', {} as any),
    ).rejects.toThrow('Missing user');
  });

  it.each([
    {
      name: 'getInventoryList',
      setup: () => mockService.getInventoryList.mockResolvedValueOnce([{ id: 'inv-1' }]),
      call: () => controller.getInventoryList(makeReq({ brandMemberships: undefined, branchMemberships: undefined }), 'branch-1'),
      expectCall: () =>
        expect(mockService.getInventoryList).toHaveBeenCalledWith('user-1', 'branch-1', [], []),
    },
    {
      name: 'getLowStockAlerts',
      setup: () => mockService.getLowStockAlerts.mockResolvedValueOnce([{ id: 'alert-1' }]),
      call: () => controller.getLowStockAlerts(makeReq({ brandMemberships: undefined, branchMemberships: undefined }), 'branch-1'),
      expectCall: () =>
        expect(mockService.getLowStockAlerts).toHaveBeenCalledWith('user-1', 'branch-1', [], []),
    },
    {
      name: 'getInventoryLogs',
      setup: () => mockService.getInventoryLogs.mockResolvedValueOnce([{ id: 'log-1' }]),
      call: () => controller.getInventoryLogs(makeReq({ brandMemberships: undefined, branchMemberships: undefined }), 'branch-1', 'prod-1'),
      expectCall: () =>
        expect(mockService.getInventoryLogs).toHaveBeenCalledWith('user-1', 'branch-1', 'prod-1', [], []),
    },
    {
      name: 'getInventoryByProduct',
      setup: () => mockService.getInventoryByProduct.mockResolvedValueOnce({ id: 'inv-1' }),
      call: () => controller.getInventoryByProduct(makeReq({ brandMemberships: undefined, branchMemberships: undefined }), 'prod-1'),
      expectCall: () =>
        expect(mockService.getInventoryByProduct).toHaveBeenCalledWith('user-1', 'prod-1', [], []),
    },
    {
      name: 'updateInventory',
      setup: () => mockService.updateInventory.mockResolvedValueOnce({ id: 'inv-1' }),
      call: () => controller.updateInventory(makeReq({ brandMemberships: undefined, branchMemberships: undefined }), 'prod-1', { qty: 10 } as any),
      expectCall: () =>
        expect(mockService.updateInventory).toHaveBeenCalledWith('user-1', 'prod-1', { qty: 10 }, [], []),
    },
    {
      name: 'adjustInventory',
      setup: () => mockService.adjustInventory.mockResolvedValueOnce({ id: 'inv-1' }),
      call: () => controller.adjustInventory(makeReq({ brandMemberships: undefined, branchMemberships: undefined }), 'prod-1', { change: 2 } as any),
      expectCall: () =>
        expect(mockService.adjustInventory).toHaveBeenCalledWith('user-1', 'prod-1', { change: 2 }, [], []),
    },
  ])('should default memberships for $name', async ({ setup, call, expectCall }) => {
    setup();
    await call();
    expectCall();
  });
});
