"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MembershipGuard = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
const roles_enum_1 = require("../../modules/auth/authorization/roles.enum");
const member_dto_1 = require("../../modules/members/dto/member.dto");
let MembershipGuard = class MembershipGuard {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    normalizeId(value) {
        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed.length > 0 ? trimmed : undefined;
        }
        if (Array.isArray(value) && typeof value[0] === 'string') {
            const trimmed = value[0].trim();
            return trimmed.length > 0 ? trimmed : undefined;
        }
        return undefined;
    }
    getRequestId(req, key) {
        const fromParams = this.normalizeId(req?.params?.[key]);
        if (fromParams)
            return fromParams;
        const fromQuery = this.normalizeId(req?.query?.[key]);
        if (fromQuery)
            return fromQuery;
        const fromBody = this.normalizeId(req?.body?.[key]);
        if (fromBody)
            return fromBody;
        return undefined;
    }
    mapBrandRole(role) {
        if (role === member_dto_1.BrandRole.OWNER)
            return roles_enum_1.Role.OWNER;
        return roles_enum_1.Role.STAFF;
    }
    mapBranchRole(role) {
        if (role === member_dto_1.BranchRole.BRANCH_OWNER)
            return roles_enum_1.Role.OWNER;
        return roles_enum_1.Role.STAFF;
    }
    async canActivate(ctx) {
        const req = ctx.switchToHttp().getRequest();
        const userId = req?.user?.id;
        const accessToken = req?.accessToken;
        if (!userId || !accessToken) {
            throw new common_1.ForbiddenException('Missing user context');
        }
        if (req?.isAdmin) {
            const brandId = this.getRequestId(req, 'brandId');
            const branchId = this.getRequestId(req, 'branchId');
            if (brandId)
                req.brandId = brandId;
            if (branchId)
                req.branchId = branchId;
            req.role = roles_enum_1.Role.OWNER;
            return true;
        }
        const brandId = this.getRequestId(req, 'brandId');
        const branchId = this.getRequestId(req, 'branchId');
        if (!brandId && !branchId) {
            const sb = this.supabase.userClient(accessToken);
            const { data, error } = await sb
                .from('brand_members')
                .select('role')
                .eq('user_id', userId)
                .eq('status', member_dto_1.MemberStatus.ACTIVE);
            if (!error && data && data.length > 0) {
                const hasOwner = data.some((row) => row.role === member_dto_1.BrandRole.OWNER);
                req.role = hasOwner ? roles_enum_1.Role.OWNER : roles_enum_1.Role.STAFF;
            }
            return true;
        }
        const sb = this.supabase.userClient(accessToken);
        if (brandId) {
            const { data, error } = await sb
                .from('brand_members')
                .select('brand_id, role, status')
                .eq('brand_id', brandId)
                .eq('user_id', userId)
                .maybeSingle();
            if (error) {
                throw new common_1.ForbiddenException('Brand membership check failed');
            }
            if (!data || data.status !== member_dto_1.MemberStatus.ACTIVE) {
                throw new common_1.ForbiddenException('Brand membership required');
            }
            req.brandId = brandId;
            req.role = this.mapBrandRole(data.role);
            return true;
        }
        if (branchId) {
            const { data, error } = await sb
                .from('branch_members')
                .select('branch_id, role, status')
                .eq('branch_id', branchId)
                .eq('user_id', userId)
                .maybeSingle();
            if (error) {
                throw new common_1.ForbiddenException('Branch membership check failed');
            }
            if (data && data.status === member_dto_1.MemberStatus.ACTIVE) {
                req.branchId = branchId;
                req.role = this.mapBranchRole(data.role);
                return true;
            }
            const { data: branchRow, error: branchError } = await sb
                .from('branches')
                .select('id, brand_id')
                .eq('id', branchId)
                .maybeSingle();
            if (branchError || !branchRow?.brand_id) {
                throw new common_1.ForbiddenException('Branch not found or not permitted');
            }
            const { data: brandMember, error: brandError } = await sb
                .from('brand_members')
                .select('brand_id, role, status')
                .eq('brand_id', branchRow.brand_id)
                .eq('user_id', userId)
                .maybeSingle();
            if (brandError) {
                throw new common_1.ForbiddenException('Brand membership check failed');
            }
            if (!brandMember || brandMember.status !== member_dto_1.MemberStatus.ACTIVE) {
                throw new common_1.ForbiddenException('Branch membership required');
            }
            req.branchId = branchId;
            req.brandId = branchRow.brand_id;
            req.role = this.mapBrandRole(brandMember.role);
            return true;
        }
        return true;
    }
};
exports.MembershipGuard = MembershipGuard;
exports.MembershipGuard = MembershipGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], MembershipGuard);
//# sourceMappingURL=membership.guard.js.map