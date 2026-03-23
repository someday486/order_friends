import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { OrderStatus } from './order-status.enum';
import {
  OrderDetailResponse,
  OrderItemResponse,
} from './dto/order-detail.response';
import { OrderListItemResponse } from './dto/order-list.response';
import { OrderNotFoundException } from '../../common/exceptions/order.exception';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { PaginationUtil } from '../../common/utils/pagination.util';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';
import { PaymentsService } from '../payments/payments.service';
import type { DepositMatchStatus } from '../deposit-sync/deposit-sync.util';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly paymentsService: PaymentsService,
  ) {}

  private async releaseInventoryForCancelledOrder(
    sb: any,
    orderId: string,
    branchId: string,
    orderNo: string | null,
  ) {
    try {
      const { data: orderItems } = await sb
        .from('order_items')
        .select('product_id, qty')
        .eq('order_id', orderId);

      if (!orderItems || orderItems.length === 0) {
        return;
      }

      const productIds = orderItems.map((item: any) => item.product_id);
      const { data: inventories } = await sb
        .from('product_inventory')
        .select('product_id, qty_available, qty_reserved')
        .in('product_id', productIds)
        .eq('branch_id', branchId);

      const inventoryMap = new Map<string, any>(
        inventories?.map((inv: any) => [inv.product_id, inv]) ?? [],
      );

      const updatePromises: PromiseLike<any>[] = [];
      const logRows: any[] = [];

      for (const item of orderItems) {
        const inventory = inventoryMap.get(item.product_id) as
          | { qty_available: number; qty_reserved: number }
          | undefined;
        if (!inventory) continue;

        updatePromises.push(
          sb
            .from('product_inventory')
            .update({
              qty_available: inventory.qty_available + item.qty,
              qty_reserved: Math.max(0, inventory.qty_reserved - item.qty),
            })
            .eq('product_id', item.product_id)
            .eq('branch_id', branchId),
        );

        logRows.push({
          product_id: item.product_id,
          branch_id: branchId,
          transaction_type: 'RELEASE',
          qty_change: item.qty,
          qty_before: inventory.qty_available,
          qty_after: inventory.qty_available + item.qty,
          reference_id: orderId,
          reference_type: 'ORDER',
          notes: `주문 취소로 인한 재고 복구 (주문번호: ${orderNo ?? '-'})`,
        });
      }

      await Promise.all([
        ...updatePromises,
        logRows.length > 0
          ? sb.from('inventory_logs').insert(logRows)
          : Promise.resolve(),
      ]);

      this.logger.log(`Inventory released for cancelled order: ${orderNo}`);
    } catch (error) {
      this.logger.error(
        `Failed to release inventory for cancelled order ${orderId}`,
        error,
      );
      // Don't throw - cancellation should remain effective even if inventory sync fails
    }
  }

  private isUuid(v: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v,
    );
  }

  private async getDepositMatchStatusMap(
    sb: any,
    orderIds: string[],
  ): Promise<Map<string, DepositMatchStatus>> {
    const map = new Map<string, DepositMatchStatus>();
    if (orderIds.length === 0) {
      return map;
    }

    const { data, error } = await sb
      .from('deposit_match_rows')
      .select('matched_order_id')
      .in('matched_order_id', orderIds)
      .eq('match_status', 'MATCHED');

    if (error) {
      this.logger.warn(
        `Failed to load deposit match rows for orders: ${error.message}`,
      );
      return map;
    }

    for (const row of data ?? []) {
      const orderId = String(row?.matched_order_id ?? '');
      if (orderId) {
        map.set(orderId, 'AUTO_MATCHED');
      }
    }

    return map;
  }

  private async getPaymentMethodMap(
    sb: any,
    orderIds: string[],
  ): Promise<Map<string, 'CARD' | 'TRANSFER' | 'CASH' | null>> {
    const map = new Map<string, 'CARD' | 'TRANSFER' | 'CASH' | null>();
    if (orderIds.length === 0) {
      return map;
    }

    const { data, error } = await sb
      .from('payments')
      .select('order_id, payment_method')
      .in('order_id', orderIds);

    if (error) {
      this.logger.warn(
        `Failed to load payment methods for orders: ${error.message}`,
      );
      return map;
    }

    for (const row of data ?? []) {
      const orderId = String(row?.order_id ?? '');
      if (!orderId || map.has(orderId)) {
        continue;
      }
      map.set(
        orderId,
        this.normalizeOrderPaymentMethod(row?.payment_method ?? null),
      );
    }

    return map;
  }

  private async getOrderPaymentMethodMap(
    sb: any,
    orderIds: string[],
  ): Promise<Map<string, 'CARD' | 'TRANSFER' | 'CASH' | null>> {
    const map = new Map<string, 'CARD' | 'TRANSFER' | 'CASH' | null>();
    if (orderIds.length === 0) {
      return map;
    }

    const { data, error } = await sb
      .from('orders')
      .select('id, payment_method')
      .in('id', orderIds);

    if (error) {
      this.logger.warn(
        `Failed to load order payment methods for orders: ${error.message}`,
      );
      return map;
    }

    for (const row of data ?? []) {
      const orderId = String(row?.id ?? '');
      if (!orderId || map.has(orderId)) {
        continue;
      }
      map.set(
        orderId,
        this.normalizeOrderPaymentMethod(row?.payment_method ?? null),
      );
    }

    return map;
  }

  private async getPaymentStatusMap(
    sb: any,
    orderIds: string[],
  ): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>();
    if (orderIds.length === 0) {
      return map;
    }

    const { data, error } = await sb
      .from('payments')
      .select('order_id, status')
      .in('order_id', orderIds);

    if (error) {
      this.logger.warn(
        `Failed to load payment statuses for orders: ${error.message}`,
      );
      return map;
    }

    for (const row of data ?? []) {
      const orderId = String(row?.order_id ?? '');
      if (!orderId || map.has(orderId)) {
        continue;
      }
      map.set(orderId, (row?.status as string | null | undefined) ?? null);
    }

    return map;
  }

  private normalizeOrderPaymentMethod(
    paymentMethod: string | null | undefined,
  ): 'CARD' | 'TRANSFER' | 'CASH' | null {
    if (
      paymentMethod === 'CARD' ||
      paymentMethod === 'TRANSFER' ||
      paymentMethod === 'CASH'
    ) {
      return paymentMethod;
    }

    return null;
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
    queryDto: Partial<GetOrdersQueryDto> = {},
  ): Promise<PaginatedResponse<OrderListItemResponse>> {
    const { page = 1, limit = 20, status, fulfillmentType } = queryDto;
    this.logger.log(
      `Fetching orders for branch: ${branchId} (page: ${page}, limit: ${limit})`,
    );

    const sb = this.supabase.adminClient();
    const { from, to } = PaginationUtil.getRange(page, limit);

    // count와 data를 단일 쿼리로 조회
    let query = sb
      .from('orders')
      .select(
        'id, order_no, status, created_at, total_amount, customer_name, branch_id, fulfillment_type',
        { count: 'exact' },
      )
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) {
      query = query.eq('status', status);
    }
    if (fulfillmentType) {
      query = query.eq('fulfillment_type', fulfillmentType);
    }

    const { data, count, error } = await query;

    if (error) {
      this.logger.error(`Failed to fetch orders: ${error.message}`, error);
      throw new BusinessException(
        'Failed to fetch orders',
        'ORDER_FETCH_FAILED',
        500,
        { branchId, error: error.message },
      );
    }

    const paymentMethodMap = await this.getPaymentMethodMap(
      sb,
      (data ?? []).map((row: any) => String(row.id)),
    );
    const orderPaymentMethodMap = await this.getOrderPaymentMethodMap(
      sb,
      (data ?? []).map((row: any) => String(row.id)),
    );
    const paymentStatusMap = await this.getPaymentStatusMap(
      sb,
      (data ?? []).map((row: any) => String(row.id)),
    );
    const depositMatchStatusMap = await this.getDepositMatchStatusMap(
      sb,
      (data ?? []).map((row: any) => String(row.id)),
    );

    const orders = (data ?? []).map((row: any) => {
      const paymentMethod =
        orderPaymentMethodMap.get(String(row.id)) ??
        paymentMethodMap.get(String(row.id)) ??
        null;

      return {
        id: row.id,
        orderNo: row.order_no ?? null,
        orderedAt: row.created_at ?? '',
        customerName: row.customer_name ?? '',
        totalAmount: row.total_amount ?? 0,
        status: row.status as OrderStatus,
        paymentMethod,
        paymentStatus: paymentStatusMap.get(String(row.id)) ?? null,
        depositMatchStatus:
          paymentMethod === 'TRANSFER'
            ? (depositMatchStatusMap.get(String(row.id)) ?? 'PENDING')
            : null,
        fulfillmentType: row.fulfillment_type ?? null,

        // ✅ 새 필드들: admin 목록에서는 아직 데이터가 없으니 기본값
        branchId: row.branch_id ?? branchId ?? null,
        branchName: row.branches?.name ?? row.branch_name ?? null,
        itemCount: row.itemCount ?? row.item_count ?? 0,
        firstItemName: row.firstItemName ?? row.first_item_name ?? null,
      };
    });

    this.logger.log(`Fetched ${orders.length} orders for branch: ${branchId}`);

    return PaginationUtil.createResponse(orders, count || 0, queryDto);
  }

  /**
   * 주문 상세 (admin)
   * - RLS 때문에 adminClient 사용
   * - id / order_no 모두 지원
   */
  async getOrder(
    accessToken: string,
    orderId: string,
    branchId: string,
  ): Promise<OrderDetailResponse> {
    this.logger.log(
      `Fetching order detail: ${orderId} for branch: ${branchId}`,
    );
    const sb = this.supabase.adminClient();

    const selectDetail = `
      id, order_no, status, created_at, fulfillment_type,
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
      const opts = (it.options ?? [])
        .map((o: any) => o.option_name_snapshot)
        .filter(Boolean);

      return {
        id: it.id,
        name: it.product_name_snapshot ?? '',
        option: opts.length ? opts.join(', ') : undefined,
        qty: it.qty ?? 0,
        unitPrice: it.unit_price_snapshot ?? 0,
      };
    });

    const paymentMethodMap = await this.getPaymentMethodMap(sb, [
      String(data.id),
    ]);
    const orderPaymentMethodMap = await this.getOrderPaymentMethodMap(sb, [
      String(data.id),
    ]);
    const paymentStatusMap = await this.getPaymentStatusMap(sb, [
      String(data.id),
    ]);
    const paymentMethod =
      orderPaymentMethodMap.get(String(data.id)) ??
      paymentMethodMap.get(String(data.id)) ??
      null;
    const depositMatchStatusMap = await this.getDepositMatchStatusMap(sb, [
      String(data.id),
    ]);

    return {
      id: data.id,
      orderNo: data.order_no ?? null,
      orderedAt: data.created_at ?? '',
      status: data.status as OrderStatus,
      paymentStatus: paymentStatusMap.get(String(data.id)) ?? null,
      depositMatchStatus:
        paymentMethod === 'TRANSFER'
          ? (depositMatchStatusMap.get(String(data.id)) ?? 'PENDING')
          : null,
      fulfillmentType: data.fulfillment_type ?? null,
      customer: {
        name: data.customer_name ?? '',
        phone: data.customer_phone ?? '',
        address1: data.delivery_address ?? '',
        address2: undefined,
        memo: data.delivery_memo ?? undefined,
      },
      payment: {
        method: paymentMethod,
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
  async updateStatus(
    accessToken: string,
    orderId: string,
    status: OrderStatus,
    branchId: string,
  ) {
    this.logger.log(`Updating order status: ${orderId} to ${status}`);
    const sb = this.supabase.adminClient();

    const resolvedId = await this.resolveOrderId(sb, orderId, branchId);
    if (!resolvedId) {
      this.logger.warn(`Order not found for status update: ${orderId}`);
      throw new OrderNotFoundException(orderId);
    }

    if (status === OrderStatus.CANCELLED) {
      await this.paymentsService.refundOrderPaymentForCancellation(
        resolvedId,
        branchId,
      );
    }

    const { data, error } = await sb
      .from('orders')
      .update({ status })
      .eq('id', resolvedId)
      .eq('branch_id', branchId)
      .select('id, order_no, status')
      .maybeSingle();

    if (error) {
      this.logger.error(
        `Failed to update order status: ${error.message}`,
        error,
      );
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

    if (status === 'CANCELLED') {
      await this.releaseInventoryForCancelledOrder(
        sb,
        resolvedId,
        branchId,
        data.order_no ?? null,
      );
    }

    this.logger.log(
      `Order status updated successfully: ${orderId} -> ${status}`,
    );

    return {
      id: data.id,
      orderNo: data.order_no ?? null,
      status: data.status as OrderStatus,
    };
  }
}
