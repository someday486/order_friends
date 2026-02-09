import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { CustomerGuard } from './customer.guard';
import { SupabaseService } from '../../infra/supabase/supabase.service';

describe('CustomerGuard', () => {
  let guard: CustomerGuard;

  const createChain = () => {
    const chain: any = {};
    chain.select = jest.fn().mockReturnValue(chain);
    chain.eq = jest.fn();
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

  let brandMembersChain: any;
  let brandsChain: any;
  let branchMembersChain: any;
  let mockSb: any;

  beforeEach(async () => {
    brandMembersChain = createChain();
    brandsChain = createChain();
    branchMembersChain = createChain();

    mockSb = {
      from: jest.fn((table: string) => {
        if (table === 'brand_members') return brandMembersChain;
        if (table === 'brands') return brandsChain;
        if (table === 'branch_members') return branchMembersChain;
        return {} as any;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerGuard,
        { provide: SupabaseService, useValue: { adminClient: jest.fn(() => mockSb) } },
      ],
    }).compile();

    guard = module.get<CustomerGuard>(CustomerGuard);
    jest.clearAllMocks();
  });

  it('should throw when user or accessToken is missing', async () => {
    const ctx = createContext({ user: undefined });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw for admin users', async () => {
    const ctx = createContext({ isAdmin: true });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw when brand membership query fails', async () => {
    brandMembersChain.eq
      .mockReturnValueOnce(brandMembersChain)
      .mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    const ctx = createContext();

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw when branch membership query fails', async () => {
    brandMembersChain.eq
      .mockReturnValueOnce(brandMembersChain)
      .mockResolvedValueOnce({ data: [], error: null });

    brandsChain.eq.mockResolvedValueOnce({ data: [], error: null });

    branchMembersChain.eq
      .mockReturnValueOnce(branchMembersChain)
      .mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    const ctx = createContext();

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw when no memberships exist', async () => {
    brandMembersChain.eq
      .mockReturnValueOnce(brandMembersChain)
      .mockResolvedValueOnce({ data: [], error: null });

    brandsChain.eq.mockResolvedValueOnce({ data: [], error: null });

    branchMembersChain.eq
      .mockReturnValueOnce(branchMembersChain)
      .mockResolvedValueOnce({ data: [], error: null });

    const ctx = createContext();

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should allow access and attach memberships', async () => {
    brandMembersChain.eq
      .mockReturnValueOnce(brandMembersChain)
      .mockResolvedValueOnce({ data: [], error: null });

    brandsChain.eq.mockResolvedValueOnce({ data: [{ id: 'brand-1' }], error: null });

    branchMembersChain.eq
      .mockReturnValueOnce(branchMembersChain)
      .mockResolvedValueOnce({ data: [], error: null });

    const ctx = createContext();

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(ctx._req.brandMemberships).toEqual([
      { brand_id: 'brand-1', role: 'OWNER', status: 'ACTIVE' },
    ]);
    expect(ctx._req.branchMemberships).toEqual([]);
  });
});
