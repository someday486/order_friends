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
var CustomerBrandsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerBrandsService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
let CustomerBrandsService = CustomerBrandsService_1 = class CustomerBrandsService {
    supabase;
    logger = new common_1.Logger(CustomerBrandsService_1.name);
    constructor(supabase) {
        this.supabase = supabase;
    }
    async getMyBrands(userId, brandMemberships) {
        this.logger.log(`Fetching brands for user: ${userId}`);
        const brandIds = brandMemberships.map((m) => m.brand_id);
        if (brandIds.length === 0) {
            return [];
        }
        const sb = this.supabase.adminClient();
        const { data, error } = await sb
            .from('brands')
            .select('id, name, biz_name, biz_reg_no, owner_user_id, logo_url, cover_image_url, thumbnail_url, created_at')
            .in('id', brandIds)
            .order('created_at', { ascending: false });
        if (error) {
            this.logger.error(`Failed to fetch brands for user ${userId}`, error);
            throw new Error('Failed to fetch brands');
        }
        const brandsWithRole = data.map((brand) => {
            const membership = brandMemberships.find((m) => m.brand_id === brand.id);
            return {
                ...brand,
                myRole: membership?.role || null,
            };
        });
        this.logger.log(`Fetched ${brandsWithRole.length} brands for user: ${userId}`);
        return brandsWithRole;
    }
    async getMyBrand(brandId, userId, brandMemberships) {
        this.logger.log(`Fetching brand ${brandId} for user: ${userId}`);
        const membership = brandMemberships.find((m) => m.brand_id === brandId);
        if (!membership) {
            this.logger.warn(`User ${userId} attempted to access brand ${brandId} without membership`);
            throw new common_1.ForbiddenException('You do not have access to this brand');
        }
        const sb = this.supabase.adminClient();
        const { data, error } = await sb
            .from('brands')
            .select('id, name, biz_name, biz_reg_no, owner_user_id, logo_url, cover_image_url, thumbnail_url, created_at')
            .eq('id', brandId)
            .single();
        if (error || !data) {
            this.logger.error(`Failed to fetch brand ${brandId}`, error);
            throw new common_1.NotFoundException('Brand not found');
        }
        return {
            ...data,
            myRole: membership.role,
        };
    }
    async updateMyBrand(brandId, updateData, userId, brandMemberships) {
        this.logger.log(`Updating brand ${brandId} by user: ${userId}`);
        const membership = brandMemberships.find((m) => m.brand_id === brandId);
        if (!membership) {
            throw new common_1.ForbiddenException('You do not have access to this brand');
        }
        if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
            this.logger.warn(`User ${userId} with role ${membership.role} attempted to update brand ${brandId}`);
            throw new common_1.ForbiddenException('Only OWNER or ADMIN can update brand information');
        }
        const sb = this.supabase.adminClient();
        const { name, biz_name, biz_reg_no, logo_url, cover_image_url, thumbnail_url } = updateData;
        const updateFields = {};
        if (name !== undefined)
            updateFields.name = name;
        if (biz_name !== undefined)
            updateFields.biz_name = biz_name;
        if (biz_reg_no !== undefined)
            updateFields.biz_reg_no = biz_reg_no;
        if (logo_url !== undefined)
            updateFields.logo_url = logo_url;
        if (cover_image_url !== undefined)
            updateFields.cover_image_url = cover_image_url;
        if (thumbnail_url !== undefined)
            updateFields.thumbnail_url = thumbnail_url;
        const { data, error } = await sb
            .from('brands')
            .update(updateFields)
            .eq('id', brandId)
            .select()
            .single();
        if (error || !data) {
            this.logger.error(`Failed to update brand ${brandId}`, error);
            throw new Error('Failed to update brand');
        }
        this.logger.log(`Brand ${brandId} updated successfully`);
        return {
            ...data,
            myRole: membership.role,
        };
    }
};
exports.CustomerBrandsService = CustomerBrandsService;
exports.CustomerBrandsService = CustomerBrandsService = CustomerBrandsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], CustomerBrandsService);
//# sourceMappingURL=customer-brands.service.js.map