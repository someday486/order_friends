import { OrderStatus } from '../order-status.enum';

export class OrderItemResponse {
  id: string;
  name: string;
  option?: string;
  qty: number;
  unitPrice: number;
}

export class CashReceiptRequestResponse {
  requested: boolean;
  type?: string | null;
  identityType?: string | null;
  identityValue?: string | null;
}

export class CashReceiptIssueResponse {
  provider?: string | null;
  status: string;
  issuedAt?: string | null;
  approvalNo?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export type DeliveryTrackingStatus =
  | 'PENDING'
  | 'PREPARING_SHIPMENT'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'DELIVERY_FAILED';

export class DeliveryTrackingResponse {
  status: DeliveryTrackingStatus;
  carrier?: string | null;
  trackingNumber?: string | null;
  startedAt?: string | null;
  deliveredAt?: string | null;
  updatedAt?: string | null;
}

export class OrderDetailResponse {
  id: string;
  orderedAt: string;
  orderNo?: string | null; // ✅ 추가
  status: OrderStatus;
  paymentStatus?: string | null;
  depositMatchStatus?: 'PENDING' | 'AUTO_MATCHED' | null;
  fulfillmentType?: 'PICKUP' | 'DELIVERY' | 'DINE_IN' | 'SHIPPING' | null;
  myRole?: string;

  customer: {
    name: string;
    phone: string;
    address1: string;
    address2?: string;
    memo?: string;
  };

  payment: {
    method: 'CARD' | 'TRANSFER' | 'CASH' | null;
    subtotal: number;
    shippingFee: number;
    discount: number;
    total: number;
  };
  cashReceiptRequest?: CashReceiptRequestResponse | null;
  cashReceiptIssue?: CashReceiptIssueResponse | null;
  deliveryTracking?: DeliveryTrackingResponse | null;

  items: OrderItemResponse[];
}
