import type { Request } from 'express';
import type { RequestUser } from '../decorators/current-user.decorator';
import type { Role } from '../../modules/auth/authorization/roles.enum';
export type AuthRequest = Request & {
    accessToken?: string;
    user?: RequestUser;
    isAdmin?: boolean;
    role?: Role;
    brandId?: string;
    branchId?: string;
};
