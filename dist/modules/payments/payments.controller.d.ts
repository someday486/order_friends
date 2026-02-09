import { PaymentsService } from './payments.service';
import type { AuthRequest } from '../../common/types/auth-request';
import { PreparePaymentRequest, PreparePaymentResponse, ConfirmPaymentRequest, ConfirmPaymentResponse, PaymentStatusResponse, PaymentListItemResponse, PaymentDetailResponse, RefundPaymentRequest, RefundPaymentResponse, TossWebhookRequest } from './dto/payment.dto';
import { PaginationDto, PaginatedResponse } from '../../common/dto/pagination.dto';
export declare class PaymentsPublicController {
    private readonly paymentsService;
    constructor(paymentsService: PaymentsService);
    preparePayment(dto: PreparePaymentRequest): Promise<PreparePaymentResponse>;
    confirmPayment(dto: ConfirmPaymentRequest): Promise<ConfirmPaymentResponse>;
    getPaymentStatus(orderId: string): Promise<PaymentStatusResponse>;
    handleTossWebhook(webhookData: TossWebhookRequest, headers: Record<string, string>, req: any): Promise<{
        success: boolean;
    }>;
}
export declare class PaymentsCustomerController {
    private readonly paymentsService;
    constructor(paymentsService: PaymentsService);
    getPayments(branchId: string, paginationDto: PaginationDto): Promise<PaginatedResponse<PaymentListItemResponse>>;
    getPaymentDetail(paymentId: string, branchId: string): Promise<PaymentDetailResponse>;
    refundPayment(paymentId: string, branchId: string, dto: RefundPaymentRequest, req: AuthRequest): Promise<RefundPaymentResponse>;
}
