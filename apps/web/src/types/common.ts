export type OrderStatus =
  | "CREATED"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  CREATED: "주문접수",
  CONFIRMED: "확인",
  PREPARING: "준비중",
  READY: "준비완료",
  COMPLETED: "완료",
  CANCELLED: "취소",
  REFUNDED: "환불",
};

export const ORDER_STATUS_LABEL_LONG: Record<OrderStatus, string> = {
  CREATED: "주문 접수",
  CONFIRMED: "주문 확인",
  PREPARING: "준비 중",
  READY: "준비 완료",
  COMPLETED: "완료",
  CANCELLED: "취소됨",
  REFUNDED: "환불됨",
};

export const ORDER_STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  CREATED: "bg-warning-500/20 text-warning-500",
  CONFIRMED: "bg-primary-500/20 text-primary-500",
  PREPARING: "bg-primary-500/20 text-primary-500",
  READY: "bg-success/20 text-success",
  COMPLETED: "bg-neutral-500/20 text-text-secondary",
  CANCELLED: "bg-danger-500/20 text-danger-500",
  REFUNDED: "bg-pink-500/20 text-pink-400",
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
  CARD: "카드결제",
  CASH: "현금",
  TRANSFER: "계좌이체",
};
