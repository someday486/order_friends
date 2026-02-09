import { HttpStatus } from '@nestjs/common';
import {
  BusinessException,
  ResourceNotFoundException,
  InsufficientPermissionException,
  InvalidRequestException,
  DuplicateResourceException,
} from './business.exception';
import {
  PaymentAmountMismatchException,
  PaymentNotAllowedException,
  PaymentNotFoundException,
  PaymentProviderException,
  OrderAlreadyPaidException,
  RefundNotAllowedException,
  RefundAmountExceededException,
  WebhookSignatureVerificationException,
} from './payment.exception';
import {
  OrderNotFoundException,
  InvalidOrderStatusTransitionException,
  OrderUpdateNotAllowedException,
} from './order.exception';
import {
  ProductNotFoundException,
  ProductCategoryNotFoundException,
  ProductOutOfStockException,
} from './product.exception';

describe('Business Exceptions', () => {
  it('BusinessException should format response payload', () => {
    const ex = new BusinessException('msg', 'CODE', HttpStatus.CONFLICT, { a: 1 });
    expect(ex.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(ex.getResponse()).toMatchObject({
      statusCode: HttpStatus.CONFLICT,
      message: 'msg',
      error: 'CODE',
      details: { a: 1 },
    });
  });

  it('ResourceNotFoundException should include resource and identifier', () => {
    const ex = new ResourceNotFoundException('Thing', 'id-1');
    expect(ex.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(ex.getResponse()).toMatchObject({
      message: 'Thing not found',
      error: 'RESOURCE_NOT_FOUND',
      details: { resource: 'Thing', identifier: 'id-1' },
    });
  });

  it('InsufficientPermissionException should include required permission', () => {
    const ex = new InsufficientPermissionException('PERM');
    expect(ex.getResponse()).toMatchObject({
      error: 'INSUFFICIENT_PERMISSION',
      details: { requiredPermission: 'PERM' },
    });
  });

  it('InvalidRequestException should pass through details', () => {
    const ex = new InvalidRequestException('bad', { field: 'x' });
    expect(ex.getResponse()).toMatchObject({
      error: 'INVALID_REQUEST',
      details: { field: 'x' },
    });
  });

  it('DuplicateResourceException should format message', () => {
    const ex = new DuplicateResourceException('User', 'email', 'a@b.com');
    expect(ex.getResponse()).toMatchObject({
      message: "User with email 'a@b.com' already exists",
      error: 'DUPLICATE_RESOURCE',
    });
  });
});

describe('Payment Exceptions', () => {
  it('PaymentNotFoundException should format', () => {
    const ex = new PaymentNotFoundException('pay-1');
    expect(ex.getResponse()).toMatchObject({
      message: 'Payment not found',
      error: 'RESOURCE_NOT_FOUND',
    });
  });

  it('PaymentAmountMismatchException should include expected/actual', () => {
    const ex = new PaymentAmountMismatchException(10, 5);
    expect(ex.getResponse()).toMatchObject({
      error: 'PAYMENT_AMOUNT_MISMATCH',
      details: { expected: 10, actual: 5 },
    });
  });

  it('OrderAlreadyPaidException should include orderId', () => {
    const ex = new OrderAlreadyPaidException('order-1');
    expect(ex.getResponse()).toMatchObject({
      error: 'ORDER_ALREADY_PAID',
      details: { orderId: 'order-1' },
    });
  });

  it('PaymentNotAllowedException should include reason', () => {
    const ex = new PaymentNotAllowedException('nope');
    expect(ex.getResponse()).toMatchObject({
      error: 'PAYMENT_NOT_ALLOWED',
      details: { reason: 'nope' },
    });
  });

  it('PaymentProviderException should include provider and message', () => {
    const ex = new PaymentProviderException('TOSS', 'boom', { status: 500 });
    expect(ex.getResponse()).toMatchObject({
      error: 'PAYMENT_PROVIDER_ERROR',
      details: { provider: 'TOSS', message: 'boom', details: { status: 500 } },
    });
  });

  it('RefundNotAllowedException should include reason', () => {
    const ex = new RefundNotAllowedException('blocked');
    expect(ex.getResponse()).toMatchObject({
      error: 'REFUND_NOT_ALLOWED',
      details: { reason: 'blocked' },
    });
  });

  it('RefundAmountExceededException should include requested and available', () => {
    const ex = new RefundAmountExceededException(20, 10);
    expect(ex.getResponse()).toMatchObject({
      error: 'REFUND_AMOUNT_EXCEEDED',
      details: { requested: 20, available: 10 },
    });
  });

  it('WebhookSignatureVerificationException should set unauthorized', () => {
    const ex = new WebhookSignatureVerificationException();
    expect(ex.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    expect(ex.getResponse()).toMatchObject({
      error: 'WEBHOOK_SIGNATURE_VERIFICATION_FAILED',
    });
  });
});

describe('Order/Product Exceptions', () => {
  it('OrderNotFoundException should format', () => {
    const ex = new OrderNotFoundException('o1');
    expect(ex.getResponse()).toMatchObject({
      message: 'Order not found',
      error: 'RESOURCE_NOT_FOUND',
    });
  });

  it('InvalidOrderStatusTransitionException should include status', () => {
    const ex = new InvalidOrderStatusTransitionException('A', 'B');
    expect(ex.getResponse()).toMatchObject({
      error: 'INVALID_ORDER_STATUS_TRANSITION',
      details: { currentStatus: 'A', targetStatus: 'B' },
    });
  });

  it('OrderUpdateNotAllowedException should use provided reason', () => {
    const ex = new OrderUpdateNotAllowedException('nope');
    expect(ex.getResponse()).toMatchObject({
      error: 'ORDER_UPDATE_NOT_ALLOWED',
      message: 'nope',
    });
  });

  it('ProductNotFoundException should format', () => {
    const ex = new ProductNotFoundException('p1');
    expect(ex.getResponse()).toMatchObject({
      message: 'Product not found',
      error: 'RESOURCE_NOT_FOUND',
    });
  });

  it('ProductCategoryNotFoundException should format', () => {
    const ex = new ProductCategoryNotFoundException('c1');
    expect(ex.getResponse()).toMatchObject({
      message: 'Product Category not found',
      error: 'RESOURCE_NOT_FOUND',
    });
  });

  it('ProductOutOfStockException should include productId', () => {
    const ex = new ProductOutOfStockException('p1');
    expect(ex.getResponse()).toMatchObject({
      error: 'PRODUCT_OUT_OF_STOCK',
      details: { productId: 'p1' },
    });
  });
});
