import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import {
  PublicBranchResponse,
  PublicProductResponse,
  PublicProductOptionResponse,
  PublicOrderResponse,
  CreatePublicOrderRequest,
} from './dto/public.dto';

@Injectable()
export class PublicService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * 가게 정보 조회 (퍼블릭)
   */
  async getBranch(branchId: string): Promise<PublicBranchResponse> {
    const sb = this.supabase.anonClient();

    const { data, error } = await sb
      .from('branches')
      .select(`
        id,
        name,
        brands (
          name
        )
      `)
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
   * 가게 상품 목록 조회 (퍼블릭)
   */
  async getProducts(branchId: string): Promise<PublicProductResponse[]> {
    const sb = this.supabase.anonClient();

    const { data, error } = await sb
      .from('products')
      .select(`
        id,
        name,
        description,
        price,
        product_options (
          id,
          name,
          price_delta,
          is_active
        )
      `)
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`[public.getProducts] ${error.message}`);
    }

    return (data ?? []).map((product: any) => ({
      id: product.id,
      name: product.name,
      description: product.description ?? null,
      price: product.price ?? 0,
      options: (product.product_options ?? [])
        .filter((opt: any) => opt.is_active)
        .map((opt: any) => ({
          id: opt.id,
          name: opt.name,
          priceDelta: opt.price_delta ?? 0,
        })),
    }));
  }

  /**
   * 주문 생성 (퍼블릭)
   */
  async createOrder(dto: CreatePublicOrderRequest): Promise<PublicOrderResponse> {
    const sb = this.supabase.anonClient();

    // 1. 상품 정보 조회 (가격 검증용)
    const productIds = dto.items.map((item) => item.productId);
    const { data: products, error: productsError } = await sb
      .from('products')
      .select(`
        id,
        name,
        price,
        branch_id,
        product_options (
          id,
          name,
          price_delta
        )
      `)
      .in('id', productIds);

    if (productsError) {
      throw new Error(`상품 조회 실패: ${productsError.message}`);
    }

    // 상품 맵 생성
    const productMap = new Map(products?.map((p: any) => [p.id, p]) ?? []);

    // 2. 브랜치 검증
    for (const product of products ?? []) {
      if (product.branch_id !== dto.branchId) {
        throw new BadRequestException('다른 가게의 상품이 포함되어 있습니다.');
      }
    }

    // 3. 주문 금액 계산
    let subtotalAmount = 0;
    const orderItemsData: any[] = [];

    for (const item of dto.items) {
      const product = productMap.get(item.productId) as any;
      if (!product) {
        throw new BadRequestException(`상품을 찾을 수 없습니다: ${item.productId}`);
      }

      let itemPrice = product.price;
      const optionSnapshots: any[] = [];

      // 옵션 가격 계산
      if (item.options && item.options.length > 0) {
        const optionMap = new Map(
          (product.product_options ?? []).map((o: any) => [o.id, o])
        );

        for (const opt of item.options) {
          const optionData = optionMap.get(opt.optionId) as any;
          if (optionData) {
            itemPrice += optionData.price_delta ?? 0;
            optionSnapshots.push({
              product_option_id: optionData.id,
              option_name_snapshot: optionData.name,
              price_delta_snapshot: optionData.price_delta ?? 0,
            });
          }
        }
      }

      subtotalAmount += itemPrice * item.qty;

      orderItemsData.push({
        product_id: product.id,
        product_name_snapshot: product.name,
        qty: item.qty,
        unit_price: itemPrice,
        options: optionSnapshots,
      });
    }

    const totalAmount = subtotalAmount; // 배송비, 할인 등은 추후 추가

    // 4. 주문 생성
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

    // 5. 주문 아이템 생성
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

      // 옵션 생성
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
   * 주문 조회 (퍼블릭 - 주문번호로)
   */
  async getOrder(orderId: string): Promise<PublicOrderResponse> {
    const sb = this.supabase.anonClient();

    // ID 또는 order_no로 조회
    let data: any = null;

    // 1) UUID로 시도
    const { data: byId } = await sb
      .from('orders')
      .select(`
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
      `)
      .eq('id', orderId)
      .maybeSingle();

    if (byId) {
      data = byId;
    } else {
      // 2) order_no로 시도
      const { data: byOrderNo } = await sb
        .from('orders')
        .select(`
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
        `)
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
