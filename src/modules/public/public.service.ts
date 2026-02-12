import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import {
  PublicBranchResponse,
  PublicProductResponse,
  PublicOrderResponse,
  CreatePublicOrderRequest,
} from './dto/public.dto';

@Injectable()
export class PublicService {
  constructor(private readonly supabase: SupabaseService) {}

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
      throw new NotFoundException('가게를 찾을 수 없습니다.');
    }

    return {
      id: data.id,
      name: data.name,
      brandName: (data.brands as any)?.name ?? undefined,
    };
  }

  /**
   * Get product list (public)
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
      throw new Error(`[public.getProducts] ${error.message}`);
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
   */
  async createOrder(
    dto: CreatePublicOrderRequest,
  ): Promise<PublicOrderResponse> {
    const sb = this.supabase.anonClient();

    // 1. Load products for validation
    const productIds = dto.items.map((item) => item.productId);
    const selectProductFields = '*';

    const { data: products, error: productsError } = await (sb as any)
      .from('products')
      .select(selectProductFields)
      .in('id', productIds);

    if (productsError) {
      throw new Error(`상품 조회 실패: ${productsError.message}`);
    }

    const productMap = new Map(products?.map((p: any) => [p.id, p]) ?? []);

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
    const orderItemsData: any[] = [];

    for (const item of dto.items) {
      const product = productMap.get(item.productId) as any;
      if (!product) {
        throw new BadRequestException(
          `상품을 찾을 수 없습니다: ${item.productId}`,
        );
      }

      const itemPrice = this.getPriceFromRow(product);
      const optionSnapshots: any[] = [];

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
      throw new Error(`주문 생성 실패: ${orderError.message}`);
    }

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

      if (itemData.options && itemData.options.length > 0) {
        for (const opt of itemData.options) {
          await sb.from('order_item_options').insert({
            order_item_id: orderItem.id,
            product_option_id: opt.product_option_id,
            option_name_snapshot: opt.option_name_snapshot,
            price_delta_snapshot: opt.price_delta_snapshot,
          });
        }
      }
    }

    return {
      id: order.id,
      orderNo: order.order_no,
      status: order.status,
      totalAmount: order.total_amount,
      createdAt: order.created_at,
      items: orderItemsData.map((item) => ({
        name: item.product_name_snapshot,
        qty: item.qty,
        unitPrice: item.unit_price,
      })),
    };
  }

  /**
   * Get order (public)
   */
  async getOrder(orderId: string): Promise<PublicOrderResponse> {
    const sb = this.supabase.anonClient();

    let data: any = null;

    const { data: byId } = await sb
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
          unit_price
        )
      `,
      )
      .eq('id', orderId)
      .maybeSingle();

    if (byId) {
      data = byId;
    } else {
      const { data: byOrderNo } = await sb
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
            unit_price
          )
        `,
        )
        .eq('order_no', orderId)
        .maybeSingle();

      data = byOrderNo;
    }

    if (!data) {
      throw new NotFoundException('주문을 찾을 수 없습니다.');
    }

    return {
      id: data.id,
      orderNo: data.order_no,
      status: data.status,
      totalAmount: data.total_amount,
      createdAt: data.created_at,
      items: (data.order_items ?? []).map((item: any) => ({
        name: item.product_name_snapshot,
        qty: item.qty,
        unitPrice: item.unit_price,
      })),
    };
  }
}
