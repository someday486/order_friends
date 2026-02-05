import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { OrderStatus } from './order-status.enum';
import { OrderDetailResponse, OrderItemResponse } from './dto/order-detail.response';
import { OrderListItemResponse } from './dto/order-list.response';
import { OrderNotFoundException } from '../../common/exceptions/order.exception';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PaginationDto, PaginatedResponse } from '../../common/dto/pagination.dto';
import { PaginationUtil } from '../../common/utils/pagination.util';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private isUuid(v: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  }

  /**
   * orderId가 uuid(id)일 수도, order_no일 수도 있음
   * 실제 orders.id(uuid)로 resolve
   */
  private async resolveOrderId(
    sb: any,
    orderIdOrNo: string,
    branchId?: string,
  ): Promise<string | null> {
    // uuid면 id로 조회
    if (this.isUuid(orderIdOrNo)) {
      let query = sb.from('orders').select('id').eq('id', orderIdOrNo);
      if (branchId) query = query.eq('branch_id', branchId);
      const byId = await query.maybeSingle();
      if (!byId.error && byId.data?.id) return byId.data.id;
    }

    // order_no 조회
    let noQuery = sb.from('orders').select('id').eq('order_no', orderIdOrNo);
    if (branchId) noQuery = noQuery.eq('branch_id', branchId);
    const byNo = await noQuery.maybeSingle();
    if (!byNo.error && byNo.data?.id) return byNo.data.id;

    return null;
  }

  /**
   * 주문 목록 (admin)
   * - RLS 때문에 userClient로는 안 보일 수 있어 adminClient 사용
   * - 페이지네이션 지원
   */
  async getOrders(
    accessToken: string,
    branchId: string,
    paginationDto: PaginationDto = {},
  ): Promise<PaginatedResponse<OrderListItemResponse>> {
    const { page = 1, limit = 20 } = paginationDto;
    this.logger.log(`Fetching orders for branch: ${branchId} (page: ${page}, limit: ${limit})`);

    const sb = this.supabase.adminClient();
    const { from, to } = PaginationUtil.getRange(page, limit);

    // 총 개수 조회
    const { count, error: countError } = await sb
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', branchId);

    if (countError) {
      this.logger.error(`Failed to count orders: ${countError.message}`, countError);
      throw new BusinessException(
        'Failed to count orders',
        'ORDER_COUNT_FAILED',
        500,
        { branchId, error: countError.message },
      );
    }

    // 데이터 조회
    const { data, error } = await sb
      .from('orders')
      .select('id, order_no, status, created_at, total_amount, customer_name')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      this.logger.error(`Failed to fetch orders: ${error.message}`, error);
      throw new BusinessException(
        'Failed to fetch orders',
        'ORDER_FETCH_FAILED',
        500,
        { branchId, error: error.message },
      );
    }

    const orders = (data ?? []).map((row: any) => ({
      id: row.id,
      orderNo: row.order_no ?? null,
      orderedAt: row.created_at ?? '',
      customerName: row.customer_name ?? '',
      totalAmount: row.total_amount ?? 0,
      status: row.status as OrderStatus,
    }));

    this.logger.log(`Fetched ${orders.length} orders for branch: ${branchId}`);

    return PaginationUtil.createResponse(orders, count || 0, paginationDto);
  }

  /**
   * 주문 상세 (admin)
   * - RLS 때문에 adminClient 사용
   * - id / order_no 모두 지원
   */
  async getOrder(accessToken: string, orderId: string, branchId: string): Promise<OrderDetailResponse> {
    this.logger.log(`Fetching order detail: ${orderId} for branch: ${branchId}`);
    const sb = this.supabase.adminClient();

    const selectDetail = `
      id, order_no, status, created_at,
      customer_name, customer_phone,
      delivery_address, delivery_memo,
      subtotal, delivery_fee, discount_total, total_amount,
      items:order_items (
        id, product_name_snapshot, qty, unit_price_snapshot,
        options:order_item_options ( id, option_name_snapshot )
      )
    `;

    const resolvedId = await this.resolveOrderId(sb, orderId, branchId);
    if (!resolvedId) {
      this.logger.warn(`Order not found: ${orderId}`);
      throw new OrderNotFoundException(orderId);
    }

    const { data, error } = await sb
      .from('orders')
      .select(selectDetail)
      .eq('id', resolvedId)
      .eq('branch_id', branchId)
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to fetch order: ${error.message}`, error);
      throw new BusinessException(
        'Failed to fetch order',
        'ORDER_FETCH_FAILED',
        500,
        { orderId, error: error.message },
      );
    }
    if (!data) {
      throw new OrderNotFoundException(orderId);
    }

    const items: OrderItemResponse[] = (data.items ?? []).map((it: any) => {
      const opts = (it.options ?? []).map((o: any) => o.option_name_snapshot).filter(Boolean);

      return {
        id: it.id,
        name: it.product_name_snapshot ?? '',
        option: opts.length ? opts.join(', ') : undefined,
        qty: it.qty ?? 0,
        unitPrice: it.unit_price_snapshot ?? 0,
      };
    });

    return {
      id: data.id,
      orderNo: data.order_no ?? null,
      orderedAt: data.created_at ?? '',
      status: data.status as OrderStatus,
      customer: {
        name: data.customer_name ?? '',
        phone: data.customer_phone ?? '',
        address1: data.delivery_address ?? '',
        address2: undefined,
        memo: data.delivery_memo ?? undefined,
      },
      payment: {
        method: 'CARD' as any,
        subtotal: data.subtotal ?? 0,
        shippingFee: data.delivery_fee ?? 0,
        discount: data.discount_total ?? 0,
        total: data.total_amount ?? 0,
      },
      items,
    };
  }

  /**
   * 주문 상태 변경 (admin)
   * - RLS 때문에 adminClient 사용
   * - id / order_no 모두 지원
   */
  async updateStatus(accessToken: string, orderId: string, status: OrderStatus, branchId: string) {
    this.logger.log(`Updating order status: ${orderId} to ${status}`);
    const sb = this.supabase.adminClient();

    const resolvedId = await this.resolveOrderId(sb, orderId, branchId);
    if (!resolvedId) {
      this.logger.warn(`Order not found for status update: ${orderId}`);
      throw new OrderNotFoundException(orderId);
    }

    const { data, error } = await sb
      .from('orders')
      .update({ status })
      .eq('id', resolvedId)
      .eq('branch_id', branchId)
      .select('id, order_no, status')
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to update order status: ${error.message}`, error);
      throw new BusinessException(
        'Failed to update order status',
        'ORDER_UPDATE_FAILED',
        500,
        { orderId, status, error: error.message },
      );
    }

    if (!data) {
      throw new OrderNotFoundException(orderId);
    }

    this.logger.log(`Order status updated successfully: ${orderId} -> ${status}`);

    return {
      id: data.id,
      orderNo: data.order_no ?? null,
      status: data.status as OrderStatus,
    };
  }
}
