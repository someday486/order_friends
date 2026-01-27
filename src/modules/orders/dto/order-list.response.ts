import { OrderStatus } from '../order-status.enum';

export class OrderListItemResponse {
  id: string;
  orderNo?: string | null; // ✅ 추가
  orderedAt: string;
  customerName: string;
  totalAmount: number;
  status: OrderStatus;
}
