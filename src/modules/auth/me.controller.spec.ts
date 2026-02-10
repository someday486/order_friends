import { Test, TestingModule } from '@nestjs/testing';
import { MeController } from './me.controller';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { AuthGuard } from '../../common/guards/auth.guard';

describe('MeController', () => {
  let controller: MeController;

  const profilesChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };
  const membersChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn(),
  };
  const brandsChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn(),
  };

  const mockSb = {
    from: jest.fn((table: string) => {
      if (table === 'profiles') return profilesChain;
      if (table === 'members') return membersChain;
      if (table === 'brands') return brandsChain;
      return {} as any;
    }),
  };

  const mockSupabaseService = {
    adminClient: jest.fn(() => mockSb),
  };
  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeController],
      providers: [
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: AuthGuard, useValue: mockGuard },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<MeController>(MeController);
    jest.clearAllMocks();
  });

  it('should return system admin response when profile is system admin', async () => {
    profilesChain.single.mockResolvedValueOnce({
      data: { is_system_admin: true },
      error: null,
    });

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

  it('should return memberships and owned brands for regular user', async () => {
    profilesChain.single.mockResolvedValueOnce({
      data: { is_system_admin: false },
      error: null,
    });

    membersChain.eq.mockResolvedValueOnce({
      data: [{ id: 'm1', role: 'staff' }],
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
    expect(result.memberships).toEqual([{ id: 'm1', role: 'staff' }]);
    expect(result.ownedBrands).toEqual([{ id: 'b1', name: 'Brand' }]);
    expect(result.isSystemAdmin).toBe(false);
  });

  it('should set primaryRole from memberships when no owned brands', async () => {
    profilesChain.single.mockResolvedValueOnce({
      data: { is_system_admin: false },
      error: null,
    });

    membersChain.eq.mockResolvedValueOnce({
      data: [{ id: 'm1', role: 'branch_manager' }],
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

    expect(result.user.role).toBe('branch_manager');
    expect(result.ownedBrands).toEqual([]);
  });

  it('should fallback to staff role when only staff memberships', async () => {
    profilesChain.single.mockResolvedValueOnce({
      data: { is_system_admin: false },
      error: null,
    });

    membersChain.eq.mockResolvedValueOnce({
      data: [{ id: 'm1', role: 'staff' }],
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

  it('should handle profile/membership/brand errors gracefully', async () => {
    profilesChain.single.mockResolvedValueOnce({
      data: { is_system_admin: false },
      error: { message: 'profile error' },
    });

    membersChain.eq.mockResolvedValueOnce({
      data: [],
      error: { message: 'members error' },
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
