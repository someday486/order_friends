import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { OrderStatus } from './order-status.enum';
import { OrderDetailResponse, OrderItemResponse } from './dto/order-detail.response';
import { OrderListItemResponse } from './dto/order-list.response';

@Injectable()
export class OrdersService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * 주문 목록
   */
  async getOrders(accessToken: string): Promise<OrderListItemResponse[]> {
    const sb = this.supabase.userClient(accessToken);

    // NOTE:
    // - 실제 컬럼명은 DB와 맞춰야 합니다.
    // - 우선은 가장 흔한 컬럼명(id/status/created_at/total_amount/customer_name)을 기준으로 작성합니다.
    const { data, error } = await sb
      .from('orders')
      .select('id, order_no, status, created_at, total_amount, customer_name')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      // 컬럼명이 다르면 여기서 error.message로 바로 드러납니다.
      throw new Error(`[orders.getOrders] ${error.message}`);
    }

    return (data ?? []).map((row: any) => ({
      // UI 라우트에서 쓰는 식별자가 order_no면 order_no를 우선 사용
      id: row.order_no ?? row.id,
      orderedAt: row.created_at ?? '',
      customerName: row.customer_name ?? '',
      totalAmount: row.total_amount ?? 0,
      status: row.status as OrderStatus,
    }));
  }

  /**
   * 주문 상세
   */
  async getOrder(accessToken: string, orderId: string): Promise<OrderDetailResponse> {
    const sb = this.supabase.userClient(accessToken);

    // orderId가 UUID(id)인지, order_no(OF-1001)인지 아직 확정 전이라
    // 1) id로 먼저 시도 → 실패하면 2) order_no로 재시도
    let data: any | null = null;
    let errMsg: string | null = null;

    // 1) id 기준 조회
    {
      const { data: d, error } = await sb
        .from('orders')
        .select(
          `
          id, order_no, status, created_at,
          customer_name, customer_phone, customer_address1, customer_address2, customer_memo,
          payment_method, subtotal_amount, shipping_fee, discount_amount, total_amount,
          order_items (
            id, product_name_snapshot, qty, unit_price,
            order_item_options ( id, option_name_snapshot )
          )
        `,
        )
        .eq('id', orderId)
        .maybeSingle();

      if (!error && d) data = d;
      if (error) errMsg = error.message;
    }

    // 2) order_no 기준 조회 (id 조회 실패/미존재 시)
    if (!data) {
      const { data: d, error } = await sb
        .from('orders')
        .select(
          `
          id, order_no, status, created_at,
          customer_name, customer_phone, customer_address1, customer_address2, customer_memo,
          payment_method, subtotal_amount, shipping_fee, discount_amount, total_amount,
          order_items (
            id, product_name_snapshot, qty, unit_price,
            order_item_options ( id, option_name_snapshot )
          )
        `,
        )
        .eq('order_no', orderId)
        .single();

      if (error) {
        throw new Error(`[orders.getOrder] ${error.message}${errMsg ? ` (id try: ${errMsg})` : ''}`);
      }
      data = d;
    }

    // 옵션 문자열 합치기(현재 DTO는 item.option 단일 문자열)
    const items: OrderItemResponse[] = (data.order_items ?? []).map((it: any) => {
      const opts = (it.order_item_options ?? []).map((o: any) => o.option_name_snapshot).filter(Boolean);
      return {
        id: it.id,
        name: it.product_name_snapshot ?? '',
        option: opts.length ? opts.join(', ') : undefined,
        qty: it.qty ?? 0,
        unitPrice: it.unit_price ?? 0,
      };
    });

    const res: OrderDetailResponse = {
      id: data.order_no ?? data.id,
      orderedAt: data.created_at ?? '',
      status: data.status as OrderStatus,
      customer: {
        name: data.customer_name ?? '',
        phone: data.customer_phone ?? '',
        address1: data.customer_address1 ?? '',
        address2: data.customer_address2 ?? undefined,
        memo: data.customer_memo ?? undefined,
      },
      payment: {
        method: (data.payment_method ?? 'CARD') as any,
        subtotal: data.subtotal_amount ?? 0,
        shippingFee: data.shipping_fee ?? 0,
        discount: data.discount_amount ?? 0,
        total: data.total_amount ?? 0,
      },
      items,
    };

    return res;
  }

  /**
   * 주문 상태 변경
   */
  async updateStatus(accessToken: string, orderId: string, status: OrderStatus) {
    const sb = this.supabase.userClient(accessToken);

    // id 기반 업데이트 먼저 시도 → 실패하면 order_no 기반 업데이트
    // (DB가 트리거/함수로 상태전이 검증을 하는 구조라, invalid transition이면 여기서 error가 납니다.)
    const tryUpdateById = await sb
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .select('id, order_no, status')
      .maybeSingle();

    if (!tryUpdateById.error && tryUpdateById.data) {
      return {
        id: tryUpdateById.data.order_no ?? tryUpdateById.data.id,
        status: tryUpdateById.data.status as OrderStatus,
      };
    }

    const tryUpdateByOrderNo = await sb
      .from('orders')
      .update({ status })
      .eq('order_no', orderId)
      .select('id, order_no, status')
      .single();

    if (tryUpdateByOrderNo.error) {
      throw new Error(
        `[orders.updateStatus] ${tryUpdateByOrderNo.error.message}${
          tryUpdateById.error ? ` (id try: ${tryUpdateById.error.message})` : ''
        }`,
      );
    }

    return {
      id: tryUpdateByOrderNo.data.order_no ?? tryUpdateByOrderNo.data.id,
      status: tryUpdateByOrderNo.data.status as OrderStatus,
    };
  }
}
