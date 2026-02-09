export declare enum NotificationType {
    EMAIL = "EMAIL",
    SMS = "SMS",
    PUSH = "PUSH"
}
export declare enum NotificationStatus {
    PENDING = "PENDING",
    SENT = "SENT",
    FAILED = "FAILED",
    RETRY = "RETRY"
}
export interface OrderConfirmationEmailData {
    orderNo: string;
    orderedAt: string;
    customerName: string;
    items: Array<{
        name: string;
        option?: string;
        qty: number;
        unitPrice: number;
    }>;
    subtotal: number;
    shippingFee: number;
    discount: number;
    total: number;
    deliveryAddress?: string;
    deliveryMemo?: string;
}
export interface OrderStatusUpdateEmailData {
    orderNo: string;
    customerName: string;
    oldStatus: string;
    newStatus: string;
    statusMessage: string;
    updatedAt: string;
}
export interface PaymentConfirmationEmailData {
    orderNo: string;
    customerName: string;
    paymentMethod: string;
    amount: number;
    paidAt: string;
    transactionId?: string;
}
export interface RefundConfirmationEmailData {
    orderNo: string;
    customerName: string;
    refundAmount: number;
    refundedAt: string;
    refundReason?: string;
    transactionId?: string;
}
export interface LowStockAlertEmailData {
    productName: string;
    productSku?: string;
    branchName: string;
    currentStock: number;
    minimumStock: number;
    alertedAt: string;
}
export interface EmailTemplate {
    subject: string;
    html: string;
    text?: string;
}
export interface OrderConfirmationSMSData {
    orderNo: string;
    customerName: string;
    total: number;
}
export interface OrderReadySMSData {
    orderNo: string;
    branchName: string;
    branchPhone?: string;
}
export interface DeliveryCompleteSMSData {
    orderNo: string;
    deliveredAt: string;
}
export interface NotificationResult {
    success: boolean;
    type: NotificationType;
    recipient: string;
    errorMessage?: string;
    retryCount?: number;
    sentAt?: string;
}
export interface NotificationLogEntry {
    id?: string;
    type: NotificationType;
    status: NotificationStatus;
    recipient: string;
    subject?: string;
    message: string;
    errorMessage?: string;
    retryCount: number;
    createdAt: string;
    sentAt?: string;
}
