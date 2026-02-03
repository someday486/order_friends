import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { ROLE_PERMISSIONS } from '../../modules/auth/authorization/policy';
import { Role } from '../../modules/auth/authorization/roles.enum';
import type { Permission } from '../../modules/auth/authorization/permissions';

@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<Permission[]>(REQUIRE_PERMISSIONS_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];

    if (required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    if (req?.isAdmin) return true;

    const role: Role | undefined = req.role;

    if (!role) {
      throw new ForbiddenException('Missing role (membership required)');
    }

    const allowed = new Set(ROLE_PERMISSIONS[role] ?? []);
    const ok = required.every((p) => allowed.has(p));

    if (!ok) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
