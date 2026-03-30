import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import type {
  BrandMembership,
  BranchMembership,
} from '../../common/types/auth-request';
import { CreateProductRequest } from '../../modules/products/dto/create-product.request';
import { UpdateProductRequest } from '../../modules/products/dto/update-product.request';
import { canModifyProductOrInventory } from '../../common/utils/role-permission.util';

@Injectable()
export class CustomerProductsService {
  private readonly logger = new Logger(CustomerProductsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * 釉뚮옖移섏뿉 ????묎렐 沅뚰븳 ?뺤씤
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

    // 釉뚮옖移??뺣낫 議고쉶
    const { data: branch, error } = await sb
      .from('branches')
      .select('id, brand_id, name, slug, created_at')
      .eq('id', branchId)
      .single();

    if (error || !branch) {
      throw new NotFoundException('Branch not found');
    }

    // 1. 釉뚮옖移?硫ㅻ쾭???뺤씤 (?곗꽑?쒖쐞)
    const branchMembership = branchMemberships.find(
      (m) => m.branch_id === branchId,
    );
    if (branchMembership) {
      return { branchMembership, branch };
    }

    // 2. 釉뚮옖??硫ㅻ쾭??쑝濡??뺤씤
    const brandMembership = brandMemberships.find(
      (m) => m.brand_id === branch.brand_id,
    );
    if (brandMembership) {
      return { brandMembership, branch };
    }

    throw new ForbiddenException('You do not have access to this branch');
  }

  /**
   * ?곹뭹??????묎렐 沅뚰븳 ?뺤씤
   */
  private async checkProductAccess(
    productId: string,
    userId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ): Promise<{ role: string; product: any }> {
    const sb = this.supabase.adminClient();

    // ?곹뭹 諛?釉뚮옖移??뺣낫 議고쉶
    const { data: product, error } = await sb
      .from('products')
      .select('*, branches!inner(id, brand_id)')
      .eq('id', productId)
      .single();

    if (error || !product) {
      throw new NotFoundException('Product not found');
    }

    const branchId = product.branch_id;
    const brandId = product.branches.brand_id;

    // 1. 釉뚮옖移?硫ㅻ쾭???뺤씤 (?곗꽑?쒖쐞)
    const branchMembership = branchMemberships.find(
      (m) => m.branch_id === branchId,
    );
    if (branchMembership) {
      return { role: branchMembership.role, product };
    }

    // 2. 釉뚮옖??硫ㅻ쾭??쑝濡??뺤씤
    const brandMembership = brandMemberships.find(
      (m) => m.brand_id === brandId,
    );
    if (brandMembership) {
      return { role: brandMembership.role, product };
    }

    throw new ForbiddenException('You do not have access to this product');
  }

  /**
   * ?섏젙/??젣 沅뚰븳 ?뺤씤 (OWNER/ADMIN/BRANCH_OWNER/BRANCH_ADMIN 媛??
   */
  private checkModificationPermission(
    role: string,
    action: string,
    userId: string,
  ) {
    if (!canModifyProductOrInventory(role)) {
      this.logger.warn(
        `User ${userId} with role ${role} attempted to ${action}`,
      );
      throw new ForbiddenException(
        `Only OWNER, ADMIN, or BRANCH_ADMIN can ${action}`,
      );
    }
  }

  private normalizeInventoryMode(
    mode: string | undefined | null,
  ): 'PRODUCT' | 'NONE' | undefined {
    if (mode === undefined || mode === null) {
      return undefined;
    }

    return String(mode).toUpperCase() === 'NONE' ? 'NONE' : 'PRODUCT';
  }

  private parseTemplateImageUrls(value: unknown): string[] {
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

  private getPrimaryTemplateImageUrl(value: unknown): string | null {
    const urls = this.parseTemplateImageUrls(value);
    if (urls.length > 0) return urls[0];
    if (typeof value === 'string' && value.trim()) return value.trim();
    return null;
  }

  private normalizeTemplateImageUrls(
    imageUrl?: string | null,
    imageUrls?: string[] | null,
  ): string[] {
    const base = Array.isArray(imageUrls) ? imageUrls : [];
    const normalized = [...new Set(base)]
      .filter((url): url is string => typeof url === 'string')
      .map((url) => url.trim())
      .filter(Boolean);

    if (normalized.length > 0) {
      return normalized.slice(0, 10);
    }

    if (typeof imageUrl === 'string' && imageUrl.trim().length > 0) {
      return [imageUrl.trim()];
    }

    return [];
  }

  private serializeTemplateImageUrls(urls: string[]): string | null {
    if (urls.length === 0) return null;
    if (urls.length === 1) return urls[0];
    return JSON.stringify(urls);
  }

  private parseDateTimeOrNull(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const ts = Date.parse(trimmed);
    if (Number.isNaN(ts)) return null;
    return new Date(ts).toISOString();
  }

  private resolveActiveUrgentDiscount(
    row: any,
    basePrice: number,
  ): { discountPrice: number | null; isActive: boolean } {
    const rawDiscountValue = row?.urgent_discount_price;
    if (
      rawDiscountValue === null ||
      rawDiscountValue === undefined ||
      rawDiscountValue === ''
    ) {
      return { discountPrice: null, isActive: false };
    }
    const rawPrice = Number(rawDiscountValue);
    if (!Number.isFinite(rawPrice) || rawPrice < 0 || rawPrice >= basePrice) {
      return { discountPrice: null, isActive: false };
    }

    const startAt = this.parseDateTimeOrNull(row?.urgent_discount_start_at);
    const endAt = this.parseDateTimeOrNull(row?.urgent_discount_end_at);
    const now = Date.now();
    if (startAt && now < Date.parse(startAt)) {
      return { discountPrice: rawPrice, isActive: false };
    }
    if (endAt && now > Date.parse(endAt)) {
      return { discountPrice: rawPrice, isActive: false };
    }
    return { discountPrice: rawPrice, isActive: true };
  }

  private buildUrgentDiscountFields(
    basePrice: number,
    payload: {
      urgentDiscountPrice?: number | null;
      urgentDiscountStartAt?: string | null;
      urgentDiscountEndAt?: string | null;
    },
  ) {
    const hasPrice = payload.urgentDiscountPrice !== undefined;
    const hasStart = payload.urgentDiscountStartAt !== undefined;
    const hasEnd = payload.urgentDiscountEndAt !== undefined;
    if (!hasPrice && !hasStart && !hasEnd) {
      return null;
    }

    const fields: {
      urgent_discount_price?: number | null;
      urgent_discount_start_at?: string | null;
      urgent_discount_end_at?: string | null;
    } = {};

    if (hasPrice) {
      const price = payload.urgentDiscountPrice;
      if (price === null) {
        fields.urgent_discount_price = null;
      } else if (
        typeof price !== 'number' ||
        !Number.isFinite(price) ||
        price < 0
      ) {
        throw new BadRequestException(
          '湲닿툒?좎씤 媛寃⑹? 0 ?댁긽???レ옄?ъ빞 ?⑸땲??',
        );
      } else if (price >= basePrice) {
        throw new BadRequestException(
          '湲닿툒?좎씤 媛寃⑹? 湲곕낯 媛寃⑸낫????븘???⑸땲??',
        );
      } else {
        fields.urgent_discount_price = Math.floor(price);
      }
    }

    if (hasStart) {
      const normalized = this.parseDateTimeOrNull(
        payload.urgentDiscountStartAt,
      );
      fields.urgent_discount_start_at = payload.urgentDiscountStartAt
        ? normalized
        : null;
      if (payload.urgentDiscountStartAt && !normalized) {
        throw new BadRequestException(
          '湲닿툒?좎씤 ?쒖옉 ?쒓컖 ?뺤떇???щ컮瑜댁? ?딆뒿?덈떎.',
        );
      }
    }

    if (hasEnd) {
      const normalized = this.parseDateTimeOrNull(payload.urgentDiscountEndAt);
      fields.urgent_discount_end_at = payload.urgentDiscountEndAt
        ? normalized
        : null;
      if (payload.urgentDiscountEndAt && !normalized) {
        throw new BadRequestException(
          '湲닿툒?좎씤 醫낅즺 ?쒓컖 ?뺤떇???щ컮瑜댁? ?딆뒿?덈떎.',
        );
      }
    }

    const startAt = fields.urgent_discount_start_at;
    const endAt = fields.urgent_discount_end_at;
    if (startAt && endAt && Date.parse(startAt) >= Date.parse(endAt)) {
      throw new BadRequestException(
        '湲닿툒?좎씤 醫낅즺 ?쒓컖? ?쒖옉 ?쒓컖蹂대떎 ??뼱???⑸땲??',
      );
    }

    return fields;
  }

  private getUrgentDiscountSnapshot(row: any): {
    price: number | null;
    startAt: string | null;
    endAt: string | null;
  } {
    const rawPrice = Number(row?.urgent_discount_price);
    const price =
      Number.isFinite(rawPrice) && rawPrice >= 0 ? Math.floor(rawPrice) : null;
    return {
      price,
      startAt: this.parseDateTimeOrNull(row?.urgent_discount_start_at),
      endAt: this.parseDateTimeOrNull(row?.urgent_discount_end_at),
    };
  }

  private isSameUrgentDiscountSnapshot(
    a: { price: number | null; startAt: string | null; endAt: string | null },
    b: { price: number | null; startAt: string | null; endAt: string | null },
  ) {
    return (
      a.price === b.price && a.startAt === b.startAt && a.endAt === b.endAt
    );
  }

  private isMissingUrgentDiscountHistoryTableError(error: any): boolean {
    const message = String(error?.message ?? '').toLowerCase();
    const hint = String(error?.hint ?? '').toLowerCase();
    const details = String(error?.details ?? '').toLowerCase();
    const joined = `${message} ${hint} ${details}`;

    if (!joined.includes('brand_product_urgent_discount_histories')) {
      return false;
    }

    return (
      joined.includes('does not exist') ||
      joined.includes('relation') ||
      joined.includes('schema cache')
    );
  }

  private async appendUrgentDiscountHistory(
    brandProductId: string,
    brandId: string,
    snapshot: {
      price: number | null;
      startAt: string | null;
      endAt: string | null;
    },
    recordedBy: string,
    reason: 'SET' | 'UPDATED' | 'REPLACED' | 'CLEARED',
  ) {
    if (snapshot.price === null) {
      return;
    }

    const sb = this.supabase.adminClient();
    const { error } = await sb
      .from('brand_product_urgent_discount_histories')
      .insert({
        brand_product_id: brandProductId,
        brand_id: brandId,
        discount_price: snapshot.price,
        discount_start_at: snapshot.startAt,
        discount_end_at: snapshot.endAt,
        recorded_reason: reason,
        recorded_by: recordedBy,
      });

    if (!error) {
      return;
    }

    if (this.isMissingUrgentDiscountHistoryTableError(error)) {
      this.logger.warn(
        'urgent discount history table is missing. skip recording history.',
      );
      return;
    }

    this.logger.error(
      `Failed to record urgent discount history for template ${brandProductId}`,
      error,
    );
    throw new Error('Failed to record urgent discount history');
  }

  private async syncInventoryTrackingForProducts(
    rows: Array<{ id: string; branch_id: string }>,
    mode: 'PRODUCT' | 'NONE' | undefined,
  ) {
    if (mode === undefined) {
      return;
    }

    const targets = rows.filter((row) => row?.id && row?.branch_id);
    if (targets.length === 0) {
      return;
    }

    const productIds = [...new Set(targets.map((row) => row.id))];
    const sb = this.supabase.adminClient();

    if (mode === 'NONE') {
      const { error } = await sb
        .from('product_inventory')
        .delete()
        .in('product_id', productIds);

      if (error) {
        this.logger.error('Failed to disable inventory tracking', error);
        throw new Error('Failed to sync inventory tracking');
      }
      return;
    }

    const { data: existingRows, error: existingError } = await sb
      .from('product_inventory')
      .select('product_id')
      .in('product_id', productIds);

    if (existingError) {
      this.logger.error('Failed to fetch inventory records', existingError);
      throw new Error('Failed to sync inventory tracking');
    }

    const existingIds = new Set(
      (existingRows ?? [])
        .map((row: any) => String(row.product_id ?? ''))
        .filter(Boolean),
    );
    const insertRows = targets
      .filter((row) => !existingIds.has(row.id))
      .map((row) => ({
        product_id: row.id,
        branch_id: row.branch_id,
        qty_available: 0,
        qty_reserved: 0,
        qty_sold: 0,
        low_stock_threshold: 10,
      }));

    if (insertRows.length === 0) {
      return;
    }

    const { error: insertError } = await sb
      .from('product_inventory')
      .insert(insertRows);

    if (insertError && insertError.code !== '23505') {
      this.logger.error('Failed to create inventory records', insertError);
      throw new Error('Failed to sync inventory tracking');
    }
  }

  private async getTemplateInventoryMode(
    templateId: string,
  ): Promise<'PRODUCT' | 'NONE'> {
    const sb = this.supabase.adminClient();
    const { data: linkedRows, error: linkedError } = await sb
      .from('products')
      .select('id')
      .eq('brand_product_id', templateId);

    if (linkedError) {
      this.logger.error(
        `Failed to fetch linked products for inventory mode ${templateId}`,
        linkedError,
      );
      throw new Error('Failed to resolve inventory mode');
    }

    const linkedIds = (linkedRows ?? [])
      .map((row: any) => row.id)
      .filter(Boolean);
    if (linkedIds.length === 0) {
      return 'PRODUCT';
    }

    const { data: inventoryRows, error: inventoryError } = await sb
      .from('product_inventory')
      .select('product_id')
      .in('product_id', linkedIds);

    if (inventoryError) {
      this.logger.error(
        `Failed to fetch inventory mode for template ${templateId}`,
        inventoryError,
      );
      throw new Error('Failed to resolve inventory mode');
    }

    const trackedCount = (inventoryRows ?? []).length;
    if (trackedCount === 0) {
      return 'NONE';
    }
    if (trackedCount === linkedIds.length) {
      return 'PRODUCT';
    }

    return 'NONE';
  }

  private async checkBrandAccess(
    brandId: string,
    userId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
    branchId?: string,
  ): Promise<{ role: string; branch?: any }> {
    const brandMembership = brandMemberships.find(
      (m) => m.brand_id === brandId,
    );
    if (brandMembership) {
      return { role: brandMembership.role };
    }

    if (branchId) {
      const branchAccess = await this.checkBranchAccess(
        branchId,
        userId,
        brandMemberships,
        branchMemberships,
      );
      if (branchAccess.branch?.brand_id !== brandId) {
        throw new ForbiddenException('Branch does not belong to this brand');
      }

      const role =
        branchAccess.branchMembership?.role ??
        branchAccess.brandMembership?.role;
      if (role) {
        return { role, branch: branchAccess.branch };
      }
    }

    throw new ForbiddenException('You do not have access to this brand');
  }

  private canManageBrandTemplates(role: string): boolean {
    return role === 'OWNER' || role === 'ADMIN';
  }

  private isMissingColumnError(error: any, columnName?: string): boolean {
    const message = String(error?.message ?? '');
    const hint = String(error?.hint ?? '');
    const details = String(error?.details ?? '');
    const joined = `${message} ${hint} ${details}`.toLowerCase();
    if (!joined.includes('column')) return false;
    if (
      !joined.includes('schema cache') &&
      !joined.includes('does not exist')
    ) {
      return false;
    }
    if (!columnName) return true;
    return joined.includes(columnName.toLowerCase());
  }
  private isMissingUrgentDiscountColumnError(error: any): boolean {
    const message = String(error?.message ?? '');
    const hint = String(error?.hint ?? '');
    const details = String(error?.details ?? '');
    const joined = `${message} ${hint} ${details}`.toLowerCase();
    const hasUrgentDiscountColumn =
      joined.includes('urgent_discount_price') ||
      joined.includes('urgent_discount_start_at') ||
      joined.includes('urgent_discount_end_at');
    if (!hasUrgentDiscountColumn) return false;
    return this.isMissingColumnError(error);
  }
  private async getBrandBranches(brandId: string) {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('branches')
      .select('id, brand_id, name, slug')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error(`Failed to fetch branches for brand ${brandId}`, error);
      throw new Error('Failed to fetch brand branches');
    }

    return data ?? [];
  }

  private normalizeTemplateBranchIds(
    allBranchIds: string[],
    branchIds: string[] | undefined,
    useAllOnMissing: boolean,
  ) {
    const allIds = [...new Set(allBranchIds)];
    if (branchIds === undefined) {
      return useAllOnMissing ? allIds : null;
    }

    const requested = [...new Set(branchIds)];
    const idSet = new Set(allIds);
    const invalid = requested.filter((id) => !idSet.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Some branchIds do not belong to this brand: ${invalid.join(', ')}`,
      );
    }

    return requested;
  }

  private normalizeTemplateBranchCategoryAssignments(
    allBranchIds: string[],
    assignments:
      | Array<{ branchId: string; categoryId?: string | null }>
      | undefined,
  ) {
    if (assignments === undefined) {
      return null;
    }

    const idSet = new Set(allBranchIds);
    const invalidBranchIds = [
      ...new Set(
        assignments
          .map((item) => item.branchId)
          .filter((branchId) => !idSet.has(branchId)),
      ),
    ];
    if (invalidBranchIds.length > 0) {
      throw new BadRequestException(
        `Some branchIds do not belong to this brand: ${invalidBranchIds.join(', ')}`,
      );
    }

    const categoryByBranch = new Map<string, string | null>();
    for (const item of assignments) {
      const normalized =
        typeof item.categoryId === 'string' && item.categoryId.trim().length > 0
          ? item.categoryId.trim()
          : null;
      categoryByBranch.set(item.branchId, normalized);
    }

    return categoryByBranch;
  }

  private async validateTemplateBranchCategoryAssignments(
    categoryByBranch: Map<string, string | null>,
  ) {
    const requested = [...categoryByBranch.entries()].filter(
      ([, categoryId]) => categoryId !== null,
    ) as Array<[string, string]>;
    if (requested.length === 0) {
      return;
    }

    const categoryIds = [
      ...new Set(requested.map(([, categoryId]) => categoryId)),
    ];
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('product_categories')
      .select('id, branch_id')
      .in('id', categoryIds);

    if (error) {
      this.logger.error(
        'Failed to validate branch category assignments',
        error,
      );
      throw new Error('Failed to validate categories');
    }

    const categoryBranchMap = new Map<string, string>();
    for (const row of data ?? []) {
      categoryBranchMap.set(row.id, row.branch_id);
    }

    const missingIds: string[] = [];
    const mismatchIds: string[] = [];
    for (const [branchId, categoryId] of requested) {
      const categoryBranchId = categoryBranchMap.get(categoryId);
      if (!categoryBranchId) {
        missingIds.push(categoryId);
        continue;
      }
      if (categoryBranchId !== branchId) {
        mismatchIds.push(categoryId);
      }
    }

    if (missingIds.length > 0) {
      throw new BadRequestException(
        `Some categoryIds do not exist: ${[...new Set(missingIds)].join(', ')}`,
      );
    }
    if (mismatchIds.length > 0) {
      throw new BadRequestException(
        `Some categoryIds do not belong to target branches: ${[...new Set(mismatchIds)].join(', ')}`,
      );
    }
  }

  private buildTemplateProductFields(template: any) {
    return {
      name: template.name,
      description: template.description ?? null,
      base_price: template.base_price ?? 0,
      image_url: this.getPrimaryTemplateImageUrl(template.image_url),
      sort_order: template.sort_order ?? 0,
      urgent_discount_price: template.urgent_discount_price ?? null,
      urgent_discount_start_at: template.urgent_discount_start_at ?? null,
      urgent_discount_end_at: template.urgent_discount_end_at ?? null,
    };
  }

  private async syncTemplateFieldsToLinkedProducts(template: any) {
    const sb = this.supabase.adminClient();
    const { error } = await sb
      .from('products')
      .update(this.buildTemplateProductFields(template))
      .eq('brand_product_id', template.id);

    if (error) {
      if (this.isMissingUrgentDiscountColumnError(error)) {
        throw new BadRequestException(
          '긴급할인 기능을 사용하려면 상품 테이블에 할인 컬럼이 필요합니다.',
        );
      }
      this.logger.error(
        `Failed to sync linked products for template ${template.id}`,
        error,
      );
      throw new Error('Failed to sync linked products');
    }
  }

  private async hideTemplateFromAllBranches(templateId: string) {
    const sb = this.supabase.adminClient();
    const { error } = await sb
      .from('products')
      .update({ is_hidden: true })
      .eq('brand_product_id', templateId);

    if (error) {
      this.logger.error(
        `Failed to hide linked products for template ${templateId}`,
        error,
      );
      throw new Error('Failed to hide linked products');
    }
  }

  private async syncTemplateBranchAssignments(
    template: any,
    branchIds: string[] | undefined,
    options?: {
      useAllOnMissing?: boolean;
      syncFields?: boolean;
      inventoryMode?: 'PRODUCT' | 'NONE';
      branchCategoryAssignments?: Array<{
        branchId: string;
        categoryId?: string | null;
      }>;
    },
  ) {
    const useAllOnMissing = options?.useAllOnMissing ?? false;
    const syncFields = options?.syncFields ?? false;
    const branches = await this.getBrandBranches(template.brand_id);
    const allBranchIds = branches.map((branch: any) => branch.id);
    const targetBranchIds = this.normalizeTemplateBranchIds(
      allBranchIds,
      branchIds,
      useAllOnMissing,
    );
    const categoryByBranch = this.normalizeTemplateBranchCategoryAssignments(
      allBranchIds,
      options?.branchCategoryAssignments,
    );
    if (categoryByBranch) {
      await this.validateTemplateBranchCategoryAssignments(categoryByBranch);
    }

    if (
      targetBranchIds === null &&
      !categoryByBranch &&
      options?.inventoryMode === undefined
    ) {
      return;
    }

    const sb = this.supabase.adminClient();
    const fields = this.buildTemplateProductFields(template);

    if (allBranchIds.length === 0) {
      return;
    }

    const { data: linkedProducts, error: linkedError } = await sb
      .from('products')
      .select('id, branch_id, is_hidden, category_id')
      .eq('brand_product_id', template.id)
      .in('branch_id', allBranchIds);

    if (linkedError) {
      this.logger.error(
        `Failed to load linked products for template ${template.id}`,
        linkedError,
      );
      throw new Error('Failed to sync template branches');
    }

    const linkedByBranch = new Map<string, any>();
    for (const row of linkedProducts ?? []) {
      linkedByBranch.set(row.branch_id, row);
    }

    const effectiveTargetBranchIds = targetBranchIds ?? [
      ...new Set(
        (linkedProducts ?? [])
          .filter((row: any) => row.is_hidden !== true)
          .map((row: any) => row.branch_id),
      ),
    ];
    const targetSet = new Set(effectiveTargetBranchIds);

    for (const branchId of effectiveTargetBranchIds) {
      const existing = linkedByBranch.get(branchId);
      const hasCategoryAssignment = categoryByBranch?.has(branchId) ?? false;
      const categoryId = hasCategoryAssignment
        ? (categoryByBranch?.get(branchId) ?? null)
        : null;
      if (existing) {
        const updatePayload: Record<string, unknown> = { is_hidden: false };
        if (syncFields) {
          Object.assign(updatePayload, fields);
        }
        if (hasCategoryAssignment) {
          updatePayload.category_id = categoryId;
        }
        const { error } = await sb
          .from('products')
          .update(updatePayload)
          .eq('id', existing.id);

        if (error) {
          this.logger.error(
            `Failed to activate template ${template.id} for branch ${branchId}`,
            error,
          );
          throw new Error('Failed to sync template branches');
        }
        continue;
      }

      const { error } = await sb.from('products').insert({
        branch_id: branchId,
        brand_product_id: template.id,
        ...fields,
        category_id: hasCategoryAssignment ? categoryId : null,
        is_hidden: false,
      });

      if (error) {
        this.logger.error(
          `Failed to create linked product for template ${template.id} and branch ${branchId}`,
          error,
        );
        throw new Error('Failed to sync template branches');
      }
    }

    for (const [branchId, linked] of linkedByBranch.entries()) {
      if (targetSet.has(branchId)) {
        continue;
      }

      const { error } = await sb
        .from('products')
        .update({ is_hidden: true })
        .eq('id', linked.id);

      if (error) {
        this.logger.error(
          `Failed to hide template ${template.id} for branch ${branchId}`,
          error,
        );
        throw new Error('Failed to sync template branches');
      }
    }

    if (
      options?.inventoryMode !== undefined &&
      effectiveTargetBranchIds.length > 0
    ) {
      const { data: targetProducts, error: targetProductsError } = await sb
        .from('products')
        .select('id, branch_id')
        .eq('brand_product_id', template.id)
        .eq('is_hidden', false)
        .in('branch_id', effectiveTargetBranchIds);

      if (targetProductsError) {
        this.logger.error(
          `Failed to fetch template products for inventory sync ${template.id}`,
          targetProductsError,
        );
        throw new Error('Failed to sync template branches');
      }

      await this.syncInventoryTrackingForProducts(
        targetProducts ?? [],
        options.inventoryMode,
      );
    }
  }

  private mapBrandTemplate(
    row: any,
    options?: {
      linkedProduct?: any;
      appliedBranchIds?: string[];
      appliedBranchCategoryIds?: Record<string, string | null>;
      totalBranchCount?: number;
      inventoryMode?: 'PRODUCT' | 'NONE' | 'MIXED';
    },
  ) {
    const appliedBranchIds = options?.appliedBranchIds ?? [];
    const linkedProduct = options?.linkedProduct;
    const imageUrls = this.parseTemplateImageUrls(row.image_url);
    const basePrice = row.base_price ?? 0;
    const urgentDiscount = this.resolveActiveUrgentDiscount(row, basePrice);
    return {
      id: row.id,
      brandId: row.brand_id,
      name: row.name,
      description: row.description ?? null,
      price: basePrice,
      discountPrice: urgentDiscount.isActive
        ? urgentDiscount.discountPrice
        : undefined,
      urgentDiscountPrice: urgentDiscount.discountPrice,
      urgentDiscountStartAt:
        this.parseDateTimeOrNull(row.urgent_discount_start_at) ?? null,
      urgentDiscountEndAt:
        this.parseDateTimeOrNull(row.urgent_discount_end_at) ?? null,
      imageUrl: imageUrls[0] ?? null,
      imageUrls,
      isActive: row.is_active ?? true,
      sortOrder: row.sort_order ?? 0,
      createdAt: row.created_at ?? '',
      updatedAt: row.updated_at ?? row.created_at ?? '',
      appliedToBranch: linkedProduct ? linkedProduct.is_hidden !== true : false,
      branchProductId: linkedProduct?.id ?? null,
      branchPrice: linkedProduct?.base_price ?? null,
      appliedBranchIds,
      appliedBranchCategoryIds: options?.appliedBranchCategoryIds ?? {},
      appliedBranchCount: appliedBranchIds.length,
      totalBranchCount: options?.totalBranchCount ?? null,
      inventoryMode: options?.inventoryMode ?? 'PRODUCT',
      isOnlineShopVisible: row.is_online_shop_visible ?? true,
    };
  }

  /**
   * ??吏?먯쓽 ?곹뭹 移댄뀒怨좊━ 紐⑸줉 議고쉶
   */
  async getMyCategories(
    userId: string,
    branchId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(
      `Fetching categories for branch ${branchId} by user ${userId}`,
    );

    // 釉뚮옖移??묎렐 沅뚰븳 ?뺤씤
    await this.checkBranchAccess(
      branchId,
      userId,
      brandMemberships,
      branchMemberships,
    );

    const sb = this.supabase.adminClient();

    const { data, error } = await sb
      .from('product_categories')
      .select('*')
      .eq('branch_id', branchId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error(
        `Failed to fetch categories for branch ${branchId}`,
        error,
      );
      throw new Error('Failed to fetch categories');
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      branchId: row.branch_id,
      name: row.name,
      sortOrder: row.sort_order ?? 0,
      isActive: row.is_active ?? true,
      createdAt: row.created_at ?? '',
    }));
  }

  /**
   * ??吏?먯쓽 ?곹뭹 紐⑸줉 議고쉶
   */
  async getMyProducts(
    userId: string,
    branchId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(
      `Fetching products for branch ${branchId} by user ${userId}`,
    );

    // 釉뚮옖移??묎렐 沅뚰븳 ?뺤씤
    await this.checkBranchAccess(
      branchId,
      userId,
      brandMemberships,
      branchMemberships,
    );

    const sb = this.supabase.adminClient();

    let { data, error } = await sb
      .from('products')
      .select('*')
      .eq('branch_id', branchId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    // Fallback if sort_order column doesn't exist yet
    if (error && error.message?.includes('sort_order')) {
      ({ data, error } = await sb
        .from('products')
        .select('*')
        .eq('branch_id', branchId)
        .order('created_at', { ascending: true }));
    }

    if (error) {
      this.logger.error(
        `Failed to fetch products for branch ${branchId}`,
        error,
      );
      throw new Error('Failed to fetch products');
    }

    this.logger.log(
      `Fetched ${data?.length || 0} products for branch ${branchId}`,
    );

    return data || [];
  }

  /**
   * ???곹뭹 ?곸꽭 議고쉶
   */
  async getMyProduct(
    userId: string,
    productId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(`Fetching product ${productId} by user ${userId}`);

    const { product } = await this.checkProductAccess(
      productId,
      userId,
      brandMemberships,
      branchMemberships,
    );

    // ?곹뭹 ?듭뀡 議고쉶
    const sb = this.supabase.adminClient();
    const { data: options, error: optionsError } = await sb
      .from('product_options')
      .select('id, product_id, name, price_delta, is_active, sort_order')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true });

    if (optionsError) {
      this.logger.error(
        `Failed to fetch options for product ${productId}`,
        optionsError,
      );
    }

    return {
      ...product,
      options: options || [],
    };
  }

  /**
   * ?곹뭹 ?앹꽦 (OWNER, ADMIN留?媛??
   */
  async createMyProduct(
    userId: string,
    dto: CreateProductRequest,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(
      `Creating product for branch ${dto.branchId} by user ${userId}`,
    );

    // 釉뚮옖移??묎렐 沅뚰븳 ?뺤씤
    const { branchMembership, brandMembership } = await this.checkBranchAccess(
      dto.branchId,
      userId,
      brandMemberships,
      branchMemberships,
    );

    const role = branchMembership?.role || brandMembership?.role;
    if (!role) {
      throw new ForbiddenException('You do not have access to this branch');
    }

    // ?앹꽦 沅뚰븳 ?뺤씤
    this.checkModificationPermission(role, 'create products', userId);

    const sb = this.supabase.adminClient();

    // ?곹뭹 ?앹꽦
    const { data: product, error: productError } = await sb
      .from('products')
      .insert({
        branch_id: dto.branchId,
        name: dto.name,
        description: dto.description,
        category_id: dto.categoryId,
        base_price: dto.price,
        is_hidden: !(dto.isActive ?? true),
        image_url: dto.imageUrl,
        sort_order: dto.sortOrder ?? 0,
      })
      .select()
      .single();

    if (productError) {
      this.logger.error(
        `Failed to create product for branch ${dto.branchId}`,
        productError,
      );
      throw new Error('Failed to create product');
    }

    // ?곹뭹 ?듭뀡 ?앹꽦 (?덈뒗 寃쎌슦)
    if (dto.options && dto.options.length > 0) {
      const optionsToInsert = dto.options.map((opt) => ({
        product_id: product.id,
        name: opt.name,
        price_delta: opt.priceDelta ?? 0,
        is_active: opt.isActive ?? true,
        sort_order: opt.sortOrder ?? 0,
      }));

      const { error: optionsError } = await sb
        .from('product_options')
        .insert(optionsToInsert);

      if (optionsError) {
        this.logger.error(
          `Failed to create options for product ${product.id}`,
          optionsError,
        );
        // ?곹뭹? ?앹꽦?섏뿀?쇰?濡??먮윭瑜??섏?吏 ?딄퀬 濡쒓렇留??④?
      }
    }

    this.logger.log(`Product ${product.id} created successfully`);

    return product;
  }

  /**
   * ?곹뭹 ?섏젙 (OWNER, ADMIN留?媛??
   */
  async updateMyProduct(
    userId: string,
    productId: string,
    dto: UpdateProductRequest,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(`Updating product ${productId} by user ${userId}`);

    // ?묎렐 沅뚰븳 ?뺤씤
    const { role } = await this.checkProductAccess(
      productId,
      userId,
      brandMemberships,
      branchMemberships,
    );

    // ?섏젙 沅뚰븳 ?뺤씤
    this.checkModificationPermission(role, 'update products', userId);

    const sb = this.supabase.adminClient();

    // ?섏젙 媛?ν븳 ?꾨뱶留??덉슜
    const updateFields: any = {};
    if (dto.name !== undefined) updateFields.name = dto.name;
    if (dto.description !== undefined)
      updateFields.description = dto.description;
    if (dto.categoryId !== undefined) updateFields.category_id = dto.categoryId;
    if (dto.price !== undefined) updateFields.base_price = dto.price;
    if (dto.isActive !== undefined) updateFields.is_hidden = !dto.isActive;
    if (dto.imageUrl !== undefined) updateFields.image_url = dto.imageUrl;
    if (dto.sortOrder !== undefined) updateFields.sort_order = dto.sortOrder;

    if (Object.keys(updateFields).length === 0) {
      return this.getMyProduct(
        userId,
        productId,
        brandMemberships,
        branchMemberships,
      );
    }

    const { data, error } = await sb
      .from('products')
      .update(updateFields)
      .eq('id', productId)
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`Failed to update product ${productId}`, error);
      throw new Error('Failed to update product');
    }

    this.logger.log(`Product ${productId} updated successfully`);

    return data;
  }

  /**
   * ?곹뭹 ??젣 (OWNER, ADMIN留?媛??
   */
  async deleteMyProduct(
    userId: string,
    productId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(`Deleting product ${productId} by user ${userId}`);

    // ?묎렐 沅뚰븳 ?뺤씤
    const { role } = await this.checkProductAccess(
      productId,
      userId,
      brandMemberships,
      branchMemberships,
    );

    // ??젣 沅뚰븳 ?뺤씤
    this.checkModificationPermission(role, 'delete products', userId);

    const sb = this.supabase.adminClient();

    const { error } = await sb.from('products').delete().eq('id', productId);

    if (error) {
      this.logger.error(`Failed to delete product ${productId}`, error);
      throw new Error('Failed to delete product');
    }

    this.logger.log(`Product ${productId} deleted successfully`);

    return { deleted: true };
  }

  /**
   * ?곹뭹 ?쇨큵 ?곹깭 蹂寃?(OWNER, ADMIN留?媛??
   */
  async bulkUpdateProductStatus(
    userId: string,
    branchId: string,
    productIds: string[],
    isActive: boolean,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(
      `Bulk updating ${productIds.length} products status for branch ${branchId} by user ${userId}`,
    );

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
    this.checkModificationPermission(
      role,
      'bulk update product status',
      userId,
    );

    const sb = this.supabase.adminClient();

    const { data, error } = await sb
      .from('products')
      .update({ is_hidden: !isActive })
      .eq('branch_id', branchId)
      .in('id', productIds)
      .select();

    if (error) {
      this.logger.error(`Failed to bulk update product status`, error);
      throw new Error('Failed to bulk update product status');
    }

    this.logger.log(`Bulk updated ${data?.length || 0} products status`);

    return { updated: data?.length || 0, products: data || [] };
  }

  /**
   * 移댄뀒怨좊━ ?쇨큵 ?쒖꽦??鍮꾪솢?깊솕 (OWNER, ADMIN留?媛??
   */
  async bulkUpdateCategoryStatus(
    userId: string,
    branchId: string,
    categoryIds: string[],
    isActive: boolean,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(
      `Bulk updating ${categoryIds.length} categories status for branch ${branchId} by user ${userId}`,
    );

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
    this.checkModificationPermission(
      role,
      'bulk update category status',
      userId,
    );

    const sb = this.supabase.adminClient();

    const { data, error } = await sb
      .from('product_categories')
      .update({ is_active: isActive })
      .eq('branch_id', branchId)
      .in('id', categoryIds)
      .select();

    if (error) {
      this.logger.error(`Failed to bulk update category status`, error);
      throw new Error('Failed to bulk update category status');
    }

    this.logger.log(`Bulk updated ${data?.length || 0} categories status`);

    return {
      updated: data?.length || 0,
      categories: (data || []).map((row: any) => ({
        id: row.id,
        branchId: row.branch_id,
        name: row.name,
        sortOrder: row.sort_order ?? 0,
        isActive: row.is_active ?? true,
        createdAt: row.created_at ?? '',
      })),
    };
  }

  /**
   * ?곹뭹 ?뺣젹 ?쒖꽌 ?쇨큵 蹂寃?(OWNER, ADMIN留?媛??
   */
  async reorderProducts(
    userId: string,
    branchId: string,
    items: { id: string; sortOrder: number }[],
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(
      `Reordering ${items.length} products for branch ${branchId} by user ${userId}`,
    );

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
    this.checkModificationPermission(role, 'reorder products', userId);

    const sb = this.supabase.adminClient();

    for (const item of items) {
      const { error } = await sb
        .from('products')
        .update({ sort_order: item.sortOrder })
        .eq('id', item.id)
        .eq('branch_id', branchId);

      if (error) {
        this.logger.error(
          `Failed to update sort_order for product ${item.id}`,
          error,
        );
      }
    }

    this.logger.log(`Products reordered successfully for branch ${branchId}`);

    return this.getMyProducts(
      userId,
      branchId,
      brandMemberships,
      branchMemberships,
    );
  }

  /**
   * 移댄뀒怨좊━ ?앹꽦 (OWNER, ADMIN留?媛??
   */
  async createCategory(
    userId: string,
    branchId: string,
    name: string,
    sortOrder: number | undefined,
    isActive: boolean | undefined,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(
      `Creating category for branch ${branchId} by user ${userId}`,
    );

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
    this.checkModificationPermission(role, 'create categories', userId);

    const sb = this.supabase.adminClient();

    const { data, error } = await sb
      .from('product_categories')
      .insert({
        branch_id: branchId,
        name,
        sort_order: sortOrder ?? 0,
        is_active: isActive ?? true,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Failed to create category for branch ${branchId}`,
        error,
      );
      throw new Error(`Failed to create category: ${error.message}`);
    }

    return {
      id: data.id,
      branchId: data.branch_id,
      name: data.name,
      sortOrder: data.sort_order ?? 0,
      isActive: data.is_active ?? true,
      createdAt: data.created_at ?? '',
    };
  }

  /**
   * 移댄뀒怨좊━ ?쇨큵 ?앹꽦 (?좏깮??留ㅼ옣?ㅼ뿉 ?숈씪 移댄뀒怨좊━ ?앹꽦)
   */
  async bulkCreateCategories(
    userId: string,
    dto: {
      branchIds: string[];
      name: string;
      sortOrder?: number;
      isActive?: boolean;
    },
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    const branchIds = [...new Set(dto.branchIds)];
    if (branchIds.length === 0) {
      throw new BadRequestException('branchIds is required');
    }

    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }

    this.logger.log(
      `Bulk creating category "${name}" for ${branchIds.length} branches by user ${userId}`,
    );

    for (const branchId of branchIds) {
      const { branchMembership, brandMembership } =
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
      this.checkModificationPermission(role, 'create categories', userId);
    }

    const sb = this.supabase.adminClient();
    const { data: existingRows, error: existingError } = await sb
      .from('product_categories')
      .select('id, branch_id, name, sort_order')
      .in('branch_id', branchIds);

    if (existingError) {
      this.logger.error(
        'Failed to fetch existing categories for bulk create',
        existingError,
      );
      throw new Error('Failed to create categories');
    }

    const normalizedName = name.toLowerCase();
    const existingNameByBranch = new Map<string, Set<string>>();
    const maxSortByBranch = new Map<string, number>();

    for (const row of existingRows ?? []) {
      const branchId = row.branch_id as string;
      const rowName = String(row.name ?? '')
        .trim()
        .toLowerCase();
      const names = existingNameByBranch.get(branchId) ?? new Set<string>();
      if (rowName) {
        names.add(rowName);
      }
      existingNameByBranch.set(branchId, names);

      const currentMax = maxSortByBranch.get(branchId) ?? -1;
      const rowSort = Number(row.sort_order ?? 0);
      if (rowSort > currentMax) {
        maxSortByBranch.set(branchId, rowSort);
      }
    }

    const insertRows: Array<{
      branch_id: string;
      name: string;
      sort_order: number;
      is_active: boolean;
    }> = [];
    const skippedBranchIds: string[] = [];

    for (const branchId of branchIds) {
      const names = existingNameByBranch.get(branchId);
      if (names?.has(normalizedName)) {
        skippedBranchIds.push(branchId);
        continue;
      }

      const sortOrder =
        dto.sortOrder !== undefined
          ? dto.sortOrder
          : (maxSortByBranch.get(branchId) ?? -1) + 1;
      maxSortByBranch.set(branchId, sortOrder);

      insertRows.push({
        branch_id: branchId,
        name,
        sort_order: sortOrder,
        is_active: dto.isActive ?? true,
      });
    }

    if (insertRows.length === 0) {
      return {
        created: 0,
        skipped: skippedBranchIds.length,
        skippedBranchIds,
        categories: [],
      };
    }

    const { data, error } = await sb
      .from('product_categories')
      .insert(insertRows)
      .select('*');

    if (error) {
      this.logger.error('Failed to bulk create categories', error);
      throw new Error('Failed to create categories');
    }

    const categories = (data ?? []).map((row: any) => ({
      id: row.id,
      branchId: row.branch_id,
      name: row.name,
      sortOrder: row.sort_order ?? 0,
      isActive: row.is_active ?? true,
      createdAt: row.created_at ?? '',
    }));

    return {
      created: categories.length,
      skipped: skippedBranchIds.length,
      skippedBranchIds,
      categories,
    };
  }

  /**
   * 移댄뀒怨좊━ ?섏젙 (OWNER, ADMIN留?媛??
   */
  async updateCategory(
    userId: string,
    categoryId: string,
    dto: { name?: string; sortOrder?: number; isActive?: boolean },
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(`Updating category ${categoryId} by user ${userId}`);

    const sb = this.supabase.adminClient();

    // 移댄뀒怨좊━ 議고쉶?섏뿬 branch_id ?뺤씤
    const { data: category, error: catError } = await sb
      .from('product_categories')
      .select('*')
      .eq('id', categoryId)
      .single();

    if (catError || !category) {
      throw new NotFoundException('Category not found');
    }

    const { branchMembership, brandMembership } = await this.checkBranchAccess(
      category.branch_id,
      userId,
      brandMemberships,
      branchMemberships,
    );

    const role = branchMembership?.role || brandMembership?.role;
    if (!role) {
      throw new ForbiddenException('You do not have access to this branch');
    }
    this.checkModificationPermission(role, 'update categories', userId);

    const updateFields: any = {};
    if (dto.name !== undefined) updateFields.name = dto.name;
    if (dto.sortOrder !== undefined) updateFields.sort_order = dto.sortOrder;
    if (dto.isActive !== undefined) updateFields.is_active = dto.isActive;

    if (Object.keys(updateFields).length === 0) {
      return {
        id: category.id,
        branchId: category.branch_id,
        name: category.name,
        sortOrder: category.sort_order ?? 0,
        isActive: category.is_active ?? true,
        createdAt: category.created_at ?? '',
      };
    }

    const { data, error } = await sb
      .from('product_categories')
      .update(updateFields)
      .eq('id', categoryId)
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`Failed to update category ${categoryId}`, error);
      throw new Error('Failed to update category');
    }

    return {
      id: data.id,
      branchId: data.branch_id,
      name: data.name,
      sortOrder: data.sort_order ?? 0,
      isActive: data.is_active ?? true,
      createdAt: data.created_at ?? '',
    };
  }

  /**
   * 移댄뀒怨좊━ ??젣 (OWNER, ADMIN留?媛??
   */
  async deleteCategory(
    userId: string,
    categoryId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(`Deleting category ${categoryId} by user ${userId}`);

    const sb = this.supabase.adminClient();

    const { data: category, error: catError } = await sb
      .from('product_categories')
      .select('*')
      .eq('id', categoryId)
      .single();

    if (catError || !category) {
      throw new NotFoundException('Category not found');
    }

    const { branchMembership, brandMembership } = await this.checkBranchAccess(
      category.branch_id,
      userId,
      brandMemberships,
      branchMemberships,
    );

    const role = branchMembership?.role || brandMembership?.role;
    if (!role) {
      throw new ForbiddenException('You do not have access to this branch');
    }
    this.checkModificationPermission(role, 'delete categories', userId);

    const { error } = await sb
      .from('product_categories')
      .delete()
      .eq('id', categoryId);

    if (error) {
      this.logger.error(`Failed to delete category ${categoryId}`, error);
      throw new Error('Failed to delete category');
    }

    return { deleted: true };
  }

  /**
   * 移댄뀒怨좊━ ?뺣젹 ?쒖꽌 ?쇨큵 蹂寃?(OWNER, ADMIN留?媛??
   */
  async reorderCategories(
    userId: string,
    branchId: string,
    items: { id: string; sortOrder: number }[],
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(
      `Reordering ${items.length} categories for branch ${branchId} by user ${userId}`,
    );

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
    this.checkModificationPermission(role, 'reorder categories', userId);

    const sb = this.supabase.adminClient();

    for (const item of items) {
      const { error } = await sb
        .from('product_categories')
        .update({ sort_order: item.sortOrder })
        .eq('id', item.id)
        .eq('branch_id', branchId);

      if (error) {
        this.logger.error(
          `Failed to update sort_order for category ${item.id}`,
          error,
        );
      }
    }

    return this.getMyCategories(
      userId,
      branchId,
      brandMemberships,
      branchMemberships,
    );
  }

  async getBrandProductTemplates(
    userId: string,
    brandId: string,
    branchId: string | undefined,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    await this.checkBrandAccess(
      brandId,
      userId,
      brandMemberships,
      branchMemberships,
      branchId,
    );

    const sb = this.supabase.adminClient();
    const brandBranches = await this.getBrandBranches(brandId);
    const brandBranchIds = brandBranches.map((branch: any) => branch.id);
    if (branchId && !brandBranchIds.includes(branchId)) {
      throw new ForbiddenException('Branch does not belong to this brand');
    }

    const { data, error } = await sb
      .from('brand_products')
      .select('*')
      .eq('brand_id', brandId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error(
        `Failed to fetch brand templates for brand ${brandId}`,
        error,
      );
      throw new Error('Failed to fetch brand templates');
    }

    const templates = data ?? [];
    if (templates.length === 0) {
      return [];
    }

    if (brandBranchIds.length === 0) {
      return templates.map((row: any) =>
        this.mapBrandTemplate(row, {
          linkedProduct: undefined,
          appliedBranchIds: [],
          totalBranchCount: 0,
        }),
      );
    }

    const templateIds = templates.map((row: any) => row.id);
    const { data: linkedProducts, error: linkedError } = await sb
      .from('products')
      .select(
        'id, branch_id, brand_product_id, is_hidden, base_price, category_id',
      )
      .in('brand_product_id', templateIds)
      .in('branch_id', brandBranchIds);

    if (linkedError) {
      this.logger.error(
        `Failed to fetch linked branch products for brand ${brandId}`,
        linkedError,
      );
      throw new Error('Failed to fetch linked branch products');
    }

    const linkedByTemplate = new Map<string, any[]>();
    for (const row of linkedProducts ?? []) {
      if (!row?.brand_product_id) continue;
      const rows = linkedByTemplate.get(row.brand_product_id) ?? [];
      rows.push(row);
      linkedByTemplate.set(row.brand_product_id, rows);
    }

    const linkedProductIds = [
      ...new Set(
        (linkedProducts ?? []).map((row: any) => row.id).filter(Boolean),
      ),
    ];
    let trackedProductIds = new Set<string>();
    if (linkedProductIds.length > 0) {
      const { data: inventoryRows, error: inventoryError } = await sb
        .from('product_inventory')
        .select('product_id')
        .in('product_id', linkedProductIds);

      if (inventoryError) {
        this.logger.error(
          `Failed to fetch inventory mode for brand ${brandId}`,
          inventoryError,
        );
        throw new Error('Failed to fetch brand templates');
      }

      trackedProductIds = new Set(
        (inventoryRows ?? [])
          .map((row: any) => String(row.product_id ?? ''))
          .filter(Boolean),
      );
    }

    return templates.map((row: any) => {
      const linkedRows = linkedByTemplate.get(row.id) ?? [];
      const visibleRows = linkedRows.filter(
        (linked) => linked.is_hidden !== true,
      );
      const appliedBranchIds = visibleRows.map((linked) => linked.branch_id);
      const appliedBranchCategoryIds = Object.fromEntries(
        visibleRows.map((linked) => [
          linked.branch_id,
          linked.category_id ?? null,
        ]),
      );
      const linkedProduct = branchId
        ? linkedRows.find((linked) => linked.branch_id === branchId)
        : undefined;
      const trackedCount = visibleRows.filter((linked) =>
        trackedProductIds.has(linked.id),
      ).length;
      let inventoryMode: 'PRODUCT' | 'NONE' | 'MIXED' = 'PRODUCT';
      if (visibleRows.length > 0) {
        if (trackedCount === 0) {
          inventoryMode = 'NONE';
        } else if (trackedCount < visibleRows.length) {
          inventoryMode = 'MIXED';
        }
      }

      return this.mapBrandTemplate(row, {
        linkedProduct,
        appliedBranchIds,
        appliedBranchCategoryIds,
        totalBranchCount: brandBranchIds.length,
        inventoryMode,
      });
    });
  }

  async getBrandProductTemplateUrgentDiscountHistories(
    userId: string,
    templateId: string,
    limit: number,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    const sb = this.supabase.adminClient();
    const { data: template, error: templateError } = await sb
      .from('brand_products')
      .select('id, brand_id')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      throw new NotFoundException('Brand template not found');
    }

    const { role } = await this.checkBrandAccess(
      template.brand_id,
      userId,
      brandMemberships,
      branchMemberships,
    );

    if (!this.canManageBrandTemplates(role)) {
      throw new ForbiddenException(
        'Only OWNER/ADMIN can manage brand template history',
      );
    }

    const safeLimit = Math.min(Math.max(limit || 20, 1), 100);
    const { data, error } = await sb
      .from('brand_product_urgent_discount_histories')
      .select(
        'id, discount_price, discount_start_at, discount_end_at, recorded_reason, created_at',
      )
      .eq('brand_product_id', templateId)
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    if (error) {
      if (this.isMissingUrgentDiscountHistoryTableError(error)) {
        return [];
      }
      this.logger.error(
        `Failed to fetch urgent discount histories for template ${templateId}`,
        error,
      );
      throw new Error('Failed to fetch urgent discount histories');
    }

    return (data ?? []).map((row: any) => ({
      id: row.id,
      discountPrice:
        typeof row.discount_price === 'number' ? row.discount_price : null,
      discountStartAt: this.parseDateTimeOrNull(row.discount_start_at),
      discountEndAt: this.parseDateTimeOrNull(row.discount_end_at),
      recordedReason:
        typeof row.recorded_reason === 'string' ? row.recorded_reason : null,
      createdAt: this.parseDateTimeOrNull(row.created_at),
    }));
  }

  async createBrandProductTemplate(
    userId: string,
    dto: {
      brandId: string;
      name: string;
      description?: string;
      price: number;
      imageUrl?: string;
      imageUrls?: string[];
      urgentDiscountPrice?: number | null;
      urgentDiscountStartAt?: string | null;
      urgentDiscountEndAt?: string | null;
      sortOrder?: number;
      isActive?: boolean;
      isOnlineShopVisible?: boolean;
      inventoryMode?: 'PRODUCT' | 'NONE';
      branchIds?: string[];
      branchCategoryAssignments?: Array<{
        branchId: string;
        categoryId?: string | null;
      }>;
    },
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    const { role } = await this.checkBrandAccess(
      dto.brandId,
      userId,
      brandMemberships,
      branchMemberships,
    );

    if (!this.canManageBrandTemplates(role)) {
      throw new ForbiddenException(
        'Only OWNER/ADMIN can manage brand templates',
      );
    }

    const normalizedImageUrls = this.normalizeTemplateImageUrls(
      dto.imageUrl,
      dto.imageUrls,
    );
    const urgentDiscountFields = this.buildUrgentDiscountFields(dto.price, {
      urgentDiscountPrice: dto.urgentDiscountPrice,
      urgentDiscountStartAt: dto.urgentDiscountStartAt,
      urgentDiscountEndAt: dto.urgentDiscountEndAt,
    });
    const insertFields: Record<string, any> = {
      brand_id: dto.brandId,
      name: dto.name,
      description: dto.description ?? null,
      base_price: dto.price,
      image_url: this.serializeTemplateImageUrls(normalizedImageUrls),
      sort_order: dto.sortOrder ?? 0,
      is_active: dto.isActive ?? true,
      is_online_shop_visible: dto.isOnlineShopVisible ?? true,
    };
    if (urgentDiscountFields) {
      Object.assign(insertFields, urgentDiscountFields);
    }

    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('brand_products')
      .insert(insertFields)
      .select('*')
      .single();

    if (error || !data) {
      if (this.isMissingUrgentDiscountColumnError(error)) {
        throw new BadRequestException(
          '긴급할인 기능을 사용하려면 상품 테이블에 할인 컬럼이 필요합니다.',
        );
      }
      this.logger.error(
        `Failed to create brand template for brand ${dto.brandId}`,
        error,
      );
      throw new Error('Failed to create brand template');
    }

    await this.appendUrgentDiscountHistory(
      data.id,
      data.brand_id,
      this.getUrgentDiscountSnapshot(data),
      userId,
      'SET',
    );

    await this.syncTemplateBranchAssignments(data, dto.branchIds, {
      useAllOnMissing: true,
      syncFields: false,
      inventoryMode:
        this.normalizeInventoryMode(dto.inventoryMode) ?? 'PRODUCT',
      branchCategoryAssignments: dto.branchCategoryAssignments,
    });
    if (data.is_active === false) {
      await this.hideTemplateFromAllBranches(data.id);
    }

    const [mapped] = await this.getBrandProductTemplates(
      userId,
      dto.brandId,
      undefined,
      brandMemberships,
      branchMemberships,
    ).then((items) => items.filter((item) => item.id === data.id));

    return mapped ?? this.mapBrandTemplate(data);
  }

  async updateBrandProductTemplate(
    userId: string,
    templateId: string,
    dto: {
      name?: string;
      description?: string;
      price?: number;
      imageUrl?: string;
      imageUrls?: string[];
      urgentDiscountPrice?: number | null;
      urgentDiscountStartAt?: string | null;
      urgentDiscountEndAt?: string | null;
      sortOrder?: number;
      isActive?: boolean;
      isOnlineShopVisible?: boolean;
      inventoryMode?: 'PRODUCT' | 'NONE';
      branchIds?: string[];
      branchCategoryAssignments?: Array<{
        branchId: string;
        categoryId?: string | null;
      }>;
    },
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    const sb = this.supabase.adminClient();
    const { data: template, error: templateError } = await sb
      .from('brand_products')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      throw new NotFoundException('Brand template not found');
    }

    const { role } = await this.checkBrandAccess(
      template.brand_id,
      userId,
      brandMemberships,
      branchMemberships,
    );

    if (!this.canManageBrandTemplates(role)) {
      throw new ForbiddenException(
        'Only OWNER/ADMIN can manage brand templates',
      );
    }

    const previousUrgentSnapshot = this.getUrgentDiscountSnapshot(template);

    const updateFields: any = {};
    if (dto.name !== undefined) updateFields.name = dto.name;
    if (dto.description !== undefined)
      updateFields.description = dto.description;
    if (dto.price !== undefined) updateFields.base_price = dto.price;
    if (dto.imageUrl !== undefined || dto.imageUrls !== undefined) {
      const normalizedImageUrls = this.normalizeTemplateImageUrls(
        dto.imageUrl,
        dto.imageUrls,
      );
      updateFields.image_url =
        this.serializeTemplateImageUrls(normalizedImageUrls);
    }
    if (dto.sortOrder !== undefined) updateFields.sort_order = dto.sortOrder;
    if (dto.isActive !== undefined) updateFields.is_active = dto.isActive;
    if (dto.isOnlineShopVisible !== undefined) {
      updateFields.is_online_shop_visible = dto.isOnlineShopVisible;
    }
    const basePriceForDiscount =
      dto.price !== undefined ? dto.price : Number(template.base_price ?? 0);
    const urgentDiscountFields = this.buildUrgentDiscountFields(
      basePriceForDiscount,
      {
        urgentDiscountPrice: dto.urgentDiscountPrice,
        urgentDiscountStartAt: dto.urgentDiscountStartAt,
        urgentDiscountEndAt: dto.urgentDiscountEndAt,
      },
    );
    if (urgentDiscountFields) {
      Object.assign(updateFields, urgentDiscountFields);
    }

    let latestTemplate = template;

    if (Object.keys(updateFields).length > 0) {
      const { data, error } = await sb
        .from('brand_products')
        .update(updateFields)
        .eq('id', templateId)
        .select('*')
        .single();

      if (error || !data) {
        if (this.isMissingUrgentDiscountColumnError(error)) {
          throw new BadRequestException(
            '긴급할인 기능을 사용하려면 상품 테이블에 할인 컬럼이 필요합니다.',
          );
        }
        this.logger.error(
          `Failed to update brand template ${templateId}`,
          error,
        );
        throw new Error('Failed to update brand template');
      }

      latestTemplate = data;
      await this.syncTemplateFieldsToLinkedProducts(latestTemplate);
    }

    const latestUrgentSnapshot = this.getUrgentDiscountSnapshot(latestTemplate);
    if (
      !this.isSameUrgentDiscountSnapshot(
        previousUrgentSnapshot,
        latestUrgentSnapshot,
      )
    ) {
      if (previousUrgentSnapshot.price !== null) {
        await this.appendUrgentDiscountHistory(
          latestTemplate.id,
          latestTemplate.brand_id,
          previousUrgentSnapshot,
          userId,
          latestUrgentSnapshot.price === null ? 'CLEARED' : 'REPLACED',
        );
      }
      if (latestUrgentSnapshot.price !== null) {
        await this.appendUrgentDiscountHistory(
          latestTemplate.id,
          latestTemplate.brand_id,
          latestUrgentSnapshot,
          userId,
          previousUrgentSnapshot.price === null ? 'SET' : 'UPDATED',
        );
      }
    }

    if (latestTemplate.is_active === false) {
      await this.hideTemplateFromAllBranches(latestTemplate.id);
      const inventoryMode = this.normalizeInventoryMode(dto.inventoryMode);
      if (inventoryMode !== undefined) {
        const { data: linkedRows, error: linkedError } = await sb
          .from('products')
          .select('id, branch_id')
          .eq('brand_product_id', latestTemplate.id);

        if (linkedError) {
          this.logger.error(
            `Failed to fetch linked products for template ${latestTemplate.id}`,
            linkedError,
          );
          throw new Error('Failed to update brand template');
        }

        await this.syncInventoryTrackingForProducts(
          linkedRows ?? [],
          inventoryMode,
        );
      }
    } else {
      await this.syncTemplateBranchAssignments(latestTemplate, dto.branchIds, {
        useAllOnMissing: false,
        syncFields: true,
        inventoryMode: this.normalizeInventoryMode(dto.inventoryMode),
        branchCategoryAssignments: dto.branchCategoryAssignments,
      });
    }

    const [mapped] = await this.getBrandProductTemplates(
      userId,
      latestTemplate.brand_id,
      undefined,
      brandMemberships,
      branchMemberships,
    ).then((items) => items.filter((item) => item.id === latestTemplate.id));

    return mapped ?? this.mapBrandTemplate(latestTemplate);
  }

  async bulkUpdateBrandProductTemplates(
    userId: string,
    dto: {
      brandId: string;
      templateIds: string[];
      branchIds?: string[];
      isActive?: boolean;
      isOnlineShopVisible?: boolean;
      inventoryMode?: 'PRODUCT' | 'NONE';
    },
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    if (dto.templateIds.length === 0) {
      throw new BadRequestException('templateIds is required');
    }
    if (
      dto.branchIds === undefined &&
      dto.isActive === undefined &&
      dto.isOnlineShopVisible === undefined &&
      dto.inventoryMode === undefined
    ) {
      throw new BadRequestException(
        'isActive, isOnlineShopVisible, branchIds, or inventoryMode is required',
      );
    }

    const { role } = await this.checkBrandAccess(
      dto.brandId,
      userId,
      brandMemberships,
      branchMemberships,
    );
    if (!this.canManageBrandTemplates(role)) {
      throw new ForbiddenException(
        'Only OWNER/ADMIN can manage brand templates',
      );
    }

    const templateIds = [...new Set(dto.templateIds)];
    const sb = this.supabase.adminClient();
    const { data: templates, error: templateError } = await sb
      .from('brand_products')
      .select('*')
      .eq('brand_id', dto.brandId)
      .in('id', templateIds);

    if (templateError) {
      this.logger.error(
        `Failed to fetch brand templates for bulk update in brand ${dto.brandId}`,
        templateError,
      );
      throw new Error('Failed to bulk update brand templates');
    }

    const foundTemplates = templates ?? [];
    const foundIds = new Set(
      foundTemplates.map((template: any) => template.id),
    );
    const missingIds = templateIds.filter(
      (templateId) => !foundIds.has(templateId),
    );
    if (missingIds.length > 0) {
      throw new BadRequestException(
        `Some templateIds do not belong to this brand: ${missingIds.join(', ')}`,
      );
    }

    const templateUpdateFields: Record<string, unknown> = {};
    if (dto.isActive !== undefined) {
      templateUpdateFields.is_active = dto.isActive;
    }
    if (dto.isOnlineShopVisible !== undefined) {
      templateUpdateFields.is_online_shop_visible = dto.isOnlineShopVisible;
    }

    if (Object.keys(templateUpdateFields).length > 0) {
      const { error: statusError } = await sb
        .from('brand_products')
        .update(templateUpdateFields)
        .eq('brand_id', dto.brandId)
        .in('id', templateIds);

      if (statusError) {
        this.logger.error(
          `Failed to bulk update template status in brand ${dto.brandId}`,
          statusError,
        );
        throw new Error('Failed to bulk update brand templates');
      }

      for (const template of foundTemplates) {
        if (dto.isActive !== undefined) {
          template.is_active = dto.isActive;
        }
        if (dto.isOnlineShopVisible !== undefined) {
          template.is_online_shop_visible = dto.isOnlineShopVisible;
        }
      }
    }

    for (const template of foundTemplates) {
      if (template.is_active === false) {
        await this.hideTemplateFromAllBranches(template.id);
        if (dto.inventoryMode !== undefined) {
          const { data: linkedRows, error: linkedError } = await sb
            .from('products')
            .select('id, branch_id')
            .eq('brand_product_id', template.id);

          if (linkedError) {
            this.logger.error(
              `Failed to fetch linked products for template ${template.id}`,
              linkedError,
            );
            throw new Error('Failed to bulk update brand templates');
          }

          await this.syncInventoryTrackingForProducts(
            linkedRows ?? [],
            this.normalizeInventoryMode(dto.inventoryMode),
          );
        }
        continue;
      }

      await this.syncTemplateBranchAssignments(template, dto.branchIds, {
        useAllOnMissing: false,
        syncFields: true,
        inventoryMode: this.normalizeInventoryMode(dto.inventoryMode),
      });
    }

    const latestTemplates = await this.getBrandProductTemplates(
      userId,
      dto.brandId,
      undefined,
      brandMemberships,
      branchMemberships,
    );

    return {
      updatedCount: templateIds.length,
      templates: latestTemplates.filter((item) =>
        templateIds.includes(item.id),
      ),
    };
  }

  async deleteBrandProductTemplate(
    userId: string,
    templateId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    const sb = this.supabase.adminClient();
    const { data: template, error: templateError } = await sb
      .from('brand_products')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      throw new NotFoundException('Brand template not found');
    }

    const { role } = await this.checkBrandAccess(
      template.brand_id,
      userId,
      brandMemberships,
      branchMemberships,
    );

    if (!this.canManageBrandTemplates(role)) {
      throw new ForbiddenException(
        'Only OWNER/ADMIN can manage brand templates',
      );
    }

    const { error } = await sb
      .from('brand_products')
      .update({ is_active: false })
      .eq('id', templateId);

    if (error) {
      this.logger.error(`Failed to delete brand template ${templateId}`, error);
      throw new Error('Failed to delete brand template');
    }

    await this.hideTemplateFromAllBranches(templateId);

    return { deleted: true };
  }

  async applyBrandTemplateToBranch(
    userId: string,
    templateId: string,
    branchId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    const branchAccess = await this.checkBranchAccess(
      branchId,
      userId,
      brandMemberships,
      branchMemberships,
    );
    const role =
      branchAccess.branchMembership?.role ?? branchAccess.brandMembership?.role;

    if (!role) {
      throw new ForbiddenException('You do not have access to this branch');
    }

    this.checkModificationPermission(
      role,
      'apply brand templates to branch products',
      userId,
    );

    const sb = this.supabase.adminClient();
    const { data: template, error: templateError } = await sb
      .from('brand_products')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      throw new NotFoundException('Brand template not found');
    }

    if (template.brand_id !== branchAccess.branch.brand_id) {
      throw new ForbiddenException('Template and branch brand mismatch');
    }

    if (template.is_active === false) {
      throw new ForbiddenException('Inactive template cannot be applied');
    }
    const inventoryMode = await this.getTemplateInventoryMode(templateId);

    const { data: existing, error: existingError } = await sb
      .from('products')
      .select('*')
      .eq('branch_id', branchId)
      .eq('brand_product_id', templateId)
      .maybeSingle();

    if (existingError) {
      this.logger.error(
        `Failed to check existing linked product for template ${templateId}`,
        existingError,
      );
      throw new Error('Failed to apply brand template');
    }

    if (existing) {
      const { data: updated, error: updateError } = await sb
        .from('products')
        .update({ is_hidden: false })
        .eq('id', existing.id)
        .select('*')
        .single();

      if (updateError || !updated) {
        this.logger.error(
          `Failed to reactivate linked product ${existing.id}`,
          updateError,
        );
        throw new Error('Failed to apply brand template');
      }

      await this.syncInventoryTrackingForProducts(
        [{ id: updated.id, branch_id: updated.branch_id }],
        inventoryMode,
      );

      return updated;
    }

    const { data: created, error: createError } = await sb
      .from('products')
      .insert({
        branch_id: branchId,
        brand_product_id: templateId,
        name: template.name,
        description: template.description ?? null,
        base_price: template.base_price ?? 0,
        image_url: this.getPrimaryTemplateImageUrl(template.image_url),
        is_hidden: false,
        sort_order: template.sort_order ?? 0,
        urgent_discount_price: template.urgent_discount_price ?? null,
        urgent_discount_start_at: template.urgent_discount_start_at ?? null,
        urgent_discount_end_at: template.urgent_discount_end_at ?? null,
      })
      .select('*')
      .single();

    if (createError || !created) {
      this.logger.error(
        `Failed to create linked product for template ${templateId}`,
        createError,
      );
      throw new Error('Failed to apply brand template');
    }

    await this.syncInventoryTrackingForProducts(
      [{ id: created.id, branch_id: created.branch_id }],
      inventoryMode,
    );

    return created;
  }

  async unapplyBrandTemplateFromBranch(
    userId: string,
    templateId: string,
    branchId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    const branchAccess = await this.checkBranchAccess(
      branchId,
      userId,
      brandMemberships,
      branchMemberships,
    );
    const role =
      branchAccess.branchMembership?.role ?? branchAccess.brandMembership?.role;

    if (!role) {
      throw new ForbiddenException('You do not have access to this branch');
    }

    this.checkModificationPermission(
      role,
      'unapply brand templates from branch products',
      userId,
    );

    const sb = this.supabase.adminClient();
    const { data: template, error: templateError } = await sb
      .from('brand_products')
      .select('id, brand_id')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      throw new NotFoundException('Brand template not found');
    }

    if (template.brand_id !== branchAccess.branch.brand_id) {
      throw new ForbiddenException('Template and branch brand mismatch');
    }

    const { data, error } = await sb
      .from('products')
      .update({ is_hidden: true })
      .eq('branch_id', branchId)
      .eq('brand_product_id', templateId)
      .select('id');

    if (error) {
      this.logger.error(
        `Failed to unapply template ${templateId} from branch ${branchId}`,
        error,
      );
      throw new Error('Failed to unapply brand template');
    }

    return { updated: data?.length ?? 0 };
  }
}
