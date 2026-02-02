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

  /**
   * 내가 소속된 브랜드 목록 조회 (RLS 적용: userClient)
   */
  async getMyBrands(accessToken: string): Promise<BrandListItemResponse[]> {
    const sb = this.supabase.userClient(accessToken);

    const { data, error } = await sb
      .from('brand_members')
      .select(
        `
        brand_id,
        brands (
          id, name, biz_name, biz_reg_no, created_at
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
        bizName: row.brands.biz_name ?? null,
        bizRegNo: row.brands.biz_reg_no ?? null,
        createdAt: row.brands.created_at ?? '',
      }));
  }

  /**
   * 브랜드 상세 조회 (RLS 적용: userClient)
   */
  async getBrand(accessToken: string, brandId: string): Promise<BrandDetailResponse> {
    const sb = this.supabase.userClient(accessToken);

    const { data, error } = await sb
      .from('brands')
      .select('id, name, owner_user_id, biz_name, biz_reg_no, created_at')
      .eq('id', brandId)
      .single();

    if (error) {
      // RLS 때문에 "권한 없음"도 select 결과가 없거나 에러로 올 수 있어 NotFound로 통일
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
   * 브랜드 생성 (쓰기: adminClient로 RLS bypass)
   *
   * - userClient로 현재 유저를 확인(auth.getUser)
   * - brands insert + brand_members insert 는 adminClient로 실행
   */
  async createBrand(accessToken: string, dto: CreateBrandRequest): Promise<BrandDetailResponse> {
    const userSb = this.supabase.userClient(accessToken);

    // 현재 사용자 ID 가져오기
    const { data: userData, error: userError } = await userSb.auth.getUser();
    if (userError || !userData.user) {
      throw new ForbiddenException('사용자 정보를 가져올 수 없습니다.');
    }
    const userId = userData.user.id;

    const adminSb = this.supabase.adminClient();

    // 1) brands insert (RLS bypass)
    const { data: brand, error: brandError } = await adminSb
      .from('brands')
      .insert({
        name: dto.name,
        owner_user_id: userId,
        biz_name: dto.bizName ?? null,
        biz_reg_no: dto.bizRegNo ?? null,
      })
      .select('id, name, owner_user_id, biz_name, biz_reg_no, created_at')
      .single();

    if (brandError || !brand) {
      throw new Error(`[brands.createBrand] brand insert: ${brandError?.message ?? 'unknown'}`);
    }

    // 2) brand_members insert (OWNER) (RLS bypass)
    const { error: memberError } = await adminSb.from('brand_members').insert({
      brand_id: brand.id,
      user_id: userId,
      role: 'OWNER',
      status: 'ACTIVE',
    });

    if (memberError) {
      // 중간 실패 시 브랜드만 남는 상태 방지 (간이 롤백)
      await adminSb.from('brands').delete().eq('id', brand.id);
      throw new Error(`[brands.createBrand] member insert: ${memberError.message}`);
    }

    return {
      id: brand.id,
      name: brand.name,
      ownerUserId: brand.owner_user_id ?? null,
      bizName: brand.biz_name ?? null,
      bizRegNo: brand.biz_reg_no ?? null,
      createdAt: brand.created_at ?? '',
    };
  }

  /**
   * 브랜드 수정 (쓰기: adminClient)
   *
   * 권한 모델이 확정되기 전이라도 최소한의 안전장치:
   * - userClient로 로그인 유저 확인
   * - 해당 유저가 ACTIVE 멤버인지(또는 OWNER/ADMIN인지) 확인 후 update
   *
   * 지금 RLS가 "쓰기 차단"이라서 userClient로 update하면 실패할 가능성이 크므로 adminClient로 수행.
   */
  async updateBrand(
    accessToken: string,
    brandId: string,
    dto: UpdateBrandRequest,
  ): Promise<BrandDetailResponse> {
    const userSb = this.supabase.userClient(accessToken);

    // 1) 로그인 유저 확인
    const { data: userData, error: userError } = await userSb.auth.getUser();
    if (userError || !userData.user) {
      throw new ForbiddenException('사용자 정보를 가져올 수 없습니다.');
    }
    const userId = userData.user.id;

    // 2) update payload 구성
    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.bizName !== undefined) updateData.biz_name = dto.bizName;
    if (dto.bizRegNo !== undefined) updateData.biz_reg_no = dto.bizRegNo;

    if (Object.keys(updateData).length === 0) {
      return this.getBrand(accessToken, brandId);
    }

    const adminSb = this.supabase.adminClient();

    // 3) 최소 권한 체크: brand_members에서 ACTIVE인지 확인
    //    (원하면 role OWNER/ADMIN까지 체크하도록 강화 가능)
    const { data: membership, error: memError } = await adminSb
      .from('brand_members')
      .select('role, status')
      .eq('brand_id', brandId)
      .eq('user_id', userId)
      .maybeSingle();

    if (memError) {
      throw new Error(`[brands.updateBrand] membership check: ${memError.message}`);
    }
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('브랜드 수정 권한이 없습니다.');
    }

    // 권한을 더 엄격히 하고 싶으면 아래 주석 해제
    // if (!['OWNER', 'ADMIN'].includes(membership.role)) {
    //   throw new ForbiddenException('브랜드 수정 권한이 없습니다.');
    // }

    // 4) update (RLS bypass)
    const { data, error } = await adminSb
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
   * 브랜드 삭제 (쓰기: adminClient)
   *
   * - 로그인 유저 확인
   * - 최소 권한 체크(멤버십 + 필요시 OWNER만)
   * - adminClient로 delete
   */
  async deleteBrand(accessToken: string, brandId: string): Promise<{ deleted: boolean }> {
    const userSb = this.supabase.userClient(accessToken);

    const { data: userData, error: userError } = await userSb.auth.getUser();
    if (userError || !userData.user) {
      throw new ForbiddenException('사용자 정보를 가져올 수 없습니다.');
    }
    const userId = userData.user.id;

    const adminSb = this.supabase.adminClient();

    // 권한 체크 (기본: ACTIVE 멤버)
    const { data: membership, error: memError } = await adminSb
      .from('brand_members')
      .select('role, status')
      .eq('brand_id', brandId)
      .eq('user_id', userId)
      .maybeSingle();

    if (memError) {
      throw new Error(`[brands.deleteBrand] membership check: ${memError.message}`);
    }
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('브랜드 삭제 권한이 없습니다.');
    }

    // 보통 삭제는 OWNER만 허용하는 게 안전. 필요시 주석 해제.
    // if (membership.role !== 'OWNER') {
    //   throw new ForbiddenException('브랜드 삭제는 OWNER만 가능합니다.');
    // }

    const { error } = await adminSb.from('brands').delete().eq('id', brandId);

    if (error) {
      throw new Error(`[brands.deleteBrand] ${error.message}`);
    }

    return { deleted: true };
  }
}
