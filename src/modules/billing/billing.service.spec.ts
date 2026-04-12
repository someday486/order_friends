import { ConfigService } from '@nestjs/config';
import { BillingTier } from './billing.types';
import { BillingService } from './billing.service';
import { BillingRecordStatus } from './billing.types';

describe('BillingService', () => {
  let service: BillingService;
  let adminClient: { from: jest.Mock };

  beforeEach(() => {
    adminClient = { from: jest.fn() };
    const supabase = {
      adminClient: jest.fn(() => adminClient),
    } as any;
    const config = {
      get: jest.fn((key: string) => {
        switch (key) {
          case 'TOSS_API_BASE_URL':
            return 'https://api.tosspayments.com/v1';
          case 'TOSS_TIMEOUT_MS':
            return 15000;
          default:
            return '';
        }
      }),
    } as unknown as ConfigService;

    service = new BillingService(supabase, config);
  });

  it('resolveRetrySchedule should use the configured retry cadence', () => {
    const now = new Date('2026-04-13T00:00:00.000Z');
    const next = (service as any).resolveRetrySchedule(1, now) as Date;

    expect(next.toISOString()).toBe('2026-04-15T00:00:00.000Z');
  });

  it('toBillingRecordResponse should map snake_case fields', () => {
    const result = (service as any).toBillingRecordResponse({
      id: 'record-1',
      brand_id: 'brand-1',
      subscription_id: 'sub-1',
      amount: 39000,
      status: BillingRecordStatus.SUCCESS,
      provider: 'TOSS',
      provider_payment_key: 'pay_123',
      billing_period_start: '2026-04-01T00:00:00.000Z',
      billing_period_end: '2026-05-01T00:00:00.000Z',
      attempted_at: '2026-04-01T00:00:00.000Z',
      paid_at: '2026-04-01T00:01:00.000Z',
      failure_reason: null,
      retry_count: 0,
      created_at: '2026-04-01T00:00:00.000Z',
    });

    expect(result).toEqual({
      id: 'record-1',
      brandId: 'brand-1',
      subscriptionId: 'sub-1',
      amount: 39000,
      status: BillingRecordStatus.SUCCESS,
      provider: 'TOSS',
      providerPaymentKey: 'pay_123',
      billingPeriodStart: '2026-04-01T00:00:00.000Z',
      billingPeriodEnd: '2026-05-01T00:00:00.000Z',
      attemptedAt: '2026-04-01T00:00:00.000Z',
      paidAt: '2026-04-01T00:01:00.000Z',
      failureReason: null,
      retryCount: 0,
      createdAt: '2026-04-01T00:00:00.000Z',
    });
  });

  it('processDueSubscriptions should continue when one subscription fails', async () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      lte: jest.fn().mockResolvedValue({
        data: [{ id: 'sub-1' }, { id: 'sub-2' }],
        error: null,
      }),
    };
    adminClient.from.mockReturnValue(chain);

    const spy = jest
      .spyOn(service, 'processSubscriptionBilling')
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);

    await expect(service.processDueSubscriptions(new Date())).resolves.toBe(1);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('getAccessibleBrand should allow active brand admin membership', async () => {
    const membershipChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { role: 'ADMIN' },
        error: null,
      }),
    };
    adminClient.from.mockImplementation((table: string) => {
      if (table === 'brand_members') {
        return membershipChain;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    jest.spyOn(service as any, 'getBrandOrThrow').mockResolvedValue({
      id: 'brand-1',
      owner_user_id: 'owner-1',
      billing_tier: BillingTier.NON_PG,
    });

    await expect(
      (service as any).getAccessibleBrand('admin-user', 'brand-1', false),
    ).resolves.toEqual({
      id: 'brand-1',
      owner_user_id: 'owner-1',
      billing_tier: BillingTier.NON_PG,
    });
  });
});
