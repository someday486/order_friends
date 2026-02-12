export declare enum PaymentStatus {
    PENDING = "PENDING",
    SUCCESS = "SUCCESS",
    FAILED = "FAILED",
    CANCELLED = "CANCELLED",
    REFUNDED = "REFUNDED",
    PARTIAL_REFUNDED = "PARTIAL_REFUNDED"
}
export declare enum PaymentProvider {
    TOSS = "TOSS",
    STRIPE = "STRIPE",
    MANUAL = "MANUAL"
}
export declare enum PaymentMethod {
    CARD = "CARD",
    VIRTUAL_ACCOUNT = "VIRTUAL_ACCOUNT",
    TRANSFER = "TRANSFER",
    MOBILE = "MOBILE"
}
export declare class PreparePaymentRequest {
    orderId: string;
    amount: number;
    paymentMethod: PaymentMethod;
}
export declare class ConfirmPaymentRequest {
    orderId: string;
    idempotencyKey?: string;
    paymentKey: string;
    amount: number;
}
export declare class RefundPaymentRequest {
    reason: string;
    amount?: number;
}
export declare class PreparePaymentResponse {
    orderId: string;
    orderNo: string | null;
    amount: number;
    orderName: string;
    customerName: string;
    customerPhone: string;
}
export declare class ConfirmPaymentResponse {
    paymentId: string;
    orderId: string;
    status: PaymentStatus;
    amount: number;
    paidAt: string;
}
export declare class PaymentStatusResponse {
    id: string;
    orderId: string;
    status: PaymentStatus;
    amount: number;
    paidAt?: string;
    failureReason?: string;
}
export declare class PaymentListItemResponse {
    id: string;
    orderId: string;
    orderNo: string | null;
    amount: number;
    status: PaymentStatus;
    provider: PaymentProvider;
    paymentMethod?: PaymentMethod;
    paidAt?: string;
    createdAt: string;
}
export declare class PaymentDetailResponse {
    id: string;
    orderId: string;
    orderNo: string | null;
    amount: number;
    currency: string;
    provider: PaymentProvider;
    status: PaymentStatus;
    paymentMethod?: PaymentMethod;
    paymentMethodDetail?: any;
    providerPaymentId?: string;
    providerPaymentKey?: string;
    paidAt?: string;
    failedAt?: string;
    cancelledAt?: string;
    refundedAt?: string;
    failureReason?: string;
    cancellationReason?: string;
    refundAmount: number;
    refundReason?: string;
    metadata?: any;
    createdAt: string;
    updatedAt: string;
}
export declare class RefundPaymentResponse {
    paymentId: string;
    status: PaymentStatus;
    refundAmount: number;
    refundedAt: string;
}
export declare class TossWebhookRequest {
    eventType: string;
    createdAt: string;
    data: {
        orderId: string;
        paymentKey: string;
        status: string;
        amount: number;
        [key: string]: any;
    };
}
