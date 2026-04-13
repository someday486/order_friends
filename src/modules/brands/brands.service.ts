import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import {
  BrandListItemResponse,
  BrandDetailResponse,
  CreateBrandRequest,
  UpdateBrandRequest,
} from './dto/brand.dto';
import { CashReceiptOnboardingService } from '../cash-receipts/cash-receipt-onboarding.service';
import { BillingTier } from '../billing/billing.types';

@Injectable()
export class BrandsService {
  constructor(
    private readonly supabase: SupabaseService,
    @Optional()
    private readonly cashReceiptOnboardingService?: CashReceiptOnboardingService,
  ) {}

  private getClient(accessToken: string, isAdmin?: boolean) {
    return isAdmin
      ? this.supabase.adminClient()
      : this.supabase.userClient(accessToken);
  }

  private shouldRevalidateCashReceipt(dto: UpdateBrandRequest): boolean {
    return [
      'bizName',
      'bizRegNo',
      'repName',
      'address',
      'cashReceiptEnabled',
      'cashReceiptProvider',
      'cashReceiptMerchantId',
      'cashReceiptContactName',
      'cashReceiptContactPhone',
    ].some((key) => key in dto);
  }

  private async resolveCashReceiptConfig(
    ownerUserId: string,
    draft: {
      biz_name?: string | null;
      biz_reg_no?: string | null;
      rep_name?: string | null;
      address?: string | null;
      cash_receipt_enabled?: boolean | null;
      cash_receipt_provider?: string | null;
      cash_receipt_merchant_id?: string | null;
      cash_receipt_contact_name?: string | null;
      cash_receipt_contact_phone?: string | null;
    },
  ): Promise<{
    config: Record<string, unknown>;
    onboardingMessage: string | null;
  }> {
    if (!this.cashReceiptOnboardingService) {
      return { config: {}, onboardingMessage: null };
    }

    const resolved =
      await this.cashReceiptOnboardingService.resolveBrandCashReceiptConfig(
        ownerUserId,
        draft,
      );

    return {
      config: {
        cash_receipt_enabled: resolved.cash_receipt_enabled ?? false,
        cash_receipt_provider: resolved.cash_receipt_provider ?? null,
        cash_receipt_merchant_id: resolved.cash_receipt_merchant_id ?? null,
      },
      onboardingMessage: resolved.cash_receipt_onboarding_message ?? null,
    };
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
        .select(
          'id, name, is_active, billing_tier, slug, biz_name, biz_reg_no, address, logo_url, cover_image_url, created_at',
        )
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`[brands.getMyBrands] ${error.message}`);
      }

      return (data ?? []).map((row: any) => ({
        id: row.id,
        name: row.name,
        isActive: row.is_active ?? true,
        billingTier:
          row.billing_tier === BillingTier.NON_PG
            ? BillingTier.NON_PG
            : BillingTier.PG,
        slug: row.slug ?? null,
        bizName: row.biz_name ?? null,
        bizRegNo: row.biz_reg_no ?? null,
        address: row.address ?? null,
        logoUrl: row.logo_url ?? null,
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
          id, name, is_active, billing_tier, slug, biz_name, biz_reg_no, address, logo_url, cover_image_url, created_at
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
        isActive: row.brands.is_active ?? true,
        billingTier:
          row.brands.billing_tier === BillingTier.NON_PG
            ? BillingTier.NON_PG
            : BillingTier.PG,
        slug: row.brands.slug ?? null,
        bizName: row.brands.biz_name ?? null,
        bizRegNo: row.brands.biz_reg_no ?? null,
        address: row.brands.address ?? null,
        logoUrl: row.brands.logo_url ?? null,
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
      .select(
        'id, name, is_active, billing_tier, slug, owner_user_id, biz_name, biz_reg_no, rep_name, address, biz_cert_url, cash_receipt_enabled, cash_receipt_provider, cash_receipt_merchant_id, cash_receipt_issue_timing, cash_receipt_self_issue_enabled, cash_receipt_contact_name, cash_receipt_contact_phone, logo_url, cover_image_url, created_at',
      )
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
      isActive: data.is_active ?? true,
      billingTier:
        data.billing_tier === BillingTier.NON_PG
          ? BillingTier.NON_PG
          : BillingTier.PG,
      slug: data.slug ?? null,
      ownerUserId: data.owner_user_id ?? null,
      bizName: data.biz_name ?? null,
      bizRegNo: data.biz_reg_no ?? null,
      repName: data.rep_name ?? null,
      address: data.address ?? null,
      bizCertUrl: data.biz_cert_url ?? null,
      cashReceiptEnabled: data.cash_receipt_enabled ?? false,
      cashReceiptProvider: data.cash_receipt_provider ?? null,
      cashReceiptMerchantId: data.cash_receipt_merchant_id ?? null,
      cashReceiptIssueTiming: data.cash_receipt_issue_timing ?? null,
      cashReceiptSelfIssueEnabled:
        data.cash_receipt_self_issue_enabled ?? false,
      cashReceiptContactName: data.cash_receipt_contact_name ?? null,
      cashReceiptContactPhone: data.cash_receipt_contact_phone ?? null,
      logoUrl: data.logo_url ?? null,
      coverImageUrl: data.cover_image_url ?? null,
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
    void _isAdmin;
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
      throw new Error(
        `[brands.createBrand] profile upsert: ${profileErr.message}`,
      );
    }

    const insertPayload: Record<string, unknown> = {
      name: dto.name,
      is_active: true,
      slug: dto.slug ?? null,
      owner_user_id: userId,
      biz_name: dto.bizName ?? null,
      biz_reg_no: dto.bizRegNo ?? null,
      rep_name: dto.repName ?? null,
      address: dto.address ?? null,
      biz_cert_url: dto.bizCertUrl ?? null,
      cash_receipt_enabled: dto.cashReceiptEnabled ?? false,
      cash_receipt_provider: dto.cashReceiptProvider ?? null,
      cash_receipt_merchant_id: dto.cashReceiptMerchantId ?? null,
      cash_receipt_issue_timing: dto.cashReceiptIssueTiming ?? null,
      cash_receipt_self_issue_enabled: dto.cashReceiptSelfIssueEnabled ?? false,
      cash_receipt_contact_name: dto.cashReceiptContactName ?? null,
      cash_receipt_contact_phone: dto.cashReceiptContactPhone ?? null,
      logo_url: dto.logoUrl ?? null,
      cover_image_url: dto.coverImageUrl ?? null,
    };
    const createOnboarding = await this.resolveCashReceiptConfig(userId, {
      biz_name: dto.bizName ?? null,
      biz_reg_no: dto.bizRegNo ?? null,
      rep_name: dto.repName ?? null,
      address: dto.address ?? null,
      cash_receipt_enabled: dto.cashReceiptEnabled ?? false,
      cash_receipt_provider: dto.cashReceiptProvider ?? null,
      cash_receipt_merchant_id: dto.cashReceiptMerchantId ?? null,
      cash_receipt_contact_name: dto.cashReceiptContactName ?? null,
      cash_receipt_contact_phone: dto.cashReceiptContactPhone ?? null,
    });
    Object.assign(insertPayload, createOnboarding.config);

    // 2) brands insert (RLS bypass)
    const { data: brand, error: brandError } = await adminSb
      .from('brands')
      .insert(insertPayload)
      .select(
        'id, name, is_active, billing_tier, slug, owner_user_id, biz_name, biz_reg_no, rep_name, address, biz_cert_url, cash_receipt_enabled, cash_receipt_provider, cash_receipt_merchant_id, cash_receipt_issue_timing, cash_receipt_self_issue_enabled, cash_receipt_contact_name, cash_receipt_contact_phone, logo_url, cover_image_url, created_at',
      )
      .single();

    if (brandError || !brand) {
      throw new Error(
        `[brands.createBrand] brand insert: ${brandError?.message ?? 'unknown'}`,
      );
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
      throw new Error(
        `[brands.createBrand] member insert: ${memberError.message}`,
      );
    }

    return {
      id: brand.id,
      name: brand.name,
      isActive: brand.is_active ?? true,
      billingTier:
        brand.billing_tier === BillingTier.NON_PG
          ? BillingTier.NON_PG
          : BillingTier.PG,
      slug: brand.slug ?? null,
      ownerUserId: brand.owner_user_id ?? null,
      bizName: brand.biz_name ?? null,
      bizRegNo: brand.biz_reg_no ?? null,
      repName: brand.rep_name ?? null,
      address: brand.address ?? null,
      bizCertUrl: brand.biz_cert_url ?? null,
      cashReceiptEnabled: brand.cash_receipt_enabled ?? false,
      cashReceiptProvider: brand.cash_receipt_provider ?? null,
      cashReceiptMerchantId: brand.cash_receipt_merchant_id ?? null,
      cashReceiptIssueTiming: brand.cash_receipt_issue_timing ?? null,
      cashReceiptSelfIssueEnabled:
        brand.cash_receipt_self_issue_enabled ?? false,
      cashReceiptContactName: brand.cash_receipt_contact_name ?? null,
      cashReceiptContactPhone: brand.cash_receipt_contact_phone ?? null,
      cashReceiptOnboardingMessage: createOnboarding.onboardingMessage,
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
    if (dto.isActive !== undefined) updateData.is_active = dto.isActive;
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.slug !== undefined) updateData.slug = dto.slug;
    if (dto.bizName !== undefined) updateData.biz_name = dto.bizName;
    if (dto.bizRegNo !== undefined) updateData.biz_reg_no = dto.bizRegNo;
    if (dto.repName !== undefined) updateData.rep_name = dto.repName;
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.bizCertUrl !== undefined) updateData.biz_cert_url = dto.bizCertUrl;
    if (dto.cashReceiptEnabled !== undefined) {
      updateData.cash_receipt_enabled = dto.cashReceiptEnabled;
    }
    if (dto.cashReceiptProvider !== undefined) {
      updateData.cash_receipt_provider = dto.cashReceiptProvider;
    }
    if (dto.cashReceiptMerchantId !== undefined) {
      updateData.cash_receipt_merchant_id = dto.cashReceiptMerchantId;
    }
    if (dto.cashReceiptIssueTiming !== undefined) {
      updateData.cash_receipt_issue_timing = dto.cashReceiptIssueTiming;
    }
    if (dto.cashReceiptSelfIssueEnabled !== undefined) {
      updateData.cash_receipt_self_issue_enabled =
        dto.cashReceiptSelfIssueEnabled;
    }
    if (dto.cashReceiptContactName !== undefined) {
      updateData.cash_receipt_contact_name = dto.cashReceiptContactName;
    }
    if (dto.cashReceiptContactPhone !== undefined) {
      updateData.cash_receipt_contact_phone = dto.cashReceiptContactPhone;
    }
    if (dto.logoUrl !== undefined) updateData.logo_url = dto.logoUrl;
    if (dto.coverImageUrl !== undefined)
      updateData.cover_image_url = dto.coverImageUrl;
    const adminSb = this.supabase.adminClient();
    let existingBrand: any = null;
    let onboardingMessage: string | null = null;

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
        throw new Error(
          `[brands.updateBrand] membership check: ${memError.message}`,
        );
      }
      if (!membership || membership.status !== 'ACTIVE') {
        throw new ForbiddenException('브랜드 수정 권한이 없습니다.');
      }
    }

    if (
      this.cashReceiptOnboardingService &&
      this.shouldRevalidateCashReceipt(dto)
    ) {
      const { data: existingBrandData, error: existingBrandError } =
        await adminSb
          .from('brands')
          .select(
            'id, owner_user_id, biz_name, biz_reg_no, rep_name, address, cash_receipt_enabled, cash_receipt_provider, cash_receipt_merchant_id, cash_receipt_contact_name, cash_receipt_contact_phone',
          )
          .eq('id', brandId)
          .single();

      if (existingBrandError || !existingBrandData) {
        throw new NotFoundException('브랜드를 찾을 수 없습니다.');
      }

      existingBrand = existingBrandData;
      const resolvedOnboarding = await this.resolveCashReceiptConfig(
        existingBrand.owner_user_id,
        {
          biz_name: dto.bizName ?? existingBrand.biz_name,
          biz_reg_no: dto.bizRegNo ?? existingBrand.biz_reg_no,
          rep_name: dto.repName ?? existingBrand.rep_name,
          address: dto.address ?? existingBrand.address,
          cash_receipt_enabled:
            dto.cashReceiptEnabled ?? existingBrand.cash_receipt_enabled,
          cash_receipt_provider:
            dto.cashReceiptProvider ?? existingBrand.cash_receipt_provider,
          cash_receipt_merchant_id:
            dto.cashReceiptMerchantId ?? existingBrand.cash_receipt_merchant_id,
          cash_receipt_contact_name:
            dto.cashReceiptContactName ??
            existingBrand.cash_receipt_contact_name,
          cash_receipt_contact_phone:
            dto.cashReceiptContactPhone ??
            existingBrand.cash_receipt_contact_phone,
        },
      );
      Object.assign(updateData, resolvedOnboarding.config);
      onboardingMessage = resolvedOnboarding.onboardingMessage;
    }

    if (Object.keys(updateData).length === 0) {
      return this.getBrand(accessToken, brandId, isAdmin);
    }

    const { data, error } = await adminSb
      .from('brands')
      .update(updateData)
      .eq('id', brandId)
      .select(
        'id, name, is_active, billing_tier, slug, owner_user_id, biz_name, biz_reg_no, rep_name, address, biz_cert_url, cash_receipt_enabled, cash_receipt_provider, cash_receipt_merchant_id, cash_receipt_issue_timing, cash_receipt_self_issue_enabled, cash_receipt_contact_name, cash_receipt_contact_phone, logo_url, cover_image_url, created_at',
      )
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
      isActive: data.is_active ?? true,
      billingTier:
        data.billing_tier === BillingTier.NON_PG
          ? BillingTier.NON_PG
          : BillingTier.PG,
      slug: data.slug ?? null,
      ownerUserId: data.owner_user_id ?? null,
      bizName: data.biz_name ?? null,
      bizRegNo: data.biz_reg_no ?? null,
      repName: data.rep_name ?? null,
      address: data.address ?? null,
      bizCertUrl: data.biz_cert_url ?? null,
      cashReceiptEnabled: data.cash_receipt_enabled ?? false,
      cashReceiptProvider: data.cash_receipt_provider ?? null,
      cashReceiptMerchantId: data.cash_receipt_merchant_id ?? null,
      cashReceiptIssueTiming: data.cash_receipt_issue_timing ?? null,
      cashReceiptSelfIssueEnabled:
        data.cash_receipt_self_issue_enabled ?? false,
      cashReceiptContactName: data.cash_receipt_contact_name ?? null,
      cashReceiptContactPhone: data.cash_receipt_contact_phone ?? null,
      logoUrl: data.logo_url ?? null,
      coverImageUrl: data.cover_image_url ?? null,
      cashReceiptOnboardingMessage: onboardingMessage,
      createdAt: data.created_at ?? '',
    };
  }

  /**
   * 브랜드 비활성화
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
        throw new Error(
          `[brands.deleteBrand] membership check: ${memError.message}`,
        );
      }
      if (!membership || membership.status !== 'ACTIVE') {
        throw new ForbiddenException('브랜드 비활성화 권한이 없습니다.');
      }
    }

    const { error } = await adminSb
      .from('brands')
      .update({ is_active: false })
      .eq('id', brandId);

    if (error) {
      throw new Error(`[brands.deleteBrand] ${error.message}`);
    }

    return { deleted: true };
  }
}
