import { BusinessException, ResourceNotFoundException } from './business.exception';
export declare class OrderNotFoundException extends ResourceNotFoundException {
    constructor(orderId: string);
}
export declare class InvalidOrderStatusTransitionException extends BusinessException {
    constructor(currentStatus: string, targetStatus: string);
}
export declare class OrderUpdateNotAllowedException extends BusinessException {
    constructor(reason?: string);
}
