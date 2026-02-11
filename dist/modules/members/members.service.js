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
exports.MembersService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
const member_dto_1 = require("./dto/member.dto");
let MembersService = class MembersService {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    getClient(accessToken, isAdmin) {
        return isAdmin
            ? this.supabase.adminClient()
            : this.supabase.userClient(accessToken);
    }
    async getBrandMembers(accessToken, brandId, isAdmin) {
        const sb = this.getClient(accessToken, isAdmin);
        const { data, error } = await sb
            .from('brand_members')
            .select(`
        brand_id,
        user_id,
        role,
        status,
        created_at,
        profiles (
          id,
          display_name
        )
      `)
            .eq('brand_id', brandId)
            .order('created_at', { ascending: true });
        if (error) {
            throw new Error(`[members.getBrandMembers] ${error.message}`);
        }
        const emailMap = {};
        return (data ?? []).map((row) => ({
            id: `${row.brand_id}-${row.user_id}`,
            brandId: row.brand_id,
            userId: row.user_id,
            email: emailMap[row.user_id] ?? null,
            displayName: row.profiles?.display_name ?? null,
            role: row.role,
            status: row.status,
            createdAt: row.created_at ?? '',
        }));
    }
    async inviteBrandMember(accessToken, dto, _isAdmin) {
        void accessToken;
        void dto;
        void _isAdmin;
        throw new common_1.BadRequestException('?대찓??珥덈? 湲곕뒫? 異뷀썑 援ы쁽 ?덉젙?낅땲?? ?꾩옱???ъ슜??ID濡?吏곸젒 異붽??댁＜?몄슂.');
    }
    async addBrandMember(accessToken, brandId, userId, role = member_dto_1.BrandRole.MEMBER, isAdmin) {
        const sb = this.getClient(accessToken, isAdmin);
        const { data: existing } = await sb
            .from('brand_members')
            .select('user_id')
            .eq('brand_id', brandId)
            .eq('user_id', userId)
            .maybeSingle();
        if (existing) {
            throw new common_1.BadRequestException('?대? 釉뚮옖??硫ㅻ쾭?낅땲??');
        }
        const { data, error } = await sb
            .from('brand_members')
            .insert({
            brand_id: brandId,
            user_id: userId,
            role,
            status: member_dto_1.MemberStatus.ACTIVE,
        })
            .select('brand_id, user_id, role, status, created_at')
            .single();
        if (error) {
            throw new Error(`[members.addBrandMember] ${error.message}`);
        }
        return {
            id: `${data.brand_id}-${data.user_id}`,
            brandId: data.brand_id,
            userId: data.user_id,
            email: null,
            displayName: null,
            role: data.role,
            status: data.status,
            createdAt: data.created_at ?? '',
        };
    }
    async updateBrandMember(accessToken, brandId, userId, dto, isAdmin) {
        const sb = this.getClient(accessToken, isAdmin);
        const updateData = {};
        if (dto.role !== undefined)
            updateData.role = dto.role;
        if (dto.status !== undefined)
            updateData.status = dto.status;
        if (Object.keys(updateData).length === 0) {
            throw new common_1.BadRequestException('?섏젙???댁슜???놁뒿?덈떎.');
        }
        const { data, error } = await sb
            .from('brand_members')
            .update(updateData)
            .eq('brand_id', brandId)
            .eq('user_id', userId)
            .select('brand_id, user_id, role, status, created_at')
            .maybeSingle();
        if (error) {
            throw new Error(`[members.updateBrandMember] ${error.message}`);
        }
        if (!data) {
            throw new common_1.NotFoundException('硫ㅻ쾭瑜?李얠쓣 ???놁뒿?덈떎.');
        }
        return {
            id: `${data.brand_id}-${data.user_id}`,
            brandId: data.brand_id,
            userId: data.user_id,
            email: null,
            displayName: null,
            role: data.role,
            status: data.status,
            createdAt: data.created_at ?? '',
        };
    }
    async removeBrandMember(accessToken, brandId, userId, isAdmin) {
        const sb = this.getClient(accessToken, isAdmin);
        const { error } = await sb
            .from('brand_members')
            .delete()
            .eq('brand_id', brandId)
            .eq('user_id', userId);
        if (error) {
            throw new Error(`[members.removeBrandMember] ${error.message}`);
        }
        return { deleted: true };
    }
    async getBranchMembers(accessToken, branchId, isAdmin) {
        const sb = this.getClient(accessToken, isAdmin);
        const { data, error } = await sb
            .from('branch_members')
            .select(`
        branch_id,
        user_id,
        role,
        status,
        created_at,
        profiles (
          id,
          display_name
        )
      `)
            .eq('branch_id', branchId)
            .order('created_at', { ascending: true });
        if (error) {
            throw new Error(`[members.getBranchMembers] ${error.message}`);
        }
        return (data ?? []).map((row) => ({
            id: `${row.branch_id}-${row.user_id}`,
            branchId: row.branch_id,
            userId: row.user_id,
            email: null,
            displayName: row.profiles?.display_name ?? null,
            role: row.role,
            status: row.status,
            createdAt: row.created_at ?? '',
        }));
    }
    async addBranchMember(accessToken, dto, isAdmin) {
        const sb = this.getClient(accessToken, isAdmin);
        const { data: existing } = await sb
            .from('branch_members')
            .select('user_id')
            .eq('branch_id', dto.branchId)
            .eq('user_id', dto.userId)
            .maybeSingle();
        if (existing) {
            throw new common_1.BadRequestException('?대? 媛寃?硫ㅻ쾭?낅땲??');
        }
        const { data, error } = await sb
            .from('branch_members')
            .insert({
            branch_id: dto.branchId,
            user_id: dto.userId,
            role: dto.role ?? member_dto_1.BranchRole.STAFF,
            status: member_dto_1.MemberStatus.ACTIVE,
        })
            .select('branch_id, user_id, role, status, created_at')
            .single();
        if (error) {
            throw new Error(`[members.addBranchMember] ${error.message}`);
        }
        return {
            id: `${data.branch_id}-${data.user_id}`,
            branchId: data.branch_id,
            userId: data.user_id,
            email: null,
            displayName: null,
            role: data.role,
            status: data.status,
            createdAt: data.created_at ?? '',
        };
    }
    async updateBranchMember(accessToken, branchId, userId, dto, isAdmin) {
        const sb = this.getClient(accessToken, isAdmin);
        const updateData = {};
        if (dto.role !== undefined)
            updateData.role = dto.role;
        if (dto.status !== undefined)
            updateData.status = dto.status;
        if (Object.keys(updateData).length === 0) {
            throw new common_1.BadRequestException('?섏젙???댁슜???놁뒿?덈떎.');
        }
        const { data, error } = await sb
            .from('branch_members')
            .update(updateData)
            .eq('branch_id', branchId)
            .eq('user_id', userId)
            .select('branch_id, user_id, role, status, created_at')
            .maybeSingle();
        if (error) {
            throw new Error(`[members.updateBranchMember] ${error.message}`);
        }
        if (!data) {
            throw new common_1.NotFoundException('硫ㅻ쾭瑜?李얠쓣 ???놁뒿?덈떎.');
        }
        return {
            id: `${data.branch_id}-${data.user_id}`,
            branchId: data.branch_id,
            userId: data.user_id,
            email: null,
            displayName: null,
            role: data.role,
            status: data.status,
            createdAt: data.created_at ?? '',
        };
    }
    async removeBranchMember(accessToken, branchId, userId, isAdmin) {
        const sb = this.getClient(accessToken, isAdmin);
        const { error } = await sb
            .from('branch_members')
            .delete()
            .eq('branch_id', branchId)
            .eq('user_id', userId);
        if (error) {
            throw new Error(`[members.removeBranchMember] ${error.message}`);
        }
        return { deleted: true };
    }
};
exports.MembersService = MembersService;
exports.MembersService = MembersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], MembersService);
//# sourceMappingURL=members.service.js.map