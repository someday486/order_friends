import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { SupabaseService } from '../../infra/supabase/supabase.service';
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

  private readonly tossSecretKey = process.env.TOSS_SECRET_KEY || '';
  private readonly tossClientKey = process.env.TOSS_CLIENT_KEY || '';
  private readonly tossApiBaseUrl =
    process.env.TOSS_API_BASE_URL || 'https://api.tosspayments.com/v1';
  private readonly tossTimeoutMs: number;
  private readonly tossMockMode: boolean;
  private readonly tossWebhookSecret = process.env.TOSS_WEBHOOK_SECRET || '';
  private readonly tossWebhookSignatureHeader = (
    process.env.TOSS_WEBHOOK_SIGNATURE_HEADER || 'toss-signature'
  ).toLowerCase();

  constructor(private readonly supabase: SupabaseService) {
    const rawTimeout = Number(process.env.TOSS_TIMEOUT_MS);
    this.tossTimeoutMs =
      Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 15000;

    const rawMock = process.env.TOSS_MOCK_MODE;
    const envMock =
      rawMock !== undefined
        ? ['true', '1', 'yes'].includes(rawMock.trim().toLowerCase())
        : false;

    this.tossMockMode =
      envMock || (!this.tossSecretKey && process.env.NODE_ENV !== 'production');
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
   * orderId ?먮뒗 orderNo瑜??ㅼ젣 UUID濡?蹂??
   */
  private async resolveOrderId(
    sb: any,
    orderIdOrNo: string,
    branchId?: string,
  ): Promise<string | null> {
    // UUID硫?id濡?議고쉶
    if (this.isUuid(orderIdOrNo)) {
      let query = sb.from('orders').select('id').eq('id', orderIdOrNo);
      if (branchId) query = query.eq('branch_id', branchId);
      const byId = await query.maybeSingle();
      if (!byId.error && byId.data?.id) return byId.data.id;
    }

    // order_no 議고쉶
    let noQuery = sb.from('orders').select('id').eq('order_no', orderIdOrNo);
    if (branchId) noQuery = noQuery.eq('branch_id', branchId);
    const byNo = await noQuery.maybeSingle();
    if (!byNo.error && byNo.data?.id) return byNo.data.id;

    return null;
  }

  /**
   * 二쇰Ц ?뺣낫 議고쉶 (寃곗젣 以鍮꾩슜)
   */
  private async getOrderForPayment(orderId: string): Promise<any> {
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

  private async updateOrderPaymentStatus(
    sb: any,
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

  private logMetric(event: string, payload: Record<string, any>) {
    this.logger.log(`[METRIC] ${event} ${JSON.stringify(payload)}`);
  }

  /**
   * 寃곗젣 以鍮?- 二쇰Ц 寃利?諛?寃곗젣 ?뺣낫 諛섑솚
   * PUBLIC (?몄쬆 遺덊븘??
   */
  async preparePayment(
    dto: PreparePaymentRequest,
  ): Promise<PreparePaymentResponse> {
    this.logger.log(`Preparing payment for order: ${dto.orderId}`);

    const sb = this.supabase.adminClient();

    // 1. orderId ?댁꽍
    const resolvedId = await this.resolveOrderId(sb, dto.orderId);
    if (!resolvedId) {
      throw new OrderNotFoundException(dto.orderId);
    }

    // 2. 二쇰Ц ?뺣낫 議고쉶
    const order = await this.getOrderForPayment(resolvedId);

    // 3. 二쇰Ц ?곹깭 寃利?
    if (order.status === 'CANCELLED') {
      throw new PaymentNotAllowedException('Order is cancelled');
    }

    // 4. ?대? 寃곗젣??二쇰Ц?몄? ?뺤씤
    if (order.payment_status === 'PAID') {
      await this.updateOrderPaymentStatus(sb, resolvedId, 'PAID', 'prepare');
      throw new OrderAlreadyPaidException(resolvedId);
    }

    // 5. 湲덉븸 寃利?
    if (order.total_amount !== dto.amount) {
      throw new PaymentAmountMismatchException(order.total_amount, dto.amount);
    }

    // 6. ?대? 寃곗젣 ?덉퐫?쒓? ?덈뒗吏 ?뺤씤
    const { data: existingPayment } = await sb
      .from('payments')
      .select('id, status')
      .eq('order_id', resolvedId)
      .maybeSingle();

    if (existingPayment && existingPayment.status === PaymentStatus.SUCCESS) {
      await this.updateOrderPaymentStatus(sb, resolvedId, 'PAID', 'prepare');
      throw new OrderAlreadyPaidException(resolvedId);
    }

    // 7. 二쇰Ц紐??앹꽦 (泥?踰덉㎏ ?곹뭹紐?+ ??N嫄?
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
      customerName: order.customer_name || '怨좉컼',
      customerPhone: order.customer_phone || '',
    };
  }

  /**
   * 寃곗젣 ?뺤젙 - Toss Payments ?뱀씤 泥섎━
   * PUBLIC (?몄쬆 遺덊븘??
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

    // 1. orderId ?댁꽍
    const resolvedId = await this.resolveOrderId(sb, dto.orderId);
    if (!resolvedId) {
      throw new OrderNotFoundException(dto.orderId);
    }

    // 2. 二쇰Ц ?뺣낫 議고쉶
    const order = await this.getOrderForPayment(resolvedId);

    // 3. 湲덉븸 ?ш?利?
    if (order.total_amount !== dto.amount) {
      throw new PaymentAmountMismatchException(order.total_amount, dto.amount);
    }

    // 4. idempotency key 기반 결제 중복 처리
    let existingPayment: any | null = null;

    if (idempotencyKey) {
      const { data: idempotentPayment } = await sb
        .from('payments')
        .select('id, order_id, status, amount, paid_at, idempotency_key')
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
        .select('id, status, amount, paid_at, idempotency_key')
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

      existingPayment = paymentByOrder;
    }

    // 5. Toss Payments API call
    let providerPaymentId: string | null = null;
    let providerResponse: any = null;

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
        providerPaymentId = providerResponse?.paymentKey || dto.paymentKey;
      } catch (error: any) {
        this.logger.error('Toss Payments API call failed', error);

        // 寃곗젣 ?ㅽ뙣 ?덉퐫???앹꽦
        if (existingPayment) {
          await sb
            .from('payments')
            .update({
              status: PaymentStatus.FAILED,
              provider_payment_key: dto.paymentKey,
              payment_method: PaymentMethod.CARD,
              failed_at: new Date().toISOString(),
              failure_reason: error?.message || 'Payment confirmation failed',
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
            failure_reason: error?.message || 'Payment confirmation failed',
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
          error: error?.message || 'Payment confirmation failed',
        });
        throw new PaymentProviderException(
          PaymentProvider.TOSS,
          error?.message || 'Payment confirmation failed',
          error?.response,
        );
      }
    }

    // 6. 寃곗젣 ?깃났 ?덉퐫???앹꽦 ?먮뒗 ?낅뜲?댄듃
    const paidAt = providerResponse?.approvedAt || new Date().toISOString();

    let payment;
    if (existingPayment) {
      // 湲곗〈 ?덉퐫???낅뜲?댄듃
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
      // ???덉퐫???앹꽦
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
            .select('id, status, amount, paid_at, order_id')
            .eq('idempotency_key', idempotencyKey)
            .maybeSingle();

          if (idempotentPayment && idempotentPayment.status === PaymentStatus.SUCCESS) {
            await this.updateOrderPaymentStatus(
              sb,
              idempotentPayment.order_id,
              'PAID',
              'confirm-idempotency-race',
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

    await this.updateOrderPaymentStatus(sb, resolvedId, 'PAID', 'confirm-success');
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

  /**
   * 寃곗젣 ?곹깭 議고쉶
   * PUBLIC (?몄쬆 遺덊븘??
   */
  async getPaymentStatus(orderIdOrNo: string): Promise<PaymentStatusResponse> {
    this.logger.log(`Fetching payment status for order: ${orderIdOrNo}`);

    const sb = this.supabase.adminClient();

    // orderId ?댁꽍
    const resolvedId = await this.resolveOrderId(sb, orderIdOrNo);
    if (!resolvedId) {
      throw new OrderNotFoundException(orderIdOrNo);
    }

    // 寃곗젣 ?뺣낫 議고쉶
    const { data, error } = await sb
      .from('payments')
      .select('id, order_id, status, amount, paid_at, failure_reason')
      .eq('order_id', resolvedId)
      .maybeSingle();

    if (error) {
      this.logger.error('Failed to fetch payment status', error);
      throw new BusinessException(
        'Failed to fetch payment status',
        'PAYMENT_STATUS_FETCH_FAILED',
        500,
        { error: error.message },
      );
    }

    if (!data) {
      throw new PaymentNotFoundException(orderIdOrNo);
    }

    return {
      id: data.id,
      orderId: data.order_id,
      status: data.status as PaymentStatus,
      amount: data.amount,
      paidAt: data.paid_at || undefined,
      failureReason: data.failure_reason || undefined,
    };
  }

  /**
   * 寃곗젣 紐⑸줉 議고쉶 (怨좉컼 ?곸뿭 - branchId ?꾩닔)
   */
  async getPayments(
    branchId: string,
    paginationDto: PaginationDto = {},
  ): Promise<PaginatedResponse<PaymentListItemResponse>> {
    this.logger.log(`Fetching payments for branch: ${branchId}`);

    const sb = this.supabase.adminClient();
    const { page = 1, limit = 20 } = paginationDto;
    const { from, to } = PaginationUtil.getRange(page, limit);

    // Join?쇰줈 二쇰Ц ?뺣낫 ?④퍡 議고쉶
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

    const payments = (data || []).map((row: any) => ({
      id: row.id,
      orderId: row.order_id,
      orderNo: row.orders?.order_no || null,
      amount: row.amount,
      status: row.status as PaymentStatus,
      provider: row.provider as PaymentProvider,
      paymentMethod: row.payment_method as PaymentMethod | undefined,
      paidAt: row.paid_at || undefined,
      createdAt: row.created_at,
    }));

    this.logger.log(
      `Fetched ${payments.length} payments for branch: ${branchId}`,
    );

    return PaginationUtil.createResponse(payments, count || 0, paginationDto);
  }

  /**
   * 寃곗젣 ?곸꽭 議고쉶 (怨좉컼 ?곸뿭)
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
   * ?섎텋 泥섎━ (OWNER/ADMIN留?媛??
   */
  async refundPayment(
    paymentId: string,
    branchId: string,
    dto: RefundPaymentRequest,
  ): Promise<RefundPaymentResponse> {
    this.logger.log(`Refunding payment: ${paymentId}`);

    const sb = this.supabase.adminClient();

    // 1. 寃곗젣 ?뺣낫 議고쉶
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

    // 2. ?섎텋 媛???곹깭 ?뺤씤
    if (
      payment.status !== PaymentStatus.SUCCESS &&
      payment.status !== PaymentStatus.PARTIAL_REFUNDED
    ) {
      throw new RefundNotAllowedException(
        `Payment status is ${payment.status}`,
      );
    }

    // 3. ?섎텋 湲덉븸 怨꾩궛
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
      } catch (error: any) {
        if (error instanceof PaymentProviderException) {
          throw error;
        }
        this.logger.error('Toss Payments refund API call failed', error);
        throw new PaymentProviderException(
          PaymentProvider.TOSS,
          error?.message || 'Refund failed',
          error?.response,
        );
      }
    } else {
      throw new PaymentProviderException(
        PaymentProvider.TOSS,
        'Missing provider payment key for refund',
      );
    }

    // 5. ?섎텋 ?곹깭 ?낅뜲?댄듃
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
    this.logger.log(`Payment refunded successfully: ${paymentId}`);

    return {
      paymentId: updated.id,
      status: updated.status as PaymentStatus,
      refundAmount: newRefundAmount,
      refundedAt,
    };
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

    if (this.tossWebhookSecret) {
      if (!rawBody) {
        throw new WebhookSignatureVerificationException();
      }

      const isValid = this.verifyTossWebhookSignature(rawBody, headers);
      if (!isValid) {
        throw new WebhookSignatureVerificationException();
      }
    }

    // 1. ?뱁썒 濡쒓렇 ???
    const { orderId, paymentKey, status, amount } = webhookData.data;

    let paymentId: string | null = null;

    // 寃곗젣 ?뺣낫 議고쉶
    const { data: payment } = await sb
      .from('payments')
      .select('id, order_id, status, amount')
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

    // 2. ?대깽????낆뿉 ?곕씪 泥섎━
    try {
      switch (webhookData.eventType) {
        case 'PAYMENT_CONFIRMED':
          await this.handlePaymentConfirmedWebhook(webhookData, payment || null);
          break;
        case 'PAYMENT_CANCELLED':
          await this.handlePaymentCancelledWebhook(webhookData, payment || null);
          break;
        // TODO: Add more event types as needed
        default:
          this.logger.warn(
            `Unhandled webhook event type: ${webhookData.eventType}`,
          );
      }

      // ?뱁썒 泥섎━ ?꾨즺 ?낅뜲?댄듃
      if (paymentId) {
        await sb
          .from('payment_webhook_logs')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('payment_id', paymentId)
          .eq('event_type', webhookData.eventType);
      }
    } catch (error: any) {
      this.logger.error('Webhook processing failed', error);

      // ?먮윭 濡쒓렇 ???
      if (paymentId) {
        await sb
          .from('payment_webhook_logs')
          .update({ error_message: error.message })
          .eq('payment_id', paymentId)
          .eq('event_type', webhookData.eventType);
      }

      throw error;
    }
  }

  /**
   * PAYMENT_CONFIRMED ?뱁썒 泥섎━
   */
  private async handlePaymentConfirmedWebhook(
    webhookData: TossWebhookRequest,
    payment: any | null,
  ): Promise<void> {
    const { orderId, paymentKey, status, amount } = webhookData.data;

    const sb = this.supabase.adminClient();

    // orderId ?댁꽍
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

    if (amount !== undefined && amount !== null && order.total_amount !== amount) {
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
    }

    await this.updateOrderPaymentStatus(
      sb,
      resolvedId,
      'PAID',
      'webhook-confirmed',
    );
    this.logger.log(`Payment confirmed via webhook: ${orderId}`);
  }

  /**
   * PAYMENT_CANCELLED ?뱁썒 泥섎━
   */
  private async handlePaymentCancelledWebhook(
    webhookData: TossWebhookRequest,
    payment: any | null,
  ): Promise<void> {
    const { orderId, paymentKey } = webhookData.data;

    const sb = this.supabase.adminClient();

    // orderId ?댁꽍
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

  private async callTossPaymentsConfirmApi(
    paymentKey: string,
    orderId: string,
    amount: number,
  ): Promise<any> {
    return this.callTossApi('/payments/confirm', {
      paymentKey,
      orderId,
      amount,
    });
  }

  private async callTossPaymentsRefundApi(
    paymentKey: string,
    amount: number,
    reason: string,
  ): Promise<any> {
    return this.callTossApi(`/payments/${paymentKey}/cancel`, {
      cancelReason: reason,
      cancelAmount: amount,
    });
  }

  private async callTossApi(path: string, body: any): Promise<any> {
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
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { raw: text };
      }

      if (!res.ok) {
        throw new PaymentProviderException(
          PaymentProvider.TOSS,
          data?.message || `HTTP ${res.status}`,
          data,
        );
      }

      return data;
    } catch (error: any) {
      if (error instanceof PaymentProviderException) {
        throw error;
      }
      if (error?.name === 'AbortError') {
        throw new PaymentProviderException(
          PaymentProvider.TOSS,
          'Toss Payments request timed out',
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private verifyTossWebhookSignature(
    rawBody: Buffer,
    headers: Record<string, string | string[]>,
  ): boolean {
    if (!this.tossWebhookSecret) return true;

    const headerName = this.tossWebhookSignatureHeader;
    const headerValue =
      headers[headerName] ||
      headers[headerName.toLowerCase()] ||
      headers[headerName.toUpperCase()];

    const signature = Array.isArray(headerValue)
      ? headerValue[0]
      : headerValue;

    if (!signature) return false;

    const normalized = signature.startsWith('v1=')
      ? signature.slice(3)
      : signature;

    const hmac = createHmac('sha256', this.tossWebhookSecret)
      .update(rawBody)
      .digest('hex');

    if (normalized.length !== hmac.length) return false;

    return timingSafeEqual(
      Buffer.from(normalized, 'utf8'),
      Buffer.from(hmac, 'utf8'),
    );
  }
}




