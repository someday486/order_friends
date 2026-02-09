"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PaymentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
const payment_dto_1 = require("./dto/payment.dto");
const payment_exception_1 = require("../../common/exceptions/payment.exception");
const order_exception_1 = require("../../common/exceptions/order.exception");
const business_exception_1 = require("../../common/exceptions/business.exception");
const pagination_util_1 = require("../../common/utils/pagination.util");
let PaymentsService = PaymentsService_1 = class PaymentsService {
    supabase;
    logger = new common_1.Logger(PaymentsService_1.name);
    tossSecretKey = process.env.TOSS_SECRET_KEY || '';
    tossClientKey = process.env.TOSS_CLIENT_KEY || '';
    tossApiBaseUrl = process.env.TOSS_API_BASE_URL || 'https://api.tosspayments.com/v1';
    tossTimeoutMs;
    tossMockMode;
    tossWebhookSecret = process.env.TOSS_WEBHOOK_SECRET || '';
    tossWebhookSignatureHeader = (process.env.TOSS_WEBHOOK_SIGNATURE_HEADER || 'toss-signature').toLowerCase();
    constructor(supabase) {
        this.supabase = supabase;
        const rawTimeout = Number(process.env.TOSS_TIMEOUT_MS);
        this.tossTimeoutMs =
            Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 15000;
        const rawMock = process.env.TOSS_MOCK_MODE;
        const envMock = rawMock !== undefined
            ? ['true', '1', 'yes'].includes(rawMock.trim().toLowerCase())
            : false;
        this.tossMockMode =
            envMock || (!this.tossSecretKey && process.env.NODE_ENV !== 'production');
    }
    isUuid(v) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
    }
    async resolveOrderId(sb, orderIdOrNo, branchId) {
        if (this.isUuid(orderIdOrNo)) {
            let query = sb.from('orders').select('id').eq('id', orderIdOrNo);
            if (branchId)
                query = query.eq('branch_id', branchId);
            const byId = await query.maybeSingle();
            if (!byId.error && byId.data?.id)
                return byId.data.id;
        }
        let noQuery = sb.from('orders').select('id').eq('order_no', orderIdOrNo);
        if (branchId)
            noQuery = noQuery.eq('branch_id', branchId);
        const byNo = await noQuery.maybeSingle();
        if (!byNo.error && byNo.data?.id)
            return byNo.data.id;
        return null;
    }
    async getOrderForPayment(orderId) {
        const sb = this.supabase.adminClient();
        const { data, error } = await sb
            .from('orders')
            .select(`
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
      `)
            .eq('id', orderId)
            .maybeSingle();
        if (error) {
            this.logger.error(`Failed to fetch order for payment: ${error.message}`, error);
            throw new business_exception_1.BusinessException('Failed to fetch order', 'ORDER_FETCH_FAILED', 500, { orderId, error: error.message });
        }
        if (!data) {
            throw new order_exception_1.OrderNotFoundException(orderId);
        }
        return data;
    }
    async preparePayment(dto) {
        this.logger.log(`Preparing payment for order: ${dto.orderId}`);
        const sb = this.supabase.adminClient();
        const resolvedId = await this.resolveOrderId(sb, dto.orderId);
        if (!resolvedId) {
            throw new order_exception_1.OrderNotFoundException(dto.orderId);
        }
        const order = await this.getOrderForPayment(resolvedId);
        if (order.status === 'CANCELLED') {
            throw new payment_exception_1.PaymentNotAllowedException('Order is cancelled');
        }
        if (order.payment_status === 'PAID') {
            throw new payment_exception_1.OrderAlreadyPaidException(resolvedId);
        }
        if (order.total_amount !== dto.amount) {
            throw new payment_exception_1.PaymentAmountMismatchException(order.total_amount, dto.amount);
        }
        const { data: existingPayment } = await sb
            .from('payments')
            .select('id, status')
            .eq('order_id', resolvedId)
            .maybeSingle();
        if (existingPayment && existingPayment.status === payment_dto_1.PaymentStatus.SUCCESS) {
            throw new payment_exception_1.OrderAlreadyPaidException(resolvedId);
        }
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
    async confirmPayment(dto) {
        this.logger.log(`Confirming payment for order: ${dto.orderId}`);
        const sb = this.supabase.adminClient();
        const resolvedId = await this.resolveOrderId(sb, dto.orderId);
        if (!resolvedId) {
            throw new order_exception_1.OrderNotFoundException(dto.orderId);
        }
        const order = await this.getOrderForPayment(resolvedId);
        if (order.total_amount !== dto.amount) {
            throw new payment_exception_1.PaymentAmountMismatchException(order.total_amount, dto.amount);
        }
        const { data: existingPayment } = await sb
            .from('payments')
            .select('id, status')
            .eq('order_id', resolvedId)
            .maybeSingle();
        if (existingPayment && existingPayment.status === payment_dto_1.PaymentStatus.SUCCESS) {
            throw new payment_exception_1.OrderAlreadyPaidException(resolvedId);
        }
        let providerPaymentId = null;
        let providerResponse = null;
        if (this.tossMockMode) {
            this.logger.warn('Toss Payments running in mock mode (TOSS_MOCK_MODE or missing key)');
            providerPaymentId = `mock_${Date.now()}`;
        }
        else if (!this.tossSecretKey) {
            throw new payment_exception_1.PaymentProviderException(payment_dto_1.PaymentProvider.TOSS, 'Toss Payments secret key is not configured');
        }
        else {
            try {
                providerResponse = await this.callTossPaymentsConfirmApi(dto.paymentKey, dto.orderId, dto.amount);
                providerPaymentId = providerResponse?.paymentKey || dto.paymentKey;
            }
            catch (error) {
                this.logger.error('Toss Payments API call failed', error);
                await sb.from('payments').insert({
                    order_id: resolvedId,
                    amount: dto.amount,
                    currency: 'KRW',
                    provider: payment_dto_1.PaymentProvider.TOSS,
                    provider_payment_key: dto.paymentKey,
                    status: payment_dto_1.PaymentStatus.FAILED,
                    payment_method: payment_dto_1.PaymentMethod.CARD,
                    failed_at: new Date().toISOString(),
                    failure_reason: error?.message || 'Payment confirmation failed',
                });
                throw new payment_exception_1.PaymentProviderException(payment_dto_1.PaymentProvider.TOSS, error?.message || 'Payment confirmation failed', error?.response);
            }
        }
        const paidAt = providerResponse?.approvedAt || new Date().toISOString();
        let payment;
        if (existingPayment) {
            const { data: updated, error: updateError } = await sb
                .from('payments')
                .update({
                status: payment_dto_1.PaymentStatus.SUCCESS,
                provider_payment_id: providerPaymentId,
                provider_payment_key: dto.paymentKey,
                paid_at: paidAt,
                failure_reason: null,
                metadata: providerResponse || {},
            })
                .eq('id', existingPayment.id)
                .select()
                .single();
            if (updateError) {
                this.logger.error('Failed to update payment record', updateError);
                throw new business_exception_1.BusinessException('Failed to update payment', 'PAYMENT_UPDATE_FAILED', 500, { error: updateError.message });
            }
            payment = updated;
        }
        else {
            const { data: created, error: insertError } = await sb
                .from('payments')
                .insert({
                order_id: resolvedId,
                amount: dto.amount,
                currency: 'KRW',
                provider: payment_dto_1.PaymentProvider.TOSS,
                provider_payment_id: providerPaymentId,
                provider_payment_key: dto.paymentKey,
                status: payment_dto_1.PaymentStatus.SUCCESS,
                payment_method: payment_dto_1.PaymentMethod.CARD,
                paid_at: paidAt,
                metadata: providerResponse || {},
            })
                .select()
                .single();
            if (insertError) {
                this.logger.error('Failed to create payment record', insertError);
                throw new business_exception_1.BusinessException('Failed to create payment', 'PAYMENT_CREATE_FAILED', 500, { error: insertError.message });
            }
            payment = created;
        }
        this.logger.log(`Payment confirmed successfully: ${payment.id}`);
        return {
            paymentId: payment.id,
            orderId: resolvedId,
            status: payment_dto_1.PaymentStatus.SUCCESS,
            amount: payment.amount,
            paidAt,
        };
    }
    async getPaymentStatus(orderIdOrNo) {
        this.logger.log(`Fetching payment status for order: ${orderIdOrNo}`);
        const sb = this.supabase.adminClient();
        const resolvedId = await this.resolveOrderId(sb, orderIdOrNo);
        if (!resolvedId) {
            throw new order_exception_1.OrderNotFoundException(orderIdOrNo);
        }
        const { data, error } = await sb
            .from('payments')
            .select('id, order_id, status, amount, paid_at, failure_reason')
            .eq('order_id', resolvedId)
            .maybeSingle();
        if (error) {
            this.logger.error('Failed to fetch payment status', error);
            throw new business_exception_1.BusinessException('Failed to fetch payment status', 'PAYMENT_STATUS_FETCH_FAILED', 500, { error: error.message });
        }
        if (!data) {
            throw new payment_exception_1.PaymentNotFoundException(orderIdOrNo);
        }
        return {
            id: data.id,
            orderId: data.order_id,
            status: data.status,
            amount: data.amount,
            paidAt: data.paid_at || undefined,
            failureReason: data.failure_reason || undefined,
        };
    }
    async getPayments(branchId, paginationDto = {}) {
        this.logger.log(`Fetching payments for branch: ${branchId}`);
        const sb = this.supabase.adminClient();
        const { page = 1, limit = 20 } = paginationDto;
        const { from, to } = pagination_util_1.PaginationUtil.getRange(page, limit);
        const { data, error, count } = await sb
            .from('payments')
            .select(`
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
      `, { count: 'exact' })
            .eq('orders.branch_id', branchId)
            .order('created_at', { ascending: false })
            .range(from, to);
        if (error) {
            this.logger.error('Failed to fetch payments', error);
            throw new business_exception_1.BusinessException('Failed to fetch payments', 'PAYMENTS_FETCH_FAILED', 500, { error: error.message });
        }
        const payments = (data || []).map((row) => ({
            id: row.id,
            orderId: row.order_id,
            orderNo: row.orders?.order_no || null,
            amount: row.amount,
            status: row.status,
            provider: row.provider,
            paymentMethod: row.payment_method,
            paidAt: row.paid_at || undefined,
            createdAt: row.created_at,
        }));
        this.logger.log(`Fetched ${payments.length} payments for branch: ${branchId}`);
        return pagination_util_1.PaginationUtil.createResponse(payments, count || 0, paginationDto);
    }
    async getPaymentDetail(paymentId, branchId) {
        this.logger.log(`Fetching payment detail: ${paymentId} for branch: ${branchId}`);
        const sb = this.supabase.adminClient();
        const { data, error } = await sb
            .from('payments')
            .select(`
        *,
        orders!inner(
          order_no,
          branch_id
        )
      `)
            .eq('id', paymentId)
            .eq('orders.branch_id', branchId)
            .maybeSingle();
        if (error) {
            this.logger.error('Failed to fetch payment detail', error);
            throw new business_exception_1.BusinessException('Failed to fetch payment detail', 'PAYMENT_DETAIL_FETCH_FAILED', 500, { error: error.message });
        }
        if (!data) {
            throw new payment_exception_1.PaymentNotFoundException(paymentId);
        }
        return {
            id: data.id,
            orderId: data.order_id,
            orderNo: data.orders?.order_no || null,
            amount: data.amount,
            currency: data.currency,
            provider: data.provider,
            status: data.status,
            paymentMethod: data.payment_method,
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
    async refundPayment(paymentId, branchId, dto) {
        this.logger.log(`Refunding payment: ${paymentId}`);
        const sb = this.supabase.adminClient();
        const { data: payment, error: fetchError } = await sb
            .from('payments')
            .select(`
        *,
        orders!inner(
          branch_id
        )
      `)
            .eq('id', paymentId)
            .eq('orders.branch_id', branchId)
            .maybeSingle();
        if (fetchError) {
            this.logger.error('Failed to fetch payment for refund', fetchError);
            throw new business_exception_1.BusinessException('Failed to fetch payment', 'PAYMENT_FETCH_FAILED', 500, { error: fetchError.message });
        }
        if (!payment) {
            throw new payment_exception_1.PaymentNotFoundException(paymentId);
        }
        if (payment.status !== payment_dto_1.PaymentStatus.SUCCESS &&
            payment.status !== payment_dto_1.PaymentStatus.PARTIAL_REFUNDED) {
            throw new payment_exception_1.RefundNotAllowedException(`Payment status is ${payment.status}`);
        }
        const refundAmount = dto.amount || payment.amount;
        const availableAmount = payment.amount - payment.refund_amount;
        if (refundAmount > availableAmount) {
            throw new payment_exception_1.RefundAmountExceededException(refundAmount, availableAmount);
        }
        if (this.tossMockMode) {
            this.logger.warn('Toss Payments refund running in mock mode');
        }
        else if (!this.tossSecretKey) {
            throw new payment_exception_1.PaymentProviderException(payment_dto_1.PaymentProvider.TOSS, 'Toss Payments secret key is not configured');
        }
        else if (payment.provider_payment_key) {
            try {
                await this.callTossPaymentsRefundApi(payment.provider_payment_key, refundAmount, dto.reason);
            }
            catch (error) {
                if (error instanceof payment_exception_1.PaymentProviderException) {
                    throw error;
                }
                this.logger.error('Toss Payments refund API call failed', error);
                throw new payment_exception_1.PaymentProviderException(payment_dto_1.PaymentProvider.TOSS, error?.message || 'Refund failed', error?.response);
            }
        }
        else {
            throw new payment_exception_1.PaymentProviderException(payment_dto_1.PaymentProvider.TOSS, 'Missing provider payment key for refund');
        }
        const newRefundAmount = payment.refund_amount + refundAmount;
        const newStatus = newRefundAmount >= payment.amount
            ? payment_dto_1.PaymentStatus.REFUNDED
            : payment_dto_1.PaymentStatus.PARTIAL_REFUNDED;
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
            throw new business_exception_1.BusinessException('Failed to update refund', 'REFUND_UPDATE_FAILED', 500, { error: updateError.message });
        }
        this.logger.log(`Payment refunded successfully: ${paymentId}`);
        return {
            paymentId: updated.id,
            status: updated.status,
            refundAmount: newRefundAmount,
            refundedAt,
        };
    }
    async handleTossWebhook(webhookData, headers, rawBody) {
        this.logger.log(`Received Toss webhook: ${webhookData.eventType}`);
        const sb = this.supabase.adminClient();
        if (this.tossWebhookSecret) {
            if (!rawBody) {
                throw new payment_exception_1.WebhookSignatureVerificationException();
            }
            const isValid = this.verifyTossWebhookSignature(rawBody, headers);
            if (!isValid) {
                throw new payment_exception_1.WebhookSignatureVerificationException();
            }
        }
        const { orderId, paymentKey, status, amount } = webhookData.data;
        let paymentId = null;
        const { data: payment } = await sb
            .from('payments')
            .select('id, order_id, status, amount')
            .eq('provider_payment_key', paymentKey)
            .maybeSingle();
        paymentId = payment?.id || null;
        await sb.from('payment_webhook_logs').insert({
            payment_id: paymentId,
            provider: payment_dto_1.PaymentProvider.TOSS,
            event_type: webhookData.eventType,
            request_body: webhookData,
            request_headers: headers,
            processed: false,
        });
        try {
            switch (webhookData.eventType) {
                case 'PAYMENT_CONFIRMED':
                    await this.handlePaymentConfirmedWebhook(webhookData, payment || null);
                    break;
                case 'PAYMENT_CANCELLED':
                    await this.handlePaymentCancelledWebhook(webhookData, payment || null);
                    break;
                default:
                    this.logger.warn(`Unhandled webhook event type: ${webhookData.eventType}`);
            }
            if (paymentId) {
                await sb
                    .from('payment_webhook_logs')
                    .update({ processed: true, processed_at: new Date().toISOString() })
                    .eq('payment_id', paymentId)
                    .eq('event_type', webhookData.eventType);
            }
        }
        catch (error) {
            this.logger.error('Webhook processing failed', error);
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
    async handlePaymentConfirmedWebhook(webhookData, payment) {
        const { orderId, paymentKey, status, amount } = webhookData.data;
        const sb = this.supabase.adminClient();
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
            throw new business_exception_1.BusinessException('Failed to fetch order', 'WEBHOOK_ORDER_FETCH_FAILED', 500, { error: orderError.message });
        }
        if (!order) {
            this.logger.error(`Order not found in webhook: ${orderId}`);
            return;
        }
        if (amount !== undefined && amount !== null && order.total_amount !== amount) {
            throw new business_exception_1.BusinessException('Payment amount mismatch', 'WEBHOOK_PAYMENT_AMOUNT_MISMATCH', 400, { expected: order.total_amount, actual: amount });
        }
        if (payment) {
            if (amount !== undefined &&
                amount !== null &&
                payment.amount !== undefined &&
                payment.amount !== null &&
                payment.amount !== amount) {
                throw new business_exception_1.BusinessException('Payment amount mismatch', 'WEBHOOK_PAYMENT_AMOUNT_MISMATCH', 400, { expected: payment.amount, actual: amount });
            }
            if (payment.status === payment_dto_1.PaymentStatus.SUCCESS) {
                this.logger.log(`Payment already confirmed via webhook: ${orderId}`);
                return;
            }
            if (payment.status === payment_dto_1.PaymentStatus.CANCELLED ||
                payment.status === payment_dto_1.PaymentStatus.REFUNDED ||
                payment.status === payment_dto_1.PaymentStatus.PARTIAL_REFUNDED) {
                this.logger.warn(`Ignoring confirmed webhook for cancelled/refunded payment: ${orderId}`);
                return;
            }
            const { error } = await sb
                .from('payments')
                .update({
                status: payment_dto_1.PaymentStatus.SUCCESS,
                paid_at: new Date().toISOString(),
                metadata: webhookData.data,
            })
                .eq('order_id', resolvedId)
                .eq('provider_payment_key', paymentKey);
            if (error) {
                this.logger.error('Failed to update payment from webhook', error);
                throw new business_exception_1.BusinessException('Failed to update payment', 'WEBHOOK_PAYMENT_UPDATE_FAILED', 500, { error: error.message });
            }
        }
        else {
            const { error } = await sb.from('payments').insert({
                order_id: resolvedId,
                amount: amount ?? order.total_amount,
                currency: 'KRW',
                provider: payment_dto_1.PaymentProvider.TOSS,
                provider_payment_key: paymentKey,
                status: payment_dto_1.PaymentStatus.SUCCESS,
                paid_at: new Date().toISOString(),
                metadata: webhookData.data,
            });
            if (error) {
                this.logger.error('Failed to create payment from webhook', error);
                throw new business_exception_1.BusinessException('Failed to create payment', 'WEBHOOK_PAYMENT_CREATE_FAILED', 500, { error: error.message });
            }
        }
        this.logger.log(`Payment confirmed via webhook: ${orderId}`);
    }
    async handlePaymentCancelledWebhook(webhookData, payment) {
        const { orderId, paymentKey } = webhookData.data;
        const sb = this.supabase.adminClient();
        const resolvedId = await this.resolveOrderId(sb, orderId);
        if (!resolvedId) {
            this.logger.error(`Order not found in webhook: ${orderId}`);
            return;
        }
        if (payment &&
            (payment.status === payment_dto_1.PaymentStatus.CANCELLED ||
                payment.status === payment_dto_1.PaymentStatus.REFUNDED ||
                payment.status === payment_dto_1.PaymentStatus.PARTIAL_REFUNDED)) {
            this.logger.log(`Payment already cancelled/refunded: ${orderId}`);
            return;
        }
        if (payment) {
            const { error } = await sb
                .from('payments')
                .update({
                status: payment_dto_1.PaymentStatus.CANCELLED,
                cancelled_at: new Date().toISOString(),
                cancellation_reason: webhookData.data.cancellationReason || 'Cancelled by customer',
            })
                .eq('order_id', resolvedId)
                .eq('provider_payment_key', paymentKey);
            if (error) {
                this.logger.error('Failed to update payment cancellation from webhook', error);
                throw new business_exception_1.BusinessException('Failed to update payment cancellation', 'WEBHOOK_CANCELLATION_UPDATE_FAILED', 500, { error: error.message });
            }
        }
        else {
            const { data: order, error: orderError } = await sb
                .from('orders')
                .select('id, total_amount')
                .eq('id', resolvedId)
                .maybeSingle();
            if (orderError) {
                this.logger.error('Failed to fetch order for webhook', orderError);
                throw new business_exception_1.BusinessException('Failed to fetch order', 'WEBHOOK_ORDER_FETCH_FAILED', 500, { error: orderError.message });
            }
            if (!order) {
                this.logger.error(`Order not found in webhook: ${orderId}`);
                return;
            }
            const { error } = await sb.from('payments').insert({
                order_id: resolvedId,
                amount: webhookData.data.amount ?? order.total_amount,
                currency: 'KRW',
                provider: payment_dto_1.PaymentProvider.TOSS,
                provider_payment_key: paymentKey,
                status: payment_dto_1.PaymentStatus.CANCELLED,
                cancelled_at: new Date().toISOString(),
                cancellation_reason: webhookData.data.cancellationReason || 'Cancelled by customer',
                metadata: webhookData.data,
            });
            if (error) {
                this.logger.error('Failed to create payment cancellation from webhook', error);
                throw new business_exception_1.BusinessException('Failed to create payment cancellation', 'WEBHOOK_CANCELLATION_CREATE_FAILED', 500, { error: error.message });
            }
        }
        this.logger.log(`Payment cancelled via webhook: ${orderId}`);
    }
    async callTossPaymentsConfirmApi(paymentKey, orderId, amount) {
        return this.callTossApi('/payments/confirm', {
            paymentKey,
            orderId,
            amount,
        });
    }
    async callTossPaymentsRefundApi(paymentKey, amount, reason) {
        return this.callTossApi(`/payments/${paymentKey}/cancel`, {
            cancelReason: reason,
            cancelAmount: amount,
        });
    }
    async callTossApi(path, body) {
        if (!this.tossSecretKey) {
            throw new payment_exception_1.PaymentProviderException(payment_dto_1.PaymentProvider.TOSS, 'Toss Payments secret key is not configured');
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
            let data = null;
            try {
                data = text ? JSON.parse(text) : null;
            }
            catch {
                data = text ? { raw: text } : null;
            }
            if (!res.ok) {
                throw new payment_exception_1.PaymentProviderException(payment_dto_1.PaymentProvider.TOSS, data?.message || `HTTP ${res.status}`, data);
            }
            return data;
        }
        catch (error) {
            if (error instanceof payment_exception_1.PaymentProviderException) {
                throw error;
            }
            if (error?.name === 'AbortError') {
                throw new payment_exception_1.PaymentProviderException(payment_dto_1.PaymentProvider.TOSS, 'Toss Payments request timed out');
            }
            throw error;
        }
        finally {
            clearTimeout(timeout);
        }
    }
    verifyTossWebhookSignature(rawBody, headers) {
        if (!this.tossWebhookSecret)
            return true;
        const headerName = this.tossWebhookSignatureHeader;
        const headerValue = headers[headerName] ||
            headers[headerName.toLowerCase()] ||
            headers[headerName.toUpperCase()];
        const signature = Array.isArray(headerValue)
            ? headerValue[0]
            : headerValue;
        if (!signature)
            return false;
        const normalized = signature.startsWith('v1=')
            ? signature.slice(3)
            : signature;
        const hmac = (0, crypto_1.createHmac)('sha256', this.tossWebhookSecret)
            .update(rawBody)
            .digest('hex');
        if (normalized.length !== hmac.length)
            return false;
        return (0, crypto_1.timingSafeEqual)(Buffer.from(normalized, 'utf8'), Buffer.from(hmac, 'utf8'));
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = PaymentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map