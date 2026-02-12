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
exports.BrandsService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
let BrandsService = class BrandsService {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    getClient(accessToken, isAdmin) {
        return isAdmin
            ? this.supabase.adminClient()
            : this.supabase.userClient(accessToken);
    }
    async getMyBrands(accessToken, isAdmin) {
        if (isAdmin) {
            const sb = this.supabase.adminClient();
            const { data, error } = await sb
                .from('brands')
                .select('id, name, slug, biz_name, biz_reg_no, logo_url, cover_image_url, created_at')
                .order('created_at', { ascending: false });
            if (error) {
                throw new Error(`[brands.getMyBrands] ${error.message}`);
            }
            return (data ?? []).map((row) => ({
                id: row.id,
                name: row.name,
                slug: row.slug ?? null,
                bizName: row.biz_name ?? null,
                bizRegNo: row.biz_reg_no ?? null,
                logoUrl: row.logo_url ?? null,
                createdAt: row.created_at ?? '',
            }));
        }
        const sb = this.supabase.userClient(accessToken);
        const { data, error } = await sb
            .from('brand_members')
            .select(`
        brand_id,
        brands (
          id, name, slug, biz_name, biz_reg_no, logo_url, cover_image_url, created_at
        )
      `)
            .eq('status', 'ACTIVE');
        if (error) {
            throw new Error(`[brands.getMyBrands] ${error.message}`);
        }
        return (data ?? [])
            .filter((row) => row.brands)
            .map((row) => ({
            id: row.brands.id,
            name: row.brands.name,
            slug: row.brands.slug ?? null,
            bizName: row.brands.biz_name ?? null,
            bizRegNo: row.brands.biz_reg_no ?? null,
            logoUrl: row.brands.logo_url ?? null,
            createdAt: row.brands.created_at ?? '',
        }));
    }
    async getBrand(accessToken, brandId, isAdmin) {
        const sb = this.getClient(accessToken, isAdmin);
        const { data, error } = await sb
            .from('brands')
            .select('id, name, slug, owner_user_id, biz_name, biz_reg_no, rep_name, address, biz_cert_url, logo_url, cover_image_url, created_at')
            .eq('id', brandId)
            .single();
        if (error) {
            throw new common_1.NotFoundException(`[brands.getBrand] ${error.message}`);
        }
        if (!data) {
            throw new common_1.NotFoundException('브랜드를 찾을 수 없습니다.');
        }
        return {
            id: data.id,
            name: data.name,
            slug: data.slug ?? null,
            ownerUserId: data.owner_user_id ?? null,
            bizName: data.biz_name ?? null,
            bizRegNo: data.biz_reg_no ?? null,
            repName: data.rep_name ?? null,
            address: data.address ?? null,
            bizCertUrl: data.biz_cert_url ?? null,
            logoUrl: data.logo_url ?? null,
            coverImageUrl: data.cover_image_url ?? null,
            createdAt: data.created_at ?? '',
        };
    }
    async createBrand(accessToken, dto, _isAdmin) {
        void _isAdmin;
        const userSb = this.supabase.userClient(accessToken);
        const { data: userData, error: userError } = await userSb.auth.getUser();
        if (userError || !userData.user) {
            throw new common_1.ForbiddenException('사용자 정보를 가져올 수 없습니다.');
        }
        const userId = userData.user.id;
        const adminSb = this.supabase.adminClient();
        const { error: profileErr } = await adminSb
            .from('profiles')
            .upsert({ id: userId }, { onConflict: 'id' });
        if (profileErr) {
            throw new Error(`[brands.createBrand] profile upsert: ${profileErr.message}`);
        }
        const { data: brand, error: brandError } = await adminSb
            .from('brands')
            .insert({
            name: dto.name,
            slug: dto.slug ?? null,
            owner_user_id: userId,
            biz_name: dto.bizName ?? null,
            biz_reg_no: dto.bizRegNo ?? null,
            rep_name: dto.repName ?? null,
            address: dto.address ?? null,
            biz_cert_url: dto.bizCertUrl ?? null,
            logo_url: dto.logoUrl ?? null,
            cover_image_url: dto.coverImageUrl ?? null,
        })
            .select('id, name, slug, owner_user_id, biz_name, biz_reg_no, rep_name, address, biz_cert_url, logo_url, cover_image_url, created_at')
            .single();
        if (brandError || !brand) {
            throw new Error(`[brands.createBrand] brand insert: ${brandError?.message ?? 'unknown'}`);
        }
        const { error: memberError } = await adminSb.from('brand_members').insert({
            brand_id: brand.id,
            user_id: userId,
            role: 'OWNER',
            status: 'ACTIVE',
        });
        if (memberError) {
            await adminSb.from('brands').delete().eq('id', brand.id);
            throw new Error(`[brands.createBrand] member insert: ${memberError.message}`);
        }
        return {
            id: brand.id,
            name: brand.name,
            slug: brand.slug ?? null,
            ownerUserId: brand.owner_user_id ?? null,
            bizName: brand.biz_name ?? null,
            bizRegNo: brand.biz_reg_no ?? null,
            repName: brand.rep_name ?? null,
            address: brand.address ?? null,
            bizCertUrl: brand.biz_cert_url ?? null,
            createdAt: brand.created_at ?? '',
        };
    }
    async updateBrand(accessToken, brandId, dto, isAdmin) {
        const updateData = {};
        if (dto.name !== undefined)
            updateData.name = dto.name;
        if (dto.slug !== undefined)
            updateData.slug = dto.slug;
        if (dto.bizName !== undefined)
            updateData.biz_name = dto.bizName;
        if (dto.bizRegNo !== undefined)
            updateData.biz_reg_no = dto.bizRegNo;
        if (dto.repName !== undefined)
            updateData.rep_name = dto.repName;
        if (dto.address !== undefined)
            updateData.address = dto.address;
        if (dto.bizCertUrl !== undefined)
            updateData.biz_cert_url = dto.bizCertUrl;
        if (dto.logoUrl !== undefined)
            updateData.logo_url = dto.logoUrl;
        if (dto.coverImageUrl !== undefined)
            updateData.cover_image_url = dto.coverImageUrl;
        if (Object.keys(updateData).length === 0) {
            return this.getBrand(accessToken, brandId, isAdmin);
        }
        const adminSb = this.supabase.adminClient();
        if (!isAdmin) {
            const userSb = this.supabase.userClient(accessToken);
            const { data: userData, error: userError } = await userSb.auth.getUser();
            if (userError || !userData.user) {
                throw new common_1.ForbiddenException('사용자 정보를 가져올 수 없습니다.');
            }
            const { data: membership, error: memError } = await adminSb
                .from('brand_members')
                .select('role, status')
                .eq('brand_id', brandId)
                .eq('user_id', userData.user.id)
                .maybeSingle();
            if (memError) {
                throw new Error(`[brands.updateBrand] membership check: ${memError.message}`);
            }
            if (!membership || membership.status !== 'ACTIVE') {
                throw new common_1.ForbiddenException('브랜드 수정 권한이 없습니다.');
            }
        }
        const { data, error } = await adminSb
            .from('brands')
            .update(updateData)
            .eq('id', brandId)
            .select('id, name, slug, owner_user_id, biz_name, biz_reg_no, rep_name, address, biz_cert_url, logo_url, cover_image_url, created_at')
            .maybeSingle();
        if (error) {
            throw new Error(`[brands.updateBrand] ${error.message}`);
        }
        if (!data) {
            throw new common_1.NotFoundException('브랜드를 찾을 수 없거나 권한이 없습니다.');
        }
        return {
            id: data.id,
            name: data.name,
            slug: data.slug ?? null,
            ownerUserId: data.owner_user_id ?? null,
            bizName: data.biz_name ?? null,
            bizRegNo: data.biz_reg_no ?? null,
            repName: data.rep_name ?? null,
            address: data.address ?? null,
            bizCertUrl: data.biz_cert_url ?? null,
            logoUrl: data.logo_url ?? null,
            coverImageUrl: data.cover_image_url ?? null,
            createdAt: data.created_at ?? '',
        };
    }
    async deleteBrand(accessToken, brandId, isAdmin) {
        const adminSb = this.supabase.adminClient();
        if (!isAdmin) {
            const userSb = this.supabase.userClient(accessToken);
            const { data: userData, error: userError } = await userSb.auth.getUser();
            if (userError || !userData.user) {
                throw new common_1.ForbiddenException('사용자 정보를 가져올 수 없습니다.');
            }
            const { data: membership, error: memError } = await adminSb
                .from('brand_members')
                .select('role, status')
                .eq('brand_id', brandId)
                .eq('user_id', userData.user.id)
                .maybeSingle();
            if (memError) {
                throw new Error(`[brands.deleteBrand] membership check: ${memError.message}`);
            }
            if (!membership || membership.status !== 'ACTIVE') {
                throw new common_1.ForbiddenException('브랜드 삭제 권한이 없습니다.');
            }
        }
        const { error } = await adminSb.from('brands').delete().eq('id', brandId);
        if (error) {
            throw new Error(`[brands.deleteBrand] ${error.message}`);
        }
        return { deleted: true };
    }
};
exports.BrandsService = BrandsService;
exports.BrandsService = BrandsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], BrandsService);
//# sourceMappingURL=brands.service.js.map