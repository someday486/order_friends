import { OrderStatus } from '../order-status.enum';

export class OrderListItemResponse {
  id: string;
  orderedAt: string;
  customerName: string;
  totalAmount: number;
  status: OrderStatus;
}
