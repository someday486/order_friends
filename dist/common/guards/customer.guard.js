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
const MEMBERSHIP_CACHE_TTL_MS = 30 * 1000;
let CustomerGuard = CustomerGuard_1 = class CustomerGuard {
    supabase;
    logger = new common_1.Logger(CustomerGuard_1.name);
    membershipCache = new Map();
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
        const now = Date.now();
        const cached = this.membershipCache.get(user.id);
        if (cached && now < cached.expiresAt) {
            request.brandMemberships = cached.brandMemberships;
            request.branchMemberships = cached.branchMemberships;
            return true;
        }
        const sb = this.supabase.adminClient();
        const [brandResult, ownedResult, branchResult] = await Promise.all([
            sb
                .from('brand_members')
                .select('brand_id, role, status')
                .eq('user_id', user.id)
                .eq('status', 'ACTIVE'),
            sb.from('brands').select('id').eq('owner_user_id', user.id),
            sb
                .from('branch_members')
                .select('branch_id, role, status')
                .eq('user_id', user.id)
                .eq('status', 'ACTIVE'),
        ]);
        if (brandResult.error) {
            this.logger.error(`CustomerGuard: Failed to check brand memberships for user ${user.id}`, brandResult.error);
            throw new common_1.UnauthorizedException('Failed to verify memberships');
        }
        if (branchResult.error) {
            this.logger.error(`CustomerGuard: Failed to check branch memberships for user ${user.id}`, branchResult.error);
            throw new common_1.UnauthorizedException('Failed to verify memberships');
        }
        if (ownedResult.error) {
            this.logger.error(`CustomerGuard: Failed to check owned brands for user ${user.id}`, ownedResult.error);
        }
        const allBrandMemberships = [
            ...(brandResult.data || []),
        ];
        if (ownedResult.data && ownedResult.data.length > 0) {
            const memberBrandIds = new Set(allBrandMemberships.map((m) => m.brand_id));
            for (const brand of ownedResult.data) {
                if (!memberBrandIds.has(brand.id)) {
                    allBrandMemberships.push({
                        brand_id: brand.id,
                        role: 'OWNER',
                        status: 'ACTIVE',
                    });
                }
            }
        }
        const allBranchMemberships = branchResult.data || [];
        if (allBrandMemberships.length === 0 &&
            allBranchMemberships.length === 0) {
            this.logger.warn(`CustomerGuard: User ${user.id} has no active memberships`);
            throw new common_1.UnauthorizedException('No active brand or branch memberships found');
        }
        this.evictExpired(now);
        this.membershipCache.set(user.id, {
            brandMemberships: allBrandMemberships,
            branchMemberships: allBranchMemberships,
            expiresAt: now + MEMBERSHIP_CACHE_TTL_MS,
        });
        request.brandMemberships = allBrandMemberships;
        request.branchMemberships = allBranchMemberships;
        this.logger.log(`CustomerGuard: User ${user.id} authorized with ${allBrandMemberships.length} brand(s) and ${allBranchMemberships.length} branch(es)`);
        return true;
    }
    evictExpired(now) {
        if (this.membershipCache.size < 200)
            return;
        for (const [key, entry] of this.membershipCache) {
            if (now >= entry.expiresAt) {
                this.membershipCache.delete(key);
            }
        }
    }
};
exports.CustomerGuard = CustomerGuard;
exports.CustomerGuard = CustomerGuard = CustomerGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], CustomerGuard);
//# sourceMappingURL=customer.guard.js.map