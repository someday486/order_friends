import type { Request } from 'express';
import type { RequestUser } from '../decorators/current-user.decorator';
import type { Role } from '../../modules/auth/authorization/roles.enum';
export type BrandMembership = {
    brand_id: string;
    role: string;
    status: string;
};
export type BranchMembership = {
    branch_id: string;
    role: string;
    status: string;
};
export type AuthRequest = Request & {
    accessToken?: string;
    user?: RequestUser;
    isAdmin?: boolean;
    role?: Role;
    brandId?: string;
    branchId?: string;
    brandMemberships?: BrandMembership[];
    branchMemberships?: BranchMembership[];
};
