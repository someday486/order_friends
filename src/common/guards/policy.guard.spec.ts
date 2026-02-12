import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PolicyGuard } from './policy.guard';
import { Permission } from '../../modules/auth/authorization/permissions';
import { Role } from '../../modules/auth/authorization/roles.enum';

describe('PolicyGuard', () => {
  const createContext = (req: any = {}) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => req }),
    }) as any;

  it('should allow when no permissions are required', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([]),
    } as unknown as Reflector;
    const guard = new PolicyGuard(reflector);

    expect(guard.canActivate(createContext({}))).toBe(true);
  });

  it('should allow when reflector returns undefined', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new PolicyGuard(reflector);

    expect(guard.canActivate(createContext({}))).toBe(true);
  });

  it('should allow admin users', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Permission.BRAND_WRITE]),
    } as unknown as Reflector;
    const guard = new PolicyGuard(reflector);

    expect(guard.canActivate(createContext({ isAdmin: true }))).toBe(true);
  });

  it('should throw when role is missing', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Permission.BRAND_WRITE]),
    } as unknown as Reflector;
    const guard = new PolicyGuard(reflector);

    expect(() => guard.canActivate(createContext({ role: undefined }))).toThrow(
      ForbiddenException,
    );
  });

  it('should throw when permissions are insufficient', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Permission.BRAND_WRITE]),
    } as unknown as Reflector;
    const guard = new PolicyGuard(reflector);

    expect(() =>
      guard.canActivate(createContext({ role: Role.STAFF })),
    ).toThrow(ForbiddenException);
  });

  it('should treat unknown roles as insufficient', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Permission.BRAND_WRITE]),
    } as unknown as Reflector;
    const guard = new PolicyGuard(reflector);

    expect(() =>
      guard.canActivate(createContext({ role: 'UNKNOWN' as Role })),
    ).toThrow(ForbiddenException);
  });

  it('should allow when permissions are sufficient', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Permission.BRAND_WRITE]),
    } as unknown as Reflector;
    const guard = new PolicyGuard(reflector);

    expect(guard.canActivate(createContext({ role: Role.OWNER }))).toBe(true);
  });
});
