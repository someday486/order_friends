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
var CustomerBranchesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerBranchesService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
let CustomerBranchesService = CustomerBranchesService_1 = class CustomerBranchesService {
    supabase;
    logger = new common_1.Logger(CustomerBranchesService_1.name);
    constructor(supabase) {
        this.supabase = supabase;
    }
    checkBrandAccess(brandId, brandMemberships) {
        const membership = brandMemberships.find((m) => m.brand_id === brandId);
        if (!membership) {
            throw new common_1.ForbiddenException('You do not have access to this brand');
        }
        return membership;
    }
    async checkBranchAccess(branchId, userId, brandMemberships, branchMemberships) {
        const sb = this.supabase.adminClient();
        const { data: branch, error } = await sb
            .from('branches')
            .select('id, brand_id, name, slug, logo_url, cover_image_url, thumbnail_url, created_at')
            .eq('id', branchId)
            .single();
        if (error || !branch) {
            throw new common_1.NotFoundException('Branch not found');
        }
        const branchMembership = branchMemberships.find((m) => m.branch_id === branchId);
        if (branchMembership) {
            return { branchMembership, branch };
        }
        const brandMembership = brandMemberships.find((m) => m.brand_id === branch.brand_id);
        if (brandMembership) {
            return { brandMembership, branch };
        }
        throw new common_1.ForbiddenException('You do not have access to this branch');
    }
    checkModificationPermission(role, action, userId) {
        if (role !== 'OWNER' && role !== 'ADMIN') {
            this.logger.warn(`User ${userId} with role ${role} attempted to ${action}`);
            throw new common_1.ForbiddenException(`Only OWNER or ADMIN can ${action}`);
        }
    }
    async getMyBranches(userId, brandId, brandMemberships, branchMemberships) {
        this.logger.log(`Fetching branches for brand ${brandId} by user ${userId}`);
        this.checkBrandAccess(brandId, brandMemberships);
        const sb = this.supabase.adminClient();
        const { data, error } = await sb
            .from('branches')
            .select('id, brand_id, name, slug, logo_url, cover_image_url, thumbnail_url, created_at')
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false });
        if (error) {
            this.logger.error(`Failed to fetch branches for brand ${brandId}`, error);
            throw new Error('Failed to fetch branches');
        }
        const branchesWithRole = (data || []).map((branch) => {
            const branchMembership = branchMemberships.find((m) => m.branch_id === branch.id);
            const brandMembership = brandMemberships.find((m) => m.brand_id === branch.brand_id);
            return {
                id: branch.id,
                brandId: branch.brand_id,
                name: branch.name,
                slug: branch.slug,
                logoUrl: branch.logo_url ?? null,
                thumbnailUrl: branch.thumbnail_url ?? null,
                createdAt: branch.created_at,
                myRole: branchMembership?.role || brandMembership?.role || null,
            };
        });
        this.logger.log(`Fetched ${branchesWithRole.length} branches for brand ${brandId}`);
        return branchesWithRole;
    }
    async getMyBranch(userId, branchId, brandMemberships, branchMemberships) {
        this.logger.log(`Fetching branch ${branchId} by user ${userId}`);
        const { branchMembership, brandMembership, branch } = await this.checkBranchAccess(branchId, userId, brandMemberships, branchMemberships);
        return {
            id: branch.id,
            brandId: branch.brand_id,
            name: branch.name,
            slug: branch.slug,
            logoUrl: branch.logo_url ?? null,
            coverImageUrl: branch.cover_image_url ?? null,
            thumbnailUrl: branch.thumbnail_url ?? null,
            createdAt: branch.created_at,
            myRole: branchMembership?.role || brandMembership?.role,
        };
    }
    async createMyBranch(userId, dto, brandMemberships) {
        this.logger.log(`Creating branch for brand ${dto.brandId} by user ${userId}`);
        const membership = this.checkBrandAccess(dto.brandId, brandMemberships);
        this.checkModificationPermission(membership.role, 'create branches', userId);
        const sb = this.supabase.adminClient();
        const insertPayload = {
            brand_id: dto.brandId,
            name: dto.name,
            slug: dto.slug,
        };
        if (dto.logoUrl)
            insertPayload.logo_url = dto.logoUrl;
        if (dto.coverImageUrl)
            insertPayload.cover_image_url = dto.coverImageUrl;
        if (dto.thumbnailUrl)
            insertPayload.thumbnail_url = dto.thumbnailUrl;
        const { data, error } = await sb
            .from('branches')
            .insert(insertPayload)
            .select('id, brand_id, name, slug, logo_url, cover_image_url, thumbnail_url, created_at')
            .single();
        if (error) {
            if (error.code === '23505') {
                throw new common_1.ForbiddenException('This branch slug is already in use for this brand');
            }
            this.logger.error(`Failed to create branch for brand ${dto.brandId}`, error);
            throw new Error('Failed to create branch');
        }
        this.logger.log(`Branch ${data.id} created successfully`);
        return {
            id: data.id,
            brandId: data.brand_id,
            name: data.name,
            slug: data.slug,
            logoUrl: data.logo_url ?? null,
            coverImageUrl: data.cover_image_url ?? null,
            thumbnailUrl: data.thumbnail_url ?? null,
            createdAt: data.created_at,
            myRole: membership.role,
        };
    }
    async updateMyBranch(userId, branchId, dto, brandMemberships, branchMemberships) {
        this.logger.log(`Updating branch ${branchId} by user ${userId}`);
        const { branchMembership, brandMembership, branch } = await this.checkBranchAccess(branchId, userId, brandMemberships, branchMemberships);
        const role = branchMembership?.role || brandMembership?.role;
        if (!role) {
            throw new common_1.ForbiddenException('You do not have access to this branch');
        }
        this.checkModificationPermission(role, 'update branches', userId);
        const sb = this.supabase.adminClient();
        const updateFields = {};
        if (dto.name !== undefined)
            updateFields.name = dto.name;
        if (dto.slug !== undefined)
            updateFields.slug = dto.slug;
        if (dto.logoUrl !== undefined)
            updateFields.logo_url = dto.logoUrl;
        if (dto.coverImageUrl !== undefined)
            updateFields.cover_image_url = dto.coverImageUrl;
        if (dto.thumbnailUrl !== undefined)
            updateFields.thumbnail_url = dto.thumbnailUrl;
        if (Object.keys(updateFields).length === 0) {
            return this.getMyBranch(userId, branchId, brandMemberships, branchMemberships);
        }
        const { data, error } = await sb
            .from('branches')
            .update(updateFields)
            .eq('id', branchId)
            .select('id, brand_id, name, slug, logo_url, cover_image_url, thumbnail_url, created_at')
            .single();
        if (error) {
            if (error.code === '23505') {
                throw new common_1.ForbiddenException('This branch slug is already in use for this brand');
            }
            this.logger.error(`Failed to update branch ${branchId}`, error);
            throw new Error('Failed to update branch');
        }
        this.logger.log(`Branch ${branchId} updated successfully`);
        return {
            id: data.id,
            brandId: data.brand_id,
            name: data.name,
            slug: data.slug,
            logoUrl: data.logo_url ?? null,
            coverImageUrl: data.cover_image_url ?? null,
            thumbnailUrl: data.thumbnail_url ?? null,
            createdAt: data.created_at,
            myRole: role,
        };
    }
    async deleteMyBranch(userId, branchId, brandMemberships, branchMemberships) {
        this.logger.log(`Deleting branch ${branchId} by user ${userId}`);
        const { branchMembership, brandMembership } = await this.checkBranchAccess(branchId, userId, brandMemberships, branchMemberships);
        const role = branchMembership?.role || brandMembership?.role;
        if (!role) {
            throw new common_1.ForbiddenException('You do not have access to this branch');
        }
        this.checkModificationPermission(role, 'delete branches', userId);
        const sb = this.supabase.adminClient();
        const { error } = await sb.from('branches').delete().eq('id', branchId);
        if (error) {
            this.logger.error(`Failed to delete branch ${branchId}`, error);
            throw new Error('Failed to delete branch');
        }
        this.logger.log(`Branch ${branchId} deleted successfully`);
        return { deleted: true };
    }
};
exports.CustomerBranchesService = CustomerBranchesService;
exports.CustomerBranchesService = CustomerBranchesService = CustomerBranchesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], CustomerBranchesService);
//# sourceMappingURL=customer-branches.service.js.map