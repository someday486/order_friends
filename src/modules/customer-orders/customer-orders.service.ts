import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import type {
  BrandMembership,
  BranchMembership,
} from '../../common/types/auth-request';
import { OrderStatus } from '../../modules/orders/order-status.enum';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginationUtil } from '../../common/utils/pagination.util';
import {
  OrderDetailResponse,
  OrderItemResponse,
} from '../../modules/orders/dto/order-detail.response';
import { canModifyOrder } from '../../common/utils/role-permission.util';

@Injectable()
export class CustomerOrdersService {
  private readonly logger = new Logger(CustomerOrdersService.name);
  private static readonly ITEMS_SUMMARY_LIMIT = 6;

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * UUID 여부 확인
   */
  private isUuid(v: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v,
    );
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
   * 브랜치에 대한 접근 권한 확인
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

    // 브랜치 정보 조회
    const { data: branch, error } = await sb
      .from('branches')
      .select('id, brand_id, name, slug, created_at')
      .eq('id', branchId)
      .single();

    if (error || !branch) {
      throw new NotFoundException('Branch not found');
    }

    // 1. 브랜치 멤버십 확인 (우선순위)
    const branchMembership = branchMemberships.find(
      (m) => m.branch_id === branchId,
    );
    if (branchMembership) {
      return { branchMembership, branch };
    }

    // 2. 브랜드 멤버십으로 확인
    const brandMembership = brandMemberships.find(
      (m) => m.brand_id === branch.brand_id,
    );
    if (brandMembership) {
      return { brandMembership, branch };
    }

    throw new ForbiddenException('You do not have access to this branch');
  }

  /**
   * 주문에 대한 접근 권한 확인
   */
  private async checkOrderAccess(
    orderId: string,
    userId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ): Promise<{ role: string; order: any }> {
    const sb = this.supabase.adminClient();

    // 주문 및 브랜치 정보 조회
    const resolvedId = await this.resolveOrderId(sb, orderId);
    if (!resolvedId) {
      throw new NotFoundException('Order not found');
    }

    const { data: order, error } = await sb
      .from('orders')
      .select('*, branches!inner(id, brand_id)')
      .eq('id', resolvedId)
      .single();

    if (error || !order) {
      throw new NotFoundException('Order not found');
    }

    const branchId = order.branch_id;
    const brandId = order.branches.brand_id;

    // 1. 브랜치 멤버십 확인 (우선순위)
    const branchMembership = branchMemberships.find(
      (m) => m.branch_id === branchId,
    );
    if (branchMembership) {
      return { role: branchMembership.role, order };
    }

    // 2. 브랜드 멤버십으로 확인
    const brandMembership = brandMemberships.find(
      (m) => m.brand_id === brandId,
    );
    if (brandMembership) {
      return { role: brandMembership.role, order };
    }

    throw new ForbiddenException('You do not have access to this order');
  }

  /**
   * 수정 권한 확인 (OWNER/ADMIN/BRANCH_OWNER/BRANCH_ADMIN/STAFF 가능)
   */
  private checkModificationPermission(
    role: string,
    action: string,
    userId: string,
  ) {
    if (!canModifyOrder(role)) {
      this.logger.warn(
        `User ${userId} with role ${role} attempted to ${action}`,
      );
      throw new ForbiddenException(
        `Only OWNER, ADMIN, BRANCH_ADMIN, or STAFF can ${action}`,
      );
    }
  }

  /**
   * 접근 가능한 모든 브랜치 ID 목록 조회
   */
  private async getAccessibleBranchIds(
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ): Promise<string[]> {
    const branchIds = new Set<string>(
      branchMemberships.map((m) => m.branch_id),
    );

    if (brandMemberships.length > 0) {
      const sb = this.supabase.adminClient();
      const brandIds = brandMemberships.map((m) => m.brand_id);
      const { data: branches } = await sb
        .from('branches')
        .select('id')
        .in('brand_id', brandIds);

      if (branches) {
        for (const b of branches) {
          branchIds.add(b.id);
        }
      }
    }

    return Array.from(branchIds);
  }

  /**
   * 내 지점의 주문 목록 조회 (페이지네이션 지원)
   */
  async getMyOrders(
    userId: string,
    branchId: string | undefined,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
    paginationDto: PaginationDto = {},
    status?: OrderStatus,
  ) {
    this.logger.log(
      `Fetching orders${branchId ? ` for branch ${branchId}` : ' (all branches)'} by user ${userId}`,
    );

    // branchId가 지정된 경우 해당 브랜치 접근 권한 확인
    if (branchId) {
      await this.checkBranchAccess(
        branchId,
        userId,
        brandMemberships,
        branchMemberships,
      );
    }

    // branchId 없으면 접근 가능한 전체 브랜치 조회
    const targetBranchIds = branchId
      ? [branchId]
      : await this.getAccessibleBranchIds(brandMemberships, branchMemberships);

    if (targetBranchIds.length === 0) {
      return PaginationUtil.createResponse([], 0, paginationDto);
    }

    const { page = 1, limit = 20 } = paginationDto;
    const sb = this.supabase.adminClient();
    const { from, to } = PaginationUtil.getRange(page, limit);

    // 총 개수 조회
    let countQuery = sb
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('branch_id', targetBranchIds);

    if (status) {
      countQuery = countQuery.eq('status', status);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      this.logger.error('Failed to count orders', countError);
      throw new Error('Failed to count orders');
    }

    // 데이터 조회
    let dataQuery = sb
      .from('orders')
      .select(
        'id, order_no, status, created_at, total_amount, customer_name, branch_id, branches(name)',
      )
      .in('branch_id', targetBranchIds)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) {
      dataQuery = dataQuery.eq('status', status);
    }

    const { data, error } = await dataQuery;

    if (error) {
      this.logger.error('Failed to fetch orders', error);
      throw new Error('Failed to fetch orders');
    }

    const orderIds = (data ?? []).map((row: any) => row.id);
    const itemSummaryMap = new Map<
      string,
      {
        itemCount: number;
        firstItemName: string | null;
        firstItemQty: number | null;
        itemsSummary: string;
      }
    >();

    if (orderIds.length > 0) {
      const { data: orderItems, error: orderItemsError } = await sb
        .from('order_items')
        .select('order_id, product_name_snapshot, qty')
        .in('order_id', orderIds);

      if (orderItemsError) {
        this.logger.error(
          'Failed to fetch order item summaries',
          orderItemsError,
        );
        throw new Error('Failed to fetch order item summaries');
      }

      const groupedItems = new Map<
        string,
        { product_name_snapshot?: string | null; qty?: number | null }[]
      >();

      for (const item of orderItems ?? []) {
        const current = groupedItems.get(item.order_id);
        if (current) {
          current.push(item);
          continue;
        }
        groupedItems.set(item.order_id, [item]);
      }

      for (const [orderId, items] of groupedItems.entries()) {
        const firstItem = items[0];
        const summaryParts = items
          .slice(0, CustomerOrdersService.ITEMS_SUMMARY_LIMIT)
          .map((item) =>
            `${item.product_name_snapshot ?? ''} ${item.qty ?? 0}`.trim(),
          )
          .filter(Boolean);
        const remainingCount =
          items.length - CustomerOrdersService.ITEMS_SUMMARY_LIMIT;
        const itemsSummary =
          remainingCount > 0
            ? `${summaryParts.join(', ')}, +${remainingCount}`
            : summaryParts.join(', ');

        itemSummaryMap.set(orderId, {
          itemCount: items.length,
          firstItemName: firstItem?.product_name_snapshot ?? null,
          firstItemQty: firstItem?.qty ?? null,
          itemsSummary,
        });
      }
    }

    const orders = (data ?? []).map((row: any) => ({
      id: row.id,
      orderNo: row.order_no ?? null,
      orderedAt: row.created_at ?? '',
      customerName: row.customer_name ?? '',
      totalAmount: row.total_amount ?? 0,
      branchId: row.branch_id,
      branchName: row.branches?.name ?? '',
      itemCount: itemSummaryMap.get(row.id)?.itemCount ?? 0,
      firstItemName: itemSummaryMap.get(row.id)?.firstItemName ?? null,
      firstItemQty: itemSummaryMap.get(row.id)?.firstItemQty ?? null,
      itemsSummary: itemSummaryMap.get(row.id)?.itemsSummary ?? '',
      status: row.status as OrderStatus,
    }));

    this.logger.log(`Fetched ${orders.length} orders`);

    return PaginationUtil.createResponse(orders, count || 0, paginationDto);
  }

  /**
   * 내 주문 상세 조회
   */
  async getMyOrder(
    userId: string,
    orderId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ): Promise<OrderDetailResponse> {
    this.logger.log(`Fetching order ${orderId} by user ${userId}`);

    const { order } = await this.checkOrderAccess(
      orderId,
      userId,
      brandMemberships,
      branchMemberships,
    );

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

    const { data, error } = await sb
      .from('orders')
      .select(selectDetail)
      .eq('id', order.id)
      .maybeSingle();

    if (error || !data) {
      this.logger.error(`Failed to fetch order ${orderId}`, error);
      throw new NotFoundException('Order not found');
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
   * 주문 상태 변경 (OWNER, ADMIN만 가능)
   */
  async updateMyOrderStatus(
    userId: string,
    orderId: string,
    status: OrderStatus,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(
      `Updating order ${orderId} status to ${status} by user ${userId}`,
    );

    // 접근 권한 확인
    const { role, order } = await this.checkOrderAccess(
      orderId,
      userId,
      brandMemberships,
      branchMemberships,
    );

    // 수정 권한 확인
    this.checkModificationPermission(role, 'update order status', userId);

    const sb = this.supabase.adminClient();

    const { data, error } = await sb
      .from('orders')
      .update({ status })
      .eq('id', order.id)
      .select('id, order_no, status, created_at, customer_name, total_amount')
      .single();

    if (error || !data) {
      this.logger.error(`Failed to update order ${orderId} status`, error);
      throw new Error('Failed to update order status');
    }

    this.logger.log(
      `Order ${orderId} status updated to ${status} successfully`,
    );

    return {
      id: data.id,
      orderNo: data.order_no ?? null,
      orderedAt: data.created_at ?? '',
      customerName: data.customer_name ?? '',
      totalAmount: data.total_amount ?? 0,
      status: data.status as OrderStatus,
    };
  }
}
