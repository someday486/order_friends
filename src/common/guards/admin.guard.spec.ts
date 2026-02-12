import { ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

describe('AdminGuard', () => {
  const createContext = (req: any) =>
    ({
      switchToHttp: () => ({ getRequest: () => req }),
    }) as any;

  it('should allow admin user', () => {
    const guard = new AdminGuard();
    const ctx = createContext({ isAdmin: true });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw ForbiddenException for non-admin', () => {
    const guard = new AdminGuard();
    const ctx = createContext({ isAdmin: false });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
