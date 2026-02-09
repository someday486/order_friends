import { HttpStatus } from '@nestjs/common';
import {
  BusinessException,
  ResourceNotFoundException,
} from './business.exception';

/**
 * 주문을 찾을 수 없을 때
 */
export class OrderNotFoundException extends ResourceNotFoundException {
  constructor(orderId: string) {
    super('Order', orderId);
  }
}

/**
 * 주문 상태 변경이 유효하지 않을 때
 */
export class InvalidOrderStatusTransitionException extends BusinessException {
  constructor(currentStatus: string, targetStatus: string) {
    super(
      `Cannot transition order from ${currentStatus} to ${targetStatus}`,
      'INVALID_ORDER_STATUS_TRANSITION',
      HttpStatus.BAD_REQUEST,
      { currentStatus, targetStatus },
    );
  }
}

/**
 * 주문 수정 권한이 없을 때
 */
export class OrderUpdateNotAllowedException extends BusinessException {
  constructor(reason?: string) {
    super(
      reason || 'Order cannot be updated at this time',
      'ORDER_UPDATE_NOT_ALLOWED',
      HttpStatus.FORBIDDEN,
    );
  }
}
