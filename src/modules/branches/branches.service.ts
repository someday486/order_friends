import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import {
  BranchListItemResponse,
  BranchDetailResponse,
} from './dto/branch.response';
import { CreateBranchRequest, UpdateBranchRequest } from './dto/branch.request';
import {
  getBranchOrderConfig,
  saveBranchOrderConfig,
} from './branch-order-config.util';
import { loadBrandBillingConfig } from './branch-billing.util';

@Injectable()
export class BranchesService {
  constructor(private readonly supabase: SupabaseService) {}

  private normalizeDepositSheetName(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private normalizeDepositSheetUrl(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private getClient(accessToken: string, isAdmin?: boolean) {
    return isAdmin
      ? this.supabase.adminClient()
      : this.supabase.userClient(accessToken);
  }

  /**
   * 가게 목록 조회 (브랜드 기준)
   */
  async getBranches(
    accessToken: string,
    brandId: string,
    includeInactive = false,
    isAdmin?: boolean,
  ): Promise<BranchListItemResponse[]> {
    const sb = this.getClient(accessToken, isAdmin);

    let query = sb
      .from('branches')
      .select(
        'id, brand_id, name, slug, is_active, logo_url, cover_image_url, thumbnail_url, contact_phone, deposit_sheet_name, deposit_sheet_url, kakao_channel_url, created_at',
      )
      .eq('brand_id', brandId);

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query.order('created_at', {
      ascending: false,
    });

    if (error) {
      throw new Error(`[branches.getBranches] ${error.message}`);
    }

    return (data ?? []).map((row: any) => ({
      id: row.id,
      brandId: row.brand_id,
      name: row.name,
      isActive: row.is_active ?? true,
      slug: row.slug ?? '',
      logoUrl: row.logo_url ?? null,
      thumbnailUrl: row.thumbnail_url ?? null,
      contactPhone: row.contact_phone ?? null,
      depositSheetName: row.deposit_sheet_name ?? null,
      depositSheetUrl: row.deposit_sheet_url ?? null,
      kakaoChannelUrl: row.kakao_channel_url ?? null,
      createdAt: row.created_at ?? '',
    }));
  }

  /**
   * 가게 상세 조회
   */
  async getBranch(
    accessToken: string,
    branchId: string,
    isAdmin?: boolean,
  ): Promise<BranchDetailResponse> {
    const sb = this.getClient(accessToken, isAdmin);
    const adminSb = this.supabase.adminClient();

    const { data, error } = await sb
      .from('branches')
      .select(
        'id, brand_id, name, slug, is_active, logo_url, cover_image_url, thumbnail_url, contact_phone, deposit_sheet_name, deposit_sheet_url, kakao_channel_url, created_at',
      )
      .eq('id', branchId)
      .single();

    if (error) {
      throw new NotFoundException(`[branches.getBranch] ${error.message}`);
    }

    if (!data) {
      throw new NotFoundException('가게를 찾을 수 없습니다.');
    }

    const orderConfig = await getBranchOrderConfig(adminSb, data.id);
    const billingConfig = await loadBrandBillingConfig(adminSb, data.brand_id);

    return {
      id: data.id,
      brandId: data.brand_id,
      name: data.name,
      isActive: data.is_active ?? true,
      slug: data.slug ?? '',
      logoUrl: data.logo_url ?? null,
      coverImageUrl: data.cover_image_url ?? null,
      thumbnailUrl: data.thumbnail_url ?? null,
      enabledFulfillmentTypes: orderConfig.enabledFulfillmentTypes,
      allowedPaymentMethods: billingConfig.allowedPaymentMethods,
      transferAccount: orderConfig.transferAccount,
      pickupTimeConfig: orderConfig.pickupTimeConfig,
      businessHours: orderConfig.businessHours,
      orderNotice: orderConfig.orderNotice,
      contactPhone: data.contact_phone ?? null,
      depositSheetName: data.deposit_sheet_name ?? null,
      depositSheetUrl: data.deposit_sheet_url ?? null,
      kakaoChannelUrl: data.kakao_channel_url ?? null,
      createdAt: data.created_at ?? '',
    };
  }

  /**
   * 가게 생성
   */
  async createBranch(
    accessToken: string,
    dto: CreateBranchRequest,
    isAdmin?: boolean,
  ): Promise<BranchDetailResponse> {
    const adminSb = this.supabase.adminClient();
    const insertPayload: any = {
      brand_id: dto.brandId,
      name: dto.name,
      slug: dto.slug,
    };
    if (dto.logoUrl) insertPayload.logo_url = dto.logoUrl;
    if (dto.coverImageUrl) insertPayload.cover_image_url = dto.coverImageUrl;
    if (dto.thumbnailUrl) insertPayload.thumbnail_url = dto.thumbnailUrl;
    if (dto.contactPhone !== undefined)
      insertPayload.contact_phone = dto.contactPhone;
    if (dto.depositSheetName !== undefined) {
      insertPayload.deposit_sheet_name = this.normalizeDepositSheetName(
        dto.depositSheetName,
      );
    }
    if (dto.depositSheetUrl !== undefined) {
      insertPayload.deposit_sheet_url = this.normalizeDepositSheetUrl(
        dto.depositSheetUrl,
      );
    }
    if (dto.kakaoChannelUrl !== undefined)
      insertPayload.kakao_channel_url = dto.kakaoChannelUrl;

    if (isAdmin) {
      const sb = adminSb;
      const { data, error } = await sb
        .from('branches')
        .insert(insertPayload)
        .select(
          'id, brand_id, name, slug, is_active, logo_url, cover_image_url, thumbnail_url, contact_phone, deposit_sheet_name, deposit_sheet_url, kakao_channel_url, created_at',
        )
        .single();

      if (error) {
        if ((error as any).code === '23505') {
          throw new ConflictException('이미 사용 중인 가게 URL(slug)입니다.');
        }
        throw new Error(`[branches.createBranch] ${error.message}`);
      }

      const billingConfig = await loadBrandBillingConfig(
        adminSb,
        data.brand_id,
      );
      await saveBranchOrderConfig(adminSb, data.id, {
        enabledFulfillmentTypes: dto.enabledFulfillmentTypes,
        allowedPaymentMethods: billingConfig.allowedPaymentMethods,
        transferAccount: dto.transferAccount,
        pickupTimeConfig: dto.pickupTimeConfig,
        businessHours: dto.businessHours,
        orderNotice: dto.orderNotice,
      });
      const orderConfig = await getBranchOrderConfig(adminSb, data.id);

      return {
        id: data.id,
        brandId: data.brand_id,
        name: data.name,
        isActive: data.is_active ?? true,
        slug: data.slug ?? '',
        logoUrl: data.logo_url ?? null,
        coverImageUrl: data.cover_image_url ?? null,
        thumbnailUrl: data.thumbnail_url ?? null,
        enabledFulfillmentTypes: orderConfig.enabledFulfillmentTypes,
        allowedPaymentMethods: billingConfig.allowedPaymentMethods,
        transferAccount: orderConfig.transferAccount,
        pickupTimeConfig: orderConfig.pickupTimeConfig,
        businessHours: orderConfig.businessHours,
        orderNotice: orderConfig.orderNotice,
        contactPhone: data.contact_phone ?? null,
        depositSheetName: data.deposit_sheet_name ?? null,
        depositSheetUrl: data.deposit_sheet_url ?? null,
        kakaoChannelUrl: data.kakao_channel_url ?? null,
        createdAt: data.created_at ?? '',
      };
    }

    const tryUserClient = async () => {
      const sb = this.supabase.userClient(accessToken);
      return sb
        .from('branches')
        .insert(insertPayload)
        .select(
          'id, brand_id, name, slug, is_active, logo_url, cover_image_url, thumbnail_url, contact_phone, deposit_sheet_name, deposit_sheet_url, kakao_channel_url, created_at',
        )
        .single();
    };

    const tryAdminClient = async () => {
      const sb = this.supabase.adminClient();
      return sb
        .from('branches')
        .insert(insertPayload)
        .select(
          'id, brand_id, name, slug, is_active, logo_url, cover_image_url, thumbnail_url, contact_phone, deposit_sheet_name, deposit_sheet_url, kakao_channel_url, created_at',
        )
        .single();
    };

    let data: any;
    let error: any;

    ({ data, error } = await tryUserClient());

    if (error?.message?.includes('row-level security')) {
      ({ data, error } = await tryAdminClient());
    }

    if (error) {
      // (brand_id, slug) 복합 유니크 제약 위반
      if (error.code === '23505') {
        throw new ConflictException('이미 사용 중인 가게 URL(slug)입니다.');
      }
      throw new Error(`[branches.createBranch] ${error.message}`);
    }

    const billingConfig = await loadBrandBillingConfig(adminSb, data.brand_id);
    await saveBranchOrderConfig(adminSb, data.id, {
      enabledFulfillmentTypes: dto.enabledFulfillmentTypes,
      allowedPaymentMethods: billingConfig.allowedPaymentMethods,
      transferAccount: dto.transferAccount,
      pickupTimeConfig: dto.pickupTimeConfig,
      businessHours: dto.businessHours,
      orderNotice: dto.orderNotice,
    });
    const orderConfig = await getBranchOrderConfig(adminSb, data.id);

    return {
      id: data.id,
      brandId: data.brand_id,
      name: data.name,
      isActive: data.is_active ?? true,
      slug: data.slug ?? '',
      logoUrl: data.logo_url ?? null,
      coverImageUrl: data.cover_image_url ?? null,
      thumbnailUrl: data.thumbnail_url ?? null,
      enabledFulfillmentTypes: orderConfig.enabledFulfillmentTypes,
      allowedPaymentMethods: billingConfig.allowedPaymentMethods,
      transferAccount: orderConfig.transferAccount,
      pickupTimeConfig: orderConfig.pickupTimeConfig,
      businessHours: orderConfig.businessHours,
      orderNotice: orderConfig.orderNotice,
      contactPhone: data.contact_phone ?? null,
      depositSheetName: data.deposit_sheet_name ?? null,
      depositSheetUrl: data.deposit_sheet_url ?? null,
      kakaoChannelUrl: data.kakao_channel_url ?? null,
      createdAt: data.created_at ?? '',
    };
  }

  /**
   * 가게 수정
   */
  async updateBranch(
    accessToken: string,
    branchId: string,
    dto: UpdateBranchRequest,
    isAdmin?: boolean,
  ): Promise<BranchDetailResponse> {
    const sb = this.getClient(accessToken, isAdmin);
    const adminSb = this.supabase.adminClient();

    const updateData: any = {};
    if (dto.isActive !== undefined) updateData.is_active = dto.isActive;
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.slug !== undefined) updateData.slug = dto.slug;
    if (dto.logoUrl !== undefined) updateData.logo_url = dto.logoUrl;
    if (dto.coverImageUrl !== undefined)
      updateData.cover_image_url = dto.coverImageUrl;
    if (dto.thumbnailUrl !== undefined)
      updateData.thumbnail_url = dto.thumbnailUrl;
    if (dto.contactPhone !== undefined)
      updateData.contact_phone = dto.contactPhone;
    if (dto.depositSheetName !== undefined) {
      updateData.deposit_sheet_name = this.normalizeDepositSheetName(
        dto.depositSheetName,
      );
    }
    if (dto.depositSheetUrl !== undefined) {
      updateData.deposit_sheet_url = this.normalizeDepositSheetUrl(
        dto.depositSheetUrl,
      );
    }
    if (dto.kakaoChannelUrl !== undefined)
      updateData.kakao_channel_url = dto.kakaoChannelUrl;
    const hasOrderConfigUpdate =
      dto.enabledFulfillmentTypes !== undefined ||
      dto.transferAccount !== undefined ||
      dto.pickupTimeConfig !== undefined ||
      dto.businessHours !== undefined ||
      dto.orderNotice !== undefined;

    if (Object.keys(updateData).length === 0) {
      if (!hasOrderConfigUpdate) {
        return this.getBranch(accessToken, branchId, isAdmin);
      }

      const { data: existingBranch, error: existingBranchError } = await adminSb
        .from('branches')
        .select('id, brand_id')
        .eq('id', branchId)
        .maybeSingle();

      if (existingBranchError) {
        throw new Error(
          `[branches.updateBranch] ${existingBranchError.message}`,
        );
      }

      if (!existingBranch) {
        throw new NotFoundException('가게를 찾을 수 없거나 권한이 없습니다.');
      }

      const billingConfig = await loadBrandBillingConfig(
        adminSb,
        existingBranch.brand_id,
      );
      await saveBranchOrderConfig(adminSb, branchId, {
        enabledFulfillmentTypes: dto.enabledFulfillmentTypes,
        allowedPaymentMethods: billingConfig.allowedPaymentMethods,
        transferAccount: dto.transferAccount,
        pickupTimeConfig: dto.pickupTimeConfig,
        businessHours: dto.businessHours,
        orderNotice: dto.orderNotice,
      });
      return this.getBranch(accessToken, branchId, isAdmin);
    }

    const { data, error } = await sb
      .from('branches')
      .update(updateData)
      .eq('id', branchId)
      .select(
        'id, brand_id, name, slug, is_active, logo_url, cover_image_url, thumbnail_url, contact_phone, deposit_sheet_name, deposit_sheet_url, kakao_channel_url, created_at',
      )
      .maybeSingle();

    if (error) {
      if ((error as any).code === '23505') {
        throw new ConflictException('이미 사용 중인 가게 URL(slug)입니다.');
      }
      throw new Error(`[branches.updateBranch] ${error.message}`);
    }

    if (!data) {
      throw new NotFoundException('가게를 찾을 수 없거나 권한이 없습니다.');
    }

    const billingConfig = await loadBrandBillingConfig(adminSb, data.brand_id);

    if (hasOrderConfigUpdate) {
      await saveBranchOrderConfig(adminSb, branchId, {
        enabledFulfillmentTypes: dto.enabledFulfillmentTypes,
        allowedPaymentMethods: billingConfig.allowedPaymentMethods,
        transferAccount: dto.transferAccount,
        pickupTimeConfig: dto.pickupTimeConfig,
        businessHours: dto.businessHours,
        orderNotice: dto.orderNotice,
      });
    }
    const orderConfig = await getBranchOrderConfig(adminSb, branchId);

    return {
      id: data.id,
      brandId: data.brand_id,
      name: data.name,
      isActive: data.is_active ?? true,
      slug: data.slug ?? '',
      logoUrl: data.logo_url ?? null,
      coverImageUrl: data.cover_image_url ?? null,
      thumbnailUrl: data.thumbnail_url ?? null,
      enabledFulfillmentTypes: orderConfig.enabledFulfillmentTypes,
      allowedPaymentMethods: billingConfig.allowedPaymentMethods,
      transferAccount: orderConfig.transferAccount,
      pickupTimeConfig: orderConfig.pickupTimeConfig,
      businessHours: orderConfig.businessHours,
      orderNotice: orderConfig.orderNotice,
      contactPhone: data.contact_phone ?? null,
      depositSheetName: data.deposit_sheet_name ?? null,
      depositSheetUrl: data.deposit_sheet_url ?? null,
      kakaoChannelUrl: data.kakao_channel_url ?? null,
      createdAt: data.created_at ?? '',
    };
  }

  /**
   * 가게 삭제
   */
  async deleteBranch(
    accessToken: string,
    branchId: string,
    isAdmin?: boolean,
  ): Promise<{ deleted: boolean }> {
    const sb = this.getClient(accessToken, isAdmin);

    const { error } = await sb
      .from('branches')
      .update({ is_active: false })
      .eq('id', branchId);

    if (error) {
      throw new Error(`[branches.deleteBranch] ${error.message}`);
    }

    return { deleted: true };
  }
}
