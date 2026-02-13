import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import type { BrandMembership } from '../../common/types/auth-request';
import {
  CreateCustomerBrandRequest,
  UpdateCustomerBrandRequest,
} from './dto/customer-brand.request';

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
      .select(
        'id, name, slug, biz_name, biz_reg_no, owner_user_id, logo_url, cover_image_url, thumbnail_url, created_at',
      )
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
        slug: brand.slug ?? null,
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
      .select(
        'id, name, slug, biz_name, biz_reg_no, owner_user_id, logo_url, cover_image_url, thumbnail_url, created_at',
      )
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
   * 브랜드 생성
   */
  async createMyBrand(
    createData: CreateCustomerBrandRequest,
    userId: string,
    brandMemberships: BrandMembership[],
  ) {
    const hasManagePermission = brandMemberships.some(
      (m) => m.role === 'OWNER' || m.role === 'ADMIN',
    );

    if (!hasManagePermission) {
      this.logger.warn(
        `User ${userId} has no owner/admin membership and attempted to create brand`,
      );
      throw new ForbiddenException('Only OWNER or ADMIN can create a brand');
    }

    const sb = this.supabase.adminClient();

    const insertPayload = {
      name: createData.name,
      slug: createData.slug ?? null,
      owner_user_id: userId,
      biz_name: createData.biz_name ?? null,
      biz_reg_no: createData.biz_reg_no ?? null,
      logo_url: createData.logo_url ?? null,
      cover_image_url: createData.cover_image_url ?? null,
    };

    const { data, error } = await sb
      .from('brands')
      .insert(insertPayload)
      .select(
        'id, name, slug, owner_user_id, biz_name, biz_reg_no, logo_url, cover_image_url, created_at',
      )
      .single();

    if (error || !data) {
      this.logger.error('Failed to create brand', error);
      throw new Error('Failed to create brand');
    }

    const memberResult = await sb.from('brand_members').insert({
      brand_id: data.id,
      user_id: userId,
      role: 'OWNER',
      status: 'ACTIVE',
    });

    if (memberResult.error) {
      await sb.from('brands').delete().eq('id', data.id);
      this.logger.error(
        `Failed to create owner membership for brand ${data.id}`,
        memberResult.error,
      );
      throw new Error('Failed to create brand membership');
    }

    return {
      ...data,
      myRole: 'OWNER',
      slug: data.slug ?? null,
    };
  }

  /**
   * 내 브랜드 수정 (OWNER, ADMIN만 가능)
   */
  async updateMyBrand(
    brandId: string,
    updateData: UpdateCustomerBrandRequest,
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
    const { name, slug, biz_name, biz_reg_no, logo_url, cover_image_url } =
      updateData;
    const updateFields: any = {};
    if (name !== undefined) updateFields.name = name;
    if (slug !== undefined) updateFields.slug = slug;
    if (biz_name !== undefined) updateFields.biz_name = biz_name;
    if (biz_reg_no !== undefined) updateFields.biz_reg_no = biz_reg_no;
    if (logo_url !== undefined) updateFields.logo_url = logo_url;
    if (cover_image_url !== undefined)
      updateFields.cover_image_url = cover_image_url;

    const { data, error } = await sb
      .from('brands')
      .update(updateFields)
      .eq('id', brandId)
      .select(
        'id, name, slug, biz_name, biz_reg_no, owner_user_id, logo_url, cover_image_url, created_at',
      )
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
