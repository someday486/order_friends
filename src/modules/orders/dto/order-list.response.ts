import { OrderStatus } from '../order-status.enum';

export class OrderListItemResponse {
  id: string;
  orderNo?: string | null;
  orderedAt: string;
  customerName: string;
  totalAmount: number;
  branchId: string;
  branchName: string;
  itemCount: number;
  firstItemName: string | null;
  status: OrderStatus;
}
