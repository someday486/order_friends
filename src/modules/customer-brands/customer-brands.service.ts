import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import type { BrandMembership } from '../../common/types/auth-request';

@Injectable()
export class CustomerBrandsService {
  private readonly logger = new Logger(CustomerBrandsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * 내 브랜드 목록 조회
   */
  async getMyBrands(userId: string, brandMemberships: BrandMembership[]) {
    this.logger.log(`Fetching brands for user: ${userId}`);

    const brandIds = brandMemberships.map((m) => m.brand_id);

    if (brandIds.length === 0) {
      return [];
    }

    const sb = this.supabase.adminClient();

    const { data, error } = await sb
      .from('brands')
      .select('id, name, biz_name, biz_reg_no, owner_user_id, created_at')
      .in('id', brandIds)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to fetch brands for user ${userId}`, error);
      throw new Error('Failed to fetch brands');
    }

    // 각 브랜드에 대한 내 역할 정보 추가
    const brandsWithRole = data.map((brand) => {
      const membership = brandMemberships.find((m) => m.brand_id === brand.id);
      return {
        ...brand,
        myRole: membership?.role || null,
      };
    });

    this.logger.log(
      `Fetched ${brandsWithRole.length} brands for user: ${userId}`,
    );

    return brandsWithRole;
  }

  /**
   * 내 브랜드 상세 조회
   */
  async getMyBrand(
    brandId: string,
    userId: string,
    brandMemberships: BrandMembership[],
  ) {
    this.logger.log(`Fetching brand ${brandId} for user: ${userId}`);

    // 권한 확인
    const membership = brandMemberships.find((m) => m.brand_id === brandId);
    if (!membership) {
      this.logger.warn(
        `User ${userId} attempted to access brand ${brandId} without membership`,
      );
      throw new ForbiddenException('You do not have access to this brand');
    }

    const sb = this.supabase.adminClient();

    const { data, error } = await sb
      .from('brands')
      .select('id, name, biz_name, biz_reg_no, owner_user_id, created_at')
      .eq('id', brandId)
      .single();

    if (error || !data) {
      this.logger.error(`Failed to fetch brand ${brandId}`, error);
      throw new NotFoundException('Brand not found');
    }

    return {
      ...data,
      myRole: membership.role,
    };
  }

  /**
   * 내 브랜드 수정 (OWNER, ADMIN만 가능)
   */
  async updateMyBrand(
    brandId: string,
    updateData: any,
    userId: string,
    brandMemberships: BrandMembership[],
  ) {
    this.logger.log(`Updating brand ${brandId} by user: ${userId}`);

    // 권한 확인
    const membership = brandMemberships.find((m) => m.brand_id === brandId);
    if (!membership) {
      throw new ForbiddenException('You do not have access to this brand');
    }

    // OWNER 또는 ADMIN만 수정 가능
    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      this.logger.warn(
        `User ${userId} with role ${membership.role} attempted to update brand ${brandId}`,
      );
      throw new ForbiddenException(
        'Only OWNER or ADMIN can update brand information',
      );
    }

    const sb = this.supabase.adminClient();

    // 수정 가능한 필드만 허용
    const { name, biz_name, biz_reg_no } = updateData;
    const updateFields: any = {};
    if (name !== undefined) updateFields.name = name;
    if (biz_name !== undefined) updateFields.biz_name = biz_name;
    if (biz_reg_no !== undefined) updateFields.biz_reg_no = biz_reg_no;

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
}
