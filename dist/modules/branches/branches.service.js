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
exports.BranchesService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
let BranchesService = class BranchesService {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    getClient(accessToken, isAdmin) {
        return isAdmin
            ? this.supabase.adminClient()
            : this.supabase.userClient(accessToken);
    }
    async getBranches(accessToken, brandId, isAdmin) {
        const sb = this.getClient(accessToken, isAdmin);
        const { data, error } = await sb
            .from('branches')
            .select('id, brand_id, name, slug, logo_url, cover_image_url, thumbnail_url, created_at')
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false });
        if (error) {
            throw new Error(`[branches.getBranches] ${error.message}`);
        }
        return (data ?? []).map((row) => ({
            id: row.id,
            brandId: row.brand_id,
            name: row.name,
            slug: row.slug ?? '',
            logoUrl: row.logo_url ?? null,
            thumbnailUrl: row.thumbnail_url ?? null,
            createdAt: row.created_at ?? '',
        }));
    }
    async getBranch(accessToken, branchId, isAdmin) {
        const sb = this.getClient(accessToken, isAdmin);
        const { data, error } = await sb
            .from('branches')
            .select('id, brand_id, name, slug, logo_url, cover_image_url, thumbnail_url, created_at')
            .eq('id', branchId)
            .single();
        if (error) {
            throw new common_1.NotFoundException(`[branches.getBranch] ${error.message}`);
        }
        if (!data) {
            throw new common_1.NotFoundException('가게를 찾을 수 없습니다.');
        }
        return {
            id: data.id,
            brandId: data.brand_id,
            name: data.name,
            slug: data.slug ?? '',
            logoUrl: data.logo_url ?? null,
            coverImageUrl: data.cover_image_url ?? null,
            thumbnailUrl: data.thumbnail_url ?? null,
            createdAt: data.created_at ?? '',
        };
    }
    async createBranch(accessToken, dto, isAdmin) {
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
        if (isAdmin) {
            const sb = this.supabase.adminClient();
            const { data, error } = await sb
                .from('branches')
                .insert(insertPayload)
                .select('id, brand_id, name, slug, logo_url, cover_image_url, thumbnail_url, created_at')
                .single();
            if (error) {
                if (error.code === '23505') {
                    throw new common_1.ConflictException('이미 사용 중인 가게 URL(slug)입니다.');
                }
                throw new Error(`[branches.createBranch] ${error.message}`);
            }
            return {
                id: data.id,
                brandId: data.brand_id,
                name: data.name,
                slug: data.slug ?? '',
                createdAt: data.created_at ?? '',
            };
        }
        const tryUserClient = async () => {
            const sb = this.supabase.userClient(accessToken);
            return sb
                .from('branches')
                .insert(insertPayload)
                .select('id, brand_id, name, slug, logo_url, cover_image_url, thumbnail_url, created_at')
                .single();
        };
        const tryAdminClient = async () => {
            const sb = this.supabase.adminClient();
            return sb
                .from('branches')
                .insert(insertPayload)
                .select('id, brand_id, name, slug, logo_url, cover_image_url, thumbnail_url, created_at')
                .single();
        };
        let data;
        let error;
        ({ data, error } = await tryUserClient());
        if (error?.message?.includes('row-level security')) {
            ({ data, error } = await tryAdminClient());
        }
        if (error) {
            if (error.code === '23505') {
                throw new common_1.ConflictException('이미 사용 중인 가게 URL(slug)입니다.');
            }
            throw new Error(`[branches.createBranch] ${error.message}`);
        }
        return {
            id: data.id,
            brandId: data.brand_id,
            name: data.name,
            slug: data.slug ?? '',
            logoUrl: data.logo_url ?? null,
            coverImageUrl: data.cover_image_url ?? null,
            thumbnailUrl: data.thumbnail_url ?? null,
            createdAt: data.created_at ?? '',
        };
    }
    async updateBranch(accessToken, branchId, dto, isAdmin) {
        const sb = this.getClient(accessToken, isAdmin);
        const updateData = {};
        if (dto.name !== undefined)
            updateData.name = dto.name;
        if (dto.slug !== undefined)
            updateData.slug = dto.slug;
        if (dto.logoUrl !== undefined)
            updateData.logo_url = dto.logoUrl;
        if (dto.coverImageUrl !== undefined)
            updateData.cover_image_url = dto.coverImageUrl;
        if (dto.thumbnailUrl !== undefined)
            updateData.thumbnail_url = dto.thumbnailUrl;
        if (Object.keys(updateData).length === 0) {
            return this.getBranch(accessToken, branchId, isAdmin);
        }
        const { data, error } = await sb
            .from('branches')
            .update(updateData)
            .eq('id', branchId)
            .select('id, brand_id, name, slug, logo_url, cover_image_url, thumbnail_url, created_at')
            .maybeSingle();
        if (error) {
            if (error.code === '23505') {
                throw new common_1.ConflictException('이미 사용 중인 가게 URL(slug)입니다.');
            }
            throw new Error(`[branches.updateBranch] ${error.message}`);
        }
        if (!data) {
            throw new common_1.NotFoundException('가게를 찾을 수 없거나 권한이 없습니다.');
        }
        return {
            id: data.id,
            brandId: data.brand_id,
            name: data.name,
            slug: data.slug ?? '',
            logoUrl: data.logo_url ?? null,
            coverImageUrl: data.cover_image_url ?? null,
            thumbnailUrl: data.thumbnail_url ?? null,
            createdAt: data.created_at ?? '',
        };
    }
    async deleteBranch(accessToken, branchId, isAdmin) {
        const sb = this.getClient(accessToken, isAdmin);
        const { error } = await sb.from('branches').delete().eq('id', branchId);
        if (error) {
            throw new Error(`[branches.deleteBranch] ${error.message}`);
        }
        return { deleted: true };
    }
};
exports.BranchesService = BranchesService;
exports.BranchesService = BranchesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], BranchesService);
//# sourceMappingURL=branches.service.js.map