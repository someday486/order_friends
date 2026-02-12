import { BusinessException, ResourceNotFoundException } from './business.exception';
export declare class PaymentNotFoundException extends ResourceNotFoundException {
    constructor(identifier: string);
}
export declare class PaymentAmountMismatchException extends BusinessException {
    constructor(expected: number, actual: number);
}
export declare class OrderAlreadyPaidException extends BusinessException {
    constructor(orderId: string);
}
export declare class PaymentNotAllowedException extends BusinessException {
    constructor(reason: string);
}
export declare class PaymentProviderException extends BusinessException {
    constructor(provider: string, message: string, details?: any);
}
export declare class RefundNotAllowedException extends BusinessException {
    constructor(reason: string);
}
export declare class RefundAmountExceededException extends BusinessException {
    constructor(requested: number, available: number);
}
export declare class WebhookSignatureVerificationException extends BusinessException {
    constructor();
}
