"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookSignatureVerificationException = exports.RefundAmountExceededException = exports.RefundNotAllowedException = exports.PaymentProviderException = exports.PaymentNotAllowedException = exports.OrderAlreadyPaidException = exports.PaymentAmountMismatchException = exports.PaymentNotFoundException = void 0;
const common_1 = require("@nestjs/common");
const business_exception_1 = require("./business.exception");
class PaymentNotFoundException extends business_exception_1.ResourceNotFoundException {
    constructor(identifier) {
        super('Payment', identifier);
    }
}
exports.PaymentNotFoundException = PaymentNotFoundException;
class PaymentAmountMismatchException extends business_exception_1.BusinessException {
    constructor(expected, actual) {
        super(`Payment amount mismatch: expected ${expected}, got ${actual}`, 'PAYMENT_AMOUNT_MISMATCH', common_1.HttpStatus.BAD_REQUEST, { expected, actual });
    }
}
exports.PaymentAmountMismatchException = PaymentAmountMismatchException;
class OrderAlreadyPaidException extends business_exception_1.BusinessException {
    constructor(orderId) {
        super('Order is already paid', 'ORDER_ALREADY_PAID', common_1.HttpStatus.CONFLICT, {
            orderId,
        });
    }
}
exports.OrderAlreadyPaidException = OrderAlreadyPaidException;
class PaymentNotAllowedException extends business_exception_1.BusinessException {
    constructor(reason) {
        super(`Payment not allowed: ${reason}`, 'PAYMENT_NOT_ALLOWED', common_1.HttpStatus.FORBIDDEN, { reason });
    }
}
exports.PaymentNotAllowedException = PaymentNotAllowedException;
class PaymentProviderException extends business_exception_1.BusinessException {
    constructor(provider, message, details) {
        super(`Payment provider error (${provider}): ${message}`, 'PAYMENT_PROVIDER_ERROR', common_1.HttpStatus.BAD_GATEWAY, { provider, message, details });
    }
}
exports.PaymentProviderException = PaymentProviderException;
class RefundNotAllowedException extends business_exception_1.BusinessException {
    constructor(reason) {
        super(`Refund not allowed: ${reason}`, 'REFUND_NOT_ALLOWED', common_1.HttpStatus.FORBIDDEN, { reason });
    }
}
exports.RefundNotAllowedException = RefundNotAllowedException;
class RefundAmountExceededException extends business_exception_1.BusinessException {
    constructor(requested, available) {
        super(`Refund amount exceeds available amount: requested ${requested}, available ${available}`, 'REFUND_AMOUNT_EXCEEDED', common_1.HttpStatus.BAD_REQUEST, { requested, available });
    }
}
exports.RefundAmountExceededException = RefundAmountExceededException;
class WebhookSignatureVerificationException extends business_exception_1.BusinessException {
    constructor() {
        super('Webhook signature verification failed', 'WEBHOOK_SIGNATURE_VERIFICATION_FAILED', common_1.HttpStatus.UNAUTHORIZED);
    }
}
exports.WebhookSignatureVerificationException = WebhookSignatureVerificationException;
//# sourceMappingURL=payment.exception.js.map