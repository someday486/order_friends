import { OrderStatus } from '../order-status.enum';
export declare class OrderListItemResponse {
    id: string;
    orderNo?: string | null;
    orderedAt: string;
    customerName: string;
    totalAmount: number;
    status: OrderStatus;
}
