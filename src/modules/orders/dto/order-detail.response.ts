import { OrderStatus } from '../order-status.enum';

export class OrderItemResponse {
  id: string;
  name: string;
  option?: string;
  qty: number;
  unitPrice: number;
}

export class OrderDetailResponse {
  id: string;
  orderedAt: string;
  orderNo?: string | null; // ✅ 추가
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
