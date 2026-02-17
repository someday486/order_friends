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
import {
  PublicBranchResponse,
  PublicBrandBranchesResponse,
  PublicProductResponse,
  PublicOrderResponse,
  CreatePublicOrderRequest,
  FulfillmentType,
} from './dto/public-order.dto';
import {
  getBranchOrderConfig,
  normalizeFulfillmentTypes,
  normalizePaymentMethods,
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

  private getPriceFromRow(row: any): number {
    if (!row) return 0;
    if (row.base_price !== undefined && row.base_price !== null)
      return row.base_price;
    if (row.price !== undefined && row.price !== null) return row.price;
    if (row.price_amount !== undefined && row.price_amount !== null)
      return row.price_amount;
    return 0;
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
      channelByType: config.channelByType,
    };
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
      enabledFulfillmentTypes: orderConfig.enabledFulfillmentTypes,
      allowedPaymentMethods: orderConfig.allowedPaymentMethods,
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
      enabledFulfillmentTypes: orderConfig.enabledFulfillmentTypes,
      allowedPaymentMethods: orderConfig.allowedPaymentMethods,
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
      enabledFulfillmentTypes: orderConfig.enabledFulfillmentTypes,
      allowedPaymentMethods: orderConfig.allowedPaymentMethods,
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

    return products.map((product: any) => ({
      id: product.id,
      name: product.name,
      description: product.description ?? null,
      price: this.getPriceFromRow(product),
      imageUrl: product.image_url ?? null,
      categoryId: product.category_id ?? null,
      categoryName: categoryMap.get(product.category_id) ?? null,
      sortOrder: product.sort_order ?? 0,
      options: [],
    }));
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
      items,
    };
  }

  private async fetchOrderByIdempotencyKey(
    adminClient: any,
    branchId: string,
    idempotencyKey?: string,
  ): Promise<any> {
    if (!idempotencyKey) return null;

    const { data, error } = await this.runOrderSelectWithUnitPriceFallback(
      (unitPriceColumn) =>
        adminClient
          .from('orders')
          .select(
            `
        id,
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

    return data[0];
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

  private async findRecentDuplicateOrder(
    adminClient: any,
    dto: CreatePublicOrderRequest,
    totalAmount: number,
    signature: string,
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
      const candidateSignature = this.buildSignatureFromOrder(order);

      if (candidateSignature !== signature) {
        continue;
      }

      this.logger.warn(
        `Duplicate order detected for ${dto.branchId} within window: ${order.id}`,
      );

      return {
        order: this.buildOrderResponse(order),
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
    const paymentMethod = (dto.paymentMethod ?? 'CARD').toUpperCase();
    const branchOrderConfig = await this.getPublicBranchOrderConfig(
      dto.branchId,
    );
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
    if (!enabledFulfillmentTypes.includes(requestedFulfillmentType as any)) {
      throw new BadRequestException(
        '선택한 주문 방식은 현재 매장에서 지원하지 않습니다.',
      );
    }

    const fulfillmentType = requestedFulfillmentType as FulfillmentType;
    const channelId = branchOrderConfig.channelByType[fulfillmentType];

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
        return this.buildOrderResponse(existingOrder);
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

    if (orderError && this.isRowLevelSecurityError(orderError)) {
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
          return this.buildOrderResponse(existingOrder);
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

    return {
      id: createdOrder.id,
      orderNo: createdOrder.order_no ?? createdOrder.id,
      status: createdOrder.status,
      totalAmount: createdOrder.total_amount,
      createdAt: createdOrder.created_at,
      items: orderItemResults,
    };
  }

  /**
   * Get order (public)
   */
  async getOrder(orderIdOrNo: string): Promise<PublicOrderResponse> {
    const sb = this.supabase.anonClient();
    const adminSb = this.supabase.adminClient();

    const queryOrder = async (client: any) => {
      let { data, error } = await this.runOrderSelectWithUnitPriceFallback(
        (unitPriceColumn) =>
          client
            .from('orders')
            .select(
              `
        id,
        order_no,
        status,
        total_amount,
        created_at,
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
          order_no,
          status,
          total_amount,
          created_at,
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
    if (!data && this.isUuid(orderIdOrNo)) {
      const adminResult = await queryOrder(adminSb);
      if (adminResult.data || adminResult.error) {
        data = adminResult.data;
        error = adminResult.error;
      }
    }

    if (error || !data) {
      throw new NotFoundException('주문을 찾을 수 없습니다.');
    }

    return {
      id: data.id,
      orderNo: data.order_no ?? data.id,
      status: data.status,
      totalAmount: data.total_amount,
      createdAt: data.created_at,
      items: (data.order_items ?? []).map((item: any) => ({
        productName: item.product_name_snapshot,
        qty: item.qty,
        unitPrice: this.getOrderItemUnitPrice(item),
        options: (item.order_item_options ?? []).map(
          (o: any) => o.option_name_snapshot,
        ),
      })),
    };
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
