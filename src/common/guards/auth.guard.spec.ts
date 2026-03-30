import { UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  const makeContext = (req: any) =>
    ({
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    }) as any;

  const makeGuard = (configValues: Record<string, string | undefined>) => {
    const supabase = {
      userClient: jest.fn(),
    };
    const config = {
      get: (key: string) => configValues[key],
    };
    return { guard: new AuthGuard(supabase as any, config as any), supabase };
  };

  const makeUserClient = (options: {
    user: {
      id: string;
      email: string | null;
      user_metadata?: Record<string, unknown>;
    };
    profile?: { is_system_admin: boolean } | null;
    profileError?: { message: string } | null;
  }) => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: options.user },
        error: null,
      }),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: options.profile ?? null,
        error: options.profileError ?? null,
      }),
    })),
  });

  it('should throw when missing bearer token', async () => {
    const { guard } = makeGuard({});

    await expect(
      guard.canActivate(makeContext({ headers: {} })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw on invalid token', async () => {
    const { guard, supabase } = makeGuard({});
    supabase.userClient.mockReturnValue({
      auth: {
        getUser: jest
          .fn()
          .mockResolvedValue({ data: null, error: { message: 'bad' } }),
      },
    });

    await expect(
      guard.canActivate(
        makeContext({ headers: { authorization: 'Bearer bad' } }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should convert auth client errors into unauthorized responses', async () => {
    const { guard, supabase } = makeGuard({});
    supabase.userClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockRejectedValue(new Error('fetch failed')),
      },
    });

    await expect(
      guard.canActivate(
        makeContext({ headers: { authorization: 'Bearer bad-network' } }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should set request user and admin flags from config', async () => {
    const { guard, supabase } = makeGuard({
      ADMIN_EMAILS: 'admin@example.com; other@example.com',
      ADMIN_USER_IDS: 'user-1, user-2',
      ADMIN_EMAIL_DOMAINS: '@example.org',
      ADMIN_BYPASS: 'false',
    });

    supabase.userClient.mockReturnValue(
      makeUserClient({
        user: { id: 'user-1', email: 'admin@example.com' },
        profile: { is_system_admin: false },
      }),
    );

    const req: any = { headers: { authorization: 'Bearer token' } };
    const result = await guard.canActivate(makeContext(req));

    expect(result).toBe(true);
    expect(req.user).toEqual({
      id: 'user-1',
      email: 'admin@example.com',
      canCreateBrand: false,
    });
    expect(req.accessToken).toBe('token');
    expect(req.isAdmin).toBe(true);
    expect(supabase.userClient).toHaveBeenCalledWith('token');
  });

  it('should allow admin by domain or bypass', async () => {
    const { guard, supabase } = makeGuard({
      ADMIN_EMAIL_DOMAINS: 'example.org',
      ADMIN_BYPASS: 'yes',
    });

    supabase.userClient.mockReturnValue(
      makeUserClient({
        user: { id: 'user-9', email: 'user@example.org' },
        profile: { is_system_admin: false },
      }),
    );

    const req: any = { headers: { authorization: 'Bearer token2' } };
    const result = await guard.canActivate(makeContext(req));

    expect(result).toBe(true);
    expect(req.isAdmin).toBe(true);
  });

  it('should mark admin from profile flag', async () => {
    const { guard, supabase } = makeGuard({});
    supabase.userClient.mockReturnValue(
      makeUserClient({
        user: { id: 'user-10', email: 'user@none.com' },
        profile: { is_system_admin: true },
      }),
    );

    const req: any = { headers: { authorization: 'Bearer token3' } };
    const result = await guard.canActivate(makeContext(req));

    expect(result).toBe(true);
    expect(req.isAdmin).toBe(true);
  });

  it('should handle user without email', async () => {
    const { guard, supabase } = makeGuard({
      ADMIN_EMAILS: 'admin@example.com',
      ADMIN_EMAIL_DOMAINS: 'example.org',
    });
    supabase.userClient.mockReturnValue(
      makeUserClient({
        user: { id: 'user-11', email: null },
        profile: { is_system_admin: false },
      }),
    );

    const req: any = { headers: { authorization: 'Bearer token4' } };
    const result = await guard.canActivate(makeContext(req));

    expect(result).toBe(true);
    expect(req.user).toEqual({
      id: 'user-11',
      email: undefined,
      canCreateBrand: false,
    });
    expect(req.isAdmin).toBe(false);
  });

  it('should expose brand creation approval from auth metadata', async () => {
    const { guard, supabase } = makeGuard({});
    supabase.userClient.mockReturnValue(
      makeUserClient({
        user: {
          id: 'user-13',
          email: 'creator@test.com',
          user_metadata: { customer_brand_creator_approved: true },
        },
        profile: { is_system_admin: false },
      }),
    );

    const req: any = { headers: { authorization: 'Bearer token6' } };
    const result = await guard.canActivate(makeContext(req));

    expect(result).toBe(true);
    expect(req.user).toEqual({
      id: 'user-13',
      email: 'creator@test.com',
      canCreateBrand: true,
    });
  });

  it('should bypass cached auth for me route to refresh onboarding approval', async () => {
    const { guard, supabase } = makeGuard({});
    supabase.userClient
      .mockReturnValueOnce(
        makeUserClient({
          user: {
            id: 'user-14',
            email: 'creator@test.com',
            user_metadata: {},
          },
          profile: { is_system_admin: false },
        }),
      )
      .mockReturnValueOnce(
        makeUserClient({
          user: {
            id: 'user-14',
            email: 'creator@test.com',
            user_metadata: { customer_brand_creator_approved: true },
          },
          profile: { is_system_admin: false },
        }),
      );

    const firstReq: any = {
      headers: { authorization: 'Bearer token7' },
      path: '/orders',
    };
    const secondReq: any = {
      headers: { authorization: 'Bearer token7' },
      path: '/me',
    };

    await expect(guard.canActivate(makeContext(firstReq))).resolves.toBe(true);
    await expect(guard.canActivate(makeContext(secondReq))).resolves.toBe(true);

    expect(firstReq.user.canCreateBrand).toBe(false);
    expect(secondReq.user.canCreateBrand).toBe(true);
    expect(supabase.userClient).toHaveBeenCalledTimes(2);
  });

  it('should reject requests when profile admin lookup fails', async () => {
    const { guard, supabase } = makeGuard({});
    supabase.userClient.mockReturnValue(
      makeUserClient({
        user: { id: 'user-12', email: 'user@test.com' },
        profileError: { message: 'profile lookup failed' },
      }),
    );

    await expect(
      guard.canActivate(
        makeContext({ headers: { authorization: 'Bearer token5' } }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject requests when profile admin lookup throws', async () => {
    const { guard, supabase } = makeGuard({});
    supabase.userClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-13', email: 'user@test.com' } },
          error: null,
        }),
      },
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockRejectedValue(new Error('fetch failed')),
      })),
    });

    await expect(
      guard.canActivate(
        makeContext({ headers: { authorization: 'Bearer token6' } }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });
});
