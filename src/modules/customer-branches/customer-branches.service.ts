import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import type {
  BrandMembership,
  BranchMembership,
} from '../../common/types/auth-request';
import {
  CreateBranchRequest,
  UpdateBranchRequest,
} from '../../modules/branches/dto/branch.request';

@Injectable()
export class CustomerBranchesService {
  private readonly logger = new Logger(CustomerBranchesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * 브랜드에 대한 접근 권한 확인
   */
  private checkBrandAccess(
    brandId: string,
    brandMemberships: BrandMembership[],
  ): BrandMembership {
    const membership = brandMemberships.find((m) => m.brand_id === brandId);
    if (!membership) {
      throw new ForbiddenException('You do not have access to this brand');
    }
    return membership;
  }

  /**
   * 브랜치에 대한 접근 권한 확인
   */
  private async checkBranchAccess(
    branchId: string,
    userId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ): Promise<{
    branchMembership?: BranchMembership;
    brandMembership?: BrandMembership;
    branch: any;
  }> {
    const sb = this.supabase.adminClient();

    // 브랜치 정보 조회
    const { data: branch, error } = await sb
      .from('branches')
      .select('id, brand_id, name, slug, logo_url, cover_image_url, thumbnail_url, created_at')
      .eq('id', branchId)
      .single();

    if (error || !branch) {
      throw new NotFoundException('Branch not found');
    }

    // 1. 브랜치 멤버십 확인 (우선순위)
    const branchMembership = branchMemberships.find(
      (m) => m.branch_id === branchId,
    );
    if (branchMembership) {
      return { branchMembership, branch };
    }

    // 2. 브랜드 멤버십으로 확인
    const brandMembership = brandMemberships.find(
      (m) => m.brand_id === branch.brand_id,
    );
    if (brandMembership) {
      return { brandMembership, branch };
    }

    throw new ForbiddenException('You do not have access to this branch');
  }

  /**
   * 수정/삭제 권한 확인 (OWNER 또는 ADMIN만 가능)
   */
  private checkModificationPermission(
    role: string,
    action: string,
    userId: string,
  ) {
    if (role !== 'OWNER' && role !== 'ADMIN') {
      this.logger.warn(
        `User ${userId} with role ${role} attempted to ${action}`,
      );
      throw new ForbiddenException(`Only OWNER or ADMIN can ${action}`);
    }
  }

  /**
   * 내 브랜드의 지점 목록 조회
   * brandId가 주어지면 해당 브랜드의 지점만, 없으면 접근 가능한 모든 지점을 반환
   */
  async getMyBranches(
    userId: string,
    brandId: string | undefined,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    const sb = this.supabase.adminClient();

    if (brandId) {
      // 특정 브랜드의 지점만 조회
      this.logger.log(
        `Fetching branches for brand ${brandId} by user ${userId}`,
      );
      this.checkBrandAccess(brandId, brandMemberships);

      const { data, error } = await sb
        .from('branches')
        .select(
          'id, brand_id, name, slug, logo_url, cover_image_url, thumbnail_url, created_at',
        )
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error(
          `Failed to fetch branches for brand ${brandId}`,
          error,
        );
        throw new Error('Failed to fetch branches');
      }

      return this.mapBranchesWithRole(
        data || [],
        brandMemberships,
        branchMemberships,
      );
    }

    // brandId 없으면 접근 가능한 모든 지점 조회
    this.logger.log(`Fetching all accessible branches for user ${userId}`);

    const accessibleBrandIds = brandMemberships.map((m) => m.brand_id);
    const accessibleBranchIds = branchMemberships.map((m) => m.branch_id);

    let data: any[] = [];

    // 브랜드 멤버십으로 접근 가능한 지점
    if (accessibleBrandIds.length > 0) {
      const { data: brandBranches, error } = await sb
        .from('branches')
        .select(
          'id, brand_id, name, slug, logo_url, cover_image_url, thumbnail_url, created_at',
        )
        .in('brand_id', accessibleBrandIds)
        .order('created_at', { ascending: false });

      if (!error && brandBranches) {
        data = brandBranches;
      }
    }

    // 브랜치 멤버십으로 접근 가능한 지점 (중복 제거)
    if (accessibleBranchIds.length > 0) {
      const existingIds = new Set(data.map((b) => b.id));
      const missingIds = accessibleBranchIds.filter(
        (id) => !existingIds.has(id),
      );

      if (missingIds.length > 0) {
        const { data: branchData, error } = await sb
          .from('branches')
          .select(
            'id, brand_id, name, slug, logo_url, cover_image_url, thumbnail_url, created_at',
          )
          .in('id', missingIds)
          .order('created_at', { ascending: false });

        if (!error && branchData) {
          data = [...data, ...branchData];
        }
      }
    }

    this.logger.log(
      `Fetched ${data.length} accessible branches for user ${userId}`,
    );

    return this.mapBranchesWithRole(data, brandMemberships, branchMemberships);
  }

  /**
   * 브랜치 목록에 역할 정보 추가
   */
  private mapBranchesWithRole(
    branches: any[],
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    return branches.map((branch) => {
      const branchMembership = branchMemberships.find(
        (m) => m.branch_id === branch.id,
      );
      const brandMembership = brandMemberships.find(
        (m) => m.brand_id === branch.brand_id,
      );

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
  }

  /**
   * 내 지점 상세 조회
   */
  async getMyBranch(
    userId: string,
    branchId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(`Fetching branch ${branchId} by user ${userId}`);

    const { branchMembership, brandMembership, branch } =
      await this.checkBranchAccess(
        branchId,
        userId,
        brandMemberships,
        branchMemberships,
      );

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

  /**
   * 지점 생성 (OWNER, ADMIN만 가능)
   */
  async createMyBranch(
    userId: string,
    dto: CreateBranchRequest,
    brandMemberships: BrandMembership[],
  ) {
    this.logger.log(
      `Creating branch for brand ${dto.brandId} by user ${userId}`,
    );

    // 브랜드 접근 권한 및 수정 권한 확인
    const membership = this.checkBrandAccess(dto.brandId, brandMemberships);
    this.checkModificationPermission(
      membership.role,
      'create branches',
      userId,
    );

    const sb = this.supabase.adminClient();

    const insertPayload: any = {
      brand_id: dto.brandId,
      name: dto.name,
      slug: dto.slug,
    };
    if (dto.logoUrl) insertPayload.logo_url = dto.logoUrl;
    if (dto.coverImageUrl) insertPayload.cover_image_url = dto.coverImageUrl;
    if (dto.thumbnailUrl) insertPayload.thumbnail_url = dto.thumbnailUrl;

    const { data, error } = await sb
      .from('branches')
      .insert(insertPayload)
      .select('id, brand_id, name, slug, logo_url, cover_image_url, thumbnail_url, created_at')
      .single();

    if (error) {
      if ((error as any).code === '23505') {
        throw new ForbiddenException(
          'This branch slug is already in use for this brand',
        );
      }
      this.logger.error(
        `Failed to create branch for brand ${dto.brandId}`,
        error,
      );
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

  /**
   * 지점 수정 (OWNER, ADMIN만 가능)
   */
  async updateMyBranch(
    userId: string,
    branchId: string,
    dto: UpdateBranchRequest,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(`Updating branch ${branchId} by user ${userId}`);

    // 접근 권한 확인
    const { branchMembership, brandMembership, branch } =
      await this.checkBranchAccess(
        branchId,
        userId,
        brandMemberships,
        branchMemberships,
      );

    const role = branchMembership?.role || brandMembership?.role;
    if (!role) {
      throw new ForbiddenException('You do not have access to this branch');
    }

    // 수정 권한 확인
    this.checkModificationPermission(role, 'update branches', userId);

    const sb = this.supabase.adminClient();

    // 수정 가능한 필드만 허용
    const updateFields: any = {};
    if (dto.name !== undefined) updateFields.name = dto.name;
    if (dto.slug !== undefined) updateFields.slug = dto.slug;
    if (dto.logoUrl !== undefined) updateFields.logo_url = dto.logoUrl;
    if (dto.coverImageUrl !== undefined) updateFields.cover_image_url = dto.coverImageUrl;
    if (dto.thumbnailUrl !== undefined) updateFields.thumbnail_url = dto.thumbnailUrl;

    if (Object.keys(updateFields).length === 0) {
      return this.getMyBranch(
        userId,
        branchId,
        brandMemberships,
        branchMemberships,
      );
    }

    const { data, error } = await sb
      .from('branches')
      .update(updateFields)
      .eq('id', branchId)
      .select('id, brand_id, name, slug, logo_url, cover_image_url, thumbnail_url, created_at')
      .single();

    if (error) {
      if ((error as any).code === '23505') {
        throw new ForbiddenException(
          'This branch slug is already in use for this brand',
        );
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

  /**
   * 지점 삭제 (OWNER, ADMIN만 가능)
   */
  async deleteMyBranch(
    userId: string,
    branchId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(`Deleting branch ${branchId} by user ${userId}`);

    // 접근 권한 확인
    const { branchMembership, brandMembership } = await this.checkBranchAccess(
      branchId,
      userId,
      brandMemberships,
      branchMemberships,
    );

    const role = branchMembership?.role || brandMembership?.role;
    if (!role) {
      throw new ForbiddenException('You do not have access to this branch');
    }

    // 삭제 권한 확인
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
}
