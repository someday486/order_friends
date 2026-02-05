import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { InventoryService } from '../inventory/inventory.service';
import {
  PublicBranchResponse,
  PublicProductResponse,
  PublicOrderResponse,
  CreatePublicOrderRequest,
} from './dto/public-order.dto';

@Injectable()
export class PublicOrderService {
  private readonly logger = new Logger(PublicOrderService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly inventoryService: InventoryService,
  ) {}

  private getPriceFromRow(row: any): number {
    if (!row) return 0;
    if (row.base_price !== undefined && row.base_price !== null)
      return row.base_price;
    if (row.price !== undefined && row.price !== null) return row.price;
    if (row.price_amount !== undefined && row.price_amount !== null)
      return row.price_amount;
    return 0;
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
        brands (
          name
        )
      `,
      )
      .eq('id', branchId)
      .single();

    if (error || !data) {
      throw new NotFoundException('사용할 수 없는 가게입니다.');
    }

    return {
      id: data.id,
      name: data.name,
      brandName: (data as any).brands?.name ?? undefined,
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
        brands (
          name
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
    return {
      id: row.id,
      name: row.name,
      brandName: row.brands?.name ?? undefined,
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
        brands!inner (
          id,
          name,
          slug
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
    return {
      id: row.id,
      name: row.name,
      brandName: row.brands?.name ?? undefined,
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

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const query = buildBaseQuery(includeIsHidden, includeIsSoldOut);
      const orderedQuery = query.order('created_at', { ascending: false });
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

      if (!retried) break;
    }

    if (error) {
      throw new Error(`상품 목록 조회 실패: ${error.message}`);
    }

    const products = data ?? [];

    return products.map((product: any) => ({
      id: product.id,
      name: product.name,
      description: product.description ?? null,
      price: this.getPriceFromRow(product),
      options: [],
    }));
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

    // ============================================================
    // STEP 1: Check inventory availability
    // ============================================================
    const { data: inventoryRecords, error: invError } = await adminClient
      .from('product_inventory')
      .select('product_id, qty_available, qty_reserved')
      .in('product_id', productIds)
      .eq('branch_id', dto.branchId);

    if (invError) {
      throw new BadRequestException(`재고 조회 실패: ${invError.message}`);
    }

    const inventoryMap = new Map(
      inventoryRecords?.map((inv: any) => [inv.product_id, inv]) ?? [],
    );

    // Check if all products have sufficient inventory
    for (const item of dto.items) {
      const inventory = inventoryMap.get(item.productId);
      if (!inventory) {
        throw new BadRequestException(
          `재고 정보를 찾을 수 없습니다: ${productMap.get(item.productId)?.name}`,
        );
      }
      if (inventory.qty_available < item.qty) {
        throw new BadRequestException(
          `재고가 부족합니다: ${productMap.get(item.productId)?.name} (재고: ${inventory.qty_available}개, 주문: ${item.qty}개)`,
        );
      }
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
      const product = productMap.get(item.productId) as any;
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

    const { data: order, error: orderError } = await sb
      .from('orders')
      .insert({
        branch_id: dto.branchId,
        customer_name: dto.customerName,
        customer_phone: dto.customerPhone ?? null,
        customer_address1: dto.customerAddress1 ?? null,
        customer_address2: dto.customerAddress2 ?? null,
        customer_memo: dto.customerMemo ?? null,
        payment_method: dto.paymentMethod ?? 'CARD',
        subtotal_amount: subtotalAmount,
        shipping_fee: 0,
        discount_amount: 0,
        total_amount: totalAmount,
        status: 'CREATED',
        payment_status: 'PENDING',
      })
      .select('id, order_no, status, total_amount, created_at')
      .single();

    if (orderError) {
      throw new BadRequestException(`주문 생성 실패: ${orderError.message}`);
    }

    const orderItemResults: {
      productName: string;
      qty: number;
      unitPrice: number;
      options: string[];
    }[] = [];

    for (const itemData of orderItemsData) {
      const { data: orderItem, error: itemError } = await sb
        .from('order_items')
        .insert({
          order_id: order.id,
          product_id: itemData.product_id,
          product_name_snapshot: itemData.product_name_snapshot,
          qty: itemData.qty,
          unit_price: itemData.unit_price,
        })
        .select('id')
        .single();

      if (itemError) {
        console.error('order_item insert error:', itemError);
        continue;
      }

      const optionNames: string[] = [];
      if (itemData.options && itemData.options.length > 0) {
        for (const opt of itemData.options) {
          const { error: optError } = await sb
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

    // ============================================================
    // STEP 2: Reserve inventory and create logs
    // ============================================================
    try {
      for (const item of dto.items) {
        const inventory = inventoryMap.get(item.productId);
        if (!inventory) continue;

        // Update inventory: decrease available, increase reserved
        const { error: updateError } = await adminClient
          .from('product_inventory')
          .update({
            qty_available: inventory.qty_available - item.qty,
            qty_reserved: inventory.qty_reserved + item.qty,
          })
          .eq('product_id', item.productId)
          .eq('branch_id', dto.branchId);

        if (updateError) {
          this.logger.error(
            `Failed to reserve inventory for product ${item.productId}`,
            updateError,
          );
          throw new BadRequestException(
            `재고 예약 실패: ${productMap.get(item.productId)?.name}`,
          );
        }

        // Create inventory log
        await adminClient.from('inventory_logs').insert({
          product_id: item.productId,
          branch_id: dto.branchId,
          transaction_type: 'RESERVE',
          qty_change: -item.qty,
          qty_before: inventory.qty_available,
          qty_after: inventory.qty_available - item.qty,
          reference_id: order.id,
          reference_type: 'ORDER',
          notes: `주문 생성으로 인한 재고 예약 (주문번호: ${order.order_no})`,
        });
      }
    } catch (error) {
      // If inventory reservation fails, we should ideally rollback the order
      // For now, just log the error and throw
      this.logger.error('Inventory reservation failed for order ' + order.id, error);
      throw new BadRequestException(
        '재고 처리 중 오류가 발생했습니다. 관리자에게 문의해주세요.',
      );
    }

    return {
      id: order.id,
      orderNo: order.order_no,
      status: order.status,
      totalAmount: order.total_amount,
      createdAt: order.created_at,
      items: orderItemResults,
    };
  }

  /**
   * Get order (public)
   */
  async getOrder(orderIdOrNo: string): Promise<PublicOrderResponse> {
    const sb = this.supabase.anonClient();

    let { data, error } = await sb
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
          unit_price,
          order_item_options (
            option_name_snapshot
          )
        )
      `,
      )
      .eq('id', orderIdOrNo)
      .maybeSingle();

    if (!data) {
      const result = await sb
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
            unit_price,
            order_item_options (
              option_name_snapshot
            )
          )
        `,
        )
        .eq('order_no', orderIdOrNo)
        .maybeSingle();

      data = result.data;
      error = result.error;
    }

    if (error || !data) {
      throw new NotFoundException('주문을 찾을 수 없습니다.');
    }

    return {
      id: data.id,
      orderNo: data.order_no,
      status: data.status,
      totalAmount: data.total_amount,
      createdAt: data.created_at,
      items: ((data as any).order_items ?? []).map((item: any) => ({
        productName: item.product_name_snapshot,
        qty: item.qty,
        unitPrice: item.unit_price,
        options: (item.order_item_options ?? []).map(
          (o: any) => o.option_name_snapshot,
        ),
      })),
    };
  }
}
