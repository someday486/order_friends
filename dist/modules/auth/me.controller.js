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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../../common/guards/auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
let MeController = class MeController {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    async me(user) {
        const { data: profile, error: profileError } = await this.supabase
            .adminClient()
            .from('profiles')
            .select('is_system_admin')
            .eq('id', user.id)
            .single();
        if (profileError) {
            console.error('Error fetching user profile:', profileError);
        }
        if (profile?.is_system_admin) {
            return {
                user: {
                    id: user.id,
                    email: user.email,
                    role: 'system_admin',
                },
                memberships: [],
                ownedBrands: [],
                isSystemAdmin: true,
            };
        }
        const { data: memberships, error } = await this.supabase
            .adminClient()
            .from('members')
            .select(`
        id,
        role,
        branch_id,
        branches:branch_id (
          id,
          name,
          brand_id,
          brands:brand_id (
            id,
            name,
            owner_user_id
          )
        )
      `)
            .eq('user_id', user.id);
        if (error) {
            console.error('Error fetching user memberships:', error);
        }
        const { data: ownedBrands, error: brandsError } = await this.supabase
            .adminClient()
            .from('brands')
            .select('id, name')
            .eq('owner_user_id', user.id);
        if (brandsError) {
            console.error('Error fetching owned brands:', brandsError);
        }
        let primaryRole = 'customer';
        if (ownedBrands && ownedBrands.length > 0) {
            primaryRole = 'brand_owner';
        }
        else if (memberships && memberships.length > 0) {
            const roles = memberships.map((m) => m.role);
            if (roles.includes('branch_manager')) {
                primaryRole = 'branch_manager';
            }
            else if (roles.includes('staff')) {
                primaryRole = 'staff';
            }
        }
        return {
            user: {
                id: user.id,
                email: user.email,
                role: primaryRole,
            },
            memberships: memberships || [],
            ownedBrands: ownedBrands || [],
            isSystemAdmin: false,
        };
    }
};
exports.MeController = MeController;
__decorate([
    (0, common_1.Get)('/me'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MeController.prototype, "me", null);
exports.MeController = MeController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], MeController);
//# sourceMappingURL=me.controller.js.map