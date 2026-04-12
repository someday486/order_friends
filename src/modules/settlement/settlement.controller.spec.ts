import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import {
  SettlementAdminController,
  SettlementController,
} from './settlement.controller';
import { SettlementService } from './settlement.service';

describe('SettlementController', () => {
  const mockService = {
    getPeriods: jest.fn(),
    getPeriodDetail: jest.fn(),
    getSummary: jest.fn(),
    listAdminPeriods: jest.fn(),
    getAdminPeriodDetail: jest.fn(),
    settlePeriod: jest.fn(),
    triggerCalculation: jest.fn(),
    listCommissionTiers: jest.fn(),
    createCommissionTier: jest.fn(),
    updateCommissionTier: jest.fn(),
    deleteCommissionTier: jest.fn(),
  };
  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SettlementController', () => {
    let controller: SettlementController;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [SettlementController],
        providers: [
          { provide: SettlementService, useValue: mockService },
          { provide: AuthGuard, useValue: mockGuard },
        ],
      })
        .overrideGuard(AuthGuard)
        .useValue(mockGuard)
        .compile();

      controller = module.get(SettlementController);
    });

    it('getPeriods should delegate to service', async () => {
      mockService.getPeriods.mockResolvedValue([{ id: 'period-1' }]);

      const req = { user: { id: 'owner-1' }, isAdmin: false } as any;
      const query = { brandId: 'brand-1', page: 1, limit: 12 };

      await expect(controller.getPeriods(req, query as any)).resolves.toEqual([
        { id: 'period-1' },
      ]);
      expect(mockService.getPeriods).toHaveBeenCalledWith(
        'owner-1',
        query,
        false,
      );
    });

    it('getPeriodDetail should delegate to service', async () => {
      mockService.getPeriodDetail.mockResolvedValue({ id: 'period-1' });

      const req = { user: { id: 'owner-1' }, isAdmin: true } as any;
      await expect(
        controller.getPeriodDetail(req, 'period-1', 'brand-1'),
      ).resolves.toEqual({ id: 'period-1' });
      expect(mockService.getPeriodDetail).toHaveBeenCalledWith(
        'owner-1',
        'period-1',
        'brand-1',
        true,
      );
    });
  });

  describe('SettlementAdminController', () => {
    let controller: SettlementAdminController;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [SettlementAdminController],
        providers: [
          { provide: SettlementService, useValue: mockService },
          { provide: AuthGuard, useValue: mockGuard },
          { provide: AdminGuard, useValue: mockGuard },
        ],
      })
        .overrideGuard(AuthGuard)
        .useValue(mockGuard)
        .overrideGuard(AdminGuard)
        .useValue(mockGuard)
        .compile();

      controller = module.get(SettlementAdminController);
    });

    it('settlePeriod should delegate to service', async () => {
      mockService.settlePeriod.mockResolvedValue({ id: 'period-1' });

      const dto = { note: 'done' };
      await expect(
        controller.settlePeriod('period-1', dto as any),
      ).resolves.toEqual({ id: 'period-1' });
      expect(mockService.settlePeriod).toHaveBeenCalledWith('period-1', dto);
    });

    it('triggerCalculation should delegate to service', async () => {
      mockService.triggerCalculation.mockResolvedValue({ processed: 2 });

      const dto = { targetDate: '2026-04-13' };
      await expect(controller.triggerCalculation(dto as any)).resolves.toEqual({
        processed: 2,
      });
      expect(mockService.triggerCalculation).toHaveBeenCalledWith(dto);
    });

    it('commission tier CRUD should delegate to service', async () => {
      mockService.listCommissionTiers.mockResolvedValue([{ id: 'tier-1' }]);
      mockService.createCommissionTier.mockResolvedValue({ id: 'tier-2' });
      mockService.updateCommissionTier.mockResolvedValue({ id: 'tier-3' });
      mockService.deleteCommissionTier.mockResolvedValue({ success: true });

      const dto = {
        name: 'Starter',
        minMonthlySales: 0,
        commissionRate: 0.05,
      };

      await expect(controller.listCommissionTiers()).resolves.toEqual([
        { id: 'tier-1' },
      ]);
      await expect(
        controller.createCommissionTier(dto as any),
      ).resolves.toEqual({ id: 'tier-2' });
      await expect(
        controller.updateCommissionTier('tier-3', dto as any),
      ).resolves.toEqual({ id: 'tier-3' });
      await expect(controller.deleteCommissionTier('tier-3')).resolves.toEqual({
        success: true,
      });
    });
  });
});
