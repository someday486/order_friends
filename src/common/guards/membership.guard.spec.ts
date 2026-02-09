import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { MembershipGuard } from './membership.guard';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { Role } from '../../modules/auth/authorization/roles.enum';
import { BrandRole, BranchRole, MemberStatus } from '../../modules/members/dto/member.dto';

describe('MembershipGuard', () => {
  let guard: MembershipGuard;

  const createChain = () => {
    const chain: any = {};
    chain.select = jest.fn().mockReturnValue(chain);
    chain.eq = jest.fn().mockReturnValue(chain);
    chain.maybeSingle = jest.fn();
    return chain;
  };

  const createContext = (overrides: Record<string, any> = {}) => {
    const req = {
      user: { id: 'user-1' },
      accessToken: 'token',
      isAdmin: false,
      params: {},
      query: {},
      body: {},
      ...overrides,
    } as any;

    return {
      switchToHttp: () => ({ getRequest: () => req }),
      _req: req,
    } as any;
  };

  let brandMembersChain: any;
  let branchMembersChain: any;
  let branchesChain: any;
  let mockSb: any;

  beforeEach(async () => {
    brandMembersChain = createChain();
    branchMembersChain = createChain();
    branchesChain = createChain();

    mockSb = {
      from: jest.fn((table: string) => {
        if (table === 'brand_members') return brandMembersChain;
        if (table === 'branch_members') return branchMembersChain;
        if (table === 'branches') return branchesChain;
        return {} as any;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipGuard,
        { provide: SupabaseService, useValue: { userClient: jest.fn(() => mockSb) } },
      ],
    }).compile();

    guard = module.get<MembershipGuard>(MembershipGuard);
    jest.clearAllMocks();
  });

  it('should throw when user context is missing', async () => {
    const ctx = createContext({ user: undefined });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should allow admin users and set role/ids', async () => {
    const ctx = createContext({
      isAdmin: true,
      params: { brandId: 'brand-1' },
      query: { branchId: 'branch-1' },
    });

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(ctx._req.brandId).toBe('brand-1');
    expect(ctx._req.branchId).toBe('branch-1');
    expect(ctx._req.role).toBe(Role.OWNER);
  });

  it('should infer role when no scope is provided', async () => {
    brandMembersChain.eq
      .mockReturnValueOnce(brandMembersChain)
      .mockResolvedValueOnce({ data: [{ role: BrandRole.OWNER }], error: null });

    const ctx = createContext();

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(ctx._req.role).toBe(Role.OWNER);
  });

  it('should validate brand membership and set role', async () => {
    brandMembersChain.eq
      .mockReturnValueOnce(brandMembersChain)
      .mockReturnValueOnce(brandMembersChain);
    brandMembersChain.maybeSingle.mockResolvedValueOnce({
      data: { role: BrandRole.OWNER, status: MemberStatus.ACTIVE },
      error: null,
    });

    const ctx = createContext({ params: { brandId: 'brand-1' } });

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(ctx._req.brandId).toBe('brand-1');
    expect(ctx._req.role).toBe(Role.OWNER);
  });

  it('should throw when brand membership lookup fails', async () => {
    brandMembersChain.eq
      .mockReturnValueOnce(brandMembersChain)
      .mockReturnValueOnce(brandMembersChain);
    brandMembersChain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    const ctx = createContext({ params: { brandId: 'brand-1' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should throw when brand membership is inactive', async () => {
    brandMembersChain.eq
      .mockReturnValueOnce(brandMembersChain)
      .mockReturnValueOnce(brandMembersChain);
    brandMembersChain.maybeSingle.mockResolvedValueOnce({
      data: { role: BrandRole.ADMIN, status: MemberStatus.SUSPENDED },
      error: null,
    });

    const ctx = createContext({ params: { brandId: 'brand-1' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should validate branch membership and set role', async () => {
    branchMembersChain.eq
      .mockReturnValueOnce(branchMembersChain)
      .mockReturnValueOnce(branchMembersChain);
    branchMembersChain.maybeSingle.mockResolvedValueOnce({
      data: { role: BranchRole.BRANCH_OWNER, status: MemberStatus.ACTIVE },
      error: null,
    });

    const ctx = createContext({ params: { branchId: 'branch-1' } });

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(ctx._req.branchId).toBe('branch-1');
    expect(ctx._req.role).toBe(Role.OWNER);
  });

  it('should throw when branch membership lookup fails', async () => {
    branchMembersChain.eq
      .mockReturnValueOnce(branchMembersChain)
      .mockReturnValueOnce(branchMembersChain);
    branchMembersChain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'fail' },
    });

    const ctx = createContext({ params: { branchId: 'branch-1' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should fallback when branch membership inactive', async () => {
    branchMembersChain.eq
      .mockReturnValueOnce(branchMembersChain)
      .mockReturnValueOnce(branchMembersChain);
    branchMembersChain.maybeSingle.mockResolvedValueOnce({
      data: { role: BranchRole.MANAGER, status: MemberStatus.SUSPENDED },
      error: null,
    });

    branchesChain.eq.mockReturnValueOnce(branchesChain);
    branchesChain.maybeSingle.mockResolvedValueOnce({ data: { id: 'branch-1', brand_id: 'brand-1' }, error: null });

    brandMembersChain.eq
      .mockReturnValueOnce(brandMembersChain)
      .mockReturnValueOnce(brandMembersChain);
    brandMembersChain.maybeSingle.mockResolvedValueOnce({
      data: { role: BrandRole.ADMIN, status: MemberStatus.ACTIVE },
      error: null,
    });

    const ctx = createContext({ params: { branchId: 'branch-1' } });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(ctx._req.role).toBe(Role.STAFF);
  });

  it('should fallback to brand membership when branch membership is missing', async () => {
    branchMembersChain.eq
      .mockReturnValueOnce(branchMembersChain)
      .mockReturnValueOnce(branchMembersChain);
    branchMembersChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    branchesChain.eq.mockReturnValueOnce(branchesChain);
    branchesChain.maybeSingle.mockResolvedValueOnce({ data: { id: 'branch-1', brand_id: 'brand-1' }, error: null });

    brandMembersChain.eq
      .mockReturnValueOnce(brandMembersChain)
      .mockReturnValueOnce(brandMembersChain);
    brandMembersChain.maybeSingle.mockResolvedValueOnce({
      data: { role: BrandRole.OWNER, status: MemberStatus.ACTIVE },
      error: null,
    });

    const ctx = createContext({ params: { branchId: 'branch-1' } });

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(ctx._req.branchId).toBe('branch-1');
    expect(ctx._req.brandId).toBe('brand-1');
    expect(ctx._req.role).toBe(Role.OWNER);
  });

  it('should throw when branch lookup fails', async () => {
    branchMembersChain.eq
      .mockReturnValueOnce(branchMembersChain)
      .mockReturnValueOnce(branchMembersChain);
    branchMembersChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    branchesChain.eq.mockReturnValueOnce(branchesChain);
    branchesChain.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

    const ctx = createContext({ params: { branchId: 'branch-1' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should throw when brand membership lookup fails in fallback', async () => {
    branchMembersChain.eq
      .mockReturnValueOnce(branchMembersChain)
      .mockReturnValueOnce(branchMembersChain);
    branchMembersChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    branchesChain.eq.mockReturnValueOnce(branchesChain);
    branchesChain.maybeSingle.mockResolvedValueOnce({ data: { id: 'branch-1', brand_id: 'brand-1' }, error: null });

    brandMembersChain.eq
      .mockReturnValueOnce(brandMembersChain)
      .mockReturnValueOnce(brandMembersChain);
    brandMembersChain.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    const ctx = createContext({ params: { branchId: 'branch-1' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should normalize ids from query arrays', async () => {
    const ctx = createContext({
      isAdmin: true,
      query: { branchId: ['branch-1'] },
      body: { brandId: 'brand-1' },
    });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(ctx._req.branchId).toBe('branch-1');
    expect(ctx._req.brandId).toBe('brand-1');
  });
});
