import { StampsService } from './stamps.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';

describe('StampsService', () => {
  let service: StampsService;
  let mockSb: any;

  const makeSupabase = () => {
    mockSb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
    };

    return {
      adminClient: jest.fn(() => mockSb),
    };
  };

  beforeEach(() => {
    const supabase = makeSupabase();
    service = new StampsService(supabase as SupabaseService);
    jest.clearAllMocks();
  });

  it('allows branch admins to manage stamp config', async () => {
    await expect(
      service.canManageConfig(
        'branch-1',
        [],
        [{ branch_id: 'branch-1', role: 'BRANCH_ADMIN', status: 'ACTIVE' }],
      ),
    ).resolves.toBe(true);

    expect(mockSb.from).not.toHaveBeenCalled();
  });

  it('allows brand owners to manage stamp config for their branch', async () => {
    mockSb.maybeSingle.mockResolvedValue({
      data: { brand_id: 'brand-1' },
      error: null,
    });

    await expect(
      service.canManageConfig(
        'branch-1',
        [{ brand_id: 'brand-1', role: 'OWNER', status: 'ACTIVE' }],
        [],
      ),
    ).resolves.toBe(true);

    expect(mockSb.from).toHaveBeenCalledWith('branches');
    expect(mockSb.select).toHaveBeenCalledWith('brand_id');
    expect(mockSb.eq).toHaveBeenCalledWith('id', 'branch-1');
  });

  it('rejects non-manage memberships even when branch belongs to their brand', async () => {
    mockSb.maybeSingle.mockResolvedValue({
      data: { brand_id: 'brand-1' },
      error: null,
    });

    await expect(
      service.canManageConfig(
        'branch-1',
        [{ brand_id: 'brand-1', role: 'MEMBER', status: 'ACTIVE' }],
        [{ branch_id: 'branch-1', role: 'STAFF', status: 'ACTIVE' }],
      ),
    ).resolves.toBe(false);
  });
});
