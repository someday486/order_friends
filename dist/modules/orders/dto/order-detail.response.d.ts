import { OrderStatus } from '../order-status.enum';
export declare class OrderItemResponse {
    id: string;
    name: string;
    option?: string;
    qty: number;
    unitPrice: number;
}
export declare class OrderDetailResponse {
    id: string;
    orderedAt: string;
    orderNo?: string | null;
    status: OrderStatus;
    customer: {
        name: string;
        phone: string;
        address1: string;
        address2?: string;
        memo?: string;
    };
    payment: {
        method: 'CARD' | 'TRANSFER' | 'CASH';
        subtotal: number;
        shippingFee: number;
        discount: number;
        total: number;
    };
    items: OrderItemResponse[];
}
