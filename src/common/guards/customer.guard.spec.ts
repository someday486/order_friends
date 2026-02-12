import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { CustomerGuard } from './customer.guard';
import { SupabaseService } from '../../infra/supabase/supabase.service';

describe('CustomerGuard', () => {
  let guard: CustomerGuard;

  /**
   * Creates a Supabase chain mock that supports `.select().eq().eq()` (brand/branch_members)
   * and `.select().eq()` (brands owner lookup).
   * The final `.eq()` call resolves with the provided result.
   */
  const createChainMock = (result: { data: any; error: any }) => {
    const chain: any = {};
    chain.select = jest.fn().mockReturnValue(chain);
    // Each .eq() returns chain, but the *last* .eq() resolves with result.
    // For brand_members/branch_members: select -> eq(user_id) -> eq(status) => resolves
    // For brands: select -> eq(owner_user_id) => resolves
    // We make eq always return a thenable chain that also has .eq()
    chain.eq = jest.fn().mockImplementation(() => {
      // Return an object that is both thenable and chainable
      const thenable: any = {
        eq: jest.fn().mockResolvedValue(result),
        then: (resolve: any, reject: any) =>
          Promise.resolve(result).then(resolve, reject),
      };
      return thenable;
    });
    return chain;
  };

  const createContext = (overrides: Record<string, any> = {}) => {
    const req = {
      user: { id: 'user-1' },
      accessToken: 'token',
      isAdmin: false,
      ...overrides,
    };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
      _req: req,
    } as any;
  };

  let mockSb: any;
  let brandMembersResult: { data: any; error: any };
  let brandsResult: { data: any; error: any };
  let branchMembersResult: { data: any; error: any };

  beforeEach(async () => {
    // Default: empty results, no errors
    brandMembersResult = { data: [], error: null };
    brandsResult = { data: [], error: null };
    branchMembersResult = { data: [], error: null };

    mockSb = {
      from: jest.fn((table: string) => {
        if (table === 'brand_members')
          return createChainMock(brandMembersResult);
        if (table === 'brands') return createChainMock(brandsResult);
        if (table === 'branch_members')
          return createChainMock(branchMembersResult);
        return {} as any;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerGuard,
        {
          provide: SupabaseService,
          useValue: { adminClient: jest.fn(() => mockSb) },
        },
      ],
    }).compile();

    guard = module.get<CustomerGuard>(CustomerGuard);

    // Clear membership cache between tests
    (guard as any).membershipCache.clear();
  });

  it('should throw when user or accessToken is missing', async () => {
    const ctx = createContext({ user: undefined });

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw for admin users', async () => {
    const ctx = createContext({ isAdmin: true });

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw when brand membership query fails', async () => {
    brandMembersResult = { data: null, error: { message: 'fail' } };

    const ctx = createContext();

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw when branch membership query fails', async () => {
    brandMembersResult = { data: [], error: null };
    brandsResult = { data: [], error: null };
    branchMembersResult = { data: null, error: { message: 'fail' } };

    const ctx = createContext();

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw when no memberships exist', async () => {
    brandMembersResult = { data: [], error: null };
    brandsResult = { data: [], error: null };
    branchMembersResult = { data: [], error: null };

    const ctx = createContext();

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should allow access and attach memberships', async () => {
    brandMembersResult = { data: [], error: null };
    brandsResult = { data: [{ id: 'brand-1' }], error: null };
    branchMembersResult = { data: [], error: null };

    const ctx = createContext();

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(ctx._req.brandMemberships).toEqual([
      { brand_id: 'brand-1', role: 'OWNER', status: 'ACTIVE' },
    ]);
    expect(ctx._req.branchMemberships).toEqual([]);
  });

  it('should allow access even when owned brand lookup fails', async () => {
    brandMembersResult = {
      data: [{ brand_id: 'brand-1', role: 'STAFF', status: 'ACTIVE' }],
      error: null,
    };
    brandsResult = { data: null, error: { message: 'fail' } };
    branchMembersResult = {
      data: [{ branch_id: 'branch-1', role: 'STAFF', status: 'ACTIVE' }],
      error: null,
    };

    const ctx = createContext();

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it('should avoid duplicating owned brands', async () => {
    brandMembersResult = {
      data: [{ brand_id: 'brand-1', role: 'STAFF', status: 'ACTIVE' }],
      error: null,
    };
    brandsResult = {
      data: [{ id: 'brand-1' }, { id: 'brand-2' }],
      error: null,
    };
    branchMembersResult = { data: [], error: null };

    const ctx = createContext();

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(ctx._req.brandMemberships).toHaveLength(2);
    expect(ctx._req.brandMemberships.map((m: any) => m.brand_id)).toEqual(
      expect.arrayContaining(['brand-1', 'brand-2']),
    );
  });

  it('should allow access when branch memberships are null', async () => {
    brandMembersResult = { data: null, error: null };
    brandsResult = { data: [{ id: 'brand-1' }], error: null };
    branchMembersResult = { data: null, error: null };

    const ctx = createContext();

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(ctx._req.branchMemberships).toEqual([]);
  });

  it('should use cached membership on second call', async () => {
    brandMembersResult = { data: [], error: null };
    brandsResult = { data: [{ id: 'brand-1' }], error: null };
    branchMembersResult = {
      data: [{ branch_id: 'branch-1', role: 'STAFF', status: 'ACTIVE' }],
      error: null,
    };

    const ctx1 = createContext();
    await guard.canActivate(ctx1);

    // Reset mock call count
    mockSb.from.mockClear();

    const ctx2 = createContext();
    await guard.canActivate(ctx2);

    // Should not have called DB again (cache hit)
    expect(mockSb.from).not.toHaveBeenCalled();
    expect(ctx2._req.brandMemberships).toEqual([
      { brand_id: 'brand-1', role: 'OWNER', status: 'ACTIVE' },
    ]);
  });
});
