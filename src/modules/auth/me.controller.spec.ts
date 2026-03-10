import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MeController } from './me.controller';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { AuthGuard } from '../../common/guards/auth.guard';

describe('MeController', () => {
  let controller: MeController;

  const profilesChain = {
    select: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
    single: jest.fn(),
  };
  const brandMembersChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
  };
  const branchMembersChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
  };
  const brandsChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn(),
  };

  const mockSb = {
    from: jest.fn((table: string) => {
      if (table === 'profiles') return profilesChain;
      if (table === 'brand_members') return brandMembersChain;
      if (table === 'branch_members') return branchMembersChain;
      if (table === 'brands') return brandsChain;
      return {} as any;
    }),
  };

  const adminAuth = {
    getUserById: jest.fn().mockResolvedValue({
      data: { user: { id: 'user-1', user_metadata: {} } },
      error: null,
    }),
    updateUserById: jest.fn().mockResolvedValue({
      data: { user: { id: 'user-1', user_metadata: {} } },
      error: null,
    }),
  };

  const mockSupabaseService = {
    adminClient: jest.fn(() => ({
      ...mockSb,
      auth: {
        admin: adminAuth,
      },
    })),
  };
  const mockGuard = { canActivate: jest.fn(() => true) };
  const mockConfig = { get: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeController],
      providers: [
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: ConfigService, useValue: mockConfig },
        { provide: AuthGuard, useValue: mockGuard },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<MeController>(MeController);
    jest.clearAllMocks();
    mockConfig.get.mockReturnValue(undefined);
  });

  it('should return system admin response when profile is system admin', async () => {
    profilesChain.maybeSingle.mockResolvedValueOnce({
      data: { is_system_admin: true },
      error: null,
    });
    brandMembersChain.eq
      .mockReturnValueOnce(brandMembersChain)
      .mockResolvedValueOnce({ data: [], error: null });
    branchMembersChain.eq
      .mockReturnValueOnce(branchMembersChain)
      .mockResolvedValueOnce({ data: [], error: null });
    brandsChain.eq.mockResolvedValueOnce({ data: [], error: null });

    const result = await controller.me({
      id: 'user-1',
      email: 'user@test.com',
    } as any);

    expect(result).toEqual({
      user: { id: 'user-1', email: 'user@test.com', role: 'system_admin' },
      memberships: [],
      ownedBrands: [],
      isSystemAdmin: true,
    });
    expect(mockSb.from).toHaveBeenCalledWith('profiles');
  });

  it('should treat configured admin email as system admin', async () => {
    mockConfig.get.mockImplementation((key: string) =>
      key === 'ADMIN_EMAILS' ? 'user@test.com' : undefined,
    );

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeController],
      providers: [
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: ConfigService, useValue: mockConfig },
        { provide: AuthGuard, useValue: mockGuard },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockGuard)
      .compile();

    const configuredController = module.get<MeController>(MeController);

    profilesChain.maybeSingle.mockResolvedValueOnce({
      data: { is_system_admin: false },
      error: null,
    });
    brandMembersChain.eq
      .mockReturnValueOnce(brandMembersChain)
      .mockResolvedValueOnce({ data: [], error: null });
    branchMembersChain.eq
      .mockReturnValueOnce(branchMembersChain)
      .mockResolvedValueOnce({ data: [], error: null });
    brandsChain.eq.mockResolvedValueOnce({ data: [], error: null });

    const result = await configuredController.me({
      id: 'user-1',
      email: 'user@test.com',
    } as any);

    expect(result.isSystemAdmin).toBe(true);
    expect(result.user.role).toBe('system_admin');
  });

  it('should return profile display name from profiles table', async () => {
    profilesChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'user-1', display_name: '프로필 이름' },
      error: null,
    });

    const result = await controller.getProfile({
      id: 'user-1',
      email: 'user@test.com',
    } as any);

    expect(result).toEqual({ id: 'user-1', displayName: '프로필 이름' });
  });

  it('should update profile display name and sync auth metadata', async () => {
    profilesChain.single.mockResolvedValueOnce({
      data: { id: 'user-1', display_name: '새 이름' },
      error: null,
    });

    const result = await controller.updateProfile(
      { id: 'user-1', email: 'user@test.com' } as any,
      { displayName: '  새 이름  ' },
    );

    expect(adminAuth.updateUserById).toHaveBeenCalledWith('user-1', {
      user_metadata: { display_name: '새 이름' },
    });
    expect(result).toEqual({ id: 'user-1', displayName: '새 이름' });
  });

  it('should return memberships and owned brands for regular user', async () => {
    profilesChain.maybeSingle.mockResolvedValueOnce({
      data: { is_system_admin: false },
      error: null,
    });

    brandMembersChain.eq
      .mockReturnValueOnce(brandMembersChain)
      .mockResolvedValueOnce({
        data: [{ brand_id: 'brand-1', role: 'MEMBER', status: 'ACTIVE' }],
        error: null,
      });

    branchMembersChain.eq
      .mockReturnValueOnce(branchMembersChain)
      .mockResolvedValueOnce({
        data: [],
        error: null,
      });

    brandsChain.eq.mockResolvedValueOnce({
      data: [{ id: 'b1', name: 'Brand' }],
      error: null,
    });

    const result = await controller.me({
      id: 'user-1',
      email: 'user@test.com',
    } as any);

    expect(result.user).toEqual({
      id: 'user-1',
      email: 'user@test.com',
      role: 'brand_owner',
    });
    expect(result.memberships).toEqual([
      { brandId: 'brand-1', role: 'MEMBER' },
    ]);
    expect(result.ownedBrands).toEqual([{ id: 'b1', name: 'Brand' }]);
    expect(result.isSystemAdmin).toBe(false);
  });

  it('should treat brand admins as brand owners for primary role routing', async () => {
    profilesChain.maybeSingle.mockResolvedValueOnce({
      data: { is_system_admin: false },
      error: null,
    });

    brandMembersChain.eq
      .mockReturnValueOnce(brandMembersChain)
      .mockResolvedValueOnce({
        data: [{ brand_id: 'brand-1', role: 'ADMIN', status: 'ACTIVE' }],
        error: null,
      });

    branchMembersChain.eq
      .mockReturnValueOnce(branchMembersChain)
      .mockResolvedValueOnce({
        data: [],
        error: null,
      });

    brandsChain.eq.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const result = await controller.me({
      id: 'user-1',
      email: 'user@test.com',
    } as any);

    expect(result.user.role).toBe('brand_owner');
    expect(result.ownedBrands).toEqual([]);
  });

  it('should normalize legacy manager memberships to admin', async () => {
    profilesChain.maybeSingle.mockResolvedValueOnce({
      data: { is_system_admin: false },
      error: null,
    });

    brandMembersChain.eq
      .mockReturnValueOnce(brandMembersChain)
      .mockResolvedValueOnce({
        data: [{ brand_id: 'brand-1', role: 'MANAGER', status: 'ACTIVE' }],
        error: null,
      });

    branchMembersChain.eq
      .mockReturnValueOnce(branchMembersChain)
      .mockResolvedValueOnce({
        data: [],
        error: null,
      });

    brandsChain.eq.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const result = await controller.me({
      id: 'user-1',
      email: 'user@test.com',
    } as any);

    expect(result.user.role).toBe('brand_owner');
    expect(result.memberships).toEqual([{ brandId: 'brand-1', role: 'ADMIN' }]);
  });

  it('should fallback to staff role when only staff memberships', async () => {
    profilesChain.maybeSingle.mockResolvedValueOnce({
      data: { is_system_admin: false },
      error: null,
    });

    brandMembersChain.eq
      .mockReturnValueOnce(brandMembersChain)
      .mockResolvedValueOnce({
        data: [],
        error: null,
      });

    branchMembersChain.eq
      .mockReturnValueOnce(branchMembersChain)
      .mockResolvedValueOnce({
        data: [
          {
            branch_id: 'branch-1',
            role: 'STAFF',
            status: 'ACTIVE',
            branches: { brand_id: 'brand-1' },
          },
        ],
        error: null,
      });

    brandsChain.eq.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const result = await controller.me({
      id: 'user-1',
      email: 'user@test.com',
    } as any);

    expect(result.user.role).toBe('staff');
  });

  it('should classify viewer/member-only users as customer while returning memberships', async () => {
    profilesChain.maybeSingle.mockResolvedValueOnce({
      data: { is_system_admin: false },
      error: null,
    });

    brandMembersChain.eq
      .mockReturnValueOnce(brandMembersChain)
      .mockResolvedValueOnce({
        data: [{ brand_id: 'brand-1', role: 'MEMBER', status: 'ACTIVE' }],
        error: null,
      });

    branchMembersChain.eq
      .mockReturnValueOnce(branchMembersChain)
      .mockResolvedValueOnce({
        data: [
          {
            branch_id: 'branch-1',
            role: 'VIEWER',
            status: 'ACTIVE',
            branches: { brand_id: 'brand-1' },
          },
        ],
        error: null,
      });

    brandsChain.eq.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const result = await controller.me({
      id: 'user-1',
      email: 'user@test.com',
    } as any);

    expect(result.user.role).toBe('customer');
    expect(result.memberships).toEqual([
      { brandId: 'brand-1', role: 'MEMBER' },
      { brandId: 'brand-1', branchId: 'branch-1', role: 'VIEWER' },
    ]);
  });

  it('should handle profile/membership/brand errors gracefully', async () => {
    profilesChain.maybeSingle.mockResolvedValueOnce({
      data: { is_system_admin: false },
      error: { message: 'profile error' },
    });

    brandMembersChain.eq
      .mockReturnValueOnce(brandMembersChain)
      .mockResolvedValueOnce({
        data: [],
        error: { message: 'brand members error' },
      });

    branchMembersChain.eq
      .mockReturnValueOnce(branchMembersChain)
      .mockResolvedValueOnce({
        data: [],
        error: { message: 'branch members error' },
      });

    brandsChain.eq.mockResolvedValueOnce({
      data: [],
      error: { message: 'brands error' },
    });

    const result = await controller.me({
      id: 'user-1',
      email: 'user@test.com',
    } as any);

    expect(result.user.role).toBe('customer');
    expect(result.isSystemAdmin).toBe(false);
  });

  it('should propagate errors from supabase client creation', async () => {
    const errorSupabase = {
      adminClient: jest.fn(() => {
        throw new Error('boom');
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeController],
      providers: [
        { provide: SupabaseService, useValue: errorSupabase },
        { provide: ConfigService, useValue: mockConfig },
        { provide: AuthGuard, useValue: mockGuard },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockGuard)
      .compile();

    const errorController = module.get<MeController>(MeController);

    await expect(
      errorController.me({ id: 'user-1', email: 'user@test.com' } as any),
    ).rejects.toThrow('boom');
  });
});
