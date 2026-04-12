import { Injectable, Logger, Optional } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BillingTier } from '../billing/billing.types';
import { FulfillmentType } from '../public-order/dto/public-order.dto';
import {
  TossPaymentsClient,
  TossConfirmResponse,
} from './toss-payments.client';

/** Shape returned by getOrderForPayment */
interface OrderForPayment {
  id: string;
  order_no: string | null;
  branch_id: string;
  total_amount: number;
  customer_name: string | null;
  customer_phone: string | null;
  status: string;
  payment_status: string | null;
  items: Array<{
    id: string;
    product_name_snapshot: string | null;
    qty: number;
  }>;
}

/** Additional fields only needed for post-payment notifications */
interface OrderForPaymentNotification extends OrderForPayment {
  customer_address1: string | null;
  customer_address2: string | null;
  fulfillment_type: string | null;
}

/** Minimal payment record fetched during confirmation flow */
interface ExistingPaymentRecord {
  id: string;
  order_id: string;
  status: string;
  amount: number | null;
  paid_at: string | null;
  idempotency_key: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Minimal payment record fetched during webhook processing */
interface WebhookPaymentRecord {
  id: string;
  order_id: string;
  status: string;
  amount: number | null;
  provider_payment_key: string | null;
  refund_amount: number;
  metadata?: Record<string, unknown> | null;
}

interface CancellationPaymentRecord {
  id: string;
  status: string;
  amount: number | null;
  refund_amount: number | null;
  order_id?: string;
}

/** Minimal payment row returned by payments list query */
interface PaymentListRow {
  id: string;
  order_id: string;
  amount: number;
  status: string;
  provider: string;
  payment_method: string | null;
  paid_at: string | null;
  created_at: string;
  /** Supabase !inner join returns single object (filtered) */
  orders: { order_no: string | null; branch_id: string } | null;
}

interface BrandBillingContext {
  brandId: string;
  billingTier: BillingTier;
  commissionRate: number | null;
}
import {
  PreparePaymentRequest,
  PreparePaymentResponse,
  ConfirmPaymentRequest,
  ConfirmPaymentResponse,
  PaymentStatusResponse,
  PaymentListItemResponse,
  PaymentDetailResponse,
  RefundPaymentRequest,
  RefundPaymentResponse,
  PaymentStatus,
  PaymentProvider,
  PaymentMethod,
  TossWebhookRequest,
} from './dto/payment.dto';
import {
  PaymentNotFoundException,
  PaymentAmountMismatchException,
  OrderAlreadyPaidException,
  PaymentNotAllowedException,
  PaymentProviderException,
  RefundNotAllowedException,
  RefundAmountExceededException,
  WebhookSignatureVerificationException,
  WebhookTimestampVerificationException,
} from '../../common/exceptions/payment.exception';
import { OrderNotFoundException } from '../../common/exceptions/order.exception';
import { BusinessException } from '../../common/exceptions/business.exception';
import {
  PaginationDto,
  PaginatedResponse,
} from '../../common/dto/pagination.dto';
import { PaginationUtil } from '../../common/utils/pagination.util';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly orderCompletionNotificationSentAtKey =
    'orderCompletionNotificationSentAt';

  private readonly tossSecretKey = process.env.TOSS_SECRET_KEY || '';
  private readonly tossClientKey = process.env.TOSS_CLIENT_KEY || '';
  private readonly tossApiBaseUrl: string;
  private readonly tossWebhookSecret: string;
  private readonly tossWebhookSignatureHeader: string;
  private readonly tossWebhookMaxAgeMs: number;
  private readonly tossTimeoutMs: number;
  private readonly tossMockMode: boolean;
  private readonly tossClient: TossPaymentsClient;

  constructor(
    private readonly supabase: SupabaseService,
    @Optional()
    private readonly notificationsService?: NotificationsService,
  ) {
    const rawTimeout = Number(process.env.TOSS_TIMEOUT_MS);
    this.tossTimeoutMs =
      Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 15000;

    const rawWebhookMaxAgeSeconds = Number(
      process.env.TOSS_WEBHOOK_MAX_AGE_SECONDS,
    );
    const webhookMaxAgeSeconds =
      Number.isFinite(rawWebhookMaxAgeSeconds) && rawWebhookMaxAgeSeconds > 0
        ? rawWebhookMaxAgeSeconds
        : 300;
    this.tossWebhookMaxAgeMs = webhookMaxAgeSeconds * 1000;

    const rawMock = process.env.TOSS_MOCK_MODE;
    const envMock =
      rawMock !== undefined
        ? ['true', '1', 'yes'].includes(rawMock.trim().toLowerCase())
        : false;

    this.tossMockMode =
      envMock || (!this.tossSecretKey && process.env.NODE_ENV !== 'production');

    this.tossApiBaseUrl =
      process.env.TOSS_API_BASE_URL || 'https://api.tosspayments.com/v1';
    this.tossWebhookSecret = process.env.TOSS_WEBHOOK_SECRET || '';
    this.tossWebhookSignatureHeader = (
      process.env.TOSS_WEBHOOK_SIGNATURE_HEADER || 'toss-signature'
    ).toLowerCase();

    this.tossClient = new TossPaymentsClient(
      this.tossSecretKey,
      this.tossApiBaseUrl,
      this.tossTimeoutMs,
      this.tossWebhookSecret,
      this.tossWebhookSignatureHeader,
    );
  }

  /**
   * UUID 泥댄겕 ?ы띁
   */
  private isUuid(v: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v,
    );
  }

  /**
   * orderId 또는 orderNo를 실제 UUID로 변환
   */
  private async resolveOrderId(
    sb: SupabaseClient,
    orderIdOrNo: string,
    branchId?: string,
  ): Promise<string | null> {
    // UUID면 id로 조회
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
      /column\s+"?([a-zA-Z0-9_.]+)"?\s+does not exist/i,
    );
    if (pgMatch?.[1]) {
      return pgMatch[1].split('.').pop() ?? pgMatch[1];
    }

    const pgrstMatch = message.match(
      /could not find the\s+'?([a-zA-Z0-9_]+)'?\s+column\s+of/i,
    );
    return pgrstMatch?.[1] ?? null;
  }

  /**
   * 주문 정보 조회 (결제 준비용)
   */
  private async getOrderForPayment(orderId: string): Promise<OrderForPayment> {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('orders')
      .select(
        `
          id,
          order_no,
          branch_id,
          total_amount,
          customer_name,
          customer_phone,
          status,
          payment_status,
          items:order_items(
            id,
            product_name_snapshot,
            qty
          )
        `,
      )
      .eq('id', orderId)
      .maybeSingle();

    if (error) {
      this.logger.error(
        `Failed to fetch order for payment: ${error.message}`,
        error,
      );
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

    return data;
  }

  private async getOrderForPaymentNotification(
    orderId: string,
  ): Promise<OrderForPaymentNotification> {
    const sb = this.supabase.adminClient();
    const optionalColumns = new Set([
      'customer_address1',
      'customer_address2',
      'fulfillment_type',
    ]);
    const selectedColumns = [
      'id',
      'order_no',
      'branch_id',
      'total_amount',
      'customer_name',
      'customer_phone',
      'customer_address1',
      'customer_address2',
      'fulfillment_type',
      'status',
      'payment_status',
    ];

    let data: OrderForPaymentNotification | null = null;
    let error: any = null;

    for (let attempts = 0; attempts < optionalColumns.size + 1; attempts += 1) {
      ({ data, error } = await sb
        .from('orders')
        .select(
          `
          ${selectedColumns.join(',\n          ')},
          items:order_items(
            id,
            product_name_snapshot,
            qty
          )
        `,
        )
        .eq('id', orderId)
        .maybeSingle());

      if (!error) {
        break;
      }

      const missingColumn = this.getMissingColumnName(error);
      if (
        !this.isMissingColumnError(error) ||
        !missingColumn ||
        !optionalColumns.has(missingColumn)
      ) {
        break;
      }

      optionalColumns.delete(missingColumn);
      const nextSelectedColumns = selectedColumns.filter(
        (column) => column !== missingColumn,
      );
      selectedColumns.length = 0;
      selectedColumns.push(...nextSelectedColumns);
    }

    if (error) {
      this.logger.error(
        `Failed to fetch order for payment: ${error.message}`,
        error,
      );
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

    return {
      ...data,
      customer_address1: data.customer_address1 ?? null,
      customer_address2: data.customer_address2 ?? null,
      fulfillment_type: data.fulfillment_type ?? null,
    };
  }

  private getPaymentMetadata(metadata: unknown): Record<string, unknown> {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return {};
    }

    return { ...(metadata as Record<string, unknown>) };
  }

  private hasOrderCompletionNotificationSent(metadata: unknown): boolean {
    const sentAt =
      this.getPaymentMetadata(metadata)[
        this.orderCompletionNotificationSentAtKey
      ];
    return typeof sentAt === 'string' && sentAt.trim().length > 0;
  }

  private async markOrderCompletionNotificationSent(
    sb: SupabaseClient,
    paymentId: string,
    metadata: unknown,
  ): Promise<void> {
    const nextMetadata = {
      ...this.getPaymentMetadata(metadata),
      [this.orderCompletionNotificationSentAtKey]: new Date().toISOString(),
    };

    const { error } = await sb
      .from('payments')
      .update({ metadata: nextMetadata })
      .eq('id', paymentId);

    if (error) {
      this.logger.warn(
        `Failed to mark order completion notification as sent for payment ${paymentId}: ${error.message}`,
      );
    }
  }

  private async getBranchNameForNotification(
    sb: SupabaseClient,
    branchId: string,
  ): Promise<string> {
    const { data, error } = await sb
      .from('branches')
      .select('name')
      .eq('id', branchId)
      .maybeSingle();

    if (error) {
      this.logger.warn(
        `Failed to resolve branch name for notification: ${branchId} (${error.message})`,
      );
      return '매장';
    }

    return data?.name ?? '매장';
  }

  private getSettlementPeriodBounds(targetAt: string) {
    const sourceDate = new Date(targetAt);
    const koreaDate = new Date(sourceDate.getTime() + 9 * 60 * 60 * 1000);
    const year = koreaDate.getUTCFullYear();
    const month = koreaDate.getUTCMonth();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const monthValue = String(month + 1).padStart(2, '0');

    return {
      periodStart: `${year}-${monthValue}-01`,
      periodEnd: `${year}-${monthValue}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  private async resolveBrandBillingContext(
    sb: SupabaseClient,
    orderId: string,
  ): Promise<BrandBillingContext | null> {
    const { data: order, error: orderError } = await sb
      .from('orders')
      .select('branch_id')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !order?.branch_id) {
      this.logger.warn(
        `Failed to resolve branch for settlement line item (${orderId}): ${orderError?.message ?? 'order missing'}`,
      );
      return null;
    }

    const { data: branch, error: branchError } = await sb
      .from('branches')
      .select('brand_id')
      .eq('id', order.branch_id)
      .maybeSingle();

    if (branchError || !branch?.brand_id) {
      this.logger.warn(
        `Failed to resolve brand for settlement line item (${orderId}): ${branchError?.message ?? 'branch missing'}`,
      );
      return null;
    }

    const { data: brand, error: brandError } = await sb
      .from('brands')
      .select('id, billing_tier, commission_rate')
      .eq('id', branch.brand_id)
      .maybeSingle();

    if (brandError || !brand?.id) {
      this.logger.warn(
        `Failed to resolve billing tier for settlement line item (${orderId}): ${brandError?.message ?? 'brand missing'}`,
      );
      return null;
    }

    return {
      brandId: brand.id,
      billingTier:
        brand.billing_tier === BillingTier.NON_PG
          ? BillingTier.NON_PG
          : BillingTier.PG,
      commissionRate:
        brand.commission_rate === null || brand.commission_rate === undefined
          ? null
          : Number(brand.commission_rate),
    };
  }

  private async resolveSettlementCommissionRate(
    sb: SupabaseClient,
    brandId: string,
    commissionRate: number | null,
  ): Promise<number> {
    if (typeof commissionRate === 'number' && Number.isFinite(commissionRate)) {
      return commissionRate;
    }

    const { data: tier, error } = await sb
      .from('commission_tiers')
      .select('commission_rate')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !tier?.commission_rate) {
      this.logger.warn(
        `Failed to resolve commission tier for brand ${brandId}: ${error?.message ?? 'tier missing'}`,
      );
      return 0.035;
    }

    return Number(tier.commission_rate);
  }

  private async ensureSettlementPeriod(
    sb: SupabaseClient,
    brandId: string,
    paidAt: string,
    commissionRate: number,
  ): Promise<string | null> {
    const { periodStart, periodEnd } = this.getSettlementPeriodBounds(paidAt);

    const { data: existing, error: existingError } = await sb
      .from('settlement_periods')
      .select('id')
      .eq('brand_id', brandId)
      .eq('period_start', periodStart)
      .maybeSingle();

    if (!existingError && existing?.id) {
      return existing.id;
    }

    const { data: created, error: createError } = await sb
      .from('settlement_periods')
      .insert({
        brand_id: brandId,
        period_start: periodStart,
        period_end: periodEnd,
        commission_rate: commissionRate,
        status: 'PENDING',
      })
      .select('id')
      .single();

    if (!createError && created?.id) {
      return created.id;
    }

    if (createError?.code === '23505') {
      const { data: retried } = await sb
        .from('settlement_periods')
        .select('id')
        .eq('brand_id', brandId)
        .eq('period_start', periodStart)
        .maybeSingle();

      return retried?.id ?? null;
    }

    this.logger.warn(
      `Failed to ensure settlement period for brand ${brandId}: ${createError?.message ?? existingError?.message ?? 'unknown error'}`,
    );
    return null;
  }

  private async createSettlementLineItemForPayment(
    paymentId: string,
    orderId: string,
    amount: number,
    paidAt: string,
  ): Promise<void> {
    const sb = this.supabase.adminClient();
    const { data: existingLineItem, error: existingLineItemError } = await sb
      .from('settlement_line_items')
      .select('id')
      .eq('payment_id', paymentId)
      .maybeSingle();

    if (!existingLineItemError && existingLineItem?.id) {
      return;
    }

    const billingContext = await this.resolveBrandBillingContext(sb, orderId);
    if (!billingContext || billingContext.billingTier !== BillingTier.PG) {
      return;
    }

    const commissionRate = await this.resolveSettlementCommissionRate(
      sb,
      billingContext.brandId,
      billingContext.commissionRate,
    );
    const settlementPeriodId = await this.ensureSettlementPeriod(
      sb,
      billingContext.brandId,
      paidAt,
      commissionRate,
    );

    if (!settlementPeriodId) {
      return;
    }

    const commissionAmount = Math.round(amount * commissionRate);
    const netAmount = amount - commissionAmount;

    const { error } = await sb.from('settlement_line_items').insert({
      settlement_period_id: settlementPeriodId,
      payment_id: paymentId,
      order_id: orderId,
      sale_amount: amount,
      commission_amount: commissionAmount,
      net_amount: netAmount,
    });

    if (error && error.code !== '23505') {
      throw new Error(error.message ?? 'settlement line item insert failed');
    }
  }

  private queueSettlementLineItemCreation(
    paymentId: string,
    orderId: string,
    amount: number,
    paidAt: string,
  ): void {
    void this.createSettlementLineItemForPayment(
      paymentId,
      orderId,
      amount,
      paidAt,
    ).catch((error) => {
      this.logger.warn(
        `Failed to create settlement line item for payment ${paymentId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  private async createSettlementAdjustmentLineItemForRefund(
    paymentId: string,
    orderId: string,
    refundAmount: number,
    refundedAt: string,
  ): Promise<void> {
    const sb = this.supabase.adminClient();
    const { data: originalLineItem, error: originalLineItemError } = await sb
      .from('settlement_line_items')
      .select('settlement_period_id, sale_amount, commission_amount')
      .eq('payment_id', paymentId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (originalLineItemError || !originalLineItem?.settlement_period_id) {
      this.logger.warn(
        `Failed to resolve original settlement line item for refund ${paymentId}: ${originalLineItemError?.message ?? 'line item missing'}`,
      );
      return;
    }

    const { data: originalPeriod, error: originalPeriodError } = await sb
      .from('settlement_periods')
      .select('id, brand_id, period_start, commission_rate')
      .eq('id', originalLineItem.settlement_period_id)
      .maybeSingle();

    if (
      originalPeriodError ||
      !originalPeriod?.id ||
      !originalPeriod.brand_id
    ) {
      this.logger.warn(
        `Failed to resolve settlement period for refund ${paymentId}: ${originalPeriodError?.message ?? 'period missing'}`,
      );
      return;
    }

    const originalSaleAmount = Math.abs(
      Number(originalLineItem.sale_amount ?? 0),
    );
    const originalCommissionAmount = Math.abs(
      Number(originalLineItem.commission_amount ?? 0),
    );
    const originalCommissionRate =
      originalSaleAmount > 0
        ? originalCommissionAmount / originalSaleAmount
        : Number(originalPeriod.commission_rate ?? 0);

    const refundPeriod = this.getSettlementPeriodBounds(refundedAt);
    const targetSettlementPeriodId =
      refundPeriod.periodStart === originalPeriod.period_start
        ? originalPeriod.id
        : await this.ensureSettlementPeriod(
            sb,
            originalPeriod.brand_id,
            refundedAt,
            originalCommissionRate,
          );

    if (!targetSettlementPeriodId) {
      return;
    }

    const commissionAmount = Math.round(refundAmount * originalCommissionRate);
    const { error } = await sb.from('settlement_line_items').insert({
      settlement_period_id: targetSettlementPeriodId,
      payment_id: paymentId,
      order_id: orderId,
      sale_amount: -refundAmount,
      commission_amount: -commissionAmount,
      net_amount: -refundAmount + commissionAmount,
    });

    if (error) {
      throw new Error(
        error.message ?? 'settlement refund line item insert failed',
      );
    }
  }

  private queueSettlementLineItemAdjustmentForRefund(
    paymentId: string,
    orderId: string,
    refundAmount: number,
    refundedAt: string,
  ): void {
    void this.createSettlementAdjustmentLineItemForRefund(
      paymentId,
      orderId,
      refundAmount,
      refundedAt,
    ).catch((error) => {
      this.logger.warn(
        `Failed to create settlement adjustment line item for refund ${paymentId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  private async sendCardOrderCompletionNotification(
    sb: SupabaseClient,
    paymentId: string,
    orderId: string,
    paymentMetadata: unknown,
    orderForNotification?: OrderForPaymentNotification,
  ): Promise<void> {
    if (
      !this.notificationsService ||
      this.hasOrderCompletionNotificationSent(paymentMetadata)
    ) {
      return;
    }

    try {
      const order =
        orderForNotification ??
        (await this.getOrderForPaymentNotification(orderId));
      if (!order.customer_phone) {
        return;
      }

      const branchName = await this.getBranchNameForNotification(
        sb,
        order.branch_id,
      );
      const deliveryAddress = [order.customer_address1, order.customer_address2]
        .filter(Boolean)
        .join(' ')
        .trim();

      const result = await this.notificationsService.sendOrderCompletionKakao(
        order.id,
        {
          orderNo: order.order_no ?? order.id,
          customerName: order.customer_name ?? '고객',
          items: order.items.map((item) => ({
            name: item.product_name_snapshot ?? '상품',
            qty: item.qty,
          })),
          totalAmount: order.total_amount,
          paymentMethod: PaymentMethod.CARD,
          transferAccount: null,
          fulfillmentType: order.fulfillment_type ?? FulfillmentType.PICKUP,
          deliveryAddress: deliveryAddress || null,
          branchName,
        },
        order.customer_phone,
      );

      if (!result.success) {
        this.logger.warn(
          `Failed to send order completion KakaoTalk for order ${order.id}: ${result.errorMessage ?? 'unknown error'}`,
        );
        return;
      }

      await this.markOrderCompletionNotificationSent(
        sb,
        paymentId,
        paymentMetadata,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to send order completion KakaoTalk for order ${orderId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async updateOrderPaymentStatus(
    sb: SupabaseClient,
    orderId: string,
    paymentStatus: string,
    source: string,
  ) {
    try {
      const { error } = await sb
        .from('orders')
        .update({ payment_status: paymentStatus })
        .eq('id', orderId);

      if (error) {
        this.logger.error(
          `Failed to update order payment_status (${paymentStatus}) from ${source}`,
          error,
        );
      }
    } catch (error) {
      this.logger.error(
        `Order payment_status update failed (${paymentStatus}) from ${source}`,
        error,
      );
    }
  }

  private logMetric(event: string, payload: Record<string, unknown>) {
    this.logger.log(`[METRIC] ${event} ${JSON.stringify(payload)}`);
  }

  /**
   * Backward-compatible Toss API wrapper used by unit tests and service wrappers.
   */
  private async callTossApi(
    path: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    if (!this.tossSecretKey) {
      throw new PaymentProviderException(
        PaymentProvider.TOSS,
        'Toss Payments secret key is not configured',
      );
    }

    const url = `${this.tossApiBaseUrl}${path}`;
    const auth = Buffer.from(`${this.tossSecretKey}:`).toString('base64');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.tossTimeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await res.text();
      let data: Record<string, unknown> | null = null;
      try {
        data = text ? (JSON.parse(text) as Record<string, unknown>) : null;
      } catch {
        data = { raw: text };
      }

      if (!res.ok) {
        throw new PaymentProviderException(
          PaymentProvider.TOSS,
          (data?.message as string) || `HTTP ${res.status}`,
          data ?? undefined,
        );
      }

      return data;
    } catch (error: unknown) {
      if (error instanceof PaymentProviderException) {
        throw error;
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        (error as { name?: string }).name === 'AbortError'
      ) {
        throw new PaymentProviderException(
          PaymentProvider.TOSS,
          'Toss Payments request timed out',
        );
      }
      this.logger.error(`Toss API call failed for path ${path}:`, error);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async callTossPaymentsConfirmApi(
    paymentKey: string,
    orderId: string,
    amount: number,
  ): Promise<TossConfirmResponse> {
    const result = await this.callTossApi('/payments/confirm', {
      paymentKey,
      orderId,
      amount,
    });
    return (result ?? {}) as TossConfirmResponse;
  }

  private async callTossPaymentsRefundApi(
    paymentKey: string,
    amount: number,
    reason: string,
  ): Promise<Record<string, unknown> | null> {
    return this.callTossApi(`/payments/${paymentKey}/cancel`, {
      cancelReason: reason,
      cancelAmount: amount,
    });
  }

  private verifyTossWebhookSignature(
    rawBody: Buffer,
    headers: Record<string, string | string[]>,
  ): boolean {
    return this.tossClient.verifyWebhookSignature(rawBody, headers);
  }

  private verifyTossWebhookTimestamp(
    headers: Record<string, string | string[]>,
    createdAt?: string,
    nowMs = Date.now(),
  ): boolean {
    return this.tossClient.verifyWebhookTimestamp(
      headers,
      createdAt,
      this.tossWebhookMaxAgeMs,
      nowMs,
    );
  }

  /**
   * 결제 준비 - 주문 검증 및 결제 정보 반환
   * PUBLIC (인증 불필요)
   */
  async preparePayment(
    dto: PreparePaymentRequest,
  ): Promise<PreparePaymentResponse> {
    this.logger.log(`Preparing payment for order: ${dto.orderId}`);

    const sb = this.supabase.adminClient();

    // 1. orderId 해석
    const resolvedId = await this.resolveOrderId(sb, dto.orderId);
    if (!resolvedId) {
      throw new OrderNotFoundException(dto.orderId);
    }

    // 2. 주문 정보 조회
    const order = await this.getOrderForPayment(resolvedId);

    // 3. 주문 상태 검증
    if (order.status === 'CANCELLED') {
      throw new PaymentNotAllowedException('Order is cancelled');
    }

    // 4. 이미 결제된 주문인지 확인
    if (order.payment_status === 'PAID') {
      await this.updateOrderPaymentStatus(sb, resolvedId, 'PAID', 'prepare');
      throw new OrderAlreadyPaidException(resolvedId);
    }

    // 5. 금액 검증
    if (order.total_amount !== dto.amount) {
      throw new PaymentAmountMismatchException(order.total_amount, dto.amount);
    }

    // 6. 이미 결제 레코드가 있는지 확인
    const { data: existingPayment } = await sb
      .from('payments')
      .select('id, status')
      .eq('order_id', resolvedId)
      .maybeSingle();

    if (existingPayment && existingPayment.status === PaymentStatus.SUCCESS) {
      await this.updateOrderPaymentStatus(sb, resolvedId, 'PAID', 'prepare');
      throw new OrderAlreadyPaidException(resolvedId);
    }

    // 7. 주문명 생성 (첫번째 상품명 + 외 N건)
    let orderName = '주문';
    if (order.items && order.items.length > 0) {
      const firstName = order.items[0].product_name_snapshot || '상품';
      orderName =
        order.items.length > 1
          ? `${firstName} 외 ${order.items.length - 1}건`
          : firstName;
    }

    this.logger.log(`Payment preparation successful for order: ${resolvedId}`);

    return {
      orderId: resolvedId,
      orderNo: order.order_no || null,
      amount: order.total_amount,
      orderName,
      customerName: order.customer_name || '고객',
      customerPhone: order.customer_phone || '',
    };
  }

  /**
   * 결제 확정 - Toss Payments 승인 처리
   * PUBLIC (인증 불필요)
   */
  async confirmPayment(
    dto: ConfirmPaymentRequest,
  ): Promise<ConfirmPaymentResponse> {
    this.logger.log(`Confirming payment for order: ${dto.orderId}`);
    const idempotencyKey = dto.idempotencyKey?.trim() || undefined;
    this.logMetric('payment.confirm.start', {
      orderId: dto.orderId,
      amount: dto.amount,
      idempotencyKey,
    });

    const sb = this.supabase.adminClient();

    // 1. orderId 해석
    const resolvedId = await this.resolveOrderId(sb, dto.orderId);
    if (!resolvedId) {
      throw new OrderNotFoundException(dto.orderId);
    }

    // 2. 주문 정보 조회
    const order = await this.getOrderForPayment(resolvedId);

    // 3. 금액 재검증
    if (order.total_amount !== dto.amount) {
      throw new PaymentAmountMismatchException(order.total_amount, dto.amount);
    }

    // 4. idempotency key 기반 결제 중복 처리
    let existingPayment: ExistingPaymentRecord | null = null;

    if (idempotencyKey) {
      const { data: idempotentPayment } = await sb
        .from('payments')
        .select(
          'id, order_id, status, amount, paid_at, idempotency_key, metadata',
        )
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (idempotentPayment) {
        if (idempotentPayment.order_id !== resolvedId) {
          throw new PaymentNotAllowedException(
            'Idempotency key already used for another order',
          );
        }

        if (
          idempotentPayment.amount !== undefined &&
          idempotentPayment.amount !== null &&
          idempotentPayment.amount !== dto.amount
        ) {
          throw new PaymentAmountMismatchException(
            idempotentPayment.amount,
            dto.amount,
          );
        }

        if (idempotentPayment.status === PaymentStatus.SUCCESS) {
          await this.updateOrderPaymentStatus(
            sb,
            resolvedId,
            'PAID',
            'confirm-idempotency',
          );
          await this.sendCardOrderCompletionNotification(
            sb,
            idempotentPayment.id,
            resolvedId,
            idempotentPayment.metadata,
          );
          this.queueSettlementLineItemCreation(
            idempotentPayment.id,
            resolvedId,
            idempotentPayment.amount ?? dto.amount,
            idempotentPayment.paid_at || new Date().toISOString(),
          );
          this.logMetric('payment.confirm.idempotent_hit', {
            orderId: resolvedId,
            paymentId: idempotentPayment.id,
            idempotencyKey,
          });
          return {
            paymentId: idempotentPayment.id,
            orderId: resolvedId,
            status: PaymentStatus.SUCCESS,
            amount: idempotentPayment.amount ?? dto.amount,
            paidAt: idempotentPayment.paid_at || new Date().toISOString(),
          };
        }

        existingPayment = idempotentPayment;
      }
    }

    if (!existingPayment) {
      const { data: paymentByOrder } = await sb
        .from('payments')
        .select('id, status, amount, paid_at, idempotency_key, metadata')
        .eq('order_id', resolvedId)
        .maybeSingle();

      if (paymentByOrder && paymentByOrder.status === PaymentStatus.SUCCESS) {
        if (
          paymentByOrder.amount !== undefined &&
          paymentByOrder.amount !== null &&
          paymentByOrder.amount !== dto.amount
        ) {
          throw new PaymentAmountMismatchException(
            paymentByOrder.amount,
            dto.amount,
          );
        }

        await this.updateOrderPaymentStatus(
          sb,
          resolvedId,
          'PAID',
          'confirm-existing',
        );
        await this.sendCardOrderCompletionNotification(
          sb,
          paymentByOrder.id,
          resolvedId,
          paymentByOrder.metadata,
        );
        this.queueSettlementLineItemCreation(
          paymentByOrder.id,
          resolvedId,
          paymentByOrder.amount ?? dto.amount,
          paymentByOrder.paid_at || new Date().toISOString(),
        );
        this.logMetric('payment.confirm.existing_hit', {
          orderId: resolvedId,
          paymentId: paymentByOrder.id,
          idempotencyKey,
        });
        return {
          paymentId: paymentByOrder.id,
          orderId: resolvedId,
          status: PaymentStatus.SUCCESS,
          amount: paymentByOrder.amount ?? dto.amount,
          paidAt: paymentByOrder.paid_at || new Date().toISOString(),
        };
      }

      existingPayment = paymentByOrder as ExistingPaymentRecord | null;
    }

    // 5. Toss Payments API call
    let providerPaymentId: string | null = null;
    let providerResponse: TossConfirmResponse | null = null;

    if (this.tossMockMode) {
      this.logger.warn(
        'Toss Payments running in mock mode (TOSS_MOCK_MODE or missing key)',
      );
      providerPaymentId = `mock_${Date.now()}`;
    } else if (!this.tossSecretKey) {
      throw new PaymentProviderException(
        PaymentProvider.TOSS,
        'Toss Payments secret key is not configured',
      );
    } else {
      try {
        providerResponse = await this.callTossPaymentsConfirmApi(
          dto.paymentKey,
          dto.orderId,
          dto.amount,
        );
        providerPaymentId =
          (providerResponse?.paymentKey as string) || dto.paymentKey;
      } catch (error: unknown) {
        this.logger.error('Toss Payments API call failed', error);
        const errMsg =
          error instanceof Error
            ? error.message
            : 'Payment confirmation failed';

        // 결제 실패 레코드 생성
        if (existingPayment) {
          await sb
            .from('payments')
            .update({
              status: PaymentStatus.FAILED,
              provider_payment_key: dto.paymentKey,
              payment_method: PaymentMethod.CARD,
              failed_at: new Date().toISOString(),
              failure_reason: errMsg,
              idempotency_key:
                idempotencyKey ?? existingPayment.idempotency_key ?? null,
            })
            .eq('id', existingPayment.id);
        } else {
          await sb.from('payments').insert({
            order_id: resolvedId,
            amount: dto.amount,
            currency: 'KRW',
            provider: PaymentProvider.TOSS,
            provider_payment_key: dto.paymentKey,
            status: PaymentStatus.FAILED,
            payment_method: PaymentMethod.CARD,
            failed_at: new Date().toISOString(),
            failure_reason: errMsg,
            idempotency_key: idempotencyKey ?? null,
          });
        }

        await this.updateOrderPaymentStatus(
          sb,
          resolvedId,
          'FAILED',
          'confirm-provider-error',
        );
        this.logMetric('payment.confirm.provider_error', {
          orderId: resolvedId,
          idempotencyKey,
          error: errMsg,
        });
        throw new PaymentProviderException(PaymentProvider.TOSS, errMsg);
      }
    }

    // 6. 결제 성공 레코드 생성 또는 업데이트
    const paidAt = providerResponse?.approvedAt || new Date().toISOString();

    let payment;
    if (existingPayment) {
      // 기존 결제 레코드 업데이트
      const { data: updated, error: updateError } = await sb
        .from('payments')
        .update({
          status: PaymentStatus.SUCCESS,
          provider_payment_id: providerPaymentId,
          provider_payment_key: dto.paymentKey,
          paid_at: paidAt,
          failure_reason: null,
          metadata: providerResponse || {},
          idempotency_key:
            idempotencyKey ?? existingPayment.idempotency_key ?? null,
        })
        .eq('id', existingPayment.id)
        .select()
        .single();

      if (updateError) {
        this.logger.error('Failed to update payment record', updateError);
        throw new BusinessException(
          'Failed to update payment',
          'PAYMENT_UPDATE_FAILED',
          500,
          { error: updateError.message },
        );
      }

      payment = updated;
    } else {
      // 신규 결제 레코드 생성
      const { data: created, error: insertError } = await sb
        .from('payments')
        .insert({
          order_id: resolvedId,
          amount: dto.amount,
          currency: 'KRW',
          provider: PaymentProvider.TOSS,
          provider_payment_id: providerPaymentId,
          provider_payment_key: dto.paymentKey,
          status: PaymentStatus.SUCCESS,
          payment_method: PaymentMethod.CARD,
          paid_at: paidAt,
          metadata: providerResponse || {},
          idempotency_key: idempotencyKey ?? null,
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505' && idempotencyKey) {
          const { data: idempotentPayment } = await sb
            .from('payments')
            .select('id, status, amount, paid_at, order_id, metadata')
            .eq('idempotency_key', idempotencyKey)
            .maybeSingle();

          if (
            idempotentPayment &&
            idempotentPayment.status === PaymentStatus.SUCCESS
          ) {
            await this.updateOrderPaymentStatus(
              sb,
              idempotentPayment.order_id,
              'PAID',
              'confirm-idempotency-race',
            );
            await this.sendCardOrderCompletionNotification(
              sb,
              idempotentPayment.id,
              idempotentPayment.order_id,
              idempotentPayment.metadata,
            );
            this.queueSettlementLineItemCreation(
              idempotentPayment.id,
              idempotentPayment.order_id,
              idempotentPayment.amount ?? dto.amount,
              idempotentPayment.paid_at || new Date().toISOString(),
            );
            this.logMetric('payment.confirm.idempotency_race', {
              orderId: idempotentPayment.order_id,
              paymentId: idempotentPayment.id,
              idempotencyKey,
            });
            return {
              paymentId: idempotentPayment.id,
              orderId: idempotentPayment.order_id,
              status: PaymentStatus.SUCCESS,
              amount: idempotentPayment.amount ?? dto.amount,
              paidAt: idempotentPayment.paid_at || new Date().toISOString(),
            };
          }
        }

        this.logger.error('Failed to create payment record', insertError);
        throw new BusinessException(
          'Failed to create payment',
          'PAYMENT_CREATE_FAILED',
          500,
          { error: insertError.message },
        );
      }

      payment = created;
    }

    await this.updateOrderPaymentStatus(
      sb,
      resolvedId,
      'PAID',
      'confirm-success',
    );
    await this.sendCardOrderCompletionNotification(
      sb,
      payment.id,
      resolvedId,
      payment.metadata,
    );
    this.queueSettlementLineItemCreation(
      payment.id,
      resolvedId,
      payment.amount ?? dto.amount,
      paidAt,
    );
    this.logger.log(`Payment confirmed successfully: ${payment.id}`);
    this.logMetric('payment.confirm.success', {
      orderId: resolvedId,
      paymentId: payment.id,
      amount: payment.amount,
      idempotencyKey,
    });

    return {
      paymentId: payment.id,
      orderId: resolvedId,
      status: PaymentStatus.SUCCESS,
      amount: payment.amount,
      paidAt,
    };
  }

  async confirmManualTransferPayment(
    orderId: string,
    branchId: string,
  ): Promise<PaymentStatusResponse> {
    this.logger.log(
      `Manually confirming transfer payment for order: ${orderId}`,
    );

    const sb = this.supabase.adminClient();

    const { data: order, error: orderError } = await sb
      .from('orders')
      .select('id, branch_id')
      .eq('id', orderId)
      .eq('branch_id', branchId)
      .maybeSingle();

    if (orderError) {
      this.logger.error(
        'Failed to fetch order for manual payment confirm',
        orderError,
      );
      throw new BusinessException(
        'Failed to fetch order',
        'ORDER_FETCH_FAILED',
        500,
        { error: orderError.message, orderId, branchId },
      );
    }

    if (!order) {
      throw new OrderNotFoundException(orderId);
    }

    const { data: payment, error: paymentError } = await sb
      .from('payments')
      .select(
        'id, order_id, status, amount, paid_at, failure_reason, payment_method, provider',
      )
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (paymentError) {
      this.logger.error(
        'Failed to fetch payment for manual payment confirm',
        paymentError,
      );
      throw new BusinessException(
        'Failed to fetch payment',
        'PAYMENT_FETCH_FAILED',
        500,
        { error: paymentError.message, orderId },
      );
    }

    if (!payment) {
      throw new PaymentNotFoundException(orderId);
    }

    if (payment.payment_method !== PaymentMethod.TRANSFER) {
      throw new PaymentNotAllowedException(
        `payment method is ${payment.payment_method ?? 'UNKNOWN'}`,
      );
    }

    if (payment.provider && payment.provider !== PaymentProvider.MANUAL) {
      throw new PaymentNotAllowedException(
        `payment provider is ${payment.provider}`,
      );
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      return {
        id: payment.id,
        orderId: payment.order_id,
        status: PaymentStatus.SUCCESS,
        amount: payment.amount ?? 0,
        paidAt: payment.paid_at || undefined,
        failureReason: payment.failure_reason || undefined,
      };
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new PaymentNotAllowedException(
        `payment status is ${payment.status}`,
      );
    }

    const paidAt = new Date().toISOString();
    const { data: updated, error: updateError } = await sb
      .from('payments')
      .update({
        status: PaymentStatus.SUCCESS,
        paid_at: paidAt,
        failure_reason: null,
      })
      .eq('id', payment.id)
      .select('id, order_id, status, amount, paid_at, failure_reason')
      .maybeSingle();

    if (updateError || !updated) {
      this.logger.error('Failed to update manual payment status', updateError);
      throw new BusinessException(
        'Failed to confirm payment',
        'PAYMENT_CONFIRM_FAILED',
        500,
        { error: updateError?.message, paymentId: payment.id },
      );
    }

    await this.updateOrderPaymentStatus(
      sb,
      orderId,
      'PAID',
      'manual-transfer-confirm',
    );

    return {
      id: updated.id,
      orderId: updated.order_id,
      status: updated.status as PaymentStatus,
      amount: updated.amount ?? 0,
      paidAt: updated.paid_at || undefined,
      failureReason: updated.failure_reason || undefined,
    };
  }

  /**
   * 결제 목록 조회 (고객 영역 - branchId 필수)
   */
  async getPayments(
    branchId: string,
    paginationDto: PaginationDto = {},
  ): Promise<PaginatedResponse<PaymentListItemResponse>> {
    this.logger.log(`Fetching payments for branch: ${branchId}`);

    const sb = this.supabase.adminClient();
    const { page = 1, limit = 20 } = paginationDto;
    const { from, to } = PaginationUtil.getRange(page, limit);

    // Join으로 주문 정보 함께 조회
    const { data, error, count } = await sb
      .from('payments')
      .select(
        `
        id,
        order_id,
        amount,
        status,
        provider,
        payment_method,
        paid_at,
        created_at,
        orders!inner(
          order_no,
          branch_id
        )
      `,
        { count: 'exact' },
      )
      .eq('orders.branch_id', branchId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      this.logger.error('Failed to fetch payments', error);
      throw new BusinessException(
        'Failed to fetch payments',
        'PAYMENTS_FETCH_FAILED',
        500,
        { error: error.message },
      );
    }

    const payments = ((data || []) as unknown as PaymentListRow[]).map(
      (row) => ({
        id: row.id,
        orderId: row.order_id,
        orderNo: row.orders?.order_no || null,
        amount: row.amount,
        status: row.status as PaymentStatus,
        provider: row.provider as PaymentProvider,
        paymentMethod: row.payment_method as PaymentMethod | undefined,
        paidAt: row.paid_at || undefined,
        createdAt: row.created_at,
      }),
    );

    this.logger.log(
      `Fetched ${payments.length} payments for branch: ${branchId}`,
    );

    return PaginationUtil.createResponse(payments, count || 0, paginationDto);
  }

  /**
   * 결제 상세 조회 (고객 영역)
   */
  async getPaymentDetail(
    paymentId: string,
    branchId: string,
  ): Promise<PaymentDetailResponse> {
    this.logger.log(
      `Fetching payment detail: ${paymentId} for branch: ${branchId}`,
    );

    const sb = this.supabase.adminClient();

    const { data, error } = await sb
      .from('payments')
      .select(
        `
        *,
        orders!inner(
          order_no,
          branch_id
        )
      `,
      )
      .eq('id', paymentId)
      .eq('orders.branch_id', branchId)
      .maybeSingle();

    if (error) {
      this.logger.error('Failed to fetch payment detail', error);
      throw new BusinessException(
        'Failed to fetch payment detail',
        'PAYMENT_DETAIL_FETCH_FAILED',
        500,
        { error: error.message },
      );
    }

    if (!data) {
      throw new PaymentNotFoundException(paymentId);
    }

    return {
      id: data.id,
      orderId: data.order_id,
      orderNo: data.orders?.order_no || null,
      amount: data.amount,
      currency: data.currency,
      provider: data.provider as PaymentProvider,
      status: data.status as PaymentStatus,
      paymentMethod: data.payment_method as PaymentMethod | undefined,
      paymentMethodDetail: data.payment_method_detail || undefined,
      providerPaymentId: data.provider_payment_id || undefined,
      providerPaymentKey: data.provider_payment_key || undefined,
      paidAt: data.paid_at || undefined,
      failedAt: data.failed_at || undefined,
      cancelledAt: data.cancelled_at || undefined,
      refundedAt: data.refunded_at || undefined,
      failureReason: data.failure_reason || undefined,
      cancellationReason: data.cancellation_reason || undefined,
      refundAmount: data.refund_amount || 0,
      refundReason: data.refund_reason || undefined,
      metadata: data.metadata || undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * 환불 처리 (OWNER/ADMIN만 가능)
   */
  async refundPayment(
    paymentId: string,
    branchId: string,
    dto: RefundPaymentRequest,
  ): Promise<RefundPaymentResponse> {
    this.logger.log(`Refunding payment: ${paymentId}`);

    const sb = this.supabase.adminClient();

    // 1. 결제 정보 조회
    const { data: payment, error: fetchError } = await sb
      .from('payments')
      .select(
        `
        *,
        orders!inner(
          branch_id
        )
      `,
      )
      .eq('id', paymentId)
      .eq('orders.branch_id', branchId)
      .maybeSingle();

    if (fetchError) {
      this.logger.error('Failed to fetch payment for refund', fetchError);
      throw new BusinessException(
        'Failed to fetch payment',
        'PAYMENT_FETCH_FAILED',
        500,
        { error: fetchError.message },
      );
    }

    if (!payment) {
      throw new PaymentNotFoundException(paymentId);
    }

    // 2. 환불 가능한 상태 확인
    if (
      payment.status !== PaymentStatus.SUCCESS &&
      payment.status !== PaymentStatus.PARTIAL_REFUNDED
    ) {
      throw new RefundNotAllowedException(
        `Payment status is ${payment.status}`,
      );
    }

    // 3. 환불 금액 계산
    const refundAmount = dto.amount || payment.amount;
    const availableAmount = payment.amount - payment.refund_amount;

    if (refundAmount > availableAmount) {
      throw new RefundAmountExceededException(refundAmount, availableAmount);
    }

    // 4. Toss Payments refund call
    if (this.tossMockMode) {
      this.logger.warn('Toss Payments refund running in mock mode');
    } else if (!this.tossSecretKey) {
      throw new PaymentProviderException(
        PaymentProvider.TOSS,
        'Toss Payments secret key is not configured',
      );
    } else if (payment.provider_payment_key) {
      try {
        await this.callTossPaymentsRefundApi(
          payment.provider_payment_key,
          refundAmount,
          dto.reason,
        );
      } catch (error: unknown) {
        if (error instanceof PaymentProviderException) {
          throw error;
        }
        this.logger.error('Toss Payments refund API call failed', error);
        throw new PaymentProviderException(
          PaymentProvider.TOSS,
          error instanceof Error ? error.message : 'Refund failed',
        );
      }
    } else {
      throw new PaymentProviderException(
        PaymentProvider.TOSS,
        'Missing provider payment key for refund',
      );
    }

    // 5. 환불 상태 업데이트
    const newRefundAmount = payment.refund_amount + refundAmount;
    const newStatus =
      newRefundAmount >= payment.amount
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIAL_REFUNDED;

    const refundedAt = new Date().toISOString();

    const { data: updated, error: updateError } = await sb
      .from('payments')
      .update({
        status: newStatus,
        refund_amount: newRefundAmount,
        refund_reason: dto.reason,
        refunded_at: refundedAt,
      })
      .eq('id', paymentId)
      .select()
      .single();

    if (updateError) {
      this.logger.error('Failed to update payment refund', updateError);
      throw new BusinessException(
        'Failed to update refund',
        'REFUND_UPDATE_FAILED',
        500,
        { error: updateError.message },
      );
    }

    await this.updateOrderPaymentStatus(
      sb,
      payment.order_id,
      newStatus,
      'refund',
    );
    this.queueSettlementLineItemAdjustmentForRefund(
      payment.id,
      payment.order_id,
      refundAmount,
      refundedAt,
    );
    this.logger.log(`Payment refunded successfully: ${paymentId}`);

    return {
      paymentId: updated.id,
      status: updated.status as PaymentStatus,
      refundAmount: newRefundAmount,
      refundedAt,
    };
  }

  async refundOrderPaymentForCancellation(
    orderIdOrNo: string,
    branchId: string,
    reason = '주문 취소로 인한 자동 환불',
  ): Promise<void> {
    const sb = this.supabase.adminClient();

    const resolvedId = await this.resolveOrderId(sb, orderIdOrNo, branchId);
    if (!resolvedId) {
      throw new OrderNotFoundException(orderIdOrNo);
    }

    const { data: order, error: orderError } = await sb
      .from('orders')
      .select('id, branch_id, status')
      .eq('id', resolvedId)
      .eq('branch_id', branchId)
      .maybeSingle();

    if (orderError) {
      this.logger.error(
        'Failed to fetch order for cancellation refund',
        orderError,
      );
      throw new BusinessException(
        'Failed to fetch order for refund',
        'ORDER_FETCH_FAILED',
        500,
        { orderId: resolvedId, branchId, error: orderError.message },
      );
    }

    if (!order) {
      throw new OrderNotFoundException(orderIdOrNo);
    }

    const shouldStageCompletedOrder =
      String((order as { status?: string | null }).status ?? '') ===
      'COMPLETED';
    let stagedCompletedOrder = false;

    if (shouldStageCompletedOrder) {
      stagedCompletedOrder = await this.stageCompletedOrderForRefund(
        sb,
        resolvedId,
        branchId,
      );
    }

    const { data: payment, error: paymentError } = await sb
      .from('payments')
      .select('id, status, amount, refund_amount')
      .eq('order_id', resolvedId)
      .maybeSingle();

    if (paymentError) {
      this.logger.error(
        'Failed to fetch payment for cancellation refund',
        paymentError,
      );
      throw new BusinessException(
        'Failed to fetch payment',
        'PAYMENT_FETCH_FAILED',
        500,
        { orderId: resolvedId, branchId, error: paymentError.message },
      );
    }

    if (!payment) {
      return;
    }

    const paymentRecord = payment as CancellationPaymentRecord;

    if (
      paymentRecord.status === PaymentStatus.CANCELLED ||
      paymentRecord.status === PaymentStatus.REFUNDED
    ) {
      return;
    }

    // Unpaid or failed payments can be cancelled without a refund.
    if (
      paymentRecord.status === PaymentStatus.PENDING ||
      paymentRecord.status === PaymentStatus.FAILED
    ) {
      return;
    }

    if (
      paymentRecord.status !== PaymentStatus.SUCCESS &&
      paymentRecord.status !== PaymentStatus.PARTIAL_REFUNDED
    ) {
      throw new RefundNotAllowedException(
        `Payment status is ${paymentRecord.status}`,
      );
    }

    const refundAmount =
      (paymentRecord.amount ?? 0) - (paymentRecord.refund_amount ?? 0);

    if (refundAmount <= 0) {
      return;
    }

    try {
      await this.refundPayment(paymentRecord.id, branchId, {
        reason,
        amount: refundAmount,
      });
    } catch (error) {
      if (stagedCompletedOrder) {
        await this.restoreRefundStagedOrderStatus(sb, resolvedId, branchId);
      }
      throw error;
    }
  }

  private async stageCompletedOrderForRefund(
    sb: SupabaseClient,
    orderId: string,
    branchId: string,
  ): Promise<boolean> {
    try {
      const { error } = await sb
        .from('orders')
        .update({
          status: 'REFUNDED',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('branch_id', branchId);

      if (error) {
        this.logger.warn(
          `Failed to stage completed order ${orderId} for refund: ${error.message}`,
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.warn(
        `Unexpected error while staging completed order ${orderId} for refund`,
        error,
      );
      return false;
    }
  }

  private async restoreRefundStagedOrderStatus(
    sb: SupabaseClient,
    orderId: string,
    branchId: string,
  ): Promise<void> {
    try {
      const { error } = await sb
        .from('orders')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('branch_id', branchId);

      if (error) {
        this.logger.warn(
          `Failed to restore refund-staged order ${orderId}: ${error.message}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Unexpected error while restoring refund-staged order ${orderId}`,
        error,
      );
    }
  }

  /**
   * Toss Payments ?뱁썒 泥섎━
   */
  async handleTossWebhook(
    webhookData: TossWebhookRequest,
    headers: Record<string, string | string[]>,
    rawBody?: Buffer,
  ): Promise<void> {
    this.logger.log(`Received Toss webhook: ${webhookData.eventType}`);

    const sb = this.supabase.adminClient();

    if (process.env.TOSS_WEBHOOK_SECRET) {
      if (!rawBody) {
        throw new WebhookSignatureVerificationException();
      }

      const isValid = this.verifyTossWebhookSignature(rawBody, headers);
      if (!isValid) {
        throw new WebhookSignatureVerificationException();
      }
    }

    const isFresh = this.verifyTossWebhookTimestamp(
      headers,
      webhookData.createdAt,
    );
    if (!isFresh) {
      throw new WebhookTimestampVerificationException();
    }

    // 1. 웹훅 로그 저장
    const { paymentKey } = webhookData.data;

    let paymentId: string | null = null;

    // 결제 정보 조회
    const { data: payment } = await sb
      .from('payments')
      .select(
        'id, order_id, status, amount, provider_payment_key, refund_amount, metadata',
      )
      .eq('provider_payment_key', paymentKey)
      .maybeSingle();

    paymentId = payment?.id || null;

    await sb.from('payment_webhook_logs').insert({
      payment_id: paymentId,
      provider: PaymentProvider.TOSS,
      event_type: webhookData.eventType,
      request_body: webhookData,
      request_headers: headers,
      processed: false,
    });

    // 2. 이벤트 타입에 따라 처리
    try {
      switch (webhookData.eventType) {
        case 'PAYMENT_CONFIRMED':
          await this.handlePaymentConfirmedWebhook(
            webhookData,
            (payment as WebhookPaymentRecord | null) || null,
          );
          break;
        case 'PAYMENT_CANCELLED':
          await this.handlePaymentCancelledWebhook(
            webhookData,
            (payment as WebhookPaymentRecord | null) || null,
          );
          break;
        // TODO: Add more event types as needed
        default:
          this.logger.warn(
            `Unhandled webhook event type: ${webhookData.eventType}`,
          );
      }

      // 웹훅 처리 완료 업데이트
      if (paymentId) {
        await sb
          .from('payment_webhook_logs')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('payment_id', paymentId)
          .eq('event_type', webhookData.eventType);
      }
    } catch (error: unknown) {
      this.logger.error('Webhook processing failed', error);

      // 에러 로그 저장
      if (paymentId) {
        await sb
          .from('payment_webhook_logs')
          .update({
            error_message:
              error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('payment_id', paymentId)
          .eq('event_type', webhookData.eventType);
      }

      throw error;
    }
  }

  /**
   * PAYMENT_CONFIRMED 웹훅 처리
   */
  private async handlePaymentConfirmedWebhook(
    webhookData: TossWebhookRequest,
    payment: WebhookPaymentRecord | null,
  ): Promise<void> {
    const { orderId, paymentKey, amount } = webhookData.data;

    const sb = this.supabase.adminClient();
    let confirmedPaymentId: string | null = payment?.id ?? null;
    let confirmedPaymentMetadata: unknown = payment?.metadata ?? null;

    // orderId 해석
    const resolvedId = await this.resolveOrderId(sb, orderId);
    if (!resolvedId) {
      this.logger.error(`Order not found in webhook: ${orderId}`);
      return;
    }

    const { data: order, error: orderError } = await sb
      .from('orders')
      .select('id, total_amount')
      .eq('id', resolvedId)
      .maybeSingle();

    if (orderError) {
      this.logger.error('Failed to fetch order for webhook', orderError);
      throw new BusinessException(
        'Failed to fetch order',
        'WEBHOOK_ORDER_FETCH_FAILED',
        500,
        { error: orderError.message },
      );
    }

    if (!order) {
      this.logger.error(`Order not found in webhook: ${orderId}`);
      return;
    }

    if (
      amount !== undefined &&
      amount !== null &&
      order.total_amount !== amount
    ) {
      throw new BusinessException(
        'Payment amount mismatch',
        'WEBHOOK_PAYMENT_AMOUNT_MISMATCH',
        400,
        { expected: order.total_amount, actual: amount },
      );
    }

    if (payment) {
      if (
        amount !== undefined &&
        amount !== null &&
        payment.amount !== undefined &&
        payment.amount !== null &&
        payment.amount !== amount
      ) {
        throw new BusinessException(
          'Payment amount mismatch',
          'WEBHOOK_PAYMENT_AMOUNT_MISMATCH',
          400,
          { expected: payment.amount, actual: amount },
        );
      }

      if (payment.status === PaymentStatus.SUCCESS) {
        this.logger.log(`Payment already confirmed via webhook: ${orderId}`);
        await this.sendCardOrderCompletionNotification(
          sb,
          payment.id,
          resolvedId,
          payment.metadata,
        );
        this.queueSettlementLineItemCreation(
          payment.id,
          resolvedId,
          payment.amount ?? amount ?? order.total_amount,
          new Date().toISOString(),
        );
        return;
      }

      if (
        payment.status === PaymentStatus.CANCELLED ||
        payment.status === PaymentStatus.REFUNDED ||
        payment.status === PaymentStatus.PARTIAL_REFUNDED
      ) {
        this.logger.warn(
          `Ignoring confirmed webhook for cancelled/refunded payment: ${orderId}`,
        );
        return;
      }

      const { error } = await sb
        .from('payments')
        .update({
          status: PaymentStatus.SUCCESS,
          paid_at: new Date().toISOString(),
          metadata: webhookData.data,
        })
        .eq('order_id', resolvedId)
        .eq('provider_payment_key', paymentKey);

      if (error) {
        this.logger.error('Failed to update payment from webhook', error);
        throw new BusinessException(
          'Failed to update payment',
          'WEBHOOK_PAYMENT_UPDATE_FAILED',
          500,
          { error: error.message },
        );
      }

      confirmedPaymentMetadata = webhookData.data;
    } else {
      const { error } = await sb.from('payments').insert({
        order_id: resolvedId,
        amount: amount ?? order.total_amount,
        currency: 'KRW',
        provider: PaymentProvider.TOSS,
        provider_payment_key: paymentKey,
        status: PaymentStatus.SUCCESS,
        paid_at: new Date().toISOString(),
        metadata: webhookData.data,
      });

      if (error) {
        this.logger.error('Failed to create payment from webhook', error);
        throw new BusinessException(
          'Failed to create payment',
          'WEBHOOK_PAYMENT_CREATE_FAILED',
          500,
          { error: error.message },
        );
      }

      confirmedPaymentMetadata = webhookData.data;
      if (this.notificationsService) {
        const { data: createdPayment } = await sb
          .from('payments')
          .select('id, metadata')
          .eq('provider_payment_key', paymentKey)
          .maybeSingle();
        confirmedPaymentId = createdPayment?.id ?? null;
        confirmedPaymentMetadata =
          createdPayment?.metadata ?? confirmedPaymentMetadata;
      }
    }

    await this.updateOrderPaymentStatus(
      sb,
      resolvedId,
      'PAID',
      'webhook-confirmed',
    );
    if (confirmedPaymentId) {
      await this.sendCardOrderCompletionNotification(
        sb,
        confirmedPaymentId,
        resolvedId,
        confirmedPaymentMetadata,
      );
      this.queueSettlementLineItemCreation(
        confirmedPaymentId,
        resolvedId,
        amount ?? order.total_amount,
        new Date().toISOString(),
      );
    }
    this.logger.log(`Payment confirmed via webhook: ${orderId}`);
  }

  /**
   * PAYMENT_CANCELLED ?뱁썒 泥섎━
   */
  private async handlePaymentCancelledWebhook(
    webhookData: TossWebhookRequest,
    payment: WebhookPaymentRecord | null,
  ): Promise<void> {
    const { orderId, paymentKey } = webhookData.data;

    const sb = this.supabase.adminClient();

    // orderId 해석
    const resolvedId = await this.resolveOrderId(sb, orderId);
    if (!resolvedId) {
      this.logger.error(`Order not found in webhook: ${orderId}`);
      return;
    }

    if (
      payment &&
      (payment.status === PaymentStatus.CANCELLED ||
        payment.status === PaymentStatus.REFUNDED ||
        payment.status === PaymentStatus.PARTIAL_REFUNDED)
    ) {
      this.logger.log(`Payment already cancelled/refunded: ${orderId}`);
      return;
    }

    if (payment) {
      const { error } = await sb
        .from('payments')
        .update({
          status: PaymentStatus.CANCELLED,
          cancelled_at: new Date().toISOString(),
          cancellation_reason:
            webhookData.data.cancellationReason || 'Cancelled by customer',
        })
        .eq('order_id', resolvedId)
        .eq('provider_payment_key', paymentKey);

      if (error) {
        this.logger.error(
          'Failed to update payment cancellation from webhook',
          error,
        );
        throw new BusinessException(
          'Failed to update payment cancellation',
          'WEBHOOK_CANCELLATION_UPDATE_FAILED',
          500,
          { error: error.message },
        );
      }
    } else {
      const { data: order, error: orderError } = await sb
        .from('orders')
        .select('id, total_amount')
        .eq('id', resolvedId)
        .maybeSingle();

      if (orderError) {
        this.logger.error('Failed to fetch order for webhook', orderError);
        throw new BusinessException(
          'Failed to fetch order',
          'WEBHOOK_ORDER_FETCH_FAILED',
          500,
          { error: orderError.message },
        );
      }

      if (!order) {
        this.logger.error(`Order not found in webhook: ${orderId}`);
        return;
      }

      const { error } = await sb.from('payments').insert({
        order_id: resolvedId,
        amount: webhookData.data.amount ?? order.total_amount,
        currency: 'KRW',
        provider: PaymentProvider.TOSS,
        provider_payment_key: paymentKey,
        status: PaymentStatus.CANCELLED,
        cancelled_at: new Date().toISOString(),
        cancellation_reason:
          webhookData.data.cancellationReason || 'Cancelled by customer',
        metadata: webhookData.data,
      });

      if (error) {
        this.logger.error(
          'Failed to create payment cancellation from webhook',
          error,
        );
        throw new BusinessException(
          'Failed to create payment cancellation',
          'WEBHOOK_CANCELLATION_CREATE_FAILED',
          500,
          { error: error.message },
        );
      }
    }

    await this.updateOrderPaymentStatus(
      sb,
      resolvedId,
      'CANCELLED',
      'webhook-cancelled',
    );
    this.logger.log(`Payment cancelled via webhook: ${orderId}`);
  }
}
