import { SupabaseService } from '../../infra/supabase/supabase.service';
import { PreparePaymentRequest, PreparePaymentResponse, ConfirmPaymentRequest, ConfirmPaymentResponse, PaymentStatusResponse, PaymentListItemResponse, PaymentDetailResponse, RefundPaymentRequest, RefundPaymentResponse, TossWebhookRequest } from './dto/payment.dto';
import { PaginationDto, PaginatedResponse } from '../../common/dto/pagination.dto';
export declare class PaymentsService {
    private readonly supabase;
    private readonly logger;
    private readonly tossSecretKey;
    private readonly tossClientKey;
    private readonly tossApiBaseUrl;
    constructor(supabase: SupabaseService);
    private isUuid;
    private resolveOrderId;
    private getOrderForPayment;
    preparePayment(dto: PreparePaymentRequest): Promise<PreparePaymentResponse>;
    confirmPayment(dto: ConfirmPaymentRequest): Promise<ConfirmPaymentResponse>;
    getPaymentStatus(orderIdOrNo: string): Promise<PaymentStatusResponse>;
    getPayments(branchId: string, paginationDto?: PaginationDto): Promise<PaginatedResponse<PaymentListItemResponse>>;
    getPaymentDetail(paymentId: string, branchId: string): Promise<PaymentDetailResponse>;
    refundPayment(paymentId: string, branchId: string, dto: RefundPaymentRequest): Promise<RefundPaymentResponse>;
    handleTossWebhook(webhookData: TossWebhookRequest, headers: any): Promise<void>;
    private handlePaymentConfirmedWebhook;
    private handlePaymentCancelledWebhook;
}
