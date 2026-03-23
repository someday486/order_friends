import { OrderStatus } from '../order-status.enum';

export class OrderListItemResponse {
  id: string;
  orderNo?: string | null;
  orderedAt: string;
  customerName: string;
  totalAmount: number;
  paymentMethod?: 'CARD' | 'TRANSFER' | 'CASH' | null;
  paymentStatus?: string | null;
  depositMatchStatus?: 'PENDING' | 'AUTO_MATCHED' | null;
  fulfillmentType?: 'PICKUP' | 'DELIVERY' | 'DINE_IN' | 'SHIPPING' | null;
  branchId: string;
  branchName: string;
  itemCount: number;
  firstItemName: string | null;
  status: OrderStatus;
}
