import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import {
  BrandListItemResponse,
  BrandDetailResponse,
  CreateBrandRequest,
  UpdateBrandRequest,
} from './dto/brand.dto';

@Injectable()
export class BrandsService {
  constructor(private readonly supabase: SupabaseService) {}

  private getClient(accessToken: string, isAdmin?: boolean) {
    return isAdmin ? this.supabase.adminClient() : this.supabase.userClient(accessToken);
  }

  /**
   * 내 소속 브랜드 목록 조회
   */
  async getMyBrands(
    accessToken: string,
    isAdmin?: boolean,
  ): Promise<BrandListItemResponse[]> {
    if (isAdmin) {
      const sb = this.supabase.adminClient();
      const { data, error } = await sb
        .from('brands')
        .select('id, name, slug, biz_name, biz_reg_no, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`[brands.getMyBrands] ${error.message}`);
      }

      return (data ?? []).map((row: any) => ({
        id: row.id,
        name: row.name,
        slug: row.slug ?? null,
        bizName: row.biz_name ?? null,
        bizRegNo: row.biz_reg_no ?? null,
        createdAt: row.created_at ?? '',
      }));
    }

    const sb = this.supabase.userClient(accessToken);

    const { data, error } = await sb
      .from('brand_members')
      .select(
        `
        brand_id,
        brands (
          id, name, slug, biz_name, biz_reg_no, created_at
        )
      `,
      )
      .eq('status', 'ACTIVE');

    if (error) {
      throw new Error(`[brands.getMyBrands] ${error.message}`);
    }

    return (data ?? [])
      .filter((row: any) => row.brands)
      .map((row: any) => ({
        id: row.brands.id,
        name: row.brands.name,
        slug: row.brands.slug ?? null,
        bizName: row.brands.biz_name ?? null,
        bizRegNo: row.brands.biz_reg_no ?? null,
        createdAt: row.brands.created_at ?? '',
      }));
  }

  /**
   * 브랜드 상세 조회
   */
  async getBrand(
    accessToken: string,
    brandId: string,
    isAdmin?: boolean,
  ): Promise<BrandDetailResponse> {
    const sb = this.getClient(accessToken, isAdmin);

    const { data, error } = await sb
      .from('brands')
      .select('id, name, slug, owner_user_id, biz_name, biz_reg_no, created_at')
      .eq('id', brandId)
      .single();

    if (error) {
      throw new NotFoundException(`[brands.getBrand] ${error.message}`);
    }

    if (!data) {
      throw new NotFoundException('브랜드를 찾을 수 없습니다.');
    }

    return {
      id: data.id,
      name: data.name,
      slug: data.slug ?? null,
      ownerUserId: data.owner_user_id ?? null,
      bizName: data.biz_name ?? null,
      bizRegNo: data.biz_reg_no ?? null,
      createdAt: data.created_at ?? '',
    };
  }

  /**
   * 브랜드 생성
   * - profiles row 보장 (brand_members FK 필요)
   * - brands insert + brand_members insert 는 adminClient로 수행
   */
  async createBrand(
    accessToken: string,
    dto: CreateBrandRequest,
    _isAdmin?: boolean,
  ): Promise<BrandDetailResponse> {
    const userSb = this.supabase.userClient(accessToken);

    // 0) 현재 사용자 확인
    const { data: userData, error: userError } = await userSb.auth.getUser();
    if (userError || !userData.user) {
      throw new ForbiddenException('사용자 정보를 가져올 수 없습니다.');
    }
    const userId = userData.user.id;

    const adminSb = this.supabase.adminClient();

    // 1) profiles row 보장
    const { error: profileErr } = await adminSb
      .from('profiles')
      .upsert({ id: userId }, { onConflict: 'id' });

    if (profileErr) {
      throw new Error(`[brands.createBrand] profile upsert: ${profileErr.message}`);
    }

    // 2) brands insert (RLS bypass)
    const { data: brand, error: brandError } = await adminSb
      .from('brands')
      .insert({
        name: dto.name,
        slug: dto.slug ?? null,
        owner_user_id: userId,
        biz_name: dto.bizName ?? null,
        biz_reg_no: dto.bizRegNo ?? null,
      })
      .select('id, name, slug, owner_user_id, biz_name, biz_reg_no, created_at')
      .single();

    if (brandError || !brand) {
      throw new Error(`[brands.createBrand] brand insert: ${brandError?.message ?? 'unknown'}`);
    }

    // 3) brand_members insert (OWNER)
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
      createdAt: brand.created_at ?? '',
    };
  }

  /**
   * 브랜드 수정
   */
  async updateBrand(
    accessToken: string,
    brandId: string,
    dto: UpdateBrandRequest,
    isAdmin?: boolean,
  ): Promise<BrandDetailResponse> {
    // 1) update payload 구성
    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.slug !== undefined) updateData.slug = dto.slug;
    if (dto.bizName !== undefined) updateData.biz_name = dto.bizName;
    if (dto.bizRegNo !== undefined) updateData.biz_reg_no = dto.bizRegNo;

    if (Object.keys(updateData).length === 0) {
      return this.getBrand(accessToken, brandId, isAdmin);
    }

    const adminSb = this.supabase.adminClient();

    if (!isAdmin) {
      const userSb = this.supabase.userClient(accessToken);
      const { data: userData, error: userError } = await userSb.auth.getUser();
      if (userError || !userData.user) {
        throw new ForbiddenException('사용자 정보를 가져올 수 없습니다.');
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
        throw new ForbiddenException('브랜드 수정 권한이 없습니다.');
      }
    }

    const { data, error } = await adminSb
      .from('brands')
      .update(updateData)
      .eq('id', brandId)
      .select('id, name, slug, owner_user_id, biz_name, biz_reg_no, created_at')
      .maybeSingle();

    if (error) {
      throw new Error(`[brands.updateBrand] ${error.message}`);
    }

    if (!data) {
      throw new NotFoundException('브랜드를 찾을 수 없거나 권한이 없습니다.');
    }

    return {
      id: data.id,
      name: data.name,
      slug: data.slug ?? null,
      ownerUserId: data.owner_user_id ?? null,
      bizName: data.biz_name ?? null,
      bizRegNo: data.biz_reg_no ?? null,
      createdAt: data.created_at ?? '',
    };
  }

  /**
   * 브랜드 삭제
   */
  async deleteBrand(
    accessToken: string,
    brandId: string,
    isAdmin?: boolean,
  ): Promise<{ deleted: boolean }> {
    const adminSb = this.supabase.adminClient();

    if (!isAdmin) {
      const userSb = this.supabase.userClient(accessToken);
      const { data: userData, error: userError } = await userSb.auth.getUser();
      if (userError || !userData.user) {
        throw new ForbiddenException('사용자 정보를 가져올 수 없습니다.');
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
        throw new ForbiddenException('브랜드 삭제 권한이 없습니다.');
      }
    }

    const { error } = await adminSb.from('brands').delete().eq('id', brandId);

    if (error) {
      throw new Error(`[brands.deleteBrand] ${error.message}`);
    }

    return { deleted: true };
  }
}
