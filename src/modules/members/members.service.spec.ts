import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MembersService } from './members.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';

describe('MembersService', () => {
  let service: MembersService;
  let mockSb: any;
  let supabase: any;

  const makeSupabase = () => {
    mockSb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    };
    const adminClient = {
      ...mockSb,
      auth: {
        admin: {
          listUsers: jest.fn().mockResolvedValue({
            data: { users: [] },
            error: null,
          }),
          getUserById: jest.fn().mockResolvedValue({
            data: {
              user: {
                id: 'user-1',
                user_metadata: {},
                email_confirmed_at: '2026-03-09T08:10:00.000Z',
              },
            },
            error: null,
          }),
          updateUserById: jest.fn().mockResolvedValue({
            data: { user: { id: 'user-1', user_metadata: {} } },
            error: null,
          }),
        },
      },
    };
    return {
      adminClient: jest.fn(() => adminClient),
      userClient: jest.fn(() => mockSb),
    };
  };

  beforeEach(() => {
    supabase = makeSupabase();
    service = new MembersService(supabase as SupabaseService);
    jest.clearAllMocks();
  });

  it('getPendingApprovalUsers should list non-member users sorted by newest first', async () => {
    const listUsers = jest.fn().mockResolvedValue({
      data: {
        users: [
          {
            id: 'pending-1',
            email: 'pending1@example.com',
            created_at: '2026-03-09T08:00:00.000Z',
            email_confirmed_at: '2026-03-09T08:10:00.000Z',
            user_metadata: { name: 'Pending One' },
          },
          {
            id: 'existing-member',
            email: 'member@example.com',
            created_at: '2026-03-08T08:00:00.000Z',
            email_confirmed_at: '2026-03-08T08:10:00.000Z',
            user_metadata: {},
          },
          {
            id: 'current-admin',
            email: 'admin@example.com',
            created_at: '2026-03-07T08:00:00.000Z',
            email_confirmed_at: '2026-03-07T08:10:00.000Z',
            user_metadata: {},
          },
          {
            id: 'system-admin',
            email: 'system@example.com',
            created_at: '2026-03-06T08:00:00.000Z',
            email_confirmed_at: '2026-03-06T08:10:00.000Z',
            user_metadata: {},
          },
          {
            id: 'pending-2',
            email: 'pending2@example.com',
            created_at: '2026-03-05T08:00:00.000Z',
            email_confirmed_at: null,
            user_metadata: { full_name: 'Pending Two' },
          },
          {
            id: 'approved-brand-creator',
            email: 'approved@example.com',
            created_at: '2026-03-04T08:00:00.000Z',
            email_confirmed_at: '2026-03-04T08:10:00.000Z',
            user_metadata: { customer_brand_creator_approved: true },
          },
        ],
      },
      error: null,
    });

    const adminClient = {
      from: jest.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'pending-1',
                  display_name: '프로필 이름',
                  created_at: '2026-03-01T00:00:00.000Z',
                  is_system_admin: false,
                },
                {
                  id: 'pending-2',
                  display_name: null,
                  created_at: '2026-03-02T00:00:00.000Z',
                  is_system_admin: false,
                },
                {
                  id: 'system-admin',
                  display_name: 'System Admin',
                  created_at: '2026-03-03T00:00:00.000Z',
                  is_system_admin: true,
                },
              ],
              error: null,
            }),
          };
        }

        if (table === 'brand_members') {
          return {
            select: jest.fn().mockResolvedValue({
              data: [{ user_id: 'existing-member', status: 'ACTIVE' }],
              error: null,
            }),
          };
        }

        if (table === 'branch_members') {
          return {
            select: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      auth: {
        admin: {
          listUsers,
        },
      },
    };

    supabase.adminClient.mockReturnValue(adminClient);

    const result = await service.getPendingApprovalUsers('current-admin');

    expect(result).toHaveLength(2);
    expect(result.map((user) => user.id)).toEqual(['pending-1', 'pending-2']);
    expect(result[0]).toMatchObject({
      email: 'pending1@example.com',
      displayName: '프로필 이름',
      isEmailConfirmed: true,
    });
    expect(result[1]).toMatchObject({
      email: 'pending2@example.com',
      displayName: 'Pending Two',
      isEmailConfirmed: false,
    });
    expect(listUsers).toHaveBeenCalledWith({ page: 1, perPage: 200 });
  });

  it('approveBrandCreator should set onboarding approval metadata', async () => {
    const result = await service.approveBrandCreator('user-2');

    expect(result).toEqual({ approved: true });
    expect(
      supabase.adminClient().auth.admin.updateUserById,
    ).toHaveBeenCalledWith('user-2', {
      user_metadata: { customer_brand_creator_approved: true },
    });
  });

  it('getPendingApprovalUsers should throw when auth user lookup fails', async () => {
    const adminClient = {
      from: jest.fn((table: string) => ({
        select: jest.fn().mockResolvedValue({
          data: table === 'profiles' ? [] : [],
          error: null,
        }),
      })),
      auth: {
        admin: {
          listUsers: jest.fn().mockResolvedValue({
            data: { users: [] },
            error: { message: 'auth fail' },
          }),
        },
      },
    };

    supabase.adminClient.mockReturnValue(adminClient);

    await expect(
      service.getPendingApprovalUsers('current-admin'),
    ).rejects.toThrow('[members.getPendingApprovalUsers] auth fail');
  });

  it('updateMemberProfile should upsert display name', async () => {
    mockSb.single.mockResolvedValueOnce({
      data: { id: 'user-1', display_name: 'Edited User' },
      error: null,
    });

    const result = await service.updateMemberProfile(
      'token',
      'user-1',
      { displayName: '  Edited User  ' },
      true,
    );

    expect(result).toEqual({ id: 'user-1', displayName: 'Edited User' });
    expect(mockSb.upsert).toHaveBeenCalledWith(
      { id: 'user-1', display_name: 'Edited User' },
      { onConflict: 'id' },
    );
    expect(
      supabase.adminClient().auth.admin.updateUserById,
    ).toHaveBeenCalledWith('user-1', {
      user_metadata: { display_name: 'Edited User' },
    });
  });

  it('updateMemberProfile should store null when display name is blank', async () => {
    mockSb.single.mockResolvedValueOnce({
      data: { id: 'user-1', display_name: null },
      error: null,
    });

    const result = await service.updateMemberProfile(
      'token',
      'user-1',
      { displayName: '   ' },
      true,
    );

    expect(result).toEqual({ id: 'user-1', displayName: null });
    expect(mockSb.upsert).toHaveBeenCalledWith(
      { id: 'user-1', display_name: null },
      { onConflict: 'id' },
    );
    expect(
      supabase.adminClient().auth.admin.updateUserById,
    ).toHaveBeenCalledWith('user-1', {
      user_metadata: { display_name: null },
    });
  });

  it('updateMemberProfile should throw on error', async () => {
    mockSb.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(
      service.updateMemberProfile(
        'token',
        'user-1',
        { displayName: 'Edited User' },
        true,
      ),
    ).rejects.toThrow('[members.updateMemberProfile] fail');
  });

  it('transferMember should move a brand member into a branch membership', async () => {
    mockSb.maybeSingle
      .mockResolvedValueOnce({ data: { user_id: 'u1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    const addBranchMemberSpy = jest
      .spyOn(service, 'addBranchMember')
      .mockResolvedValue({
        id: 'branch-u1',
        branchId: 'branch-1',
        userId: 'u1',
        role: 'BRANCH_ADMIN' as any,
        status: 'ACTIVE' as any,
        createdAt: 't',
      });
    const removeBrandMemberSpy = jest
      .spyOn(service, 'removeBrandMember')
      .mockResolvedValue({ deleted: true });

    const result = await service.transferMember(
      'token',
      {
        userId: 'u1',
        sourceType: 'brand' as any,
        sourceId: 'brand-1',
        targetType: 'branch' as any,
        targetId: 'branch-1',
        branchRole: 'BRANCH_ADMIN' as any,
      },
      true,
    );

    expect(addBranchMemberSpy).toHaveBeenCalledWith(
      'token',
      {
        branchId: 'branch-1',
        userId: 'u1',
        role: 'BRANCH_ADMIN',
      },
      true,
    );
    expect(removeBrandMemberSpy).toHaveBeenCalledWith(
      'token',
      'brand-1',
      'u1',
      true,
    );
    expect(result).toMatchObject({
      transferred: true,
      sourceType: 'brand',
      targetType: 'branch',
    });
  });

  it('transferMember should promote an existing branch member into a brand membership', async () => {
    mockSb.maybeSingle
      .mockResolvedValueOnce({ data: { user_id: 'u1' }, error: null })
      .mockResolvedValueOnce({ data: { user_id: 'u1' }, error: null });

    const updateBrandMemberSpy = jest
      .spyOn(service, 'updateBrandMember')
      .mockResolvedValue({
        id: 'brand-u1',
        brandId: 'brand-2',
        userId: 'u1',
        role: 'OWNER' as any,
        status: 'ACTIVE' as any,
        createdAt: 't',
      });
    const removeBranchMemberSpy = jest
      .spyOn(service, 'removeBranchMember')
      .mockResolvedValue({ deleted: true });

    await service.transferMember(
      'token',
      {
        userId: 'u1',
        sourceType: 'branch' as any,
        sourceId: 'branch-1',
        targetType: 'brand' as any,
        targetId: 'brand-2',
        brandRole: 'OWNER' as any,
      },
      true,
    );

    expect(updateBrandMemberSpy).toHaveBeenCalledWith(
      'token',
      'brand-2',
      'u1',
      { role: 'OWNER', status: 'ACTIVE' },
      true,
    );
    expect(removeBranchMemberSpy).toHaveBeenCalledWith(
      'token',
      'branch-1',
      'u1',
      true,
    );
  });

  it('transferMember should reject same source and target', async () => {
    await expect(
      service.transferMember(
        'token',
        {
          userId: 'u1',
          sourceType: 'brand' as any,
          sourceId: 'brand-1',
          targetType: 'brand' as any,
          targetId: 'brand-1',
        },
        true,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('transferMember should throw when source member is missing', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      service.transferMember(
        'token',
        {
          userId: 'u1',
          sourceType: 'branch' as any,
          sourceId: 'branch-1',
          targetType: 'brand' as any,
          targetId: 'brand-1',
        },
        true,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('getBrandMembers should map members', async () => {
    supabase.adminClient.mockReturnValue({
      ...mockSb,
      auth: {
        admin: {
          listUsers: jest.fn().mockResolvedValue({
            data: {
              users: [{ id: 'u1', email: 'owner@example.com' }],
            },
            error: null,
          }),
        },
      },
    });
    mockSb.order.mockResolvedValueOnce({
      data: [
        {
          brand_id: 'brand',
          user_id: 'u1',
          role: 'OWNER',
          status: 'ACTIVE',
          created_at: 't',
          profiles: { display_name: 'User' },
        },
      ],
      error: null,
    });

    const result = await service.getBrandMembers('token', 'brand', true);

    expect(result[0].brandId).toBe('brand');
    expect(result[0].displayName).toBe('User');
    expect(result[0].email).toBe('owner@example.com');
  });

  it('getBrandMembers should map missing profile and createdAt', async () => {
    mockSb.order.mockResolvedValueOnce({
      data: [
        {
          brand_id: 'brand',
          user_id: 'u1',
          role: 'OWNER',
          status: 'ACTIVE',
          created_at: null,
          profiles: null,
        },
      ],
      error: null,
    });

    const result = await service.getBrandMembers('token', 'brand', true);

    expect(result[0].displayName).toBeNull();
    expect(result[0].createdAt).toBe('');
  });

  it('getBrandMembers should normalize legacy manager role to admin', async () => {
    mockSb.order.mockResolvedValueOnce({
      data: [
        {
          brand_id: 'brand',
          user_id: 'u1',
          role: 'MANAGER',
          status: 'ACTIVE',
          created_at: 't',
          profiles: { display_name: 'User' },
        },
      ],
      error: null,
    });

    const result = await service.getBrandMembers('token', 'brand', true);

    expect(result[0].role).toBe('ADMIN');
  });

  it('getBrandMembers should return empty list when data is null', async () => {
    mockSb.order.mockResolvedValueOnce({ data: null, error: null });

    const result = await service.getBrandMembers('token', 'brand', true);

    expect(result).toEqual([]);
  });

  it('getBrandMembers should use user client when isAdmin is false', async () => {
    mockSb.order.mockResolvedValueOnce({ data: [], error: null });

    await service.getBrandMembers('token', 'brand', false);

    expect(supabase.userClient).toHaveBeenCalledWith('token');
  });

  it('getBrandMembers should throw on error', async () => {
    mockSb.order.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(
      service.getBrandMembers('token', 'brand', true),
    ).rejects.toThrow('[members.getBrandMembers]');
  });

  it('inviteBrandMember should throw not implemented', async () => {
    await expect(
      service.inviteBrandMember('token', { email: 'a@b.com' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('addBrandMember should throw when exists', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({ data: { user_id: 'u1' } });

    await expect(
      service.addBrandMember('token', 'brand', 'u1', 'MEMBER' as any, true),
    ).rejects.toThrow(BadRequestException);
  });

  it('addBrandMember should insert member', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({ data: null });
    supabase.adminClient().auth.admin.getUserById.mockResolvedValueOnce({
      data: {
        user: {
          id: 'u1',
          user_metadata: {},
          email_confirmed_at: '2026-03-09T08:10:00.000Z',
        },
      },
      error: null,
    });
    mockSb.single.mockResolvedValueOnce({
      data: {
        brand_id: 'brand',
        user_id: 'u1',
        role: 'MEMBER',
        status: 'ACTIVE',
        created_at: 't',
      },
      error: null,
    });

    const result = await service.addBrandMember(
      'token',
      'brand',
      'u1',
      'MEMBER' as any,
      true,
    );

    expect(result.brandId).toBe('brand');
  });

  it('addBrandMember should default role and map null createdAt', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({ data: null });
    supabase.adminClient().auth.admin.getUserById.mockResolvedValueOnce({
      data: {
        user: {
          id: 'u1',
          user_metadata: {},
          email_confirmed_at: '2026-03-09T08:10:00.000Z',
        },
      },
      error: null,
    });
    mockSb.single.mockResolvedValueOnce({
      data: {
        brand_id: 'brand',
        user_id: 'u1',
        role: 'MEMBER',
        status: 'ACTIVE',
        created_at: null,
      },
      error: null,
    });

    const result = await service.addBrandMember(
      'token',
      'brand',
      'u1',
      undefined as any,
      true,
    );

    expect(result.role).toBe('MEMBER');
    expect(result.createdAt).toBe('');
  });

  it('addBrandMember should throw on insert error', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({ data: null });
    supabase.adminClient().auth.admin.getUserById.mockResolvedValueOnce({
      data: {
        user: {
          id: 'u1',
          user_metadata: {},
          email_confirmed_at: '2026-03-09T08:10:00.000Z',
        },
      },
      error: null,
    });
    mockSb.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(
      service.addBrandMember('token', 'brand', 'u1', 'MEMBER' as any, true),
    ).rejects.toThrow('[members.addBrandMember]');
  });

  it('addBrandMember should throw a clear error when active owner already exists', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({ data: null });
    supabase.adminClient().auth.admin.getUserById.mockResolvedValueOnce({
      data: {
        user: {
          id: 'u1',
          user_metadata: {},
          email_confirmed_at: '2026-03-09T08:10:00.000Z',
        },
      },
      error: null,
    });
    mockSb.single.mockResolvedValueOnce({
      data: null,
      error: {
        message:
          'duplicate key value violates unique constraint "brand_members_one_active_owner_per_brand"',
      },
    });

    await expect(
      service.addBrandMember('token', 'brand', 'u1', 'OWNER' as any, true),
    ).rejects.toThrow(
      '브랜드당 활성 오너는 1명만 지정할 수 있습니다. 기존 오너 권한을 먼저 변경해주세요.',
    );
  });

  it('addBrandMember should reject unconfirmed users', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({ data: null });
    supabase.adminClient().auth.admin.getUserById.mockResolvedValueOnce({
      data: {
        user: {
          id: 'u1',
          user_metadata: {},
          email_confirmed_at: null,
        },
      },
      error: null,
    });

    await expect(
      service.addBrandMember('token', 'brand', 'u1', 'MEMBER' as any, true),
    ).rejects.toThrow('이메일 인증을 완료한 사용자만 승인할 수 있습니다.');
  });

  it('updateBrandMember should throw when no changes', async () => {
    await expect(
      service.updateBrandMember('token', 'brand', 'u1', {} as any, true),
    ).rejects.toThrow(BadRequestException);
  });

  it('updateBrandMember should update member', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({
      data: {
        brand_id: 'brand',
        user_id: 'u1',
        role: 'OWNER',
        status: 'ACTIVE',
        created_at: 't',
      },
      error: null,
    });

    const result = await service.updateBrandMember(
      'token',
      'brand',
      'u1',
      { role: 'OWNER' } as any,
      true,
    );

    expect(result.role).toBe('OWNER');
  });

  it('updateBrandMember should update status when provided', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({
      data: {
        brand_id: 'brand',
        user_id: 'u1',
        role: 'MEMBER',
        status: 'INACTIVE',
        created_at: null,
      },
      error: null,
    });

    const result = await service.updateBrandMember(
      'token',
      'brand',
      'u1',
      { status: 'INACTIVE' } as any,
      true,
    );

    expect(result.status).toBe('INACTIVE');
    expect(result.createdAt).toBe('');
  });

  it('updateBrandMember should throw on update error', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(
      service.updateBrandMember(
        'token',
        'brand',
        'u1',
        { role: 'OWNER' } as any,
        true,
      ),
    ).rejects.toThrow('[members.updateBrandMember]');
  });

  it('updateBrandMember should throw a clear error when active owner already exists', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: {
        message:
          'duplicate key value violates unique constraint "brand_members_one_active_owner_per_brand"',
      },
    });

    await expect(
      service.updateBrandMember(
        'token',
        'brand',
        'u1',
        { role: 'OWNER' } as any,
        true,
      ),
    ).rejects.toThrow(
      '브랜드당 활성 오너는 1명만 지정할 수 있습니다. 기존 오너 권한을 먼저 변경해주세요.',
    );
  });

  it('updateBrandMember should throw when member missing', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      service.updateBrandMember(
        'token',
        'brand',
        'u1',
        { role: 'OWNER' } as any,
        true,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('removeBrandMember should delete', async () => {
    mockSb.eq
      .mockReturnValueOnce(mockSb) // brand_id filter
      .mockResolvedValueOnce({ error: null }); // user_id filter

    const result = await service.removeBrandMember(
      'token',
      'brand',
      'u1',
      true,
    );

    expect(result.deleted).toBe(true);
  });

  it('removeBrandMember should throw on delete error', async () => {
    mockSb.eq
      .mockReturnValueOnce(mockSb)
      .mockResolvedValueOnce({ error: { message: 'fail' } });

    await expect(
      service.removeBrandMember('token', 'brand', 'u1', true),
    ).rejects.toThrow('[members.removeBrandMember]');
  });

  it('getBranchMembers should map members', async () => {
    supabase.adminClient.mockReturnValue({
      ...mockSb,
      auth: {
        admin: {
          listUsers: jest.fn().mockResolvedValue({
            data: {
              users: [{ id: 'u1', email: 'staff@example.com' }],
            },
            error: null,
          }),
        },
      },
    });
    mockSb.order.mockResolvedValueOnce({
      data: [
        {
          branch_id: 'branch',
          user_id: 'u1',
          role: 'STAFF',
          status: 'ACTIVE',
          created_at: 't',
          profiles: { display_name: 'User' },
        },
      ],
      error: null,
    });

    const result = await service.getBranchMembers('token', 'branch', true);

    expect(result[0].branchId).toBe('branch');
    expect(result[0].email).toBe('staff@example.com');
  });

  it('getBranchMembers should return empty list when data is null', async () => {
    mockSb.order.mockResolvedValueOnce({ data: null, error: null });

    const result = await service.getBranchMembers('token', 'branch', true);

    expect(result).toEqual([]);
  });

  it('getBranchMembers should map missing profile to null', async () => {
    mockSb.order.mockResolvedValueOnce({
      data: [
        {
          branch_id: 'branch',
          user_id: 'u1',
          role: 'STAFF',
          status: 'ACTIVE',
          created_at: null,
          profiles: null,
        },
      ],
      error: null,
    });

    const result = await service.getBranchMembers('token', 'branch', true);

    expect(result[0].displayName).toBeNull();
    expect(result[0].createdAt).toBe('');
  });

  it('getBranchMembers should use user client when isAdmin is false', async () => {
    mockSb.order.mockResolvedValueOnce({ data: [], error: null });

    await service.getBranchMembers('token', 'branch', false);

    expect(supabase.userClient).toHaveBeenCalledWith('token');
  });

  it('getBranchMembers should throw on error', async () => {
    mockSb.order.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(
      service.getBranchMembers('token', 'branch', true),
    ).rejects.toThrow('[members.getBranchMembers]');
  });

  it('addBranchMember should throw when exists', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({ data: { user_id: 'u1' } });

    await expect(
      service.addBranchMember(
        'token',
        { branchId: 'branch', userId: 'u1' } as any,
        true,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('addBranchMember should insert', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({ data: null });
    supabase.adminClient().auth.admin.getUserById.mockResolvedValueOnce({
      data: {
        user: {
          id: 'u1',
          user_metadata: {},
          email_confirmed_at: '2026-03-09T08:10:00.000Z',
        },
      },
      error: null,
    });
    mockSb.single.mockResolvedValueOnce({
      data: {
        branch_id: 'branch',
        user_id: 'u1',
        role: 'STAFF',
        status: 'ACTIVE',
        created_at: 't',
      },
      error: null,
    });

    const result = await service.addBranchMember(
      'token',
      { branchId: 'branch', userId: 'u1' } as any,
      true,
    );

    expect(result.branchId).toBe('branch');
  });

  it('addBranchMember should map null createdAt', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({ data: null });
    supabase.adminClient().auth.admin.getUserById.mockResolvedValueOnce({
      data: {
        user: {
          id: 'u1',
          user_metadata: {},
          email_confirmed_at: '2026-03-09T08:10:00.000Z',
        },
      },
      error: null,
    });
    mockSb.single.mockResolvedValueOnce({
      data: {
        branch_id: 'branch',
        user_id: 'u1',
        role: 'STAFF',
        status: 'ACTIVE',
        created_at: null,
      },
      error: null,
    });

    const result = await service.addBranchMember(
      'token',
      { branchId: 'branch', userId: 'u1' } as any,
      true,
    );

    expect(result.createdAt).toBe('');
  });

  it('addBranchMember should default role when missing', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({ data: null });
    supabase.adminClient().auth.admin.getUserById.mockResolvedValueOnce({
      data: {
        user: {
          id: 'u1',
          user_metadata: {},
          email_confirmed_at: '2026-03-09T08:10:00.000Z',
        },
      },
      error: null,
    });
    mockSb.single.mockResolvedValueOnce({
      data: {
        branch_id: 'branch',
        user_id: 'u1',
        role: 'STAFF',
        status: 'ACTIVE',
        created_at: 't',
      },
      error: null,
    });

    const result = await service.addBranchMember(
      'token',
      { branchId: 'branch', userId: 'u1' } as any,
      true,
    );

    expect(result.role).toBe('STAFF');
  });

  it('addBranchMember should throw on insert error', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({ data: null });
    supabase.adminClient().auth.admin.getUserById.mockResolvedValueOnce({
      data: {
        user: {
          id: 'u1',
          user_metadata: {},
          email_confirmed_at: '2026-03-09T08:10:00.000Z',
        },
      },
      error: null,
    });
    mockSb.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(
      service.addBranchMember(
        'token',
        { branchId: 'branch', userId: 'u1' } as any,
        true,
      ),
    ).rejects.toThrow('[members.addBranchMember]');
  });

  it('addBranchMember should reject unknown users', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({ data: null });
    supabase.adminClient().auth.admin.getUserById.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'not found' },
    });

    await expect(
      service.addBranchMember(
        'token',
        { branchId: 'branch', userId: 'u1' } as any,
        true,
      ),
    ).rejects.toThrow('사용자를 찾을 수 없습니다.');
  });

  it('updateBranchMember should throw when no changes', async () => {
    await expect(
      service.updateBranchMember('token', 'branch', 'u1', {} as any, true),
    ).rejects.toThrow(BadRequestException);
  });

  it('updateBranchMember should update member', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({
      data: {
        branch_id: 'branch',
        user_id: 'u1',
        role: 'STAFF',
        status: 'ACTIVE',
        created_at: 't',
      },
      error: null,
    });

    const result = await service.updateBranchMember(
      'token',
      'branch',
      'u1',
      { role: 'BRANCH_ADMIN' } as any,
      true,
    );

    expect(result.branchId).toBe('branch');
  });

  it('updateBranchMember should update status when provided', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({
      data: {
        branch_id: 'branch',
        user_id: 'u1',
        role: 'STAFF',
        status: 'INACTIVE',
        created_at: null,
      },
      error: null,
    });

    const result = await service.updateBranchMember(
      'token',
      'branch',
      'u1',
      { status: 'INACTIVE' } as any,
      true,
    );

    expect(result.status).toBe('INACTIVE');
    expect(result.createdAt).toBe('');
  });

  it('updateBranchMember should throw on update error', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    await expect(
      service.updateBranchMember(
        'token',
        'branch',
        'u1',
        { role: 'BRANCH_ADMIN' } as any,
        true,
      ),
    ).rejects.toThrow('[members.updateBranchMember]');
  });

  it('updateBranchMember should throw when missing', async () => {
    mockSb.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      service.updateBranchMember(
        'token',
        'branch',
        'u1',
        { role: 'BRANCH_ADMIN' } as any,
        true,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('removeBranchMember should delete', async () => {
    mockSb.eq
      .mockReturnValueOnce(mockSb) // branch_id filter
      .mockResolvedValueOnce({ error: null }); // user_id filter

    const result = await service.removeBranchMember(
      'token',
      'branch',
      'u1',
      true,
    );

    expect(result.deleted).toBe(true);
  });

  it('removeBranchMember should throw on delete error', async () => {
    mockSb.eq
      .mockReturnValueOnce(mockSb)
      .mockResolvedValueOnce({ error: { message: 'fail' } });

    await expect(
      service.removeBranchMember('token', 'branch', 'u1', true),
    ).rejects.toThrow('[members.removeBranchMember]');
  });
});
