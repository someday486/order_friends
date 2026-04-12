import type {
  ApiBillingTier,
  ApiFulfillmentType,
  ApiOrderStatus,
  ApiStorePaymentMethod,
} from './api-contracts';

export type OrderStatus = ApiOrderStatus;

export type DepositMatchStatus = 'PENDING' | 'AUTO_MATCHED';

export type OrderStatusDisplay =
  | 'RECEIVED'
  | 'PREPARING'
  | 'READY'
  | 'CANCELLED';

export function getOrderStatusDisplay(status: OrderStatus): OrderStatusDisplay {
  switch (status) {
    case 'CREATED':
    case 'CONFIRMED':
      return 'RECEIVED';
    case 'PREPARING':
      return 'PREPARING';
    case 'READY':
    case 'COMPLETED':
      return 'READY';
    case 'CANCELLED':
    case 'REFUNDED':
      return 'CANCELLED';
  }
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  CREATED: '주문접수',
  CONFIRMED: '주문접수',
  PREPARING: '준비중',
  READY: '준비완료',
  COMPLETED: '준비완료',
  CANCELLED: '취소',
  REFUNDED: '취소',
};

export const ORDER_STATUS_LABEL_LONG: Record<OrderStatus, string> = {
  CREATED: '주문 접수',
  CONFIRMED: '주문 접수',
  PREPARING: '준비 중',
  READY: '준비 완료',
  COMPLETED: '준비 완료',
  CANCELLED: '주문 취소',
  REFUNDED: '주문 취소',
};

export const ORDER_STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  CREATED: 'bg-warning-500/20 text-warning-500',
  CONFIRMED: 'bg-warning-500/20 text-warning-500',
  PREPARING: 'bg-primary-500/20 text-primary-500',
  READY: 'bg-success/20 text-success',
  COMPLETED: 'bg-success/20 text-success',
  CANCELLED: 'bg-danger-500/20 text-danger-500',
  REFUNDED: 'bg-danger-500/20 text-danger-500',
};

export const ORDER_STATUS_DISPLAY_LABEL: Record<OrderStatusDisplay, string> = {
  RECEIVED: '주문접수',
  PREPARING: '준비중',
  READY: '준비완료',
  CANCELLED: '취소',
};

export const ORDER_STATUS_DISPLAY_LABEL_LONG: Record<
  OrderStatusDisplay,
  string
> = {
  RECEIVED: '주문 접수',
  PREPARING: '준비 중',
  READY: '준비 완료',
  CANCELLED: '주문 취소',
};

export const ORDER_STATUS_DISPLAY_BADGE_CLASS: Record<
  OrderStatusDisplay,
  string
> = {
  RECEIVED: 'bg-warning-500/20 text-warning-500',
  PREPARING: 'bg-primary-500/20 text-primary-500',
  READY: 'bg-success/20 text-success',
  CANCELLED: 'bg-danger-500/20 text-danger-500',
};

export type FulfillmentType = ApiFulfillmentType;
export type BillingTier = ApiBillingTier;
export type StorePaymentMethod = ApiStorePaymentMethod;
export type PaymentMethod = StorePaymentMethod | 'CASH';

export const FULFILLMENT_TYPE_LABEL: Record<FulfillmentType, string> = {
  PICKUP: '포장',
  DELIVERY: '배달',
  DINE_IN: '매장',
  SHIPPING: '배송',
};

export const STORE_PAYMENT_METHOD_LABEL: Record<StorePaymentMethod, string> = {
  CARD: '카드',
  TRANSFER: '계좌이체',
};

export type Branch = {
  id: string;
  name: string;
  brandId?: string;
  slug?: string;
  myRole?: string | null;
  createdAt?: string;
};

export type Brand = {
  id: string;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  myRole?: string;
  created_at?: string;
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CARD: '카드결제',
  CASH: '현금',
  TRANSFER: '계좌이체',
};
