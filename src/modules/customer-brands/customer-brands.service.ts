import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import type { BrandMembership } from '../../common/types/auth-request';
import {
  CreateCustomerBrandRequest,
  UpdateCustomerBrandRequest,
} from './dto/customer-brand.request';
import { CashReceiptOnboardingService } from '../cash-receipts/cash-receipt-onboarding.service';
import { BillingTier } from '../billing/billing.types';

const SHOP_PAYMENT_METHODS = ['CARD', 'TRANSFER'] as const;
type ShopPaymentMethod = (typeof SHOP_PAYMENT_METHODS)[number];
const DEFAULT_PG_COMMISSION_RATE = 0.035;
const BRAND_SELECT_WITH_BILLING =
  'id, name, slug, billing_tier, billing_tier_decided_at, commission_rate, biz_name, biz_reg_no, rep_name, address, biz_cert_url, shop_payment_methods, cash_receipt_enabled, cash_receipt_provider, cash_receipt_merchant_id, cash_receipt_issue_timing, cash_receipt_self_issue_enabled, cash_receipt_contact_name, cash_receipt_contact_phone, owner_user_id, logo_url, cover_image_url, thumbnail_url, created_at';
const BRAND_SELECT_LEGACY =
  'id, name, slug, biz_name, biz_reg_no, rep_name, address, biz_cert_url, shop_payment_methods, cash_receipt_enabled, cash_receipt_provider, cash_receipt_merchant_id, cash_receipt_issue_timing, cash_receipt_self_issue_enabled, cash_receipt_contact_name, cash_receipt_contact_phone, owner_user_id, logo_url, cover_image_url, thumbnail_url, created_at';
const BRAND_CREATE_SELECT_WITH_BILLING =
  'id, name, slug, owner_user_id, billing_tier, billing_tier_decided_at, commission_rate, biz_name, biz_reg_no, rep_name, address, biz_cert_url, shop_payment_methods, cash_receipt_enabled, cash_receipt_provider, cash_receipt_merchant_id, cash_receipt_issue_timing, cash_receipt_self_issue_enabled, cash_receipt_contact_name, cash_receipt_contact_phone, logo_url, cover_image_url, created_at';
const BRAND_CREATE_SELECT_LEGACY =
  'id, name, slug, owner_user_id, biz_name, biz_reg_no, rep_name, address, biz_cert_url, shop_payment_methods, cash_receipt_enabled, cash_receipt_provider, cash_receipt_merchant_id, cash_receipt_issue_timing, cash_receipt_self_issue_enabled, cash_receipt_contact_name, cash_receipt_contact_phone, logo_url, cover_image_url, created_at';
type BrandRecord = Record<string, any>;
type BrandQueryResult<T> = {
  data: T | null;
  error: any;
};

@Injectable()
export class CustomerBrandsService {
  private readonly logger = new Logger(CustomerBrandsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    @Optional()
    private readonly cashReceiptOnboardingService?: CashReceiptOnboardingService,
  ) {}

  private normalizeShopPaymentMethods(value: unknown): ShopPaymentMethod[] {
    if (!Array.isArray(value)) {
      return [...SHOP_PAYMENT_METHODS];
    }

    const set = new Set<ShopPaymentMethod>();
    for (const item of value) {
      const upper = typeof item === 'string' ? item.trim().toUpperCase() : '';
      if ((SHOP_PAYMENT_METHODS as readonly string[]).includes(upper)) {
        set.add(upper as ShopPaymentMethod);
      }
    }

    if (set.size === 0) {
      return [...SHOP_PAYMENT_METHODS];
    }

    return [...set];
  }

  private getShopPaymentMethodsForBillingTier(
    billingTier: BillingTier,
  ): ShopPaymentMethod[] {
    return billingTier === BillingTier.NON_PG ? ['TRANSFER'] : ['CARD'];
  }

  private isMissingColumnError(error: any): boolean {
    const message =
      typeof error?.message === 'string' ? error.message : String(error ?? '');

    return (
      error?.code === '42703' ||
      /column .* does not exist/i.test(message) ||
      /schema cache/i.test(message)
    );
  }

  private inferBillingTierFromBrand(brand: {
    billing_tier?: unknown;
    shop_payment_methods?: unknown;
  }): BillingTier {
    if (brand.billing_tier === BillingTier.NON_PG) {
      return BillingTier.NON_PG;
    }

    const paymentMethods = this.normalizeShopPaymentMethods(
      brand.shop_payment_methods,
    );
    return paymentMethods.length === 1 && paymentMethods[0] === 'TRANSFER'
      ? BillingTier.NON_PG
      : BillingTier.PG;
  }

  private normalizeBrandRecord<T extends BrandRecord>(brand: T): T {
    const billingTier = this.inferBillingTierFromBrand(brand);

    return {
      ...brand,
      billing_tier: billingTier,
      billing_tier_decided_at: brand.billing_tier_decided_at ?? null,
      commission_rate:
        brand.commission_rate ??
        (billingTier === BillingTier.PG ? DEFAULT_PG_COMMISSION_RATE : null),
      shop_payment_methods: this.normalizeShopPaymentMethods(
        brand.shop_payment_methods,
      ),
    };
  }

  private stripBillingTierWriteFields(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const next = { ...payload };
    delete next.billing_tier;
    delete next.billing_tier_decided_at;
    delete next.commission_rate;
    return next;
  }

  private async runBrandQueryWithFallback<T>(params: {
    run:
      | ((selectClause: string) => PromiseLike<BrandQueryResult<T>>)
      | ((selectClause: string) => BrandQueryResult<T>);
    primarySelect?: string;
    fallbackSelect?: string;
    context: string;
  }): Promise<BrandQueryResult<T>> {
    const primarySelect = params.primarySelect ?? BRAND_SELECT_WITH_BILLING;
    const fallbackSelect = params.fallbackSelect ?? BRAND_SELECT_LEGACY;

    const primary = await params.run(primarySelect);
    if (!primary.error || !this.isMissingColumnError(primary.error)) {
      return primary;
    }

    this.logger.warn(
      `${params.context}: billing tier columns are unavailable, using legacy brand schema fallback`,
    );

    return params.run(fallbackSelect);
  }

  private shouldRevalidateCashReceipt(
    updateData: UpdateCustomerBrandRequest,
  ): boolean {
    return [
      'biz_name',
      'biz_reg_no',
      'rep_name',
      'address',
      'cash_receipt_enabled',
      'cash_receipt_provider',
      'cash_receipt_merchant_id',
      'cash_receipt_contact_name',
      'cash_receipt_contact_phone',
    ].some((key) => key in updateData);
  }

  private async resolveCashReceiptConfig(
    ownerUserId: string,
    draft: Partial<CreateCustomerBrandRequest & UpdateCustomerBrandRequest>,
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

  async getMyBrands(userId: string, brandMemberships: BrandMembership[]) {
    this.logger.log(`Fetching brands for user: ${userId}`);

    const brandIds = brandMemberships.map((m) => m.brand_id);
    const sb = this.supabase.adminClient();

    const [memberBrandsResult, ownedBrandsResult] = await Promise.all([
      brandIds.length > 0
        ? this.runBrandQueryWithFallback<BrandRecord[]>({
            context: `getMyBrands(member:${userId})`,
            run: (selectClause) =>
              sb
                .from('brands')
                .select(selectClause)
                .in('id', brandIds)
                .order('created_at', { ascending: false }),
          })
        : Promise.resolve({ data: [], error: null }),
      this.runBrandQueryWithFallback<BrandRecord[]>({
        context: `getMyBrands(owner:${userId})`,
        run: (selectClause) =>
          sb
            .from('brands')
            .select(selectClause)
            .eq('owner_user_id', userId)
            .order('created_at', { ascending: false }),
      }),
    ]);

    if (memberBrandsResult.error) {
      this.logger.error(
        `Failed to fetch membership brands for user ${userId}`,
        memberBrandsResult.error,
      );
      throw new Error('Failed to fetch brands');
    }

    if (ownedBrandsResult.error) {
      this.logger.error(
        `Failed to fetch owned brands for user ${userId}`,
        ownedBrandsResult.error,
      );
      throw new Error('Failed to fetch brands');
    }

    const mergedById = new Map<string, any>();
    for (const brand of memberBrandsResult.data ?? []) {
      mergedById.set(brand.id, brand);
    }
    for (const brand of ownedBrandsResult.data ?? []) {
      mergedById.set(brand.id, brand);
    }

    const membershipByBrandId = new Map(
      brandMemberships.map((membership) => [membership.brand_id, membership]),
    );

    const brandsWithRole = Array.from(mergedById.values())
      .sort((a, b) => {
        const left = String(a.created_at ?? '');
        const right = String(b.created_at ?? '');
        return right.localeCompare(left);
      })
      .map((brand) => {
        const normalizedBrand = this.normalizeBrandRecord(brand);
        const membership = membershipByBrandId.get(brand.id);
        return {
          ...normalizedBrand,
          slug: normalizedBrand.slug ?? null,
          myRole:
            membership?.role ??
            (normalizedBrand.owner_user_id === userId ? 'OWNER' : null),
        };
      });

    this.logger.log(
      `Fetched ${brandsWithRole.length} brands for user: ${userId}`,
    );

    return brandsWithRole;
  }

  async getMyBrand(
    brandId: string,
    userId: string,
    brandMemberships: BrandMembership[],
  ) {
    this.logger.log(`Fetching brand ${brandId} for user: ${userId}`);

    const membership = brandMemberships.find((m) => m.brand_id === brandId);

    const sb = this.supabase.adminClient();

    const { data, error } = await this.runBrandQueryWithFallback<BrandRecord>({
      context: `getMyBrand(${brandId})`,
      run: (selectClause) =>
        sb.from('brands').select(selectClause).eq('id', brandId).single(),
    });

    if (error || !data) {
      this.logger.error(`Failed to fetch brand ${brandId}`, error);
      throw new NotFoundException('Brand not found');
    }

    const effectiveRole =
      membership?.role ?? (data.owner_user_id === userId ? 'OWNER' : null);

    if (!effectiveRole) {
      this.logger.warn(
        `User ${userId} attempted to access brand ${brandId} without membership`,
      );
      throw new ForbiddenException('You do not have access to this brand');
    }

    return {
      ...this.normalizeBrandRecord(data),
      myRole: effectiveRole,
    };
  }

  async createMyBrand(
    createData: CreateCustomerBrandRequest,
    userId: string,
    brandMemberships: BrandMembership[],
    canCreateBrand?: boolean,
  ) {
    const hasManagePermission = brandMemberships.some(
      (m) => m.role === 'OWNER' || m.role === 'ADMIN',
    );

    if (!hasManagePermission && canCreateBrand !== true) {
      this.logger.warn(
        `User ${userId} has no owner/admin membership and attempted to create brand`,
      );
      throw new ForbiddenException('Only OWNER or ADMIN can create a brand');
    }

    const sb = this.supabase.adminClient();
    const billingTier = createData.billingTier;
    const billingTierDecidedAt = new Date().toISOString();

    const insertPayload: Record<string, unknown> = {
      name: createData.name,
      slug: createData.slug ?? null,
      owner_user_id: userId,
      billing_tier: billingTier,
      billing_tier_decided_at: billingTierDecidedAt,
      commission_rate:
        billingTier === BillingTier.PG ? DEFAULT_PG_COMMISSION_RATE : null,
      biz_name: createData.biz_name ?? null,
      biz_reg_no: createData.biz_reg_no ?? null,
      rep_name: createData.rep_name ?? null,
      address: createData.address ?? null,
      biz_cert_url: createData.biz_cert_url ?? createData.bizCertUrl ?? null,
      cash_receipt_enabled: createData.cash_receipt_enabled ?? false,
      cash_receipt_provider: createData.cash_receipt_provider ?? null,
      cash_receipt_merchant_id: createData.cash_receipt_merchant_id ?? null,
      cash_receipt_issue_timing: createData.cash_receipt_issue_timing ?? null,
      cash_receipt_self_issue_enabled:
        createData.cash_receipt_self_issue_enabled ?? false,
      cash_receipt_contact_name: createData.cash_receipt_contact_name ?? null,
      cash_receipt_contact_phone: createData.cash_receipt_contact_phone ?? null,
      logo_url: createData.logo_url ?? null,
      cover_image_url: createData.cover_image_url ?? null,
    };
    insertPayload.shop_payment_methods =
      this.getShopPaymentMethodsForBillingTier(billingTier);
    const createOnboarding = await this.resolveCashReceiptConfig(
      userId,
      createData,
    );
    Object.assign(insertPayload, createOnboarding.config);

    let createResult = await sb
      .from('brands')
      .insert(insertPayload)
      .select(BRAND_CREATE_SELECT_WITH_BILLING)
      .single();

    if (createResult.error && this.isMissingColumnError(createResult.error)) {
      this.logger.warn(
        `createMyBrand(${userId}): billing tier columns are unavailable, using legacy brand schema fallback`,
      );
      const legacyInsertPayload =
        this.stripBillingTierWriteFields(insertPayload);
      createResult = await sb
        .from('brands')
        .insert(legacyInsertPayload)
        .select(BRAND_CREATE_SELECT_LEGACY)
        .single();
    }

    const { data, error } = createResult;

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
      ...this.normalizeBrandRecord(data),
      myRole: 'OWNER',
      cash_receipt_onboarding_message: createOnboarding.onboardingMessage,
    };
  }

  async updateMyBrand(
    brandId: string,
    updateData: UpdateCustomerBrandRequest,
    userId: string,
    brandMemberships: BrandMembership[],
  ) {
    this.logger.log(`Updating brand ${brandId} by user: ${userId}`);

    const sb = this.supabase.adminClient();
    const membership = brandMemberships.find((m) => m.brand_id === brandId);
    let effectiveRole = membership?.role ?? null;

    if (!effectiveRole) {
      const { data: ownedBrand, error: ownedBrandError } = await sb
        .from('brands')
        .select('id, owner_user_id')
        .eq('id', brandId)
        .single();

      if (
        ownedBrandError ||
        !ownedBrand ||
        ownedBrand.owner_user_id !== userId
      ) {
        throw new ForbiddenException('You do not have access to this brand');
      }

      effectiveRole = 'OWNER';
    }

    if (effectiveRole !== 'OWNER' && effectiveRole !== 'ADMIN') {
      this.logger.warn(
        `User ${userId} with role ${effectiveRole} attempted to update brand ${brandId}`,
      );
      throw new ForbiddenException(
        'Only OWNER or ADMIN can update brand information',
      );
    }

    let existingBrand: any = null;
    let onboardingMessage: string | null = null;

    const {
      name,
      slug,
      biz_name,
      biz_reg_no,
      rep_name,
      address,
      biz_cert_url,
      bizCertUrl,
      logo_url,
      cover_image_url,
      shop_payment_methods,
      cash_receipt_enabled,
      cash_receipt_provider,
      cash_receipt_merchant_id,
      cash_receipt_issue_timing,
      cash_receipt_self_issue_enabled,
      cash_receipt_contact_name,
      cash_receipt_contact_phone,
    } = updateData;
    const updateFields: any = {};
    if (name !== undefined) updateFields.name = name;
    if (slug !== undefined) updateFields.slug = slug;
    if (biz_name !== undefined) updateFields.biz_name = biz_name;
    if (biz_reg_no !== undefined) updateFields.biz_reg_no = biz_reg_no;
    if (rep_name !== undefined) updateFields.rep_name = rep_name;
    if (address !== undefined) updateFields.address = address;
    if (biz_cert_url !== undefined || bizCertUrl !== undefined) {
      updateFields.biz_cert_url = biz_cert_url ?? bizCertUrl ?? null;
    }
    if (logo_url !== undefined) updateFields.logo_url = logo_url;
    if (cover_image_url !== undefined)
      updateFields.cover_image_url = cover_image_url;
    if (shop_payment_methods !== undefined) {
      updateFields.shop_payment_methods =
        this.normalizeShopPaymentMethods(shop_payment_methods);
    }
    if (cash_receipt_enabled !== undefined) {
      updateFields.cash_receipt_enabled = cash_receipt_enabled;
    }
    if (cash_receipt_provider !== undefined) {
      updateFields.cash_receipt_provider = cash_receipt_provider;
    }
    if (cash_receipt_merchant_id !== undefined) {
      updateFields.cash_receipt_merchant_id = cash_receipt_merchant_id;
    }
    if (cash_receipt_issue_timing !== undefined) {
      updateFields.cash_receipt_issue_timing = cash_receipt_issue_timing;
    }
    if (cash_receipt_self_issue_enabled !== undefined) {
      updateFields.cash_receipt_self_issue_enabled =
        cash_receipt_self_issue_enabled;
    }
    if (cash_receipt_contact_name !== undefined) {
      updateFields.cash_receipt_contact_name = cash_receipt_contact_name;
    }
    if (cash_receipt_contact_phone !== undefined) {
      updateFields.cash_receipt_contact_phone = cash_receipt_contact_phone;
    }
    if (
      this.cashReceiptOnboardingService &&
      this.shouldRevalidateCashReceipt(updateData)
    ) {
      const { data: existingBrandData, error: existingBrandError } = await sb
        .from('brands')
        .select(
          'id, owner_user_id, biz_name, biz_reg_no, rep_name, address, cash_receipt_enabled, cash_receipt_provider, cash_receipt_merchant_id, cash_receipt_contact_name, cash_receipt_contact_phone',
        )
        .eq('id', brandId)
        .single();

      if (existingBrandError || !existingBrandData) {
        this.logger.error(
          `Failed to fetch brand ${brandId} before update`,
          existingBrandError,
        );
        throw new NotFoundException('Brand not found');
      }

      existingBrand = existingBrandData;
      const resolvedOnboarding = await this.resolveCashReceiptConfig(
        existingBrand.owner_user_id,
        {
          biz_name: biz_name ?? existingBrand.biz_name,
          biz_reg_no: biz_reg_no ?? existingBrand.biz_reg_no,
          rep_name: rep_name ?? existingBrand.rep_name,
          address: address ?? existingBrand.address,
          cash_receipt_enabled:
            cash_receipt_enabled ?? existingBrand.cash_receipt_enabled,
          cash_receipt_provider:
            cash_receipt_provider ?? existingBrand.cash_receipt_provider,
          cash_receipt_merchant_id:
            cash_receipt_merchant_id ?? existingBrand.cash_receipt_merchant_id,
          cash_receipt_contact_name:
            cash_receipt_contact_name ??
            existingBrand.cash_receipt_contact_name,
          cash_receipt_contact_phone:
            cash_receipt_contact_phone ??
            existingBrand.cash_receipt_contact_phone,
        },
      );
      Object.assign(updateFields, resolvedOnboarding.config);
      onboardingMessage = resolvedOnboarding.onboardingMessage;
    }

    const { data, error } = await this.runBrandQueryWithFallback<BrandRecord>({
      context: `updateMyBrand(${brandId})`,
      run: (selectClause) =>
        sb
          .from('brands')
          .update(updateFields)
          .eq('id', brandId)
          .select(selectClause)
          .single(),
    });

    if (error || !data) {
      this.logger.error(`Failed to update brand ${brandId}`, error);
      throw new Error('Failed to update brand');
    }

    this.logger.log(`Brand ${brandId} updated successfully`);

    return {
      ...this.normalizeBrandRecord(data),
      cash_receipt_onboarding_message: onboardingMessage,
      myRole: effectiveRole,
    };
  }
}
