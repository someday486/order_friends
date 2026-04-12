import { SettlementService } from './settlement.service';
import { BillingTier } from '../billing/billing.types';

describe('SettlementService', () => {
  let service: SettlementService;
  let adminClient: { from: jest.Mock };

  beforeEach(() => {
    adminClient = { from: jest.fn() };
    const supabase = {
      adminClient: jest.fn(() => adminClient),
    } as any;

    service = new SettlementService(supabase);
  });

  it('getPreviousMonthPeriod should resolve the prior calendar month', () => {
    const result = (service as any).getPreviousMonthPeriod(
      new Date('2026-04-13T12:00:00.000Z'),
    );

    expect(result).toEqual({
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
    });
  });

  it('resolveCommissionRate should prefer brand override', async () => {
    const rate = await (service as any).resolveCommissionRate(
      {
        id: 'brand-1',
        owner_user_id: 'owner-1',
        billing_tier: BillingTier.PG,
        commission_rate: 0.041,
      },
      1200000,
    );

    expect(rate).toBe(0.041);
  });

  it('calculateMonthlySettlements should process all PG brands', async () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    };
    chain.eq.mockReturnValueOnce(chain);
    chain.eq.mockResolvedValueOnce({
      data: [{ id: 'brand-1' }, { id: 'brand-2' }],
      error: null,
    });

    adminClient.from.mockReturnValue(chain);
    const spy = jest
      .spyOn(service, 'calculateSettlementForBrand')
      .mockResolvedValue({ id: 'period-1' } as any);

    await expect(
      service.calculateMonthlySettlements(new Date('2026-04-13T00:00:00.000Z')),
    ).resolves.toBe(2);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('getAccessibleBrand should allow active brand owner/admin membership', async () => {
    const membershipChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { role: 'OWNER' },
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
      billing_tier: BillingTier.PG,
      commission_rate: null,
    });

    await expect(
      (service as any).getAccessibleBrand('brand-admin', 'brand-1', false),
    ).resolves.toEqual({
      id: 'brand-1',
      owner_user_id: 'owner-1',
      billing_tier: BillingTier.PG,
      commission_rate: null,
    });
  });
});
