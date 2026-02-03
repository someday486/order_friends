"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderDetailResponse = exports.OrderItemResponse = void 0;
class OrderItemResponse {
    id;
    name;
    option;
    qty;
    unitPrice;
}
exports.OrderItemResponse = OrderItemResponse;
class OrderDetailResponse {
    id;
    orderedAt;
    orderNo;
    status;
    customer;
    payment;
    items;
}
exports.OrderDetailResponse = OrderDetailResponse;
//# sourceMappingURL=order-detail.response.js.map