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
var CustomerGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerGuard = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
let CustomerGuard = CustomerGuard_1 = class CustomerGuard {
    supabase;
    logger = new common_1.Logger(CustomerGuard_1.name);
    constructor(supabase) {
        this.supabase = supabase;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const { user, accessToken } = request;
        if (!user || !accessToken) {
            this.logger.warn('CustomerGuard: No user or access token');
            throw new common_1.UnauthorizedException('Authentication required');
        }
        if (request.isAdmin) {
            this.logger.warn(`CustomerGuard: Admin user ${user.id} attempted to access customer area`);
            throw new common_1.UnauthorizedException('Admin users cannot access customer area');
        }
        const sb = this.supabase.adminClient();
        const { data: brandMemberships, error: brandError } = await sb
            .from('brand_members')
            .select('brand_id, role, status')
            .eq('user_id', user.id)
            .eq('status', 'ACTIVE');
        if (brandError) {
            this.logger.error(`CustomerGuard: Failed to check brand memberships for user ${user.id}`, brandError);
            throw new common_1.UnauthorizedException('Failed to verify memberships');
        }
        const { data: ownedBrands, error: ownedError } = await sb
            .from('brands')
            .select('id')
            .eq('owner_user_id', user.id);
        if (ownedError) {
            this.logger.error(`CustomerGuard: Failed to check owned brands for user ${user.id}`, ownedError);
        }
        const allBrandMemberships = [...(brandMemberships || [])];
        if (ownedBrands && ownedBrands.length > 0) {
            const memberBrandIds = new Set(allBrandMemberships.map((m) => m.brand_id));
            for (const brand of ownedBrands) {
                if (!memberBrandIds.has(brand.id)) {
                    allBrandMemberships.push({
                        brand_id: brand.id,
                        role: 'OWNER',
                        status: 'ACTIVE',
                    });
                }
            }
        }
        const { data: branchMemberships, error: branchError } = await sb
            .from('branch_members')
            .select('branch_id, role, status')
            .eq('user_id', user.id)
            .eq('status', 'ACTIVE');
        if (branchError) {
            this.logger.error(`CustomerGuard: Failed to check branch memberships for user ${user.id}`, branchError);
            throw new common_1.UnauthorizedException('Failed to verify memberships');
        }
        const hasBrandMembership = allBrandMemberships.length > 0;
        const hasBranchMembership = branchMemberships && branchMemberships.length > 0;
        if (!hasBrandMembership && !hasBranchMembership) {
            this.logger.warn(`CustomerGuard: User ${user.id} has no active memberships`);
            throw new common_1.UnauthorizedException('No active brand or branch memberships found');
        }
        request.brandMemberships = allBrandMemberships;
        request.branchMemberships = branchMemberships || [];
        this.logger.log(`CustomerGuard: User ${user.id} authorized with ${brandMemberships?.length || 0} brand(s) and ${branchMemberships?.length || 0} branch(es)`);
        return true;
    }
};
exports.CustomerGuard = CustomerGuard;
exports.CustomerGuard = CustomerGuard = CustomerGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], CustomerGuard);
//# sourceMappingURL=customer.guard.js.map