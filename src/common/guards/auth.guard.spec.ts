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

  it('should set request user and admin flags from config', async () => {
    const { guard, supabase } = makeGuard({
      ADMIN_EMAILS: 'admin@example.com; other@example.com',
      ADMIN_USER_IDS: 'user-1, user-2',
      ADMIN_EMAIL_DOMAINS: '@example.org',
      ADMIN_BYPASS: 'false',
    });

    supabase.userClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'admin@example.com' } },
          error: null,
        }),
      },
    });

    const req: any = { headers: { authorization: 'Bearer token' } };
    const result = await guard.canActivate(makeContext(req));

    expect(result).toBe(true);
    expect(req.user).toEqual({ id: 'user-1', email: 'admin@example.com' });
    expect(req.accessToken).toBe('token');
    expect(req.isAdmin).toBe(true);
    expect(supabase.userClient).toHaveBeenCalledWith('token');
  });

  it('should allow admin by domain or bypass', async () => {
    const { guard, supabase } = makeGuard({
      ADMIN_EMAIL_DOMAINS: 'example.org',
      ADMIN_BYPASS: 'yes',
    });

    supabase.userClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-9', email: 'user@example.org' } },
          error: null,
        }),
      },
    });

    const req: any = { headers: { authorization: 'Bearer token2' } };
    const result = await guard.canActivate(makeContext(req));

    expect(result).toBe(true);
    expect(req.isAdmin).toBe(true);
  });

  it('should mark admin from metadata', async () => {
    const { guard, supabase } = makeGuard({});
    supabase.userClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: 'user-10',
              email: 'user@none.com',
              app_metadata: { role: 'admin' },
            },
          },
          error: null,
        }),
      },
    });

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
    supabase.userClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-11', email: null } },
          error: null,
        }),
      },
    });

    const req: any = { headers: { authorization: 'Bearer token4' } };
    const result = await guard.canActivate(makeContext(req));

    expect(result).toBe(true);
    expect(req.user).toEqual({ id: 'user-11', email: undefined });
    expect(req.isAdmin).toBe(false);
  });

  it('should parse config helpers', () => {
    const { guard } = makeGuard({});
    const parseList = (guard as any).parseList;
    const parseBoolean = (guard as any).parseBoolean;
    const normalizeDomains = (guard as any).normalizeDomains;

    expect(parseList('a, b ; c')).toEqual(['a', 'b', 'c']);
    expect(parseList('')).toEqual([]);
    expect(parseBoolean('true')).toBe(true);
    expect(parseBoolean('1')).toBe(true);
    expect(parseBoolean('yes')).toBe(true);
    expect(parseBoolean('false')).toBe(false);
    expect([...normalizeDomains(['@Example.org', ' test.com '])]).toEqual([
      'example.org',
      'test.com',
    ]);
  });

  it('should handle allowed domain checks', () => {
    const { guard } = makeGuard({ ADMIN_EMAIL_DOMAINS: 'example.org' });
    expect((guard as any).isAllowedDomain('user@example.org')).toBe(true);
    expect((guard as any).isAllowedDomain('user@other.org')).toBe(false);
    expect((guard as any).isAllowedDomain('invalid')).toBe(false);
  });

  it('should detect admin from metadata flags', () => {
    const { guard } = makeGuard({});
    expect(
      (guard as any).isAdminFromMetadata({ app_metadata: { is_admin: true } }),
    ).toBe(true);
    expect(
      (guard as any).isAdminFromMetadata({ user_metadata: { is_admin: true } }),
    ).toBe(true);
    expect(
      (guard as any).isAdminFromMetadata({ app_metadata: { role: 'admin' } }),
    ).toBe(true);
    expect(
      (guard as any).isAdminFromMetadata({ user_metadata: { role: 'admin' } }),
    ).toBe(true);
    expect((guard as any).isAdminFromMetadata({})).toBe(false);
  });
});
