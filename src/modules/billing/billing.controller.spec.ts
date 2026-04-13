import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import {
  BillingAdminController,
  BillingController,
} from './billing.controller';
import { BillingService } from './billing.service';

describe('BillingController', () => {
  const mockService = {
    issueBillingKey: jest.fn(),
    replaceBillingKey: jest.fn(),
    deleteBillingKey: jest.fn(),
    getSubscription: jest.fn(),
    getBillingRecords: jest.fn(),
    getBillingSummary: jest.fn(),
    cancelSubscription: jest.fn(),
    changePlan: jest.fn(),
    retryBilling: jest.fn(),
    listSubscriptions: jest.fn(),
    getAdminSubscription: jest.fn(),
    updateSubscriptionStatus: jest.fn(),
    extendSubscription: jest.fn(),
    listAllBillingRecords: jest.fn(),
  };
  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('BillingController', () => {
    let controller: BillingController;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [BillingController],
        providers: [
          { provide: BillingService, useValue: mockService },
          { provide: AuthGuard, useValue: mockGuard },
        ],
      })
        .overrideGuard(AuthGuard)
        .useValue(mockGuard)
        .compile();

      controller = module.get(BillingController);
    });

    it('issueBillingKey should delegate to service', async () => {
      mockService.issueBillingKey.mockResolvedValue({ billingTier: 'NON_PG' });

      const req = { user: { id: 'user-1' }, isAdmin: false } as any;
      const dto = { brandId: 'brand-1', authKey: 'auth', customerKey: 'ck' };

      await expect(
        controller.issueBillingKey(req, dto as any),
      ).resolves.toEqual({ billingTier: 'NON_PG' });
      expect(mockService.issueBillingKey).toHaveBeenCalledWith(
        'user-1',
        dto,
        false,
      );
    });

    it('getBillingRecords should delegate to service', async () => {
      mockService.getBillingRecords.mockResolvedValue([{ id: 'record-1' }]);

      const req = { user: { id: 'user-1' }, isAdmin: false } as any;
      const query = { brandId: 'brand-1', page: 1, limit: 20 };

      await expect(
        controller.getBillingRecords(req, query as any),
      ).resolves.toEqual([{ id: 'record-1' }]);
      expect(mockService.getBillingRecords).toHaveBeenCalledWith(
        'user-1',
        query,
        false,
      );
    });

    it('cancelSubscription should delegate to service', async () => {
      mockService.cancelSubscription.mockResolvedValue({ status: 'CANCELLED' });

      const req = { user: { id: 'user-1' }, isAdmin: true } as any;
      const dto = { brandId: 'brand-1' };

      await expect(
        controller.cancelSubscription(req, dto as any),
      ).resolves.toEqual({ status: 'CANCELLED' });
      expect(mockService.cancelSubscription).toHaveBeenCalledWith(
        'user-1',
        dto,
        true,
      );
    });

    it('changePlan should delegate to service', async () => {
      mockService.changePlan.mockResolvedValue({
        effectiveDate: '2026-04-14T00:00:00.000Z',
        newPlan: {
          id: 'plan-2',
          name: 'Growth',
          price: 99000,
          isCurrent: false,
        },
      });

      const req = { user: { id: 'user-1' }, isAdmin: false } as any;
      const dto = { brandId: 'brand-1', planId: 'plan-2' };

      await expect(controller.changePlan(req, dto as any)).resolves.toEqual({
        effectiveDate: '2026-04-14T00:00:00.000Z',
        newPlan: {
          id: 'plan-2',
          name: 'Growth',
          price: 99000,
          isCurrent: false,
        },
      });
      expect(mockService.changePlan).toHaveBeenCalledWith('user-1', dto, false);
    });
  });

  describe('BillingAdminController', () => {
    let controller: BillingAdminController;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [BillingAdminController],
        providers: [
          { provide: BillingService, useValue: mockService },
          { provide: AuthGuard, useValue: mockGuard },
          { provide: AdminGuard, useValue: mockGuard },
        ],
      })
        .overrideGuard(AuthGuard)
        .useValue(mockGuard)
        .overrideGuard(AdminGuard)
        .useValue(mockGuard)
        .compile();

      controller = module.get(BillingAdminController);
    });

    it('retryBilling should delegate to service', async () => {
      mockService.retryBilling.mockResolvedValue({ success: true });

      const dto = { brandId: 'brand-1' };
      await expect(controller.retryBilling(dto as any)).resolves.toEqual({
        success: true,
      });
      expect(mockService.retryBilling).toHaveBeenCalledWith(dto);
    });

    it('listSubscriptions should delegate to service', async () => {
      mockService.listSubscriptions.mockResolvedValue([{ id: 'sub-1' }]);

      const query = { status: 'ACTIVE', page: 1, limit: 20 };
      await expect(controller.listSubscriptions(query as any)).resolves.toEqual(
        [{ id: 'sub-1' }],
      );
      expect(mockService.listSubscriptions).toHaveBeenCalledWith(query);
    });

    it('getRecords should delegate to service', async () => {
      mockService.listAllBillingRecords.mockResolvedValue([{ id: 'record-1' }]);

      const query = { status: 'FAILED', page: 1, limit: 20 };
      await expect(controller.getRecords(query as any)).resolves.toEqual([
        { id: 'record-1' },
      ]);
      expect(mockService.listAllBillingRecords).toHaveBeenCalledWith(query);
    });
  });
});
