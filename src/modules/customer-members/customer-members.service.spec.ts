import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CustomerMembersService } from './customer-members.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';

describe('CustomerMembersService', () => {
  let service: CustomerMembersService;
  let supabase: { adminClient: jest.Mock };
  let adminAuth: any;
  let brandMembersBuilder: any;
  let branchMembersBuilder: any;
  let branchesBuilder: any;
  let memberActivityLogsBuilder: any;

  beforeEach(() => {
    adminAuth = {
      listUsers: jest.fn().mockResolvedValue({
        data: { users: [] },
        error: null,
      }),
      inviteUserByEmail: jest.fn().mockResolvedValue({
        data: {
          user: { id: 'invited-user', email: 'invite@example.com' },
        },
        error: null,
      }),
    };

    brandMembersBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      single: jest.fn(),
      order: jest.fn(),
    };

    branchMembersBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      single: jest.fn(),
      order: jest.fn(),
    };

    branchesBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    memberActivityLogsBuilder = {
      insert: jest.fn().mockResolvedValue({ error: null }),
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      eq: jest.fn(),
    };
    memberActivityLogsBuilder.eq.mockImplementation(
      () => memberActivityLogsBuilder,
    );

    supabase = {
      adminClient: jest.fn(() => ({
        from: jest.fn((table: string) => {
          if (table === 'brand_members') return brandMembersBuilder;
          if (table === 'branch_members') return branchMembersBuilder;
          if (table === 'branches') return branchesBuilder;
          if (table === 'customer_member_activity_logs') {
            return memberActivityLogsBuilder;
          }
          if (table === 'profiles') {
            return {
              select: jest.fn().mockReturnValue({
                in: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
        auth: { admin: adminAuth },
      })),
    };

    service = new CustomerMembersService(
      supabase as unknown as SupabaseService,
    );
  });

  it('inviteBrandMember should invite and insert invited membership', async () => {
    brandMembersBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    brandMembersBuilder.single.mockResolvedValueOnce({
      data: {
        user_id: 'invited-user',
        role: 'MEMBER',
        status: 'INVITED',
        created_at: '2026-03-12T16:00:00.000Z',
      },
      error: null,
    });

    const result = await service.inviteBrandMember(
      'owner-user',
      'brand-1',
      { email: 'invite@example.com', role: 'MEMBER' as any },
      [{ brand_id: 'brand-1', role: 'OWNER', status: 'ACTIVE' }],
    );

    expect(adminAuth.inviteUserByEmail).toHaveBeenCalledWith(
      'invite@example.com',
    );
    expect(brandMembersBuilder.insert).toHaveBeenCalledWith({
      brand_id: 'brand-1',
      user_id: 'invited-user',
      role: 'MEMBER',
      status: 'INVITED',
    });
    expect(memberActivityLogsBuilder.insert).toHaveBeenCalledWith({
      action_type: 'INVITE_SENT',
      scope_type: 'BRAND',
      brand_id: 'brand-1',
      branch_id: null,
      actor_user_id: 'owner-user',
      target_user_id: 'invited-user',
      target_email: 'invite@example.com',
      before_role: null,
      after_role: 'MEMBER',
      before_status: null,
      after_status: 'INVITED',
    });
    expect(result).toMatchObject({
      userId: 'invited-user',
      email: 'invite@example.com',
      status: 'INVITED',
    });
  });

  it('inviteBrandMember should reject users without brand access', async () => {
    await expect(
      service.inviteBrandMember(
        'staff-user',
        'brand-1',
        { email: 'invite@example.com', role: 'MEMBER' as any },
        [{ brand_id: 'brand-1', role: 'MEMBER', status: 'ACTIVE' }],
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('inviteBrandMember should reject duplicate memberships', async () => {
    adminAuth.listUsers.mockResolvedValueOnce({
      data: {
        users: [{ id: 'existing-user', email: 'invite@example.com' }],
      },
      error: null,
    });
    brandMembersBuilder.maybeSingle.mockResolvedValueOnce({
      data: { user_id: 'existing-user' },
      error: null,
    });

    await expect(
      service.inviteBrandMember(
        'owner-user',
        'brand-1',
        { email: 'invite@example.com', role: 'MEMBER' as any },
        [{ brand_id: 'brand-1', role: 'OWNER', status: 'ACTIVE' }],
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('inviteBranchMember should invite and insert invited membership', async () => {
    branchesBuilder.single.mockResolvedValueOnce({
      data: { id: 'branch-1', brand_id: 'brand-1' },
      error: null,
    });
    branchMembersBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    branchMembersBuilder.single.mockResolvedValueOnce({
      data: {
        user_id: 'invited-user',
        role: 'STAFF',
        status: 'INVITED',
        created_at: '2026-03-12T16:00:00.000Z',
      },
      error: null,
    });

    const result = await service.inviteBranchMember(
      'manager-user',
      'branch-1',
      { email: 'invite@example.com', role: 'STAFF' as any },
      [],
      [{ branch_id: 'branch-1', role: 'BRANCH_ADMIN', status: 'ACTIVE' }],
    );

    expect(branchMembersBuilder.insert).toHaveBeenCalledWith({
      branch_id: 'branch-1',
      user_id: 'invited-user',
      role: 'STAFF',
      status: 'INVITED',
    });
    expect(memberActivityLogsBuilder.insert).toHaveBeenCalledWith({
      action_type: 'INVITE_SENT',
      scope_type: 'BRANCH',
      brand_id: 'brand-1',
      branch_id: 'branch-1',
      actor_user_id: 'manager-user',
      target_user_id: 'invited-user',
      target_email: 'invite@example.com',
      before_role: null,
      after_role: 'STAFF',
      before_status: null,
      after_status: 'INVITED',
    });
    expect(result).toMatchObject({
      branchId: 'branch-1',
      email: 'invite@example.com',
      status: 'INVITED',
    });
  });

  it('inviteBranchMember should reject users without branch access', async () => {
    branchesBuilder.single.mockResolvedValueOnce({
      data: { id: 'branch-1', brand_id: 'brand-1' },
      error: null,
    });

    await expect(
      service.inviteBranchMember(
        'staff-user',
        'branch-1',
        { email: 'invite@example.com', role: 'STAFF' as any },
        [],
        [{ branch_id: 'branch-1', role: 'STAFF', status: 'ACTIVE' }],
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('updateBrandMember should update brand role', async () => {
    brandMembersBuilder.maybeSingle
      .mockResolvedValueOnce({
        data: {
          user_id: 'target-user',
          role: 'MEMBER',
          status: 'ACTIVE',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          user_id: 'target-user',
          role: 'ADMIN',
          status: 'ACTIVE',
          created_at: '2026-03-12T16:00:00.000Z',
        },
        error: null,
      });
    brandMembersBuilder.update = jest.fn().mockReturnThis();

    const result = await service.updateBrandMember(
      'owner-user',
      'brand-1',
      'target-user',
      { role: 'ADMIN' as any },
      [{ brand_id: 'brand-1', role: 'OWNER', status: 'ACTIVE' }],
    );

    expect(brandMembersBuilder.update).toHaveBeenCalledWith({ role: 'ADMIN' });
    expect(memberActivityLogsBuilder.insert).toHaveBeenCalledWith({
      action_type: 'ROLE_CHANGED',
      scope_type: 'BRAND',
      brand_id: 'brand-1',
      branch_id: null,
      actor_user_id: 'owner-user',
      target_user_id: 'target-user',
      target_email: null,
      before_role: 'MEMBER',
      after_role: 'ADMIN',
      before_status: 'ACTIVE',
      after_status: 'ACTIVE',
    });
    expect(result.role).toBe('ADMIN');
  });

  it('updateBrandMember should return bad request for duplicate active owner', async () => {
    brandMembersBuilder.maybeSingle.mockResolvedValueOnce({
      data: {
        user_id: 'target-user',
        role: 'MEMBER',
        status: 'ACTIVE',
      },
      error: null,
    });
    brandMembersBuilder.update = jest.fn().mockReturnThis();
    brandMembersBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: {
        message:
          'duplicate key value violates unique constraint "brand_members_one_active_owner_per_brand"',
      },
    });

    await expect(
      service.updateBrandMember(
        'owner-user',
        'brand-1',
        'target-user',
        { role: 'OWNER' as any },
        [{ brand_id: 'brand-1', role: 'OWNER', status: 'ACTIVE' }],
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('updateBranchMember should update branch role', async () => {
    branchesBuilder.single.mockResolvedValueOnce({
      data: { id: 'branch-1', brand_id: 'brand-1' },
      error: null,
    });
    branchMembersBuilder.update = jest.fn().mockReturnThis();
    branchMembersBuilder.maybeSingle
      .mockResolvedValueOnce({
        data: {
          user_id: 'target-user',
          role: 'STAFF',
          status: 'ACTIVE',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          user_id: 'target-user',
          role: 'BRANCH_ADMIN',
          status: 'ACTIVE',
          created_at: '2026-03-12T16:00:00.000Z',
        },
        error: null,
      });

    const result = await service.updateBranchMember(
      'manager-user',
      'branch-1',
      'target-user',
      { role: 'BRANCH_ADMIN' as any },
      [],
      [{ branch_id: 'branch-1', role: 'BRANCH_ADMIN', status: 'ACTIVE' }],
    );

    expect(branchMembersBuilder.update).toHaveBeenCalledWith({
      role: 'BRANCH_ADMIN',
    });
    expect(memberActivityLogsBuilder.insert).toHaveBeenCalledWith({
      action_type: 'ROLE_CHANGED',
      scope_type: 'BRANCH',
      brand_id: 'brand-1',
      branch_id: 'branch-1',
      actor_user_id: 'manager-user',
      target_user_id: 'target-user',
      target_email: null,
      before_role: 'STAFF',
      after_role: 'BRANCH_ADMIN',
      before_status: 'ACTIVE',
      after_status: 'ACTIVE',
    });
    expect(result.role).toBe('BRANCH_ADMIN');
  });

  it('getBrandMemberHistory should return recent history rows', async () => {
    memberActivityLogsBuilder.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'log-1',
          action_type: 'INVITE_SENT',
          scope_type: 'BRAND',
          brand_id: 'brand-1',
          branch_id: null,
          actor_user_id: 'owner-user',
          target_user_id: 'invited-user',
          target_email: 'invite@example.com',
          before_role: null,
          after_role: 'MEMBER',
          before_status: null,
          after_status: 'INVITED',
          created_at: '2026-03-13T09:00:00.000Z',
        },
      ],
      error: null,
    });
    adminAuth.listUsers.mockResolvedValueOnce({
      data: {
        users: [
          { id: 'owner-user', email: 'owner@example.com' },
          { id: 'invited-user', email: 'invite@example.com' },
        ],
      },
      error: null,
    });

    const result = await service.getBrandMemberHistory(
      'owner-user',
      'brand-1',
      [{ brand_id: 'brand-1', role: 'OWNER', status: 'ACTIVE' }],
    );

    expect(memberActivityLogsBuilder.eq).toHaveBeenCalledWith(
      'brand_id',
      'brand-1',
    );
    expect(result[0]).toMatchObject({
      id: 'log-1',
      actionType: 'INVITE_SENT',
      brandId: 'brand-1',
      actorEmail: 'owner@example.com',
      targetEmail: 'invite@example.com',
    });
  });
});
