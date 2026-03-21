import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { InventoryService } from '../inventory/inventory.service';
import { StampsService } from '../stamps/stamps.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  PublicBranchResponse,
  PublicBrandBranchesResponse,
  PublicProductResponse,
  PublicOrderResponse,
  CreatePublicOrderRequest,
  FulfillmentType,
  PaymentMethod,
} from './dto/public-order.dto';
import {
  CreatePublicShopOrderRequest,
  PublicShopBrandResponse,
} from './dto/public-shop.dto';
import {
  getBranchOrderConfig,
  normalizeFulfillmentTypes,
  normalizePaymentMethods,
  saveBranchOrderConfig,
} from '../branches/branch-order-config.util';

@Injectable()
export class PublicOrderService {
  private readonly logger = new Logger(PublicOrderService.name);
  private readonly duplicateWindowMs: number;
  private readonly weakDuplicateWindowMs: number;
  private readonly duplicateLookbackLimit: number;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly inventoryService: InventoryService,
    private readonly stampsService: StampsService,
    private readonly notificationsService: NotificationsService,
  ) {
    const windowMs = Number(process.env.PUBLIC_ORDER_DUPLICATE_WINDOW_MS);
    this.duplicateWindowMs =
      Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 60 * 1000;

    const weakWindowMs = Number(
      process.env.PUBLIC_ORDER_ANON_DUPLICATE_WINDOW_MS,
    );
    this.weakDuplicateWindowMs =
      Number.isFinite(weakWindowMs) && weakWindowMs > 0
        ? weakWindowMs
        : 20 * 1000;

    const limit = Number(process.env.PUBLIC_ORDER_DUPLICATE_LOOKBACK_LIMIT);
    this.duplicateLookbackLimit =
      Number.isFinite(limit) && limit > 0 ? Math.min(limit, 20) : 5;
  }

  private getPrimaryImageUrl(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (!Array.isArray(parsed)) return null;
        const first = parsed.find(
          (item) => typeof item === 'string' && item.trim().length > 0,
        );
        return typeof first === 'string' ? first.trim() : null;
      } catch {
        return null;
      }
    }

    return trimmed;
  }

  private getImageUrls(value: unknown): string[] {
    if (typeof value !== 'string') return [];
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (!Array.isArray(parsed)) return [];
        return [...new Set(parsed.filter((item) => typeof item === 'string'))]
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 10);
      } catch {
        return [];
      }
    }

    return [trimmed];
  }

  /**
   * Get public brand list for shop landing
   */
  async getBrands() {
    const sb = this.supabase.anonClient();

    const { data, error } = await sb
      .from('branches')
      .select(
        `
        id,
        slug,
        created_at,
        brands!inner (
          id,
          name,
          slug,
          logo_url,
          cover_image_url
        )
      `,
      )
      .order('created_at', { ascending: true })
      .limit(1000);

    if (error) {
      throw new Error(`브랜드 목록 조회 실패: ${error.message}`);
    }

    const grouped = new Map<
      string,
      {
        id: string;
        name: string;
        slug?: string | null;
        logoUrl?: string | null;
        coverImageUrl?: string | null;
        branchCount: number;
        firstBranchId: string;
      }
    >();

    for (const row of (data ?? []) as any[]) {
      const brand = row?.brands;
      if (!brand?.id) continue;

      const existing = grouped.get(brand.id);
      if (!existing) {
        grouped.set(brand.id, {
          id: brand.id,
          name: brand.name ?? '',
          slug: brand.slug ?? null,
          logoUrl: brand.logo_url ?? null,
          coverImageUrl: brand.cover_image_url ?? null,
          branchCount: 1,
          firstBranchId: row.id,
        });
        continue;
      }

      existing.branchCount += 1;
    }

    return Array.from(grouped.values())
      .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'))
      .map((brand) => ({
        id: brand.id,
        name: brand.name,
        slug: brand.slug ?? null,
        logoUrl: brand.logoUrl ?? null,
        coverImageUrl: brand.coverImageUrl ?? null,
        branchCount: brand.branchCount,
        orderPath: brand.slug
          ? `/order/${encodeURIComponent(brand.slug)}`
          : `/order/branch/${brand.firstBranchId}`,
      }));
  }

  private async resolveShopBrandContext(brandSlug: string): Promise<{
    brandId: string;
    brandSlug: string;
    brandName: string;
    logoUrl: string | null;
    coverImageUrl: string | null;
    branchId: string;
    shopPaymentMethods: string[];
    paymentMethods: string[];
    deliverySupported: boolean;
    branchCandidates: Array<{
      branchId: string;
      paymentMethods: string[];
      supportsDelivery: boolean;
      hasDeliveryChannel: boolean;
      createdAt: string | null;
    }>;
  }> {
    const adminSb = this.supabase.adminClient();

    let brandRows: any[] | null = null;
    let brandError: any = null;
    ({ data: brandRows, error: brandError } = await adminSb
      .from('brands')
      .select('id, name, slug, logo_url, cover_image_url, shop_payment_methods')
      .eq('slug', brandSlug)
      .limit(2));
    if (
      brandError &&
      this.isMissingColumnError(brandError) &&
      this.getMissingColumnName(brandError) === 'shop_payment_methods'
    ) {
      ({ data: brandRows, error: brandError } = await adminSb
        .from('brands')
        .select('id, name, slug, logo_url, cover_image_url')
        .eq('slug', brandSlug)
        .limit(2));
    }

    if (brandError || !brandRows || brandRows.length === 0) {
      throw new NotFoundException('온라인샵 브랜드를 찾을 수 없습니다.');
    }

    if (brandRows.length > 1) {
      throw new ConflictException('브랜드 URL이 중복되어 사용할 수 없습니다.');
    }

    const brand = brandRows[0];
    const shopPaymentMethods = normalizePaymentMethods(
      brand.shop_payment_methods,
    );

    const { data: branchRows, error: branchError } = await adminSb
      .from('branches')
      .select('id, name, slug, created_at')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: true })
      .limit(1000);

    if (branchError) {
      throw new BadRequestException(
        '온라인샵 주문을 처리할 지점이 설정되지 않았습니다.',
      );
    }

    let resolvedBranchRows = (branchRows ?? []) as any[];
    if (resolvedBranchRows.length === 0) {
      const onlineShopBranch = await this.ensureOnlineShopBranch(
        adminSb,
        brand.id,
        brand.name ?? '브랜드 온라인샵',
      );
      resolvedBranchRows = onlineShopBranch ? [onlineShopBranch] : [];
    }

    if (resolvedBranchRows.length === 0) {
      throw new BadRequestException(
        '온라인샵 주문을 처리할 지점을 찾을 수 없습니다.',
      );
    }

    const branchCandidates: Array<{
      branchId: string;
      paymentMethods: string[];
      supportsDelivery: boolean;
      hasDeliveryChannel: boolean;
      createdAt: string | null;
    }> = [];

    let selected:
      | {
          branchId: string;
          hasDeliveryChannel: boolean;
          paymentMethods: string[];
          supportsDelivery: boolean;
        }
      | undefined;
    let fallback:
      | {
          branchId: string;
          paymentMethods: string[];
          supportsDelivery: boolean;
        }
      | undefined;

    for (const row of resolvedBranchRows) {
      const branchId = String(row?.id ?? '');
      if (!branchId) continue;

      const candidate = await this.buildShopBranchCandidate(branchId, {
        createdAt: row?.created_at ?? null,
      });
      branchCandidates.push(candidate);

      if (!fallback) {
        fallback = {
          branchId: candidate.branchId,
          paymentMethods: candidate.paymentMethods,
          supportsDelivery: candidate.supportsDelivery,
        };
      }
      if (!candidate.supportsDelivery) continue;

      if (
        !selected ||
        (candidate.hasDeliveryChannel && !selected.hasDeliveryChannel)
      ) {
        selected = {
          branchId: candidate.branchId,
          hasDeliveryChannel: candidate.hasDeliveryChannel,
          paymentMethods: candidate.paymentMethods,
          supportsDelivery: candidate.supportsDelivery,
        };
      }
    }

    if (branchCandidates.length === 0 || (!selected && !fallback)) {
      throw new BadRequestException(
        '온라인샵 주문을 처리할 지점을 찾을 수 없습니다.',
      );
    }

    const chosen = selected ?? {
      branchId: fallback!.branchId,
      hasDeliveryChannel: false,
      paymentMethods: fallback!.paymentMethods,
      supportsDelivery: fallback!.supportsDelivery,
    };

    return {
      brandId: brand.id,
      brandSlug: brand.slug ?? brandSlug,
      brandName: brand.name ?? '',
      logoUrl: brand.logo_url ?? null,
      coverImageUrl: brand.cover_image_url ?? null,
      branchId: chosen.branchId,
      shopPaymentMethods,
      paymentMethods: chosen.paymentMethods,
      deliverySupported: Boolean(selected),
      branchCandidates,
    };
  }

  private async ensureOnlineShopBranch(
    adminSb: any,
    brandId: string,
    brandName: string,
  ): Promise<{
    id: string;
    name: string | null;
    slug: string | null;
    created_at: string | null;
  } | null> {
    const branchName = `${brandName} 온라인샵`;

    const { data: createdBranch, error: createBranchError } = await adminSb
      .from('branches')
      .insert({
        brand_id: brandId,
        name: branchName,
      })
      .select('id, name, slug, created_at')
      .single();

    if (createBranchError || !createdBranch?.id) {
      this.logger.warn(
        `온라인샵 자동 지점 생성 실패(재조회 시도): brand=${brandId} reason=${createBranchError?.message ?? 'unknown'}`,
      );
      const { data: existingRows, error: existingRowsError } = await adminSb
        .from('branches')
        .select('id, name, slug, created_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: true })
        .limit(1000);

      const existingOnlineShopBranch = (existingRows ?? []).find((row: any) =>
        this.isInternalOnlineShopBranchRow(row, brandName),
      );

      if (
        existingRowsError ||
        !existingRows ||
        existingRows.length === 0 ||
        !existingOnlineShopBranch?.id
      ) {
        throw new BadRequestException(
          '온라인샵 주문을 처리할 지점을 자동 생성하지 못했습니다.',
        );
      }

      const branchId = String(existingOnlineShopBranch.id);
      if (branchId) {
        await this.ensureOnlineShopBranchReady(adminSb, brandId, branchId);
      }
      return {
        id: branchId,
        name: existingOnlineShopBranch.name ?? null,
        slug: existingOnlineShopBranch.slug ?? null,
        created_at: existingOnlineShopBranch.created_at ?? null,
      };
    }

    const branchId = String(createdBranch.id);
    await this.ensureOnlineShopBranchReady(adminSb, brandId, branchId);
    return {
      id: branchId,
      name: createdBranch.name ?? null,
      slug: createdBranch.slug ?? null,
      created_at: createdBranch.created_at ?? null,
    };
  }

  private async ensureOnlineShopBranchReady(
    adminSb: any,
    brandId: string,
    branchId: string,
  ): Promise<void> {
    await saveBranchOrderConfig(adminSb, branchId, {
      enabledFulfillmentTypes: [FulfillmentType.DELIVERY],
    });
    await this.ensureOnlineShopProductsLinkedToBranch(
      adminSb,
      brandId,
      branchId,
    );
  }

  private async buildShopBranchCandidate(
    branchId: string,
    options?: { createdAt?: string | null },
  ): Promise<{
    branchId: string;
    paymentMethods: string[];
    supportsDelivery: boolean;
    hasDeliveryChannel: boolean;
    createdAt: string | null;
  }> {
    const orderConfig = await this.getPublicBranchOrderConfig(branchId);
    const paymentMethods = normalizePaymentMethods(
      orderConfig.allowedPaymentMethods,
    );
    const enabledTypes = normalizeFulfillmentTypes(
      orderConfig.enabledFulfillmentTypes,
    );
    const supportsDelivery = enabledTypes.includes(FulfillmentType.DELIVERY);
    const hasDeliveryChannel = Boolean(
      orderConfig.channelByType[FulfillmentType.DELIVERY],
    );

    return {
      branchId,
      paymentMethods,
      supportsDelivery,
      hasDeliveryChannel,
      createdAt: options?.createdAt ?? null,
    };
  }

  private isInternalOnlineShopBranchRow(
    row: any,
    brandName?: string | null,
  ): boolean {
    if (row?.slug) {
      return false;
    }

    const normalizedBranchName = String(row?.name ?? '')
      .trim()
      .toLowerCase();
    if (!normalizedBranchName) {
      return false;
    }

    const normalizedBrandName = String(brandName ?? '')
      .trim()
      .toLowerCase();
    if (
      normalizedBrandName &&
      normalizedBranchName === `${normalizedBrandName} 온라인샵`
    ) {
      return true;
    }

    return normalizedBranchName.endsWith('온라인샵');
  }

  private async ensureOnlineShopCandidate(
    adminSb: any,
    context: {
      brandId: string;
      brandName: string;
      branchCandidates: Array<{
        branchId: string;
        paymentMethods: string[];
        supportsDelivery: boolean;
        hasDeliveryChannel: boolean;
        createdAt: string | null;
      }>;
    },
  ): Promise<{
    branchId: string;
    paymentMethods: string[];
    supportsDelivery: boolean;
    hasDeliveryChannel: boolean;
    createdAt: string | null;
  }> {
    const { data: branchRows, error: branchError } = await adminSb
      .from('branches')
      .select('id, name, slug, created_at')
      .eq('brand_id', context.brandId)
      .order('created_at', { ascending: true })
      .limit(1000);

    if (branchError) {
      throw new BadRequestException(
        '온라인샵 주문을 처리할 지점을 확인하지 못했습니다.',
      );
    }

    const existingOnlineShopBranch = (branchRows ?? []).find((row: any) =>
      this.isInternalOnlineShopBranchRow(row, context.brandName),
    );

    const onlineShopBranch =
      existingOnlineShopBranch ??
      (await this.ensureOnlineShopBranch(
        adminSb,
        context.brandId,
        context.brandName,
      ));

    if (!onlineShopBranch?.id) {
      throw new BadRequestException(
        '온라인샵 주문을 처리할 지점을 준비하지 못했습니다.',
      );
    }

    await this.ensureOnlineShopBranchReady(
      adminSb,
      context.brandId,
      onlineShopBranch.id,
    );

    const existingCandidate = context.branchCandidates.find(
      (candidate) => candidate.branchId === onlineShopBranch.id,
    );
    if (existingCandidate) {
      return existingCandidate;
    }

    return this.buildShopBranchCandidate(onlineShopBranch.id, {
      createdAt: onlineShopBranch.created_at ?? null,
    });
  }

  private async ensureOnlineShopProductsLinkedToBranch(
    adminSb: any,
    brandId: string,
    branchId: string,
  ): Promise<void> {
    const fetchAllTemplates = (withOnlineShopFilter: boolean) => {
      let query = adminSb
        .from('brand_products')
        .select('*')
        .eq('brand_id', brandId)
        .eq('is_active', true);

      if (withOnlineShopFilter) {
        query = query.eq('is_online_shop_visible', true);
      }

      return query
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(2000);
    };

    let { data: templates, error: templatesError } =
      await fetchAllTemplates(true);
    if (
      templatesError &&
      this.isMissingColumnError(templatesError) &&
      this.getMissingColumnName(templatesError) === 'is_online_shop_visible'
    ) {
      ({ data: templates, error: templatesError } =
        await fetchAllTemplates(false));
    }

    if (templatesError) {
      throw new BadRequestException(
        `온라인샵 상품 템플릿 조회 실패: ${templatesError.message}`,
      );
    }

    const { data: brandTemplateRows, error: brandTemplateRowsError } =
      await adminSb
        .from('brand_products')
        .select('id')
        .eq('brand_id', brandId)
        .limit(2000);

    if (brandTemplateRowsError) {
      throw new BadRequestException(
        `온라인샵 상품 템플릿 목록 조회 실패: ${brandTemplateRowsError.message}`,
      );
    }

    const allTemplateIds = (brandTemplateRows ?? [])
      .map((row: any) => String(row?.id ?? ''))
      .filter(Boolean);
    const targetTemplates = (templates ?? []) as any[];
    const targetTemplateIds = new Set(
      targetTemplates.map((row: any) => String(row?.id ?? '')).filter(Boolean),
    );

    if (allTemplateIds.length === 0) {
      return;
    }

    const { data: linkedProducts, error: linkedError } = await adminSb
      .from('products')
      .select('*')
      .eq('branch_id', branchId)
      .in('brand_product_id', allTemplateIds)
      .limit(2000);

    if (linkedError) {
      throw new BadRequestException(
        `온라인샵 상품 연결 조회 실패: ${linkedError.message}`,
      );
    }

    const linkedByTemplate = new Map<string, any>();
    for (const row of linkedProducts ?? []) {
      const templateId = String(row?.brand_product_id ?? '');
      if (!templateId) continue;
      linkedByTemplate.set(templateId, row);
    }

    for (const template of targetTemplates) {
      const templateId = String(template?.id ?? '');
      if (!templateId) continue;

      const existing = linkedByTemplate.get(templateId);
      const payload = {
        name: template.name,
        description: template.description ?? null,
        base_price: template.base_price ?? 0,
        image_url: this.getPrimaryImageUrl(template.image_url),
        sort_order: template.sort_order ?? 0,
        urgent_discount_price: template.urgent_discount_price ?? null,
        urgent_discount_start_at: template.urgent_discount_start_at ?? null,
        urgent_discount_end_at: template.urgent_discount_end_at ?? null,
        is_hidden: false,
      };

      if (existing?.id) {
        const { error } = await adminSb
          .from('products')
          .update(payload)
          .eq('id', existing.id);

        if (error) {
          throw new BadRequestException(
            `온라인샵 상품 자동 연결 실패: ${error.message}`,
          );
        }
        continue;
      }

      const { error } = await adminSb.from('products').insert({
        branch_id: branchId,
        brand_product_id: templateId,
        ...payload,
      });

      if (error && error.code !== '23505') {
        throw new BadRequestException(
          `온라인샵 상품 자동 연결 실패: ${error.message}`,
        );
      }
    }

    const linkedTemplateIdsToHide = [...linkedByTemplate.keys()].filter(
      (templateId) => !targetTemplateIds.has(templateId),
    );

    if (linkedTemplateIdsToHide.length > 0) {
      const { error } = await adminSb
        .from('products')
        .update({ is_hidden: true })
        .eq('branch_id', branchId)
        .in('brand_product_id', linkedTemplateIdsToHide);

      if (error) {
        throw new BadRequestException(
          `온라인샵 상품 숨김 처리 실패: ${error.message}`,
        );
      }
    }
  }

  private async ensureBrandProductsLinkedToBranch(
    adminSb: any,
    brandId: string,
    branchId: string,
  ): Promise<void> {
    const { data: templates, error: templatesError } = await adminSb
      .from('brand_products')
      .select('*')
      .eq('brand_id', brandId)
      .eq('is_active', true)
      .limit(2000);

    if (templatesError) {
      throw new BadRequestException(
        `온라인샵 상품 템플릿 조회 실패: ${templatesError.message}`,
      );
    }

    const templateRows = (templates ?? []) as any[];
    if (templateRows.length === 0) return;

    const templateIds = templateRows
      .map((row) => String(row?.id ?? ''))
      .filter(Boolean);
    if (templateIds.length === 0) return;

    const { data: existingProducts, error: existingProductsError } =
      await adminSb
        .from('products')
        .select('brand_product_id')
        .eq('branch_id', branchId)
        .in('brand_product_id', templateIds)
        .limit(2000);

    if (existingProductsError) {
      throw new BadRequestException(
        `온라인샵 상품 연결 조회 실패: ${existingProductsError.message}`,
      );
    }

    const existingTemplateIds = new Set(
      (existingProducts ?? [])
        .map((row: any) => String(row?.brand_product_id ?? ''))
        .filter(Boolean),
    );

    const rowsToInsert = templateRows
      .filter((template) => !existingTemplateIds.has(String(template.id)))
      .map((template) => ({
        branch_id: branchId,
        brand_product_id: template.id,
        name: template.name ?? '이름 없는 상품',
        description: template.description ?? null,
        base_price: this.getPriceFromRow(template),
        image_url: this.getPrimaryImageUrl(template.image_url),
        sort_order:
          template.sort_order !== undefined && template.sort_order !== null
            ? template.sort_order
            : 0,
        urgent_discount_price: template.urgent_discount_price ?? null,
        urgent_discount_start_at: template.urgent_discount_start_at ?? null,
        urgent_discount_end_at: template.urgent_discount_end_at ?? null,
      }));

    if (rowsToInsert.length === 0) return;

    const { error: insertError } = await adminSb
      .from('products')
      .insert(rowsToInsert);

    if (insertError && insertError.code !== '23505') {
      throw new BadRequestException(
        `온라인샵 상품 자동 연결 실패: ${insertError.message}`,
      );
    }
  }

  async getShopBrandBySlug(
    brandSlug: string,
  ): Promise<PublicShopBrandResponse> {
    const adminSb = this.supabase.adminClient();
    const context = await this.resolveShopBrandContext(brandSlug);

    const fetchTemplates = async (withOnlineShopFilter: boolean) => {
      let query = adminSb
        .from('brand_products')
        .select('*')
        .eq('brand_id', context.brandId)
        .eq('is_active', true);

      if (withOnlineShopFilter) {
        query = query.eq('is_online_shop_visible', true);
      }

      return query
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(2000);
    };

    let { data: templates, error: templatesError } = await fetchTemplates(true);
    if (
      templatesError &&
      this.isMissingColumnError(templatesError) &&
      this.getMissingColumnName(templatesError) === 'is_online_shop_visible'
    ) {
      ({ data: templates, error: templatesError } =
        await fetchTemplates(false));
    }

    if (templatesError) {
      throw new BadRequestException(
        `온라인샵 상품 조회 실패: ${templatesError.message}`,
      );
    }

    const templateIds = (templates ?? [])
      .map((row: any) => String(row?.id ?? ''))
      .filter(Boolean);

    let chosenBranchId = context.branchId;
    let chosenPaymentMethods = context.paymentMethods;
    let linkedProductMap = new Map<string, any>();

    if (templateIds.length > 0) {
      let best:
        | {
            branchId: string;
            paymentMethods: string[];
            supportsDelivery: boolean;
            hasDeliveryChannel: boolean;
            createdAt: string | null;
            map: Map<string, any>;
            count: number;
          }
        | undefined;

      for (const candidate of context.branchCandidates) {
        const map = await this.fetchVisibleTemplateProductsByBranch(
          adminSb,
          candidate.branchId,
          templateIds,
        );
        const count = map.size;

        if (!best) {
          best = { ...candidate, map, count };
          continue;
        }

        if (count > best.count) {
          best = { ...candidate, map, count };
          continue;
        }

        if (
          count === best.count &&
          this.compareShopBranchPriority(candidate, best) < 0
        ) {
          best = { ...candidate, map, count };
        }
      }

      if (best) {
        chosenBranchId = best.branchId;
        chosenPaymentMethods = best.paymentMethods;
        linkedProductMap = best.map;
      }

      if (!best || best.count < templateIds.length) {
        const onlineShopCandidate = await this.ensureOnlineShopCandidate(
          adminSb,
          context,
        );
        const map = await this.fetchVisibleTemplateProductsByBranch(
          adminSb,
          onlineShopCandidate.branchId,
          templateIds,
        );

        if (
          !best ||
          map.size > best.count ||
          (map.size === best.count &&
            this.compareShopBranchPriority(onlineShopCandidate, best) < 0)
        ) {
          chosenBranchId = onlineShopCandidate.branchId;
          chosenPaymentMethods = onlineShopCandidate.paymentMethods;
          linkedProductMap = map;
        }
      }
    }

    const exposedPaymentMethods = chosenPaymentMethods.filter((method) =>
      context.shopPaymentMethods.includes(method),
    );
    if (exposedPaymentMethods.length === 0) {
      throw new BadRequestException('온라인샵 결제수단 설정을 확인해주세요.');
    }

    const categoryIds = [
      ...new Set(
        Array.from(linkedProductMap.values())
          .map((row: any) => row?.category_id)
          .filter(Boolean),
      ),
    ];

    const categoryMap = new Map<string, string>();
    if (categoryIds.length > 0) {
      const { data: categories } = await adminSb
        .from('product_categories')
        .select('id, name')
        .eq('branch_id', chosenBranchId)
        .in('id', categoryIds)
        .limit(2000);

      for (const category of categories ?? []) {
        categoryMap.set(category.id, category.name);
      }
    }

    const products = (templates ?? [])
      .map((template: any) => {
        const linked = linkedProductMap.get(template.id);
        if (!linked) return null;

        const linkedPrice = this.getPriceSummaryFromRow(linked);
        const templatePrice = this.getPriceSummaryFromRow(template);
        const templateImageUrls = this.getImageUrls(template.image_url);
        const linkedImageUrls = this.getImageUrls(linked.image_url);
        const imageUrls =
          linkedImageUrls.length > 0 ? linkedImageUrls : templateImageUrls;
        const finalPrice =
          linkedPrice.price > 0 ? linkedPrice.price : templatePrice.price;
        const finalDiscountPrice =
          linkedPrice.discountPrice ??
          (linkedPrice.price > 0 ? undefined : templatePrice.discountPrice);
        const finalUrgentDiscountEndAt =
          linkedPrice.urgentDiscountEndAt ??
          (linkedPrice.price > 0
            ? undefined
            : templatePrice.urgentDiscountEndAt);

        return {
          id: template.id,
          name: template.name ?? linked.name,
          description: template.description ?? linked.description ?? null,
          price: finalPrice,
          discountPrice: finalDiscountPrice,
          urgentDiscountEndAt: finalUrgentDiscountEndAt ?? null,
          imageUrl:
            linkedImageUrls[0] ?? this.getPrimaryImageUrl(template.image_url),
          imageUrls,
          categoryId: linked.category_id ?? null,
          categoryName: categoryMap.get(linked.category_id) ?? null,
          sortOrder: template.sort_order ?? linked.sort_order ?? 0,
        };
      })
      .filter(Boolean);
    const chosenBranchConfig =
      await this.getPublicBranchOrderConfig(chosenBranchId);

    return {
      brandId: context.brandId,
      brandSlug: context.brandSlug,
      brandName: context.brandName,
      logoUrl: context.logoUrl,
      coverImageUrl: context.coverImageUrl,
      fulfillmentType: FulfillmentType.DELIVERY,
      paymentMethods: exposedPaymentMethods,
      transferAccount: chosenBranchConfig.transferAccount,
      products: products as any[],
    };
  }

  async createShopOrderByBrandSlug(
    brandSlug: string,
    dto: CreatePublicShopOrderRequest,
  ): Promise<PublicOrderResponse> {
    const adminSb = this.supabase.adminClient();
    const context = await this.resolveShopBrandContext(brandSlug);

    if (!this.normalizeOptional(dto.customerName)) {
      throw new BadRequestException('주문자 이름을 입력해주세요.');
    }
    if (!this.normalizeOptional(dto.customerPhone)) {
      throw new BadRequestException('연락처를 입력해주세요.');
    }
    if (!this.normalizeOptional(dto.customerAddress1)) {
      throw new BadRequestException('배송 주소를 입력해주세요.');
    }

    const templateIds = [
      ...new Set(dto.items.map((item) => item.productId).filter(Boolean)),
    ];
    if (templateIds.length === 0) {
      throw new BadRequestException('주문할 상품을 선택해주세요.');
    }

    const fetchVisibleTemplates = async (withOnlineShopFilter: boolean) => {
      let query = adminSb
        .from('brand_products')
        .select('id')
        .eq('brand_id', context.brandId)
        .eq('is_active', true)
        .in('id', templateIds);
      if (withOnlineShopFilter) {
        query = query.eq('is_online_shop_visible', true);
      }
      return query.limit(2000);
    };

    let { data: visibleTemplates, error: visibleTemplatesError } =
      await fetchVisibleTemplates(true);
    if (
      visibleTemplatesError &&
      this.isMissingColumnError(visibleTemplatesError) &&
      this.getMissingColumnName(visibleTemplatesError) ===
        'is_online_shop_visible'
    ) {
      ({ data: visibleTemplates, error: visibleTemplatesError } =
        await fetchVisibleTemplates(false));
    }

    if (visibleTemplatesError) {
      throw new BadRequestException(
        `온라인샵 상품 확인 실패: ${visibleTemplatesError.message}`,
      );
    }

    const visibleTemplateIdSet = new Set(
      (visibleTemplates ?? [])
        .map((row: any) => String(row.id ?? ''))
        .filter(Boolean),
    );
    const hiddenOrMissingTemplateIds = templateIds.filter(
      (templateId) => !visibleTemplateIdSet.has(templateId),
    );
    if (hiddenOrMissingTemplateIds.length > 0) {
      throw new BadRequestException(
        `온라인샵에 노출되지 않은 상품입니다: ${hiddenOrMissingTemplateIds.join(', ')}`,
      );
    }

    const paymentMethod = (dto.paymentMethod ?? PaymentMethod.CARD)
      .toUpperCase()
      .trim() as PaymentMethod;
    if (!context.shopPaymentMethods.includes(paymentMethod)) {
      throw new BadRequestException(
        '선택한 결제수단은 현재 온라인샵에서 사용할 수 없습니다.',
      );
    }
    let branchSelection;
    try {
      branchSelection = await this.resolveShopBranchForOrder(
        adminSb,
        context.branchCandidates,
        templateIds,
        paymentMethod,
      );
    } catch (error) {
      if (
        !(error instanceof BadRequestException) ||
        !String(error.message).includes(
          '온라인샵에 노출된 상품의 매장 연결 상태를 확인해주세요.',
        )
      ) {
        throw error;
      }

      const onlineShopCandidate = await this.ensureOnlineShopCandidate(
        adminSb,
        context,
      );
      branchSelection = await this.resolveShopBranchForOrder(
        adminSb,
        [onlineShopCandidate, ...context.branchCandidates],
        templateIds,
        paymentMethod,
      );
    }

    const mappedItems = dto.items.map((item) => {
      const branchProductId = branchSelection.branchProductMap.get(
        item.productId,
      );
      if (!branchProductId) {
        throw new BadRequestException(
          `주문 가능한 상품이 아닙니다: ${item.productId}`,
        );
      }
      return {
        productId: branchProductId,
        qty: item.qty,
      };
    });

    const orderDto: CreatePublicOrderRequest = {
      branchId: branchSelection.branchId,
      idempotencyKey: dto.idempotencyKey,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      customerAddress1: dto.customerAddress1,
      customerAddress2: dto.customerAddress2,
      customerMemo: dto.customerMemo,
      paymentMethod,
      fulfillmentType: FulfillmentType.DELIVERY,
      items: mappedItems,
    };

    return this.createOrder({
      ...(orderDto as any),
      __allowDeliveryOverride: !branchSelection.supportsDelivery,
    });
  }

  private getPriceFromRow(row: any): number {
    const summary = this.getPriceSummaryFromRow(row);
    return summary.discountPrice ?? summary.price;
  }

  private getPriceSummaryFromRow(row: any): {
    price: number;
    discountPrice?: number;
    urgentDiscountEndAt?: string | null;
  } {
    if (!row) return { price: 0 };

    let basePrice = 0;
    if (row.base_price !== undefined && row.base_price !== null) {
      basePrice = Number(row.base_price);
    } else if (row.price !== undefined && row.price !== null) {
      basePrice = Number(row.price);
    } else if (row.price_amount !== undefined && row.price_amount !== null) {
      basePrice = Number(row.price_amount);
    }
    if (!Number.isFinite(basePrice) || basePrice < 0) {
      basePrice = 0;
    }

    const rawDiscountValue = row?.urgent_discount_price;
    if (
      rawDiscountValue === null ||
      rawDiscountValue === undefined ||
      rawDiscountValue === ''
    ) {
      return { price: basePrice };
    }

    const rawDiscount = Number(rawDiscountValue);
    if (
      !Number.isFinite(rawDiscount) ||
      rawDiscount < 0 ||
      rawDiscount >= basePrice
    ) {
      return { price: basePrice };
    }

    const now = Date.now();
    const startRaw = row.urgent_discount_start_at;
    const endRaw = row.urgent_discount_end_at;
    const startTs =
      typeof startRaw === 'string' && startRaw.trim()
        ? Date.parse(startRaw)
        : null;
    const endTs =
      typeof endRaw === 'string' && endRaw.trim() ? Date.parse(endRaw) : null;

    if (startTs && !Number.isNaN(startTs) && now < startTs) {
      return { price: basePrice };
    }
    if (endTs && !Number.isNaN(endTs) && now > endTs) {
      return { price: basePrice };
    }

    return {
      price: basePrice,
      discountPrice: rawDiscount,
      urgentDiscountEndAt:
        typeof endRaw === 'string' && endRaw.trim() ? endRaw : null,
    };
  }

  private compareShopBranchPriority(
    a: {
      branchId: string;
      supportsDelivery: boolean;
      hasDeliveryChannel: boolean;
      createdAt: string | null;
    },
    b: {
      branchId: string;
      supportsDelivery: boolean;
      hasDeliveryChannel: boolean;
      createdAt: string | null;
    },
  ): number {
    if (a.hasDeliveryChannel !== b.hasDeliveryChannel) {
      return a.hasDeliveryChannel ? -1 : 1;
    }
    if (a.supportsDelivery !== b.supportsDelivery) {
      return a.supportsDelivery ? -1 : 1;
    }

    const aCreatedAt = a.createdAt ?? '';
    const bCreatedAt = b.createdAt ?? '';
    if (aCreatedAt !== bCreatedAt) {
      return aCreatedAt.localeCompare(bCreatedAt);
    }

    return a.branchId.localeCompare(b.branchId);
  }

  private async fetchVisibleTemplateProductsByBranch(
    adminSb: any,
    branchId: string,
    templateIds: string[],
  ): Promise<Map<string, any>> {
    if (templateIds.length === 0) {
      return new Map<string, any>();
    }

    const { data: linkedProducts, error: linkedError } = await adminSb
      .from('products')
      .select(
        'id, brand_product_id, name, description, base_price, image_url, category_id, sort_order, is_hidden, is_sold_out',
      )
      .eq('branch_id', branchId)
      .in('brand_product_id', templateIds)
      .limit(2000);

    if (linkedError) {
      throw new BadRequestException(
        `온라인샵 상품 매핑 조회 실패: ${linkedError.message}`,
      );
    }

    const map = new Map<string, any>();
    for (const row of linkedProducts ?? []) {
      const templateId = row?.brand_product_id;
      if (!templateId) continue;
      if (row?.is_hidden === true || row?.is_sold_out === true) continue;
      if (!map.has(templateId)) {
        map.set(templateId, row);
      }
    }

    return map;
  }

  private async resolveShopBranchForOrder(
    adminSb: any,
    candidates: Array<{
      branchId: string;
      paymentMethods: string[];
      supportsDelivery: boolean;
      hasDeliveryChannel: boolean;
      createdAt: string | null;
    }>,
    templateIds: string[],
    paymentMethod: string,
  ): Promise<{
    branchId: string;
    supportsDelivery: boolean;
    branchProductMap: Map<string, string>;
  }> {
    const fulfillable: Array<{
      branchId: string;
      paymentMethods: string[];
      supportsDelivery: boolean;
      hasDeliveryChannel: boolean;
      createdAt: string | null;
      productMap: Map<string, any>;
    }> = [];

    for (const candidate of candidates) {
      const productMap = await this.fetchVisibleTemplateProductsByBranch(
        adminSb,
        candidate.branchId,
        templateIds,
      );
      if (productMap.size !== templateIds.length) {
        continue;
      }
      fulfillable.push({
        ...candidate,
        productMap,
      });
    }

    if (fulfillable.length === 0) {
      throw new BadRequestException(
        '온라인샵에 노출된 상품의 매장 연결 상태를 확인해주세요.',
      );
    }

    const withPayment = fulfillable.filter((candidate) =>
      candidate.paymentMethods.includes(paymentMethod),
    );

    if (withPayment.length === 0) {
      throw new BadRequestException(
        '선택한 결제수단은 현재 온라인샵 주문에서 지원하지 않습니다.',
      );
    }

    withPayment.sort((a, b) => this.compareShopBranchPriority(a, b));
    const chosen = withPayment[0];

    const branchProductMap = new Map<string, string>();
    for (const templateId of templateIds) {
      const row = chosen.productMap.get(templateId);
      if (!row?.id) {
        throw new BadRequestException(
          `주문 가능한 상품이 아닙니다: ${templateId}`,
        );
      }
      branchProductMap.set(templateId, row.id);
    }

    return {
      branchId: chosen.branchId,
      supportsDelivery: chosen.supportsDelivery,
      branchProductMap,
    };
  }

  private async getPublicBranchOrderConfig(branchId: string) {
    const adminSb = this.supabase.adminClient();
    const config = await getBranchOrderConfig(adminSb, branchId);

    return {
      enabledFulfillmentTypes: normalizeFulfillmentTypes(
        config.enabledFulfillmentTypes,
      ),
      allowedPaymentMethods: normalizePaymentMethods(
        config.allowedPaymentMethods,
      ),
      orderNotice: config.orderNotice ?? null,
      transferAccount: config.transferAccount ?? null,
      pickupTimeConfig: config.pickupTimeConfig ?? null,
      businessHours: config.businessHours ?? null,
      channelByType: config.channelByType,
    };
  }

  private async getPublicBranchContactInfo(branchId: string) {
    const adminSb = this.supabase.adminClient();

    try {
      const { data, error } = await adminSb
        .from('branches')
        .select('contact_phone, kakao_channel_url')
        .eq('id', branchId)
        .maybeSingle();

      if (error || !data) {
        return {
          contactPhone: null,
          kakaoChannelUrl: null,
        };
      }

      return {
        contactPhone:
          typeof data.contact_phone === 'string' ? data.contact_phone : null,
        kakaoChannelUrl:
          typeof data.kakao_channel_url === 'string'
            ? data.kakao_channel_url
            : null,
      };
    } catch {
      return {
        contactPhone: null,
        kakaoChannelUrl: null,
      };
    }
  }

  private async rollbackOrder(adminClient: any, orderId: string) {
    try {
      await adminClient.from('order_items').delete().eq('order_id', orderId);
    } catch (error) {
      this.logger.error(`Failed to rollback order items for ${orderId}`, error);
    }

    try {
      await adminClient.from('orders').delete().eq('id', orderId);
    } catch (error) {
      this.logger.error(`Failed to rollback order ${orderId}`, error);
    }
  }

  private isMissingColumnError(error: any): boolean {
    const message = String(error?.message ?? '');
    return (
      error?.code === '42703' ||
      /^PGRST/i.test(String(error?.code ?? '')) ||
      /column .* does not exist/i.test(message) ||
      /schema cache/i.test(message)
    );
  }

  private getMissingColumnName(error: any): string | null {
    const message = String(error?.message ?? '');
    const pgMatch = message.match(
      /column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i,
    );
    if (pgMatch?.[1]) {
      return pgMatch[1];
    }

    const pgrstMatch = message.match(
      /could not find the\s+'?([a-zA-Z0-9_]+)'?\s+column\s+of/i,
    );
    return pgrstMatch?.[1] ?? null;
  }

  private isRowLevelSecurityError(error: any): boolean {
    const message = String(error?.message ?? '');
    return (
      error?.code === '42501' || /row-level security policy/i.test(message)
    );
  }

  private isInvalidChannelIdError(error: any): boolean {
    const message = String(error?.message ?? '');
    return error?.code === 'P0001' && /invalid channel_id/i.test(message);
  }

  private isInvalidFulfillmentTypeEnumError(error: any): boolean {
    const message = String(error?.message ?? '');
    return (
      (error?.code === '22P02' ||
        /invalid input value for enum/i.test(message)) &&
      /fulfillment_type/i.test(message)
    );
  }

  private isInventoryInfraUnavailableError(error: any): boolean {
    const code = String(error?.code ?? '');
    const message = String(error?.message ?? '');
    return (
      code === '42P01' ||
      code === '42883' ||
      /relation\s+"?(product_inventory|inventory_logs)"?\s+does not exist/i.test(
        message,
      ) ||
      /function\s+.*reserve_inventory_for_order.*does not exist/i.test(
        message,
      ) ||
      /could not find the function.*reserve_inventory_for_order/i.test(message)
    );
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  /**
   * Get branch info (public)
   */
  async getBranch(branchId: string): Promise<PublicBranchResponse> {
    const sb = this.supabase.anonClient();

    const { data, error } = await sb
      .from('branches')
      .select(
        `
        id,
        name,
        contact_phone,
        kakao_channel_url,
        logo_url,
        cover_image_url,
        brands (
          name,
          logo_url,
          cover_image_url
        )
      `,
      )
      .eq('id', branchId)
      .single();

    if (error || !data) {
      throw new NotFoundException('사용할 수 없는 가게입니다.');
    }

    const row = data as any;
    const orderConfig = await this.getPublicBranchOrderConfig(row.id);
    return {
      id: row.id,
      name: row.name,
      brandName: row.brands?.name ?? undefined,
      logoUrl: row.logo_url || row.brands?.logo_url || null,
      coverImageUrl: row.cover_image_url || row.brands?.cover_image_url || null,
      contactPhone: row.contact_phone ?? null,
      kakaoChannelUrl: row.kakao_channel_url ?? null,
      enabledFulfillmentTypes: orderConfig.enabledFulfillmentTypes,
      allowedPaymentMethods: orderConfig.allowedPaymentMethods,
      orderNotice: orderConfig.orderNotice,
      transferAccount: orderConfig.transferAccount,
      pickupTimeConfig: orderConfig.pickupTimeConfig,
      businessHours: orderConfig.businessHours,
    };
  }

  /**
   * Get branch info by slug (public)
   */
  async getBranchBySlug(slug: string): Promise<PublicBranchResponse> {
    const sb = this.supabase.anonClient();

    const { data, error } = await sb
      .from('branches')
      .select(
        `
        id,
        name,
        slug,
        contact_phone,
        kakao_channel_url,
        logo_url,
        cover_image_url,
        brands (
          name,
          logo_url,
          cover_image_url
        )
      `,
      )
      .eq('slug', slug)
      .limit(2);

    if (error) {
      throw new NotFoundException('사용할 수 없는 가게입니다.');
    }

    if (!data || data.length === 0) {
      throw new NotFoundException('사용할 수 없는 가게입니다.');
    }

    if (data.length > 1) {
      throw new ConflictException('가게 URL이 중복되어 사용할 수 없습니다.');
    }

    const row = data[0] as any;
    const orderConfig = await this.getPublicBranchOrderConfig(row.id);
    return {
      id: row.id,
      name: row.name,
      brandName: row.brands?.name ?? undefined,
      logoUrl: row.logo_url || row.brands?.logo_url || null,
      coverImageUrl: row.cover_image_url || row.brands?.cover_image_url || null,
      contactPhone: row.contact_phone ?? null,
      kakaoChannelUrl: row.kakao_channel_url ?? null,
      enabledFulfillmentTypes: orderConfig.enabledFulfillmentTypes,
      allowedPaymentMethods: orderConfig.allowedPaymentMethods,
      orderNotice: orderConfig.orderNotice,
      transferAccount: orderConfig.transferAccount,
      pickupTimeConfig: orderConfig.pickupTimeConfig,
      businessHours: orderConfig.businessHours,
    };
  }

  /**
   * Get branch info by brand slug + branch slug (public)
   */
  async getBranchByBrandSlug(
    brandSlug: string,
    branchSlug: string,
  ): Promise<PublicBranchResponse> {
    const sb = this.supabase.anonClient();

    const { data, error } = await sb
      .from('branches')
      .select(
        `
        id,
        name,
        slug,
        contact_phone,
        kakao_channel_url,
        logo_url,
        cover_image_url,
        brands!inner (
          id,
          name,
          slug,
          logo_url,
          cover_image_url
        )
      `,
      )
      .eq('slug', branchSlug)
      .eq('brands.slug', brandSlug)
      .limit(2);

    if (error) {
      throw new NotFoundException('사용할 수 없는 가게입니다.');
    }

    if (!data || data.length === 0) {
      throw new NotFoundException('사용할 수 없는 가게입니다.');
    }

    if (data.length > 1) {
      throw new ConflictException('가게 URL이 중복되어 사용할 수 없습니다.');
    }

    const row = data[0] as any;
    const orderConfig = await this.getPublicBranchOrderConfig(row.id);
    return {
      id: row.id,
      name: row.name,
      brandName: row.brands?.name ?? undefined,
      logoUrl: row.logo_url || row.brands?.logo_url || null,
      coverImageUrl: row.cover_image_url || row.brands?.cover_image_url || null,
      contactPhone: row.contact_phone ?? null,
      kakaoChannelUrl: row.kakao_channel_url ?? null,
      enabledFulfillmentTypes: orderConfig.enabledFulfillmentTypes,
      allowedPaymentMethods: orderConfig.allowedPaymentMethods,
      orderNotice: orderConfig.orderNotice,
      transferAccount: orderConfig.transferAccount,
      pickupTimeConfig: orderConfig.pickupTimeConfig,
      businessHours: orderConfig.businessHours,
    };
  }

  /**
   * Get branch list by brand slug (public)
   */
  async getBranchesByBrandSlug(
    brandSlug: string,
  ): Promise<PublicBrandBranchesResponse> {
    const sb = this.supabase.anonClient();

    const { data, error } = await sb
      .from('branches')
      .select(
        `
        id,
        name,
        slug,
        logo_url,
        cover_image_url,
        brands!inner (
          name,
          slug,
          logo_url,
          cover_image_url
        )
      `,
      )
      .eq('brands.slug', brandSlug)
      .order('created_at', { ascending: true });

    if (error) {
      throw new NotFoundException('사용할 수 없는 브랜드입니다.');
    }

    const rows = (data ?? []) as any[];
    const brand = rows[0]?.brands;

    return {
      brandSlug: brand?.slug ?? brandSlug,
      brandName: brand?.name ?? undefined,
      logoUrl: brand?.logo_url ?? null,
      coverImageUrl: brand?.cover_image_url ?? null,
      branches: rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug ?? null,
        logoUrl: row.logo_url || brand?.logo_url || null,
        coverImageUrl: row.cover_image_url || brand?.cover_image_url || null,
      })),
    };
  }
  /**
   * Get product list (public, active only)
   */
  async getProducts(branchId: string): Promise<PublicProductResponse[]> {
    const sb = this.supabase.anonClient();

    const selectFields = '*';

    const buildBaseQuery = (
      includeIsHidden: boolean,
      includeIsSoldOut: boolean,
    ) => {
      let query = (sb as any)
        .from('products')
        .select(selectFields)
        .eq('branch_id', branchId);

      if (includeIsHidden) {
        query = query.eq('is_hidden', false);
      }

      if (includeIsSoldOut) {
        query = query.eq('is_sold_out', false);
      }

      return query;
    };

    let data: any;
    let error: any;
    let includeIsHidden = true;
    let includeIsSoldOut = true;
    let includeSortOrder = true;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const query = buildBaseQuery(includeIsHidden, includeIsSoldOut);
      const orderedQuery = includeSortOrder
        ? query
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true })
        : query.order('created_at', { ascending: true });
      ({ data, error } = await orderedQuery);

      if (!error) break;

      const message = error.message ?? '';
      let retried = false;

      if (message.includes('is_hidden')) {
        includeIsHidden = false;
        retried = true;
      }

      if (message.includes('is_sold_out')) {
        includeIsSoldOut = false;
        retried = true;
      }

      if (message.includes('sort_order')) {
        includeSortOrder = false;
        retried = true;
      }

      if (!retried) break;
    }

    if (error) {
      throw new Error(`상품 목록 조회 실패: ${error.message}`);
    }

    const products = data ?? [];

    const templateIds = [
      ...new Set(
        products
          .map((product: any) => product?.brand_product_id)
          .filter(
            (id: unknown): id is string =>
              typeof id === 'string' && id.trim().length > 0,
          ),
      ),
    ];
    const templateImageMap = new Map<string, string[]>();
    if (templateIds.length > 0) {
      const adminSb = this.supabase.adminClient();
      const { data: templates } = await adminSb
        .from('brand_products')
        .select('id, image_url')
        .in('id', templateIds);

      for (const template of templates ?? []) {
        const imageUrls = this.getImageUrls((template as any).image_url);
        templateImageMap.set((template as any).id, imageUrls);
      }
    }

    // Fetch category names for mapping
    const categoryIds = [
      ...new Set(products.map((p: any) => p.category_id).filter(Boolean)),
    ];
    let categoryMap = new Map<string, string>();
    if (categoryIds.length > 0) {
      const { data: categories } = await sb
        .from('product_categories')
        .select('id, name')
        .in('id', categoryIds);
      if (categories) {
        categoryMap = new Map(categories.map((c: any) => [c.id, c.name]));
      }
    }

    return products.map((product: any) => {
      const productImageUrls = this.getImageUrls(product.image_url);
      const templateImageUrls =
        templateImageMap.get(product.brand_product_id) ?? [];
      const imageUrls =
        productImageUrls.length > 1
          ? productImageUrls
          : templateImageUrls.length > 0
            ? templateImageUrls
            : productImageUrls;
      const priceSummary = this.getPriceSummaryFromRow(product);
      const imageUrl = imageUrls[0] ?? null;
      return {
        id: product.id,
        name: product.name,
        description: product.description ?? null,
        price: priceSummary.price,
        discountPrice: priceSummary.discountPrice,
        urgentDiscountEndAt: priceSummary.urgentDiscountEndAt ?? null,
        imageUrl,
        imageUrls,
        categoryId: product.category_id ?? null,
        categoryName: categoryMap.get(product.category_id) ?? null,
        sortOrder: product.sort_order ?? 0,
        options: [],
      };
    });
  }

  private buildOrderSignature(
    items: { productId: string; qty: number }[],
  ): string {
    const normalized = items
      .map((item) => ({ productId: item.productId, qty: item.qty }))
      .sort((a, b) => a.productId.localeCompare(b.productId));
    const payload = normalized
      .map((item) => `${item.productId}:${item.qty}`)
      .join('|');
    return createHash('sha256').update(payload).digest('hex');
  }

  private normalizeOptional(value?: string | null): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private getDuplicatePolicy(dto: CreatePublicOrderRequest) {
    const customerName = this.normalizeOptional(dto.customerName);
    const customerPhone = this.normalizeOptional(dto.customerPhone);
    const customerAddress1 = this.normalizeOptional(dto.customerAddress1);
    const paymentMethod = dto.paymentMethod ?? 'CARD';

    const strongLimit = this.duplicateLookbackLimit;
    const weakLimit = Math.min(this.duplicateLookbackLimit, 3);

    let strategy = 'ANON';
    let windowMs = this.weakDuplicateWindowMs;
    let lookbackLimit = weakLimit;

    const filters: { name?: string; phone?: string; address1?: string } = {};

    if (customerName && customerPhone) {
      strategy = 'NAME_PHONE';
      windowMs = this.duplicateWindowMs;
      lookbackLimit = strongLimit;
      filters.name = customerName;
      filters.phone = customerPhone;
    } else if (customerPhone && customerAddress1) {
      strategy = 'PHONE_ADDRESS';
      windowMs = this.duplicateWindowMs;
      lookbackLimit = strongLimit;
      filters.phone = customerPhone;
      filters.address1 = customerAddress1;
    } else if (customerPhone) {
      strategy = 'PHONE_ONLY';
      windowMs = this.duplicateWindowMs;
      lookbackLimit = strongLimit;
      filters.phone = customerPhone;
    } else if (customerName && customerAddress1) {
      strategy = 'NAME_ADDRESS';
      windowMs = this.duplicateWindowMs;
      lookbackLimit = strongLimit;
      filters.name = customerName;
      filters.address1 = customerAddress1;
    } else if (customerName) {
      strategy = 'NAME_ONLY';
      windowMs = this.weakDuplicateWindowMs;
      lookbackLimit = weakLimit;
      filters.name = customerName;
    } else if (customerAddress1) {
      strategy = 'ADDRESS_ONLY';
      windowMs = this.weakDuplicateWindowMs;
      lookbackLimit = weakLimit;
      filters.address1 = customerAddress1;
    }

    let dedupKey: string | null = null;
    if (strategy === 'NAME_PHONE') {
      dedupKey = `name_phone:${customerName}:${customerPhone}`;
    } else if (strategy === 'PHONE_ADDRESS') {
      dedupKey = `phone_address:${customerPhone}:${customerAddress1}`;
    } else if (strategy === 'PHONE_ONLY') {
      dedupKey = `phone_only:${customerPhone}`;
    } else if (strategy === 'NAME_ADDRESS') {
      dedupKey = `name_address:${customerName}:${customerAddress1}`;
    } else if (strategy === 'NAME_ONLY') {
      dedupKey = `name_only:${customerName}`;
    } else if (strategy === 'ADDRESS_ONLY') {
      dedupKey = `address_only:${customerAddress1}`;
    } else {
      dedupKey = `anon:${paymentMethod}`;
    }

    return {
      strategy,
      windowMs,
      lookbackLimit,
      filters,
      paymentMethod,
      customerName,
      customerPhone,
      customerAddress1,
      dedupKey,
    };
  }

  private buildSignatureFromOrder(order: any): string {
    const items = (order?.order_items ?? []).map((item: any) => ({
      productId: item.product_id,
      qty: item.qty,
    }));
    return this.buildOrderSignature(items);
  }

  private getOrderItemUnitPrice(item: any): number {
    if (!item) return 0;
    if (item.unit_price !== undefined && item.unit_price !== null) {
      return item.unit_price;
    }
    if (
      item.unit_price_snapshot !== undefined &&
      item.unit_price_snapshot !== null
    ) {
      return item.unit_price_snapshot;
    }
    return 0;
  }

  private async runOrderSelectWithUnitPriceFallback(
    queryFactory: (
      unitPriceColumn: 'unit_price' | 'unit_price_snapshot',
    ) => any,
  ): Promise<{ data: any; error: any }> {
    const primary = await queryFactory('unit_price');
    if (!primary.error) {
      return primary;
    }

    if (
      this.isMissingColumnError(primary.error) &&
      this.getMissingColumnName(primary.error) === 'unit_price'
    ) {
      return queryFactory('unit_price_snapshot');
    }

    return primary;
  }

  private buildOrderResponse(order: any): PublicOrderResponse {
    const items = (order?.order_items ?? []).map((item: any) => ({
      productName: item.product_name_snapshot,
      qty: item.qty,
      unitPrice: this.getOrderItemUnitPrice(item),
      options: (item.order_item_options ?? []).map(
        (opt: any) => opt.option_name_snapshot,
      ),
    }));

    return {
      id: order.id,
      orderNo: order.order_no ?? order.id,
      status: order.status,
      totalAmount: order.total_amount,
      createdAt: order.created_at,
      requestedTime: null,
      paymentMethod: order.payment_method ?? null,
      fulfillmentType: order.fulfillment_type ?? null,
      transferAccount: order.transfer_account ?? null,
      customer: {
        name: order.customer_name ?? null,
        phone: order.customer_phone ?? null,
        address1: order.customer_address1 ?? null,
        address2: order.customer_address2 ?? null,
        memo: order.customer_memo ?? null,
      },
      branchContactPhone: null,
      branchKakaoChannelUrl: null,
      items,
    };
  }

  private async attachPublicOrderSupportInfo(
    order: PublicOrderResponse,
    branchId?: string | null,
  ): Promise<PublicOrderResponse> {
    if (!branchId) return order;

    const nextOrder = { ...order };

    try {
      if (!nextOrder.transferAccount) {
        const branchConfig = await this.getPublicBranchOrderConfig(branchId);
        nextOrder.transferAccount = branchConfig.transferAccount ?? null;
      }
    } catch {
      // Ignore branch config lookup failures on public tracking page.
    }

    const supportInfo = await this.getPublicBranchContactInfo(branchId);
    nextOrder.branchContactPhone = supportInfo.contactPhone;
    nextOrder.branchKakaoChannelUrl = supportInfo.kakaoChannelUrl;

    return nextOrder;
  }

  private async fetchOrderByIdempotencyKey(
    adminClient: any,
    branchId: string,
    idempotencyKey?: string,
    userId?: string,
  ): Promise<any> {
    if (!idempotencyKey) return null;

    const { data, error } = await this.runOrderSelectWithUnitPriceFallback(
      (unitPriceColumn) =>
        adminClient
          .from('orders')
          .select(
            `
        id,
        user_id,
        branch_id,
        order_no,
        status,
        total_amount,
        created_at,
        order_items (
          product_id,
          product_name_snapshot,
          qty,
          ${unitPriceColumn},
          order_item_options (
            option_name_snapshot
          )
        )
      `,
          )
          .eq('branch_id', branchId)
          .eq('idempotency_key', idempotencyKey)
          .order('created_at', { ascending: false })
          .limit(1),
    );

    if (error || !data || data.length === 0) {
      return null;
    }

    const matched = data.find(
      (row: any) => !userId || !row.user_id || row.user_id === userId,
    );
    return matched ?? null;
  }

  private async logDedupEvent(
    adminClient: any,
    payload: {
      branchId: string;
      orderId?: string | null;
      matchedOrderId?: string | null;
      idempotencyKey?: string | null;
      signature?: string | null;
      totalAmount?: number | null;
      customerName?: string | null;
      customerPhone?: string | null;
      customerAddress1?: string | null;
      paymentMethod?: string | null;
      strategy: string;
      reason: string;
      metadata?: Record<string, any>;
    },
  ) {
    try {
      await adminClient.from('order_dedup_logs').insert({
        branch_id: payload.branchId,
        order_id: payload.orderId ?? null,
        matched_order_id: payload.matchedOrderId ?? null,
        idempotency_key: payload.idempotencyKey ?? null,
        signature: payload.signature ?? null,
        total_amount: payload.totalAmount ?? null,
        customer_name: payload.customerName ?? null,
        customer_phone: payload.customerPhone ?? null,
        customer_address1: payload.customerAddress1 ?? null,
        payment_method: payload.paymentMethod ?? null,
        strategy: payload.strategy,
        reason: payload.reason,
        metadata: payload.metadata ?? {},
      });
    } catch (error) {
      this.logger.warn('Failed to log order dedup event', error);
    }
  }

  private logMetric(event: string, payload: Record<string, any>) {
    this.logger.log(`[METRIC] ${event} ${JSON.stringify(payload)}`);
  }

  private async getBranchNameForNotification(
    adminClient: any,
    branchId: string,
  ): Promise<string> {
    try {
      const { data, error } = await adminClient
        .from('branches')
        .select('name')
        .eq('id', branchId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data?.name ?? '매장';
    } catch (error) {
      this.logger.warn(
        `Failed to resolve branch name for notification: ${branchId}`,
        error,
      );
      return '매장';
    }
  }

  private sendOrderCompletionNotification(
    order: {
      id: string;
      order_no?: string | null;
      total_amount: number;
    },
    params: {
      customerPhone?: string | null;
      customerName?: string | null;
      customerAddress1?: string | null;
      customerAddress2?: string | null;
      paymentMethod?: string | null;
      transferAccount?: {
        bankName?: string | null;
        accountNumber?: string | null;
        accountHolder?: string | null;
      } | null;
      fulfillmentType: FulfillmentType;
      items: Array<{
        productName: string;
        qty: number;
      }>;
      branchName: string;
    },
  ) {
    if (!params.customerPhone) {
      return;
    }

    const deliveryAddress = [params.customerAddress1, params.customerAddress2]
      .filter(Boolean)
      .join(' ')
      .trim();

    this.notificationsService
      .sendOrderCompletionKakao(
        order.id,
        {
          orderNo: order.order_no ?? order.id,
          customerName: params.customerName ?? '고객',
          items: params.items.map((item) => ({
            name: item.productName,
            qty: item.qty,
          })),
          totalAmount: order.total_amount,
          paymentMethod: params.paymentMethod ?? null,
          transferAccount: params.transferAccount ?? null,
          fulfillmentType: params.fulfillmentType,
          deliveryAddress: deliveryAddress || null,
          branchName: params.branchName,
        },
        params.customerPhone,
      )
      .catch((error) =>
        this.logger.warn(
          `Failed to send order completion KakaoTalk for order ${order.id}: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
  }

  private async findRecentDuplicateOrder(
    adminClient: any,
    dto: CreatePublicOrderRequest,
    totalAmount: number,
    signature: string,
    userId?: string,
  ): Promise<{
    order: PublicOrderResponse;
    strategy: string;
    metadata: Record<string, any>;
  } | null> {
    const policy = this.getDuplicatePolicy(dto);
    const cutoff = new Date(Date.now() - policy.windowMs).toISOString();

    const { data, error } = await this.runOrderSelectWithUnitPriceFallback(
      (unitPriceColumn) => {
        let query = adminClient
          .from('orders')
          .select(
            `
        id,
        user_id,
        branch_id,
        order_no,
        status,
        total_amount,
        created_at,
        order_items (
          product_id,
          product_name_snapshot,
          qty,
          ${unitPriceColumn},
          order_item_options (
            option_name_snapshot
          )
        )
      `,
          )
          .eq('branch_id', dto.branchId)
          .eq('status', 'CREATED')
          .eq('payment_status', 'PENDING')
          .eq('total_amount', totalAmount)
          .gte('created_at', cutoff)
          .order('created_at', { ascending: false });

        if (policy.filters.name) {
          query = query.eq('customer_name', policy.filters.name);
        }

        if (policy.filters.phone) {
          query = query.eq('customer_phone', policy.filters.phone);
        }

        if (policy.filters.address1) {
          query = query.eq('customer_address1', policy.filters.address1);
        }

        if (
          !policy.filters.name &&
          !policy.filters.phone &&
          !policy.filters.address1
        ) {
          query = query.eq('payment_method', policy.paymentMethod ?? 'CARD');
        }

        return query.limit(policy.lookbackLimit);
      },
    );

    if (error || !data || data.length === 0) {
      return null;
    }

    for (const order of data as any[]) {
      if (userId && order.user_id && order.user_id !== userId) {
        continue;
      }

      const candidateSignature = this.buildSignatureFromOrder(order);

      if (candidateSignature !== signature) {
        continue;
      }

      this.logger.warn(
        `Duplicate order detected for ${dto.branchId} within window: ${order.id}`,
      );
      const orderResponse = await this.attachPublicOrderSupportInfo(
        this.buildOrderResponse(order),
        order.branch_id ?? dto.branchId,
      );

      return {
        order: orderResponse,
        strategy: policy.strategy,
        metadata: {
          windowMs: policy.windowMs,
          lookbackLimit: policy.lookbackLimit,
          cutoff,
          dedupKey: policy.dedupKey,
          paymentMethod: policy.paymentMethod ?? null,
          filters: policy.filters,
        },
      };
    }

    return null;
  }

  /**
   * Create order (public)
   * Now includes inventory reservation and logging
   */
  async createOrder(
    dto: CreatePublicOrderRequest,
    userId?: string,
  ): Promise<PublicOrderResponse> {
    const sb = this.supabase.anonClient();
    const adminClient = this.supabase.adminClient();

    const productIds = dto.items.map((item) => item.productId);
    const selectProductFields = '*';

    const { data: products, error: productsError } = await (sb as any)
      .from('products')
      .select(selectProductFields)
      .in('id', productIds);

    if (productsError) {
      throw new BadRequestException(`상품 조회 실패: ${productsError.message}`);
    }

    const productMap = new Map<string, any>(
      products?.map((p: any) => [p.id, p]) ?? [],
    );

    for (const product of products ?? []) {
      if (product.branch_id !== dto.branchId) {
        throw new BadRequestException('다른 가게의 상품이 포함되어 있습니다.');
      }
      if (product.is_hidden === true || product.is_sold_out === true) {
        throw new BadRequestException('판매 중지된 상품이 포함되어 있습니다.');
      }
    }
    if (dto.items.some((item) => item.options && item.options.length > 0)) {
      throw new BadRequestException('옵션 기능이 비활성화되어 있습니다.');
    }

    let subtotalAmount = 0;
    const orderItemsData: {
      product_id: string;
      product_name_snapshot: string;
      qty: number;
      unit_price: number;
      options: {
        product_option_id: string;
        option_name_snapshot: string;
        price_delta_snapshot: number;
      }[];
    }[] = [];

    for (const item of dto.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new BadRequestException(
          `상품을 찾을 수 없습니다: ${item.productId}`,
        );
      }

      const itemPrice = this.getPriceFromRow(product);
      const optionSnapshots: {
        product_option_id: string;
        option_name_snapshot: string;
        price_delta_snapshot: number;
      }[] = [];

      subtotalAmount += itemPrice * item.qty;

      orderItemsData.push({
        product_id: product.id,
        product_name_snapshot: product.name,
        qty: item.qty,
        unit_price: itemPrice,
        options: optionSnapshots,
      });
    }

    const totalAmount = subtotalAmount;
    const signature = this.buildOrderSignature(
      dto.items.map((item) => ({
        productId: item.productId,
        qty: item.qty,
      })),
    );
    const idempotencyKey = dto.idempotencyKey?.trim() || undefined;
    const customerName = this.normalizeOptional(dto.customerName) ?? null;
    const customerPhone = this.normalizeOptional(dto.customerPhone) ?? null;
    const customerAddress1 =
      this.normalizeOptional(dto.customerAddress1) ?? null;
    const customerAddress2 =
      this.normalizeOptional(dto.customerAddress2) ?? null;
    const customerMemo = this.normalizeOptional(dto.customerMemo) ?? null;
    const paymentMethod = (dto.paymentMethod ?? 'CARD').toUpperCase();
    const branchOrderConfig = await this.getPublicBranchOrderConfig(
      dto.branchId,
    );
    const allowDeliveryOverride = (dto as any).__allowDeliveryOverride === true;
    const allowedPaymentMethods = normalizePaymentMethods(
      branchOrderConfig.allowedPaymentMethods,
    );
    if (!allowedPaymentMethods.includes(paymentMethod as any)) {
      throw new BadRequestException(
        '선택한 결제수단은 현재 매장에서 지원하지 않습니다.',
      );
    }

    const requestedFulfillmentType = (
      dto.fulfillmentType ?? FulfillmentType.PICKUP
    ).toUpperCase();
    const enabledFulfillmentTypes = normalizeFulfillmentTypes(
      branchOrderConfig.enabledFulfillmentTypes,
    );
    if (
      !enabledFulfillmentTypes.includes(requestedFulfillmentType as any) &&
      !(allowDeliveryOverride && requestedFulfillmentType === 'DELIVERY')
    ) {
      throw new BadRequestException(
        '선택한 주문 방식은 현재 매장에서 지원하지 않습니다.',
      );
    }

    const fulfillmentType = requestedFulfillmentType as FulfillmentType;
    if (
      (fulfillmentType === FulfillmentType.DELIVERY ||
        fulfillmentType === FulfillmentType.SHIPPING) &&
      !this.normalizeOptional(dto.customerAddress1)
    ) {
      throw new BadRequestException('배송 주문은 주소를 입력해야 합니다.');
    }
    // TODO: persist requestedTime after the orders schema adds requested_time.
    const requestedTime =
      fulfillmentType === FulfillmentType.PICKUP
        ? (this.normalizeOptional(dto.requestedTime) ?? null)
        : null;
    const fallbackChannelId = Object.values(branchOrderConfig.channelByType)[0];
    const channelId =
      branchOrderConfig.channelByType[fulfillmentType] ??
      (allowDeliveryOverride ? fallbackChannelId : undefined);

    this.logMetric('order.create.start', {
      branchId: dto.branchId,
      totalAmount,
      idempotencyKey,
      paymentMethod,
      fulfillmentType,
      channelId,
    });

    if (idempotencyKey) {
      const existingOrder = await this.fetchOrderByIdempotencyKey(
        adminClient,
        dto.branchId,
        idempotencyKey,
        userId,
      );

      if (existingOrder) {
        const existingSignature = this.buildSignatureFromOrder(existingOrder);

        if (existingOrder.total_amount !== totalAmount) {
          await this.logDedupEvent(adminClient, {
            branchId: dto.branchId,
            orderId: existingOrder.id,
            matchedOrderId: existingOrder.id,
            idempotencyKey,
            signature,
            totalAmount,
            customerName,
            customerPhone,
            customerAddress1,
            paymentMethod,
            strategy: 'IDEMPOTENCY_KEY',
            reason: 'AMOUNT_MISMATCH',
            metadata: {
              dedupKey: `idempotency:${idempotencyKey}`,
              windowMs: this.duplicateWindowMs,
              lookbackLimit: this.duplicateLookbackLimit,
            },
          });

          throw new ConflictException(
            '이미 처리된 주문과 금액이 일치하지 않습니다.',
          );
        }

        if (existingSignature !== signature) {
          await this.logDedupEvent(adminClient, {
            branchId: dto.branchId,
            orderId: existingOrder.id,
            matchedOrderId: existingOrder.id,
            idempotencyKey,
            signature,
            totalAmount,
            customerName,
            customerPhone,
            customerAddress1,
            paymentMethod,
            strategy: 'IDEMPOTENCY_KEY',
            reason: 'SIGNATURE_MISMATCH',
            metadata: {
              dedupKey: `idempotency:${idempotencyKey}`,
              windowMs: this.duplicateWindowMs,
              lookbackLimit: this.duplicateLookbackLimit,
            },
          });

          throw new ConflictException(
            '이미 처리된 주문과 내용이 일치하지 않습니다.',
          );
        }

        await this.logDedupEvent(adminClient, {
          branchId: dto.branchId,
          orderId: existingOrder.id,
          matchedOrderId: existingOrder.id,
          idempotencyKey,
          signature,
          totalAmount,
          customerName,
          customerPhone,
          customerAddress1,
          paymentMethod,
          strategy: 'IDEMPOTENCY_KEY',
          reason: 'MATCHED_EXISTING',
          metadata: {
            dedupKey: `idempotency:${idempotencyKey}`,
            windowMs: this.duplicateWindowMs,
            lookbackLimit: this.duplicateLookbackLimit,
          },
        });

        this.logMetric('order.create.idempotent_hit', {
          branchId: dto.branchId,
          orderId: existingOrder.id,
          idempotencyKey,
        });
        return this.attachPublicOrderSupportInfo(
          this.buildOrderResponse(existingOrder),
          existingOrder.branch_id ?? dto.branchId,
        );
      }
    }

    const dedupDto: CreatePublicOrderRequest = {
      ...dto,
      paymentMethod: paymentMethod as any,
      fulfillmentType,
    };

    const duplicateOrder = await this.findRecentDuplicateOrder(
      adminClient,
      dedupDto,
      totalAmount,
      signature,
      userId,
    );

    if (duplicateOrder) {
      await this.logDedupEvent(adminClient, {
        branchId: dto.branchId,
        orderId: duplicateOrder.order.id,
        matchedOrderId: duplicateOrder.order.id,
        idempotencyKey,
        signature,
        totalAmount,
        customerName,
        customerPhone,
        customerAddress1,
        paymentMethod,
        strategy: duplicateOrder.strategy,
        reason: 'RECENT_DUPLICATE',
        metadata: duplicateOrder.metadata,
      });

      this.logMetric('order.create.duplicate', {
        branchId: dto.branchId,
        orderId: duplicateOrder.order.id,
        strategy: duplicateOrder.strategy,
        dedupKey: duplicateOrder.metadata?.dedupKey,
      });
      return duplicateOrder.order;
    }

    const insertPayload: Record<string, any> = {
      branch_id: dto.branchId,
      user_id: userId ?? null,
      customer_name: dto.customerName,
      customer_phone: dto.customerPhone ?? null,
      customer_address1: dto.customerAddress1 ?? null,
      customer_address2: dto.customerAddress2 ?? null,
      customer_memo: dto.customerMemo ?? null,
      delivery_address: dto.customerAddress1 ?? null,
      delivery_memo: dto.customerMemo ?? null,
      payment_method: paymentMethod,
      subtotal_amount: subtotalAmount,
      shipping_fee: 0,
      discount_amount: 0,
      total_amount: totalAmount,
      status: 'CREATED',
      payment_status: 'PENDING',
      idempotency_key: idempotencyKey ?? null,
      fulfillment_type: fulfillmentType,
    };
    if (channelId) {
      insertPayload.channel_id = channelId;
    }

    const executeOrderInsert = (client: any) =>
      client
        .from('orders')
        .insert({ ...insertPayload })
        .select('id, order_no, status, total_amount, created_at')
        .single();

    const retryMissingColumns = async (client: any, currentError: any) => {
      let error = currentError;
      const droppedColumns = new Set<string>();
      for (let attempts = 0; error && attempts < 10; attempts += 1) {
        if (!this.isMissingColumnError(error)) break;
        const missingColumn = this.getMissingColumnName(error);
        if (!missingColumn) break;
        if (!(missingColumn in insertPayload)) break;
        if (droppedColumns.has(missingColumn)) break;
        droppedColumns.add(missingColumn);
        delete insertPayload[missingColumn];
        ({ data: order, error } = await executeOrderInsert(client));
      }
      return error;
    };

    let orderClient: any = sb;
    let { data: order, error: orderError } =
      await executeOrderInsert(orderClient);
    orderError = await retryMissingColumns(orderClient, orderError);

    if (
      orderError &&
      orderClient !== adminClient &&
      (this.isRowLevelSecurityError(orderError) ||
        this.isInvalidChannelIdError(orderError))
    ) {
      orderClient = adminClient;
      ({ data: order, error: orderError } =
        await executeOrderInsert(orderClient));
      orderError = await retryMissingColumns(orderClient, orderError);
    }

    if (
      orderError &&
      this.isInvalidFulfillmentTypeEnumError(orderError) &&
      insertPayload.fulfillment_type === FulfillmentType.DINE_IN
    ) {
      insertPayload.fulfillment_type = FulfillmentType.PICKUP;
      const pickupChannelId =
        branchOrderConfig.channelByType[FulfillmentType.PICKUP];
      if (pickupChannelId) {
        insertPayload.channel_id = pickupChannelId;
      }

      ({ data: order, error: orderError } =
        await executeOrderInsert(orderClient));
      orderError = await retryMissingColumns(orderClient, orderError);
    }

    if (orderError) {
      const orderErrorMessage = String(orderError.message ?? '');
      if (
        orderError.code === '23502' &&
        /channel_id/i.test(orderErrorMessage)
      ) {
        throw new BadRequestException(
          '주문 채널이 설정되지 않았습니다. 매장 주문방식을 확인해주세요.',
        );
      }
      if (
        orderError.code === '23502' &&
        /fulfillment_type/i.test(orderErrorMessage)
      ) {
        throw new BadRequestException(
          '주문 방식이 설정되지 않았습니다. 매장 주문방식을 확인해주세요.',
        );
      }
      if (
        orderError.code === '23502' &&
        /customer_phone/i.test(orderErrorMessage)
      ) {
        throw new BadRequestException('연락처를 입력해주세요.');
      }

      if (orderError.code === '23505' && idempotencyKey) {
        const existingOrder = await this.fetchOrderByIdempotencyKey(
          adminClient,
          dto.branchId,
          idempotencyKey,
          userId,
        );

        if (existingOrder) {
          await this.logDedupEvent(adminClient, {
            branchId: dto.branchId,
            orderId: existingOrder.id,
            matchedOrderId: existingOrder.id,
            idempotencyKey,
            signature,
            totalAmount,
            customerName,
            customerPhone,
            customerAddress1,
            paymentMethod,
            strategy: 'IDEMPOTENCY_KEY',
            reason: 'UNIQUE_CONSTRAINT_RACE',
            metadata: {
              dedupKey: `idempotency:${idempotencyKey}`,
              windowMs: this.duplicateWindowMs,
              lookbackLimit: this.duplicateLookbackLimit,
            },
          });

          this.logMetric('order.create.idempotency_race', {
            branchId: dto.branchId,
            orderId: existingOrder.id,
            idempotencyKey,
          });
          return this.attachPublicOrderSupportInfo(
            this.buildOrderResponse(existingOrder),
            existingOrder.branch_id ?? dto.branchId,
          );
        }
      }
      throw new BadRequestException(`주문 생성 실패: ${orderError.message}`);
    }
    if (!order) {
      throw new BadRequestException(
        '주문 생성 실패: 주문 정보가 반환되지 않았습니다.',
      );
    }
    const createdOrder = order;

    const orderItemResults: {
      productName: string;
      qty: number;
      unitPrice: number;
      options: string[];
    }[] = [];

    try {
      for (const itemData of orderItemsData) {
        const orderItemPayload: Record<string, any> = {
          order_id: createdOrder.id,
          product_id: itemData.product_id,
          product_name_snapshot: itemData.product_name_snapshot,
          qty: itemData.qty,
          unit_price: itemData.unit_price,
          unit_price_snapshot: itemData.unit_price,
          line_total: itemData.unit_price * itemData.qty,
        };

        const executeOrderItemInsert = () =>
          orderClient
            .from('order_items')
            .insert({ ...orderItemPayload })
            .select('id')
            .single();

        let { data: orderItem, error: itemError } =
          await executeOrderItemInsert();

        const droppedColumns = new Set<string>();
        for (let attempts = 0; itemError && attempts < 10; attempts += 1) {
          if (!this.isMissingColumnError(itemError)) break;
          const missingColumn = this.getMissingColumnName(itemError);
          if (!missingColumn) break;
          if (!(missingColumn in orderItemPayload)) break;
          if (droppedColumns.has(missingColumn)) break;
          droppedColumns.add(missingColumn);
          delete orderItemPayload[missingColumn];
          ({ data: orderItem, error: itemError } =
            await executeOrderItemInsert());
        }

        if (itemError || !orderItem) {
          this.logger.error('order_item insert error:', itemError);
          throw new BadRequestException('주문 항목 생성에 실패했습니다.');
        }

        const optionNames: string[] = [];
        if (itemData.options && itemData.options.length > 0) {
          for (const opt of itemData.options) {
            const { error: optError } = await orderClient
              .from('order_item_options')
              .insert({
                order_item_id: orderItem.id,
                product_option_id: opt.product_option_id,
                option_name_snapshot: opt.option_name_snapshot,
                price_delta_snapshot: opt.price_delta_snapshot,
              });

            if (!optError) {
              optionNames.push(opt.option_name_snapshot);
            }
          }
        }

        orderItemResults.push({
          productName: itemData.product_name_snapshot,
          qty: itemData.qty,
          unitPrice: itemData.unit_price,
          options: optionNames,
        });
      }
    } catch (error) {
      await this.rollbackOrder(adminClient, createdOrder.id);
      throw error;
    }

    // ============================================================
    // STEP 2: Reserve inventory and create logs (atomic RPC)
    // ============================================================
    const defaultReserveItems = dto.items.map((item) => ({
      product_id: item.productId,
      qty: item.qty,
    }));
    let reserveItems = defaultReserveItems;

    try {
      const { data: inventoryRows, error: inventoryLookupError } =
        await adminClient
          .from('product_inventory')
          .select('product_id')
          .eq('branch_id', dto.branchId)
          .in('product_id', productIds);

      if (inventoryLookupError) {
        if (this.isInventoryInfraUnavailableError(inventoryLookupError)) {
          this.logger.warn(
            `Inventory infra unavailable. Skip reservation for order ${createdOrder.id}: ${inventoryLookupError.message ?? 'unknown'}`,
          );
          reserveItems = [];
        } else {
          throw new BadRequestException(
            '재고 처리 중 오류가 발생했습니다. 관리자에게 문의해주세요.',
          );
        }
      }

      // `inventoryRows` can be undefined in 일부 테스트 목 환경. 그 경우 기존 동작대로 전체 예약.
      if (inventoryRows !== undefined) {
        const trackedProductIds = new Set(
          (inventoryRows ?? [])
            .map((row: any) => String(row.product_id ?? ''))
            .filter(Boolean),
        );
        reserveItems = defaultReserveItems.filter((item) =>
          trackedProductIds.has(item.product_id),
        );
      }

      if (reserveItems.length > 0) {
        const { error: reserveError } = await adminClient.rpc(
          'reserve_inventory_for_order',
          {
            branch_id: dto.branchId,
            order_id: createdOrder.id,
            order_no: createdOrder.order_no,
            items: reserveItems,
          },
        );

        if (reserveError) {
          if (this.isInventoryInfraUnavailableError(reserveError)) {
            this.logger.warn(
              `Inventory RPC unavailable. Skip reservation for order ${createdOrder.id}: ${reserveError.message ?? 'unknown'}`,
            );
          } else {
            const message = reserveError.message ?? '';
            const notFoundMatch = message.match(
              /INVENTORY_NOT_FOUND:([0-9a-f-]+)/i,
            );
            if (notFoundMatch) {
              const missingId = notFoundMatch[1];
              throw new BadRequestException(
                `재고 정보를 찾을 수 없습니다: ${productMap.get(missingId)?.name ?? missingId}`,
              );
            }

            const insufficientMatch = message.match(
              /INSUFFICIENT_INVENTORY:([0-9a-f-]+)/i,
            );
            if (insufficientMatch) {
              const productId = insufficientMatch[1];
              throw new BadRequestException(
                `재고가 부족합니다: ${productMap.get(productId)?.name ?? productId}`,
              );
            }

            throw new BadRequestException(
              '재고 처리 중 오류가 발생했습니다. 관리자에게 문의해주세요.',
            );
          }
        }
      }
    } catch (error) {
      if (this.isInventoryInfraUnavailableError(error)) {
        this.logger.warn(
          `Inventory infra unavailable after exception. Continue order ${createdOrder.id}: ${String(error?.message ?? error)}`,
        );
        this.logMetric('order.create.inventory_skipped', {
          branchId: dto.branchId,
          orderId: createdOrder.id,
          reason: 'INFRA_UNAVAILABLE',
        });
      } else {
        await this.rollbackOrder(adminClient, createdOrder.id);
        this.logger.error(
          'Inventory reservation failed for order ' + createdOrder.id,
          error,
        );
        this.logMetric('order.create.inventory_failed', {
          branchId: dto.branchId,
          orderId: createdOrder.id,
        });

        if (error instanceof BadRequestException) {
          throw error;
        }

        throw new BadRequestException(
          '재고 처리 중 오류가 발생했습니다. 관리자에게 문의해주세요.',
        );
      }
    }

    this.logMetric('order.create.success', {
      branchId: dto.branchId,
      orderId: createdOrder.id,
      totalAmount: createdOrder.total_amount,
      idempotencyKey,
    });

    const branchName = customerPhone
      ? await this.getBranchNameForNotification(adminClient, dto.branchId)
      : '매장';

    // Non-blocking: earn stamps after successful order
    if (customerPhone) {
      this.stampsService
        .earnStamps({
          branchId: dto.branchId,
          customerPhone,
          orderId: createdOrder.id,
        })
        .catch((err) => this.logger.warn('earnStamps error', err));
    }

    this.sendOrderCompletionNotification(createdOrder, {
      customerPhone,
      customerName,
      customerAddress1,
      customerAddress2,
      paymentMethod,
      transferAccount: branchOrderConfig.transferAccount ?? null,
      fulfillmentType,
      items: orderItemResults.map((item) => ({
        productName: item.productName,
        qty: item.qty,
      })),
      branchName,
    });

    return {
      id: createdOrder.id,
      orderNo: createdOrder.order_no ?? createdOrder.id,
      status: createdOrder.status,
      totalAmount: createdOrder.total_amount,
      createdAt: createdOrder.created_at,
      requestedTime,
      paymentMethod,
      fulfillmentType,
      transferAccount: branchOrderConfig.transferAccount ?? null,
      customer: {
        name: customerName,
        phone: customerPhone,
        address1: customerAddress1,
        address2: customerAddress2,
        memo: customerMemo,
      },
      items: orderItemResults,
    };
  }

  /**
   * Get order (public)
   */
  async getOrder(orderIdOrNo: string): Promise<PublicOrderResponse> {
    const sb = this.supabase.anonClient();
    const adminSb = this.supabase.adminClient();
    const adminRetryCount = this.isUuid(orderIdOrNo) ? 3 : 1;
    const adminRetryDelayMs = process.env.NODE_ENV === 'test' ? 0 : 200;

    const queryOrder = async (client: any) => {
      let { data, error } = await this.runOrderSelectWithUnitPriceFallback(
        (unitPriceColumn) =>
          client
            .from('orders')
            .select(
              `
        id,
        branch_id,
        order_no,
        status,
        total_amount,
        created_at,
        payment_method,
        fulfillment_type,
        customer_name,
        customer_phone,
        customer_address1,
        customer_address2,
        customer_memo,
        order_items (
          product_name_snapshot,
          qty,
          ${unitPriceColumn},
          order_item_options (
            option_name_snapshot
          )
        )
      `,
            )
            .eq('id', orderIdOrNo)
            .maybeSingle(),
      );

      if (!data) {
        const result = await this.runOrderSelectWithUnitPriceFallback(
          (unitPriceColumn) =>
            client
              .from('orders')
              .select(
                `
          id,
          branch_id,
          order_no,
          status,
          total_amount,
          created_at,
          payment_method,
          fulfillment_type,
          customer_name,
          customer_phone,
          customer_address1,
          customer_address2,
          customer_memo,
          order_items (
            product_name_snapshot,
            qty,
            ${unitPriceColumn},
            order_item_options (
            option_name_snapshot
          )
        )
      `,
              )
              .eq('order_no', orderIdOrNo)
              .maybeSingle(),
        );

        data = result.data;
        error = result.error;
      }

      return { data, error };
    };

    let { data, error } = await queryOrder(sb);
    if (!data) {
      for (let attempt = 0; attempt < adminRetryCount; attempt += 1) {
        const adminResult = await queryOrder(adminSb);
        if (adminResult.data || adminResult.error) {
          data = adminResult.data;
          error = adminResult.error;
          break;
        }
        if (attempt < adminRetryCount - 1 && adminRetryDelayMs > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, adminRetryDelayMs),
          );
        }
      }
    }

    if (error || !data) {
      throw new NotFoundException('주문을 찾을 수 없습니다.');
    }

    return this.attachPublicOrderSupportInfo(
      this.buildOrderResponse(data),
      data.branch_id,
    );
  }

  /**
   * Get categories for a branch (public, active only)
   */
  async getCategories(branchId: string) {
    const sb = this.supabase.adminClient();

    const { data, error } = await sb
      .from('product_categories')
      .select('id, name, sort_order')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`카테고리 목록 조회 실패: ${error.message}`);
    }

    return (data ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      sortOrder: row.sort_order ?? 0,
    }));
  }
}
