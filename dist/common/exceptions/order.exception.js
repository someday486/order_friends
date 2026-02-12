"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderUpdateNotAllowedException = exports.InvalidOrderStatusTransitionException = exports.OrderNotFoundException = void 0;
const common_1 = require("@nestjs/common");
const business_exception_1 = require("./business.exception");
class OrderNotFoundException extends business_exception_1.ResourceNotFoundException {
    constructor(orderId) {
        super('Order', orderId);
    }
}
exports.OrderNotFoundException = OrderNotFoundException;
class InvalidOrderStatusTransitionException extends business_exception_1.BusinessException {
    constructor(currentStatus, targetStatus) {
        super(`Cannot transition order from ${currentStatus} to ${targetStatus}`, 'INVALID_ORDER_STATUS_TRANSITION', common_1.HttpStatus.BAD_REQUEST, { currentStatus, targetStatus });
    }
}
exports.InvalidOrderStatusTransitionException = InvalidOrderStatusTransitionException;
class OrderUpdateNotAllowedException extends business_exception_1.BusinessException {
    constructor(reason) {
        super(reason || 'Order cannot be updated at this time', 'ORDER_UPDATE_NOT_ALLOWED', common_1.HttpStatus.FORBIDDEN);
    }
}
exports.OrderUpdateNotAllowedException = OrderUpdateNotAllowedException;
//# sourceMappingURL=order.exception.js.map