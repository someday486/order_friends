import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { PaymentsService } from '../payments/payments.service';
import {
  CreatePublicOrderRequest,
  PublicOrderResponse,
} from './dto/public-order.dto';
import { PublicOrderService } from './public-order.service';

@Injectable()
export class MeOrdersService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly publicOrderService: PublicOrderService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async createMyOrder(
    userId: string,
    dto: CreatePublicOrderRequest,
  ): Promise<PublicOrderResponse> {
    return this.publicOrderService.createOrder(dto, userId);
  }

  async cancelMyOrder(
    userId: string,
    orderId: string,
  ): Promise<PublicOrderResponse> {
    const sb = this.supabase.adminClient();

    const { data: order, error } = await sb
      .from('orders')
      .select('id, branch_id, order_no, status, user_id')
      .eq('id', orderId)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(`주문 조회 실패: ${error.message}`);
    }

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다.');
    }

    if (!order.user_id) {
      throw new BadRequestException(
        '로그인 연동 이전 주문은 직접 취소할 수 없습니다. 매장에 문의해주세요.',
      );
    }

    if (order.user_id !== userId) {
      throw new NotFoundException('주문을 찾을 수 없습니다.');
    }

    if (order.status !== 'CREATED' && order.status !== 'PENDING') {
      throw new BadRequestException(
        '현재 상태에서는 구매자가 직접 주문을 취소할 수 없습니다.',
      );
    }

    await this.paymentsService.refundOrderPaymentForCancellation(
      order.id,
      order.branch_id,
      '구매자 직접 주문 취소',
    );

    const { error: updateError } = await sb
      .from('orders')
      .update({ status: 'CANCELLED' })
      .eq('id', order.id);

    if (updateError) {
      throw new BadRequestException(`주문 취소 실패: ${updateError.message}`);
    }

    await this.releaseInventoryForCancelledOrder(
      sb,
      order.id,
      order.branch_id,
      order.order_no ?? null,
    );

    return this.publicOrderService.getOrder(order.id);
  }

  private async releaseInventoryForCancelledOrder(
    sb: any,
    orderId: string,
    branchId: string,
    orderNo: string | null,
  ): Promise<void> {
    const { data: orderItems, error: itemsError } = await sb
      .from('order_items')
      .select('product_id, qty')
      .eq('order_id', orderId);

    if (itemsError) {
      throw new BadRequestException(
        `주문 상품 조회 실패: ${itemsError.message}`,
      );
    }

    if (!orderItems || orderItems.length === 0) {
      return;
    }

    const productIds = orderItems.map((item: any) => item.product_id);
    const { data: inventories, error: inventoryError } = await sb
      .from('product_inventory')
      .select('product_id, qty_available, qty_reserved')
      .in('product_id', productIds)
      .eq('branch_id', branchId);

    if (inventoryError) {
      throw new BadRequestException(
        `재고 조회 실패: ${inventoryError.message}`,
      );
    }

    const inventoryMap = new Map<string, any>(
      inventories?.map((inv: any) => [inv.product_id, inv]) ?? [],
    );

    const updatePromises: PromiseLike<any>[] = [];
    const logRows: any[] = [];

    for (const item of orderItems) {
      const inventory = inventoryMap.get(item.product_id);
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
        notes: `구매자 주문 취소로 인한 재고 복구 (주문번호: ${orderNo ?? '-'})`,
      });
    }

    await Promise.all(updatePromises);

    if (logRows.length > 0) {
      const { error: logError } = await sb
        .from('inventory_logs')
        .insert(logRows);
      if (logError) {
        throw new BadRequestException(
          `재고 로그 저장 실패: ${logError.message}`,
        );
      }
    }
  }
}
