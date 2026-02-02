import { Injectable, NotFoundException } from '@nestjs/common';
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

  /**
   * 내가 소속된 브랜드 목록 조회
   */
  async getMyBrands(accessToken: string): Promise<BrandListItemResponse[]> {
    const sb = this.supabase.userClient(accessToken);

    // 현재 사용자의 브랜드 멤버십 조회
    const { data, error } = await sb
      .from('brand_members')
      .select(`
        brand_id,
        brands (
          id, name, biz_name, biz_reg_no, created_at
        )
      `)
      .eq('status', 'ACTIVE');

    if (error) {
      throw new Error(`[brands.getMyBrands] ${error.message}`);
    }

    return (data ?? [])
      .filter((row: any) => row.brands)
      .map((row: any) => ({
        id: row.brands.id,
        name: row.brands.name,
        bizName: row.brands.biz_name ?? null,
        bizRegNo: row.brands.biz_reg_no ?? null,
        createdAt: row.brands.created_at ?? '',
      }));
  }

  /**
   * 브랜드 상세 조회
   */
  async getBrand(accessToken: string, brandId: string): Promise<BrandDetailResponse> {
    const sb = this.supabase.userClient(accessToken);

    const { data, error } = await sb
      .from('brands')
      .select('id, name, owner_user_id, biz_name, biz_reg_no, created_at')
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
      ownerUserId: data.owner_user_id ?? null,
      bizName: data.biz_name ?? null,
      bizRegNo: data.biz_reg_no ?? null,
      createdAt: data.created_at ?? '',
    };
  }

  /**
   * 브랜드 생성
   */
  async createBrand(accessToken: string, dto: CreateBrandRequest): Promise<BrandDetailResponse> {
    const sb = this.supabase.userClient(accessToken);

    // 현재 사용자 ID 가져오기
    const { data: userData, error: userError } = await sb.auth.getUser();
    if (userError || !userData.user) {
      throw new Error('사용자 정보를 가져올 수 없습니다.');
    }

    const userId = userData.user.id;

    // 1. 브랜드 생성
    const { data, error } = await sb
      .from('brands')
      .insert({
        name: dto.name,
        owner_user_id: userId,
        biz_name: dto.bizName ?? null,
        biz_reg_no: dto.bizRegNo ?? null,
      })
      .select('id, name, owner_user_id, biz_name, biz_reg_no, created_at')
      .single();

    if (error) {
      throw new Error(`[brands.createBrand] ${error.message}`);
    }

    // 2. 브랜드 멤버로 OWNER 역할 추가
    const { error: memberError } = await sb
      .from('brand_members')
      .insert({
        brand_id: data.id,
        user_id: userId,
        role: 'OWNER',
        status: 'ACTIVE',
      });

    if (memberError) {
      console.error('[brands.createBrand] member insert error:', memberError);
    }

    return {
      id: data.id,
      name: data.name,
      ownerUserId: data.owner_user_id ?? null,
      bizName: data.biz_name ?? null,
      bizRegNo: data.biz_reg_no ?? null,
      createdAt: data.created_at ?? '',
    };
  }

  /**
   * 브랜드 수정
   */
  async updateBrand(
    accessToken: string,
    brandId: string,
    dto: UpdateBrandRequest,
  ): Promise<BrandDetailResponse> {
    const sb = this.supabase.userClient(accessToken);

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.bizName !== undefined) updateData.biz_name = dto.bizName;
    if (dto.bizRegNo !== undefined) updateData.biz_reg_no = dto.bizRegNo;

    if (Object.keys(updateData).length === 0) {
      return this.getBrand(accessToken, brandId);
    }

    const { data, error } = await sb
      .from('brands')
      .update(updateData)
      .eq('id', brandId)
      .select('id, name, owner_user_id, biz_name, biz_reg_no, created_at')
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
      ownerUserId: data.owner_user_id ?? null,
      bizName: data.biz_name ?? null,
      bizRegNo: data.biz_reg_no ?? null,
      createdAt: data.created_at ?? '',
    };
  }

  /**
   * 브랜드 삭제
   */
  async deleteBrand(accessToken: string, brandId: string): Promise<{ deleted: boolean }> {
    const sb = this.supabase.userClient(accessToken);

    const { error } = await sb
      .from('brands')
      .delete()
      .eq('id', brandId);

    if (error) {
      throw new Error(`[brands.deleteBrand] ${error.message}`);
    }

    return { deleted: true };
  }
}
