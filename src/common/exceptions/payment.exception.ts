import { HttpStatus } from '@nestjs/common';
import {
  BusinessException,
  ResourceNotFoundException,
} from './business.exception';

/**
 * 결제를 찾을 수 없을 때
 */
export class PaymentNotFoundException extends ResourceNotFoundException {
  constructor(identifier: string) {
    super('Payment', identifier);
  }
}

/**
 * 결제 금액 불일치
 */
export class PaymentAmountMismatchException extends BusinessException {
  constructor(expected: number, actual: number) {
    super(
      `Payment amount mismatch: expected ${expected}, got ${actual}`,
      'PAYMENT_AMOUNT_MISMATCH',
      HttpStatus.BAD_REQUEST,
      { expected, actual },
    );
  }
}

/**
 * 이미 결제된 주문
 */
export class OrderAlreadyPaidException extends BusinessException {
  constructor(orderId: string) {
    super('Order is already paid', 'ORDER_ALREADY_PAID', HttpStatus.CONFLICT, {
      orderId,
    });
  }
}

/**
 * 결제가 불가능한 상태
 */
export class PaymentNotAllowedException extends BusinessException {
  constructor(reason: string) {
    super(
      `Payment not allowed: ${reason}`,
      'PAYMENT_NOT_ALLOWED',
      HttpStatus.FORBIDDEN,
      { reason },
    );
  }
}

/**
 * 결제 제공자 오류
 */
export class PaymentProviderException extends BusinessException {
  constructor(provider: string, message: string, details?: any) {
    super(
      `Payment provider error (${provider}): ${message}`,
      'PAYMENT_PROVIDER_ERROR',
      HttpStatus.BAD_GATEWAY,
      { provider, message, details },
    );
  }
}

/**
 * 환불 불가능
 */
export class RefundNotAllowedException extends BusinessException {
  constructor(reason: string) {
    super(
      `Refund not allowed: ${reason}`,
      'REFUND_NOT_ALLOWED',
      HttpStatus.FORBIDDEN,
      { reason },
    );
  }
}

/**
 * 환불 금액 초과
 */
export class RefundAmountExceededException extends BusinessException {
  constructor(requested: number, available: number) {
    super(
      `Refund amount exceeds available amount: requested ${requested}, available ${available}`,
      'REFUND_AMOUNT_EXCEEDED',
      HttpStatus.BAD_REQUEST,
      { requested, available },
    );
  }
}

/**
 * 웹훅 서명 검증 실패
 */
export class WebhookSignatureVerificationException extends BusinessException {
  constructor() {
    super(
      'Webhook signature verification failed',
      'WEBHOOK_SIGNATURE_VERIFICATION_FAILED',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
