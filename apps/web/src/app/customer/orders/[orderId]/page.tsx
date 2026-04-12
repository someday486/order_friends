"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import {
  formatBusinessNumber,
  formatCashReceiptProvider,
  formatDateTime,
  formatPhone,
  formatWon,
} from "@/lib/format";
import {
  FULFILLMENT_TYPE_LABEL,
  ORDER_STATUS_DISPLAY_LABEL,
  PAYMENT_METHOD_LABEL,
  getOrderStatusDisplay,
  type FulfillmentType,
  type OrderStatus,
  type OrderStatusDisplay,
} from "@/types/common";

// ============================================================
// Types
// ============================================================

type OrderItem = {
  id: string;
  name: string;
  option?: string;
  qty: number;
  unitPrice: number;
};

type DeliveryTrackingStatus =
  | "PENDING"
  | "PREPARING_SHIPMENT"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "DELIVERY_FAILED";

type DeliveryTracking = {
  status: DeliveryTrackingStatus;
  carrier?: string | null;
  trackingNumber?: string | null;
  startedAt?: string | null;
  deliveredAt?: string | null;
  updatedAt?: string | null;
};

type OrderDetail = {
  id: string;
  orderNo: string | null;
  orderedAt: string;
  status: OrderStatus;
  paymentStatus?: string | null;
  fulfillmentType?: FulfillmentType | null;
  customer: {
    name: string;
    phone: string;
    address1: string;
    address2?: string;
    memo?: string;
  };
  payment: {
    method: string;
    subtotal: number;
    shippingFee: number;
    discount: number;
    total: number;
  };
  cashReceiptRequest?: {
    requested: boolean;
    type?: string | null;
    identityType?: string | null;
    identityValue?: string | null;
  } | null;
  cashReceiptIssue?: {
    provider?: string | null;
    status: string;
    issuedAt?: string | null;
    approvalNo?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  } | null;
  deliveryTracking?: DeliveryTracking | null;
  items: OrderItem[];
  myRole?: string;
};

const CASH_RECEIPT_TYPE_LABEL: Record<string, string> = {
  INCOME_DEDUCTION: "소득공제용",
  EXPENSE_PROOF: "지출증빙용",
};

const CASH_RECEIPT_STATUS_LABEL: Record<string, string> = {
  REQUESTED: "발행 요청됨",
  ISSUED: "발행 완료",
  FAILED: "발행 실패",
  CANCEL_REQUESTED: "취소 요청됨",
  CANCELLED: "취소 완료",
};

function getCashReceiptIdentityLabel(identityType?: string | null) {
  if (identityType === "PHONE") return "휴대폰 번호";
  if (identityType === "BUSINESS_NUMBER") return "사업자등록번호";
  return "식별번호";
}

function formatCashReceiptIdentityValue(
  identityType?: string | null,
  identityValue?: string | null,
) {
  if (!identityValue) return "-";
  if (identityType === "PHONE") return formatPhone(identityValue);
  if (identityType === "BUSINESS_NUMBER") {
    return formatBusinessNumber(identityValue);
  }
  return identityValue;
}

function getCashReceiptStatusLabel(status?: string | null) {
  if (!status) return "-";
  return CASH_RECEIPT_STATUS_LABEL[status] ?? status;
}

function isDeliveryOrder(fulfillmentType?: FulfillmentType | null) {
  return fulfillmentType === "SHIPPING";
}

const DELIVERY_STATUS_LABEL: Record<DeliveryTrackingStatus, string> = {
  PENDING: "배송 접수",
  PREPARING_SHIPMENT: "배송 준비중",
  IN_TRANSIT: "배송중",
  DELIVERED: "배송 완료",
  DELIVERY_FAILED: "배송 실패",
};

const DELIVERY_STATUS_DESCRIPTION: Record<DeliveryTrackingStatus, string> = {
  PENDING: "배송 요청이 접수된 상태입니다.",
  PREPARING_SHIPMENT: "상품 포장과 출고 준비가 진행 중입니다.",
  IN_TRANSIT: "배송이 시작되어 이동 중입니다.",
  DELIVERED: "배송이 완료된 상태입니다.",
  DELIVERY_FAILED: "배송이 정상 완료되지 않아 추가 확인이 필요합니다.",
};

const NEXT_DELIVERY_STATUS: Partial<
  Record<DeliveryTrackingStatus, DeliveryTrackingStatus>
> = {
  PENDING: "PREPARING_SHIPMENT",
  PREPARING_SHIPMENT: "IN_TRANSIT",
  IN_TRANSIT: "DELIVERED",
};

// ============================================================
// Constants
// ============================================================

const DISPLAY_STATUS_FLOW: OrderStatusDisplay[] = [
  "RECEIVED",
  "PREPARING",
  "READY",
];

const displayStatusConfig: Record<
  OrderStatusDisplay,
  { label: string; bg: string; text: string; dot: string; icon: string }
> = {
  RECEIVED: {
    label: "주문접수",
    bg: "bg-warning-500/15",
    text: "text-warning-600",
    dot: "bg-warning-500",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  },
  PREPARING: {
    label: "준비중",
    bg: "bg-secondary-500/15",
    text: "text-secondary-600",
    dot: "bg-secondary-500",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  READY: {
    label: "준비완료",
    bg: "bg-success/15",
    text: "text-success-600",
    dot: "bg-success",
    icon: "M5 13l4 4L19 7",
  },
  CANCELLED: {
    label: "취소",
    bg: "bg-danger-500/15",
    text: "text-danger-600",
    dot: "bg-danger-500",
    icon: "M6 18L18 6M6 6l12 12",
  },
};

const actionStatusConfig: Record<
  OrderStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  CREATED: {
    label: "주문접수",
    bg: "bg-warning-500/15",
    text: "text-warning-600",
    dot: "bg-warning-500",
  },
  CONFIRMED: {
    label: "확인",
    bg: "bg-primary-500/15",
    text: "text-primary-600",
    dot: "bg-primary-500",
  },
  PREPARING: {
    label: "준비중",
    bg: "bg-secondary-500/15",
    text: "text-secondary-600",
    dot: "bg-secondary-500",
  },
  READY: {
    label: "준비완료",
    bg: "bg-success/15",
    text: "text-success-600",
    dot: "bg-success",
  },
  COMPLETED: {
    label: "완료",
    bg: "bg-neutral-200",
    text: "text-neutral-600",
    dot: "bg-neutral-500",
  },
  CANCELLED: {
    label: "취소",
    bg: "bg-danger-500/15",
    text: "text-danger-600",
    dot: "bg-danger-500",
  },
  REFUNDED: {
    label: "환불",
    bg: "bg-pink-500/15",
    text: "text-pink-500",
    dot: "bg-pink-500",
  },
};

const ORDER_FLOW: OrderStatus[] = [
  "CREATED",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
];

function getNextStatus(current: OrderStatus): OrderStatus | null {
  const idx = ORDER_FLOW.indexOf(current);
  if (idx === -1) return null;
  return ORDER_FLOW[idx + 1] ?? null;
}

// ============================================================
// Helpers
// ============================================================

// ============================================================
// Sub-components
// ============================================================

/** Status progress stepper */
function StatusStepper({ currentStatus }: { currentStatus: OrderStatus }) {
  const currentDisplay = getOrderStatusDisplay(currentStatus);

  if (currentDisplay === "CANCELLED") {
    const cfg = displayStatusConfig.CANCELLED;
    return (
      <div className={`flex items-center gap-2 px-4 py-3 rounded-md ${cfg.bg}`}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cfg.text}
        >
          <path d={cfg.icon} />
        </svg>
        <span className={`text-sm font-bold ${cfg.text}`}>{cfg.label}</span>
      </div>
    );
  }

  const currentIdx = DISPLAY_STATUS_FLOW.indexOf(currentDisplay);

  return (
    <div className="flex items-center gap-0 w-full">
      {DISPLAY_STATUS_FLOW.map((status, idx) => {
        const cfg = displayStatusConfig[status];
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isUpcoming = idx > currentIdx;

        return (
          <div key={status} className="flex items-center flex-1 last:flex-none">
            {/* Step circle */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                  transition-all duration-300
                  ${isDone ? "bg-success text-white" : ""}
                  ${isCurrent ? `${cfg.dot} text-white animate-pulse-slow` : ""}
                  ${isUpcoming ? "bg-bg-tertiary text-text-tertiary" : ""}
                `}
              >
                {isDone ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              <span
                className={`text-2xs font-medium whitespace-nowrap ${
                  isCurrent ? "text-foreground font-bold" : "text-text-tertiary"
                }`}
              >
                {cfg.label}
              </span>
            </div>

            {/* Connector line */}
            {idx < DISPLAY_STATUS_FLOW.length - 1 && (
              <div className="flex-1 mx-1 mt-[-16px]">
                <div
                  className={`h-0.5 w-full rounded-full transition-all duration-300 ${
                    idx < currentIdx ? "bg-success" : "bg-bg-tertiary"
                  }`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Single order item row */
function OrderItemRow({ item }: { item: OrderItem }) {
  return (
    <div className="flex items-center gap-3 py-3">
      {/* Item icon placeholder */}
      <div className="w-12 h-12 rounded-md bg-bg-tertiary flex items-center justify-center shrink-0">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-text-tertiary"
        >
          <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      </div>

      {/* Name + option */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-foreground truncate">
          {item.name}
        </div>
        {item.option && (
          <div className="text-xs text-text-tertiary mt-0.5 truncate">
            {item.option}
          </div>
        )}
      </div>

      {/* Qty */}
      <div className="text-sm text-text-secondary shrink-0">
        {item.qty}개
      </div>

      {/* Price */}
      <div className="text-sm font-bold text-foreground shrink-0 text-right min-w-[80px]">
        {formatWon(item.unitPrice * item.qty)}
      </div>
    </div>
  );
}

/** Info row for customer/payment section */
function InfoRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-text-secondary">{label}</span>
      <span
        className={`text-sm ${bold ? "font-extrabold text-foreground" : "text-foreground"}`}
      >
        {value}
      </span>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function CustomerOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params?.orderId;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [deliveryTrackingLoading, setDeliveryTrackingLoading] = useState(false);
  const [deliveryCarrierInput, setDeliveryCarrierInput] = useState("");
  const [deliveryTrackingNumberInput, setDeliveryTrackingNumberInput] =
    useState("");
  const [paymentConfirmLoading, setPaymentConfirmLoading] = useState(false);
  const [cashReceiptRetryLoading, setCashReceiptRetryLoading] = useState(false);

  const canUpdateStatus =
    order?.myRole === "OWNER" ||
    order?.myRole === "ADMIN" ||
    order?.myRole === "BRANCH_OWNER" ||
    order?.myRole === "BRANCH_ADMIN" ||
    order?.myRole === "STAFF";

  const canCancelOrder =
    !!order &&
    !["COMPLETED", "CANCELLED", "REFUNDED"].includes(order.status);
  const canRefundOrder =
    !!order && canUpdateStatus && order.status === "COMPLETED";
  const nextStatusAction = order ? getNextStatus(order.status) : null;
  const canConfirmTransferPayment =
    !!order &&
    canUpdateStatus &&
    order.payment.method === "TRANSFER" &&
    order.paymentStatus === "PENDING";
  const canRetryCashReceiptIssue =
    !!order &&
    canUpdateStatus &&
    order.status === "COMPLETED" &&
    order.payment.method === "TRANSFER" &&
    order.paymentStatus === "SUCCESS" &&
    order.cashReceiptRequest?.requested === true &&
    (!order.cashReceiptIssue || order.cashReceiptIssue.status === "FAILED");
  const isDeliveryFulfillment = isDeliveryOrder(order?.fulfillmentType);
  const deliveryTracking =
    isDeliveryFulfillment && order?.deliveryTracking
      ? order.deliveryTracking
      : isDeliveryFulfillment
        ? { status: "PENDING" as DeliveryTrackingStatus }
        : null;
  const nextDeliveryStatus = deliveryTracking
    ? NEXT_DELIVERY_STATUS[deliveryTracking.status] ?? null
    : null;

  const loadOrder = useCallback(async () => {
    if (!orderId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.get<OrderDetail>(`/customer/orders/${orderId}`);
      setOrder(data);
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error ? e.message : "주문을 불러올 수 없습니다",
      );
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // Load order detail
  useEffect(() => {
    if (!orderId) return;

    void loadOrder();
  }, [orderId, loadOrder]);

  useEffect(() => {
    setDeliveryCarrierInput(order?.deliveryTracking?.carrier ?? "");
    setDeliveryTrackingNumberInput(order?.deliveryTracking?.trackingNumber ?? "");
  }, [order?.deliveryTracking?.carrier, order?.deliveryTracking?.trackingNumber]);

  // Update order status
  const handleStatusUpdate = async (newStatus: OrderStatus) => {
    if (!order || !orderId || !canUpdateStatus) return;

    try {
      setStatusLoading(true);
      setError(null);
      await apiClient.patch<{ status: OrderStatus }>(
        `/customer/orders/${orderId}/status`,
        { status: newStatus },
      );
      await loadOrder();
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error ? e.message : "상태 변경에 실패했습니다",
      );
    } finally {
      setStatusLoading(false);
    }
  };

  const handleTransferPaymentConfirm = async () => {
    if (!orderId || !canConfirmTransferPayment) return;

    try {
      setPaymentConfirmLoading(true);
      setError(null);
      await apiClient.patch(
        `/customer/orders/${orderId}/payment/confirm-transfer`,
        {},
      );
      await loadOrder();
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error ? e.message : "입금확인 처리에 실패했습니다",
      );
    } finally {
      setPaymentConfirmLoading(false);
    }
  };

  const handleDeliveryTrackingUpdate = async (
    deliveryStatus: DeliveryTrackingStatus,
  ) => {
    if (!orderId || !canUpdateStatus || !isDeliveryFulfillment) return;

    try {
      setDeliveryTrackingLoading(true);
      setError(null);
      await apiClient.patch(`/customer/orders/${orderId}/delivery-tracking`, {
        deliveryStatus,
        deliveryCarrier: deliveryCarrierInput,
        deliveryTrackingNumber: deliveryTrackingNumberInput,
      });
      await loadOrder();
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error ? e.message : "배송현황 변경에 실패했습니다",
      );
    } finally {
      setDeliveryTrackingLoading(false);
    }
  };

  const handleCashReceiptRetry = async () => {
    if (!orderId || !canRetryCashReceiptIssue) return;

    try {
      setCashReceiptRetryLoading(true);
      setError(null);
      await apiClient.patch(`/customer/orders/${orderId}/cash-receipt/retry`, {});
      await loadOrder();
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error ? e.message : "현금영수증 재발행 시도에 실패했습니다",
      );
    } finally {
      setCashReceiptRetryLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <BackButton />
        <div className="mt-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-card rounded-md border border-border p-4 animate-pulse"
            >
              <div className="h-5 w-32 bg-bg-tertiary rounded mb-3" />
              <div className="h-4 w-48 bg-bg-tertiary rounded mb-2" />
              <div className="h-4 w-24 bg-bg-tertiary rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error && !order) {
    return (
      <div className="max-w-2xl mx-auto">
        <BackButton />
        <div className="border border-danger-500 rounded-md p-4 bg-danger-500/10 text-danger-500 mt-4 text-sm">
          {error}
        </div>
      </div>
    );
  }

  // Not found
  if (!order) {
    return (
      <div className="max-w-2xl mx-auto">
        <BackButton />
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-full bg-bg-tertiary flex items-center justify-center mb-4">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-text-tertiary"
            >
              <path d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-foreground font-semibold">
            주문을 찾을 수 없습니다
          </p>
        </div>
      </div>
    );
  }

  const itemCount = order.items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Back button */}
      <BackButton />

      {/* Order header card */}
      <div className="bg-card rounded-md border border-border p-4 mt-3 mb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="font-mono text-lg font-extrabold text-foreground">
              {order.orderNo ?? order.id.slice(0, 8)}
            </span>
            <div className="text-xs text-text-tertiary mt-0.5">
              {formatDateTime(order.orderedAt)}
            </div>
          </div>
          <StatusBadgeLarge status={order.status} />
        </div>

        {/* Status stepper */}
        <div className="mt-4 pt-4 border-t border-border-light">
          <StatusStepper currentStatus={order.status} />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="border border-danger-500 rounded-md p-3 bg-danger-500/10 text-danger-500 mb-3 text-sm">
          {error}
        </div>
      )}

      {/* Order items */}
      <div className="bg-card rounded-md border border-border p-4 mb-3">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-extrabold text-foreground">
            주문 상품
          </h2>
          <span className="text-xs text-text-tertiary">{itemCount}개</span>
        </div>

        <div className="divide-y divide-border-light">
          {order.items.map((item) => (
            <OrderItemRow key={item.id} item={item} />
          ))}
          {order.items.length === 0 && (
            <div className="py-6 text-center text-sm text-text-tertiary">
              상품 정보 없음
            </div>
          )}
        </div>

        {/* Price breakdown */}
        <div className="mt-3 pt-3 border-t border-border space-y-1">
          <InfoRow label="상품 금액" value={formatWon(order.payment.subtotal)} />
          {order.payment.shippingFee > 0 && (
            <InfoRow
              label="배달비"
              value={formatWon(order.payment.shippingFee)}
            />
          )}
          {order.payment.discount > 0 && (
            <InfoRow
              label="할인"
              value={`-${formatWon(order.payment.discount)}`}
            />
          )}
          <div className="pt-2 border-t border-border-light">
            <InfoRow
              label="총 결제금액"
              value={formatWon(order.payment.total)}
              bold
            />
          </div>
        </div>
      </div>

      {/* Customer info */}
      <div className="bg-card rounded-md border border-border p-4 mb-3">
        <h2 className="text-sm font-extrabold text-foreground mb-3">
          고객 정보
        </h2>
        <div className="space-y-0 divide-y divide-border-light">
          <InfoRow label="이름" value={order.customer.name || "-"} />
          <InfoRow
            label="연락처"
            value={formatPhone(order.customer.phone)}
          />
          <InfoRow label="주소" value={order.customer.address1 || "-"} />
          {order.customer.memo && (
            <div className="pt-2">
              <div className="text-xs text-text-tertiary mb-1">
                요청사항
              </div>
              <div className="text-sm text-foreground bg-bg-tertiary rounded-md px-3 py-2">
                {order.customer.memo}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment info */}
      <div className="bg-card rounded-md border border-border p-4 mb-3">
        <h2 className="text-sm font-extrabold text-foreground mb-3">
          결제 정보
        </h2>
        <InfoRow
          label="주문 방식"
          value={
            order.fulfillmentType
              ? FULFILLMENT_TYPE_LABEL[order.fulfillmentType]
              : "-"
          }
        />
        <InfoRow
          label="결제 방법"
          value={PAYMENT_METHOD_LABEL[order.payment.method] || order.payment.method || "-"}
        />
        <InfoRow label="결제 상태" value={order.paymentStatus || "-"} />
        {canConfirmTransferPayment && (
          <div className="pt-3">
            <button
              type="button"
              onClick={() => void handleTransferPaymentConfirm()}
              disabled={paymentConfirmLoading}
              className="h-10 w-full rounded-md border border-border bg-bg-secondary text-foreground text-sm font-semibold cursor-pointer hover:bg-bg-tertiary active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {paymentConfirmLoading ? "입금확인 처리 중..." : "입금확인 처리"}
            </button>
            <p className="mt-2 text-xs text-text-tertiary">
              계좌이체 주문의 결제 상태를 수동으로 완료 처리합니다.
            </p>
          </div>
        )}
      </div>

      {deliveryTracking && (
        <div className="bg-card rounded-md border border-border p-4 mb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold text-foreground mb-1">
                배송 현황
              </h2>
              <p className="text-xs text-text-tertiary">
                {DELIVERY_STATUS_DESCRIPTION[deliveryTracking.status]}
              </p>
            </div>
            <span className="inline-flex rounded-full bg-primary-500/15 px-3 py-1 text-xs font-semibold text-primary-600">
              {DELIVERY_STATUS_LABEL[deliveryTracking.status]}
            </span>
          </div>

          <div className="mt-3 space-y-0 divide-y divide-border-light">
            <InfoRow
              label="배송 방식"
              value={
                order.fulfillmentType === "SHIPPING" ? "택배" : "배달"
              }
            />
            <InfoRow
              label="배송사"
              value={deliveryTracking.carrier || "-"}
            />
            <InfoRow
              label="송장 번호"
              value={deliveryTracking.trackingNumber || "-"}
            />
            <InfoRow
              label="최근 상태"
              value={DELIVERY_STATUS_LABEL[deliveryTracking.status]}
            />
            {deliveryTracking.startedAt && (
              <InfoRow
                label="배송 시작"
                value={formatDateTime(deliveryTracking.startedAt)}
              />
            )}
            {deliveryTracking.deliveredAt && (
              <InfoRow
                label="배송 완료"
                value={formatDateTime(deliveryTracking.deliveredAt)}
              />
            )}
          </div>

          {canUpdateStatus && (
            <div className="pt-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs text-text-tertiary">
                    배송사
                  </span>
                  <input
                    value={deliveryCarrierInput}
                    onChange={(e) => setDeliveryCarrierInput(e.target.value)}
                    placeholder="예: CJ대한통운"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-text-tertiary">
                    송장 번호
                  </span>
                  <input
                    value={deliveryTrackingNumberInput}
                    onChange={(e) =>
                      setDeliveryTrackingNumberInput(e.target.value)
                    }
                    placeholder="예: 1234567890"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
                  />
                </label>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {nextDeliveryStatus ? (
                  <button
                    type="button"
                    onClick={() => void handleDeliveryTrackingUpdate(nextDeliveryStatus)}
                    disabled={deliveryTrackingLoading}
                    className="h-10 w-full rounded-md border border-border bg-bg-secondary text-foreground text-sm font-medium cursor-pointer hover:bg-bg-tertiary active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deliveryTrackingLoading
                      ? "배송현황 변경 중..."
                      : DELIVERY_STATUS_LABEL[nextDeliveryStatus]}
                  </button>
                ) : (
                  <div className="col-span-2 flex items-center justify-center rounded-md bg-bg-tertiary px-3 py-2 text-sm font-medium text-text-secondary">
                    다음 배송 단계가 없습니다
                  </div>
                )}
                {deliveryTracking.status !== "DELIVERY_FAILED" && (
                  <button
                    type="button"
                    onClick={() => void handleDeliveryTrackingUpdate("DELIVERY_FAILED")}
                    disabled={deliveryTrackingLoading}
                    className="h-10 w-full rounded-md border border-danger-200 bg-danger-50 text-danger-600 text-sm font-medium cursor-pointer hover:bg-danger-100 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    배송 실패 처리
                  </button>
                )}
              </div>
              <p className="mt-2 text-xs text-text-tertiary">
                배송 상태는 주문 상태와 별도로 관리됩니다.
              </p>
            </div>
          )}
        </div>
      )}

      {order.cashReceiptRequest?.requested && (
        <div className="bg-card rounded-md border border-border p-4 mb-3">
          <h2 className="text-sm font-extrabold text-foreground mb-3">
            현금영수증 요청 정보
          </h2>
          <InfoRow label="발행 요청" value="요청됨" />
          <InfoRow
            label="발급 유형"
            value={
              CASH_RECEIPT_TYPE_LABEL[order.cashReceiptRequest.type || ""] ||
              order.cashReceiptRequest.type ||
              "-"
            }
          />
          <InfoRow
            label={getCashReceiptIdentityLabel(order.cashReceiptRequest.identityType)}
            value={formatCashReceiptIdentityValue(
              order.cashReceiptRequest.identityType,
              order.cashReceiptRequest.identityValue,
            )}
          />
        </div>
      )}

      {order.cashReceiptRequest?.requested && (
        <div className="bg-card rounded-md border border-border p-4 mb-3">
          <h2 className="text-sm font-extrabold text-foreground mb-3">
            현금영수증 발행 결과
          </h2>
          {order.cashReceiptIssue ? (
            <>
              <InfoRow
                label="발행 상태"
                value={getCashReceiptStatusLabel(order.cashReceiptIssue.status)}
              />
              <InfoRow
                label="발급사"
                value={formatCashReceiptProvider(order.cashReceiptIssue.provider)}
              />
              <InfoRow
                label="발행 시각"
                value={formatDateTime(order.cashReceiptIssue.issuedAt ?? "")}
              />
              <InfoRow
                label="승인번호"
                value={order.cashReceiptIssue.approvalNo || "-"}
              />
              {order.cashReceiptIssue.errorMessage && (
                <InfoRow
                  label="실패 사유"
                  value={order.cashReceiptIssue.errorMessage}
                />
              )}
            </>
          ) : (
            <p className="text-sm text-text-secondary">
              아직 발행 결과가 없습니다. 주문 완료 후 발행 여부를 확인할 수 있습니다.
            </p>
          )}
          {canRetryCashReceiptIssue && (
            <div className="pt-3">
              <button
                type="button"
                onClick={() => void handleCashReceiptRetry()}
                disabled={cashReceiptRetryLoading}
                className="h-10 w-full rounded-md border border-border bg-bg-secondary text-foreground text-sm font-semibold cursor-pointer hover:bg-bg-tertiary active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cashReceiptRetryLoading
                  ? "현금영수증 재발행 시도 중..."
                  : "현금영수증 다시 발행 시도"}
              </button>
              <p className="mt-2 text-xs text-text-tertiary">
                브랜드 연동 정보를 수정한 뒤, 실패한 주문의 현금영수증 발행을 다시 시도할 수 있습니다.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Status actions */}
      {canUpdateStatus && (
        <div className="bg-card rounded-md border border-border p-4 mb-3">
          <h2 className="text-sm font-extrabold text-foreground mb-1">
            상태 변경
          </h2>
          <p className="text-xs text-text-tertiary mb-3">
            주문은 다음 단계로 순차 변경되며, 완료 후에는 환불 처리할 수 있습니다
          </p>

          <div className="grid grid-cols-2 gap-2">
            {nextStatusAction ? (
              <button
                onClick={() => handleStatusUpdate(nextStatusAction)}
                disabled={statusLoading}
                className="h-10 w-full rounded-md border border-border bg-bg-secondary text-foreground text-sm font-medium cursor-pointer hover:bg-bg-tertiary active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionStatusConfig[nextStatusAction].label}
              </button>
            ) : (
              <div className="col-span-2 flex items-center justify-center rounded-md bg-bg-tertiary px-3 py-2 text-sm font-medium text-text-secondary">
                더 이상 진행할 수 있는 다음 단계가 없습니다
              </div>
            )}
            {canCancelOrder && (
              <button
                onClick={() => handleStatusUpdate("CANCELLED")}
                disabled={statusLoading}
                className="h-10 w-full rounded-md border border-danger-200 bg-danger-50 text-danger-600 text-sm font-medium cursor-pointer hover:bg-danger-100 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                취소
              </button>
            )}
            {canRefundOrder && (
              <button
                onClick={() => handleStatusUpdate("REFUNDED")}
                disabled={statusLoading}
                className="h-10 w-full rounded-md border border-danger-200 bg-danger-50 text-danger-600 text-sm font-medium cursor-pointer hover:bg-danger-100 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                환불
              </button>
            )}
          </div>

          {statusLoading && (
            <div className="mt-3 text-xs text-text-tertiary text-center animate-pulse-slow">
              상태 변경 중...
            </div>
          )}
        </div>
      )}

      {/* Role info for non-privileged users */}
      {!canUpdateStatus && (
        <div className="bg-card rounded-md border border-border p-4 mb-3">
          <div className="flex items-center gap-2">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-text-tertiary"
            >
              <path d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-6V4" />
              <circle cx="12" cy="12" r="10" />
            </svg>
            <span className="text-sm text-text-secondary">
              현재 역할: <span className="font-semibold">{order.myRole || "VIEWER"}</span>
            </span>
          </div>
          <p className="text-xs text-text-tertiary mt-1">
            주문 상태를 변경하려면 OWNER, ADMIN, BRANCH_OWNER, BRANCH_ADMIN, STAFF 권한이 필요합니다
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Shared small components
// ============================================================

function BackButton() {
  return (
    <Link
      href="/customer/orders"
      className="inline-flex items-center gap-1 text-sm text-text-secondary no-underline hover:text-foreground transition-colors"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
      주문 목록
    </Link>
  );
}

function StatusBadgeLarge({ status }: { status: OrderStatus }) {
  const displayStatus = getOrderStatusDisplay(status);
  const cfg = displayStatusConfig[displayStatus];
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-sm font-bold ${cfg.bg} ${cfg.text}`}
    >
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {ORDER_STATUS_DISPLAY_LABEL[displayStatus]}
    </span>
  );
}

