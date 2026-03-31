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
import { PaymentsService } from '../payments/payments.service';
import { CashReceiptsService } from '../cash-receipts/cash-receipts.service';
import type { DepositMatchStatus } from '../deposit-sync/deposit-sync.util';
import { PaymentStatusResponse } from '../payments/dto/payment.dto';

@Injectable()
export class CustomerOrdersService {
  private readonly logger = new Logger(CustomerOrdersService.name);
  private static readonly ITEMS_SUMMARY_LIMIT = 6;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly paymentsService: PaymentsService,
    private readonly cashReceiptsService: CashReceiptsService,
  ) {}

  private async syncCashReceiptForStatusChange(
    orderId: string,
    status: OrderStatus,
  ): Promise<void> {
    try {
      if (status === OrderStatus.COMPLETED) {
        await this.cashReceiptsService.issueForCompletedOrder(orderId);
        return;
      }

      if (status === OrderStatus.CANCELLED || status === OrderStatus.REFUNDED) {
        await this.cashReceiptsService.cancelForOrder(
          orderId,
          `Order status changed to ${status}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Cash receipt sync failed for order ${orderId} (${status})`,
        error,
      );
    }
  }

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
    }
  }

  /**
   * UUID 여부 확인
   */
  private isUuid(v: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v,
    );
  }

  private buildStatusUpdatePayload(status: OrderStatus) {
    const timestamp = new Date().toISOString();
    const payload: Record<string, unknown> = { status };

    if (status === OrderStatus.COMPLETED) {
      payload.completed_at = timestamp;
    }

    if (status === OrderStatus.CANCELLED || status === OrderStatus.REFUNDED) {
      payload.cancelled_at = timestamp;
    }

    return payload;
  }

  private isMissingOrderStatusTimestampColumnError(error: any): boolean {
    const message = String(error?.message ?? '');
    const isMissingColumn =
      error?.code === '42703' ||
      error?.code === 'PGRST204' ||
      /column .* does not exist/i.test(message) ||
      /schema cache/i.test(message);

    if (!isMissingColumn) {
      return false;
    }

    return /completed_at|cancelled_at/i.test(message);
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

  private async getDepositMatchStatusMap(
    sb: any,
    orderIds: string[],
  ): Promise<Map<string, DepositMatchStatus>> {
    const map = new Map<string, DepositMatchStatus>();
    if (orderIds.length === 0) return map;

    const { data, error } = await sb
      .from('deposit_match_rows')
      .select('matched_order_id')
      .in('matched_order_id', orderIds)
      .eq('match_status', 'MATCHED');

    if (error) {
      this.logger.warn(
        `Failed to load deposit match rows for customer orders: ${error.message}`,
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
    if (orderIds.length === 0) return map;

    const { data, error } = await sb
      .from('payments')
      .select('order_id, payment_method')
      .in('order_id', orderIds);

    if (error) {
      this.logger.warn(
        `Failed to load payment methods for customer orders: ${error.message}`,
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

  private getOrderPaymentMethodMap(
    _sb: any,
    _orderIds: string[],
  ): Map<string, 'CARD' | 'TRANSFER' | 'CASH' | null> {
    // Some databases in this project do not have orders.payment_method,
    // so we keep the fallback path as a no-op and rely on payments rows.
    void _sb;
    void _orderIds;
    return new Map<string, 'CARD' | 'TRANSFER' | 'CASH' | null>();
  }

  private async getPaymentStatusMap(
    sb: any,
    orderIds: string[],
  ): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>();
    if (orderIds.length === 0) return map;

    const { data, error } = await sb
      .from('payments')
      .select('order_id, status')
      .in('order_id', orderIds);

    if (error) {
      this.logger.warn(
        `Failed to load payment statuses for customer orders: ${error.message}`,
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

  private async getBranchNameMap(
    sb: any,
    branchIds: string[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (branchIds.length === 0) return map;

    const { data, error } = await sb
      .from('branches')
      .select('id, name')
      .in('id', branchIds);

    if (error) {
      this.logger.warn(
        `Failed to load branch names for customer orders: ${error.message}`,
      );
      return map;
    }

    for (const row of data ?? []) {
      const branchId = String(row?.id ?? '');
      if (!branchId) {
        continue;
      }
      map.set(branchId, String(row?.name ?? ''));
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

  private async getLatestCashReceipt(
    sb: any,
    orderId: string,
  ): Promise<{
    provider?: string | null;
    status: string;
    issuedAt?: string | null;
    approvalNo?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  } | null> {
    const { data, error } = await sb
      .from('cash_receipts')
      .select(
        'provider, status, issued_at, approval_no, error_code, error_message',
      )
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      this.logger.warn(
        `Failed to load cash receipt for customer order ${orderId}: ${error.message}`,
      );
      return null;
    }

    if (!data?.status) {
      return null;
    }

    return {
      provider: data.provider ?? null,
      status: String(data.status),
      issuedAt: data.issued_at ?? null,
      approvalNo: data.approval_no ?? null,
      errorCode: data.error_code ?? null,
      errorMessage: data.error_message ?? null,
    };
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
   * YYYY-MM-DD → 다음날 00:00:00.000Z (lt 조건용)
   */
  private getKstDayStartUtc(dateYmd: string): string {
    return new Date(`${dateYmd}T00:00:00+09:00`).toISOString();
  }

  private getNextKstDayStartUtc(dateYmd: string): string {
    const d = new Date(`${dateYmd}T00:00:00+09:00`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString();
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
    fulfillmentType?: 'PICKUP' | 'DELIVERY' | 'DINE_IN' | 'SHIPPING',
    dateStart?: string,
    dateEnd?: string,
    depositStatus?: DepositMatchStatus,
    search?: string,
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
    const normalizedSearch = search?.trim().toLowerCase() || undefined;

    if (depositStatus || normalizedSearch) {
      let filteredQuery = sb
        .from('orders')
        .select(
          'id, order_no, status, created_at, total_amount, customer_name, branch_id, fulfillment_type',
        )
        .in('branch_id', targetBranchIds);

      if (status) {
        filteredQuery = filteredQuery.eq('status', status);
      }
      if (fulfillmentType) {
        filteredQuery = filteredQuery.eq('fulfillment_type', fulfillmentType);
      }
      if (dateStart) {
        filteredQuery = filteredQuery.gte(
          'created_at',
          this.getKstDayStartUtc(dateStart),
        );
      }
      if (dateEnd) {
        filteredQuery = filteredQuery.lt(
          'created_at',
          this.getNextKstDayStartUtc(dateEnd),
        );
      }

      const { data: candidateRows, error: filteredError } =
        await filteredQuery.order('created_at', { ascending: false });

      if (filteredError) {
        this.logger.error('Failed to fetch orders', filteredError);
        throw new Error('Failed to fetch orders');
      }

      const candidateOrderIds = (candidateRows ?? []).map((row: any) =>
        String(row.id),
      );
      const paymentMethodMap = await this.getPaymentMethodMap(
        sb,
        candidateOrderIds,
      );
      const orderPaymentMethodMap = this.getOrderPaymentMethodMap(
        sb,
        candidateOrderIds,
      );
      const depositMatchStatusMap = await this.getDepositMatchStatusMap(
        sb,
        candidateOrderIds,
      );
      const itemSummaryMap = new Map<
        string,
        {
          itemCount: number;
          firstItemName: string | null;
          firstItemQty: number | null;
          itemsSummary: string;
        }
      >();

      if (candidateOrderIds.length > 0) {
        const { data: orderItems, error: orderItemsError } = await sb
          .from('order_items')
          .select('order_id, product_name_snapshot, qty')
          .in('order_id', candidateOrderIds);

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

      const filteredRows = (candidateRows ?? []).filter((row: any) => {
        const orderId = String(row.id);
        const paymentMethod =
          orderPaymentMethodMap.get(orderId) ??
          paymentMethodMap.get(orderId) ??
          null;

        if (normalizedSearch) {
          const summary = itemSummaryMap.get(orderId);
          const haystack = [
            row.order_no ?? '',
            row.customer_name ?? '',
            summary?.firstItemName ?? '',
            summary?.itemsSummary ?? '',
          ]
            .join(' ')
            .toLowerCase();

          if (!haystack.includes(normalizedSearch)) {
            return false;
          }
        }

        if (depositStatus) {
          if (paymentMethod !== 'TRANSFER') {
            return false;
          }

          const resolvedDepositStatus =
            depositMatchStatusMap.get(orderId) ?? 'PENDING';
          return resolvedDepositStatus === depositStatus;
        }

        return true;
      });

      const pagedRows = filteredRows.slice(from, to + 1);
      const orderIds = pagedRows.map((row: any) => row.id);
      const branchNameMap = await this.getBranchNameMap(
        sb,
        Array.from(
          new Set(
            pagedRows
              .map((row: any) => String(row?.branch_id ?? ''))
              .filter(Boolean),
          ),
        ),
      );
      const paymentStatusMap = await this.getPaymentStatusMap(sb, orderIds);

      const orders = pagedRows.map((row: any) => {
        const orderId = String(row.id);
        const paymentMethod =
          orderPaymentMethodMap.get(orderId) ??
          paymentMethodMap.get(orderId) ??
          null;

        return {
          id: row.id,
          orderNo: row.order_no ?? null,
          orderedAt: row.created_at ?? '',
          customerName: row.customer_name ?? '',
          totalAmount: row.total_amount ?? 0,
          branchId: row.branch_id,
          branchName:
            branchNameMap.get(String(row.branch_id ?? '')) ??
            row.branches?.name ??
            '',
          fulfillmentType: row.fulfillment_type ?? null,
          itemCount: itemSummaryMap.get(row.id)?.itemCount ?? 0,
          firstItemName: itemSummaryMap.get(row.id)?.firstItemName ?? null,
          firstItemQty: itemSummaryMap.get(row.id)?.firstItemQty ?? null,
          itemsSummary: itemSummaryMap.get(row.id)?.itemsSummary ?? '',
          status: row.status as OrderStatus,
          paymentMethod,
          paymentStatus: paymentStatusMap.get(orderId) ?? null,
          depositMatchStatus: depositMatchStatusMap.get(orderId) ?? 'PENDING',
        };
      });

      this.logger.log(`Fetched ${orders.length} orders`);

      return PaginationUtil.createResponse(
        orders,
        filteredRows.length,
        paginationDto,
      );
    }

    // 총 개수 조회
    let countQuery = sb
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('branch_id', targetBranchIds);

    if (status) {
      countQuery = countQuery.eq('status', status);
    }
    if (fulfillmentType) {
      countQuery = countQuery.eq('fulfillment_type', fulfillmentType);
    }
    if (dateStart) {
      countQuery = countQuery.gte(
        'created_at',
        this.getKstDayStartUtc(dateStart),
      );
    }
    if (dateEnd) {
      countQuery = countQuery.lt(
        'created_at',
        this.getNextKstDayStartUtc(dateEnd),
      );
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
        'id, order_no, status, created_at, total_amount, customer_name, branch_id, fulfillment_type',
      )
      .in('branch_id', targetBranchIds)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) {
      dataQuery = dataQuery.eq('status', status);
    }
    if (fulfillmentType) {
      dataQuery = dataQuery.eq('fulfillment_type', fulfillmentType);
    }
    if (dateStart) {
      dataQuery = dataQuery.gte(
        'created_at',
        this.getKstDayStartUtc(dateStart),
      );
    }
    if (dateEnd) {
      dataQuery = dataQuery.lt(
        'created_at',
        this.getNextKstDayStartUtc(dateEnd),
      );
    }

    const { data, error } = await dataQuery;

    if (error) {
      this.logger.error('Failed to fetch orders', error);
      throw new Error('Failed to fetch orders');
    }

    const orderIds = (data ?? []).map((row: any) => row.id);
    const branchNameMap = await this.getBranchNameMap(
      sb,
      Array.from(
        new Set(
          (data ?? [])
            .map((row: any) => String(row?.branch_id ?? ''))
            .filter(Boolean),
        ),
      ),
    );
    const paymentMethodMap = await this.getPaymentMethodMap(sb, orderIds);
    const orderPaymentMethodMap = await Promise.resolve(
      this.getOrderPaymentMethodMap(sb, orderIds),
    );
    const paymentStatusMap = await this.getPaymentStatusMap(sb, orderIds);
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
        branchId: row.branch_id,
        branchName:
          branchNameMap.get(String(row.branch_id ?? '')) ??
          row.branches?.name ??
          '',
        fulfillmentType: row.fulfillment_type ?? null,
        itemCount: itemSummaryMap.get(row.id)?.itemCount ?? 0,
        firstItemName: itemSummaryMap.get(row.id)?.firstItemName ?? null,
        firstItemQty: itemSummaryMap.get(row.id)?.firstItemQty ?? null,
        itemsSummary: itemSummaryMap.get(row.id)?.itemsSummary ?? '',
        status: row.status as OrderStatus,
        paymentMethod,
        paymentStatus: paymentStatusMap.get(String(row.id)) ?? null,
        depositMatchStatus:
          paymentMethod === 'TRANSFER'
            ? (depositMatchStatusMap.get(String(row.id)) ?? 'PENDING')
            : null,
      };
    });

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

    const { order, role } = await this.checkOrderAccess(
      orderId,
      userId,
      brandMemberships,
      branchMemberships,
    );

    const sb = this.supabase.adminClient();

    const selectDetail = `
      id, order_no, status, created_at, fulfillment_type,
      cash_receipt_requested, cash_receipt_type,
      cash_receipt_identity_type, cash_receipt_identity_value,
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

    const paymentMethodMap = await this.getPaymentMethodMap(sb, [
      String(data.id),
    ]);
    const orderPaymentMethodMap = await Promise.resolve(
      this.getOrderPaymentMethodMap(sb, [String(data.id)]),
    );
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
    const cashReceiptRequest = this.mapCashReceiptRequest(data);
    const cashReceiptIssue = await this.getLatestCashReceipt(
      sb,
      String(data.id),
    );

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
      myRole: role,
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
      cashReceiptRequest,
      cashReceiptIssue,
      items,
    };
  }

  private mapCashReceiptRequest(data: {
    cash_receipt_requested?: boolean | null;
    cash_receipt_type?: string | null;
    cash_receipt_identity_type?: string | null;
    cash_receipt_identity_value?: string | null;
  }) {
    if (data.cash_receipt_requested !== true) {
      return null;
    }

    return {
      requested: true,
      type: data.cash_receipt_type ?? null,
      identityType: data.cash_receipt_identity_type ?? null,
      identityValue: data.cash_receipt_identity_value ?? null,
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

    if (status === OrderStatus.CANCELLED) {
      await this.paymentsService.refundOrderPaymentForCancellation(
        order.id,
        order.branch_id,
      );
    }

    const selectClause =
      'id, order_no, status, created_at, customer_name, total_amount';

    let { data, error } = await sb
      .from('orders')
      .update(this.buildStatusUpdatePayload(status))
      .eq('id', order.id)
      .select(selectClause)
      .single();

    if (error && this.isMissingOrderStatusTimestampColumnError(error)) {
      this.logger.warn(
        `Order status timestamp columns missing for ${orderId}; retrying status-only update`,
      );
      ({ data, error } = await sb
        .from('orders')
        .update({ status })
        .eq('id', order.id)
        .select(selectClause)
        .single());
    }

    if (error || !data) {
      this.logger.error(`Failed to update order ${orderId} status`, error);
      throw new Error('Failed to update order status');
    }

    this.logger.log(
      `Order ${orderId} status updated to ${status} successfully`,
    );

    if (status === OrderStatus.CANCELLED) {
      await this.releaseInventoryForCancelledOrder(
        sb,
        order.id,
        order.branch_id,
        data.order_no ?? order.order_no ?? null,
      );
    }

    await this.syncCashReceiptForStatusChange(order.id, status);

    return {
      id: data.id,
      orderNo: data.order_no ?? null,
      orderedAt: data.created_at ?? '',
      customerName: data.customer_name ?? '',
      totalAmount: data.total_amount ?? 0,
      status: data.status as OrderStatus,
    };
  }

  /**
   * 주문 상태 일괄 변경
   */
  async updateMyOrdersStatusBulk(
    userId: string,
    orderIds: string[],
    status: OrderStatus,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    const uniqueOrderIds = Array.from(
      new Set(orderIds.map((id) => id.trim()).filter(Boolean)),
    );

    if (uniqueOrderIds.length === 0) {
      throw new NotFoundException('No order IDs provided');
    }

    this.logger.log(
      `Bulk updating ${uniqueOrderIds.length} orders to ${status} by user ${userId}`,
    );

    if (status === OrderStatus.CANCELLED) {
      const results = [];
      for (const currentOrderId of uniqueOrderIds) {
        results.push(
          await this.updateMyOrderStatus(
            userId,
            currentOrderId,
            status,
            brandMemberships,
            branchMemberships,
          ),
        );
      }

      return {
        updatedCount: results.length,
        status,
        orderIds: results.map((result) => result.id),
      };
    }

    const resolvedOrderIds: string[] = [];
    for (const orderId of uniqueOrderIds) {
      const { role, order } = await this.checkOrderAccess(
        orderId,
        userId,
        brandMemberships,
        branchMemberships,
      );
      this.checkModificationPermission(
        role,
        'bulk update order status',
        userId,
      );
      resolvedOrderIds.push(order.id);
    }

    const targetOrderIds = Array.from(new Set(resolvedOrderIds));
    const sb = this.supabase.adminClient();

    const { data, error } = await sb
      .from('orders')
      .update(this.buildStatusUpdatePayload(status))
      .in('id', targetOrderIds)
      .select('id');

    if (error) {
      this.logger.error(
        `Failed to bulk update order statuses to ${status}`,
        error,
      );
      throw new Error('Failed to bulk update order status');
    }

    const updatedCount = data?.length ?? targetOrderIds.length;
    this.logger.log(`Bulk status update completed: ${updatedCount} orders`);

    await Promise.all(
      targetOrderIds.map((currentOrderId) =>
        this.syncCashReceiptForStatusChange(currentOrderId, status),
      ),
    );

    return {
      updatedCount,
      status,
      orderIds: targetOrderIds,
    };
  }

  async confirmMyOrderTransferPayment(
    userId: string,
    orderId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ): Promise<PaymentStatusResponse> {
    this.logger.log(
      `Confirming transfer payment for order ${orderId} by user ${userId}`,
    );

    const { role, order } = await this.checkOrderAccess(
      orderId,
      userId,
      brandMemberships,
      branchMemberships,
    );

    this.checkModificationPermission(role, 'confirm transfer payment', userId);

    const payment = await this.paymentsService.confirmManualTransferPayment(
      order.id,
      order.branch_id,
    );

    if (order.status === OrderStatus.COMPLETED) {
      await this.syncCashReceiptForStatusChange(
        order.id,
        OrderStatus.COMPLETED,
      );
    }

    return payment;
  }
}
