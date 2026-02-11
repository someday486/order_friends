"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { formatDateTime, formatPhone, formatWon } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, type OrderStatus } from "@/types/common";

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

type OrderDetail = {
  id: string;
  orderNo: string | null;
  orderedAt: string;
  status: OrderStatus;
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
  items: OrderItem[];
  myRole?: string;
};

// ============================================================
// Constants
// ============================================================

const STATUS_FLOW: OrderStatus[] = [
  "CREATED",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
];

const statusConfig: Record<
  OrderStatus,
  { label: string; bg: string; text: string; dot: string; icon: string }
> = {
  CREATED: {
    label: "주문접수",
    bg: "bg-warning-500/15",
    text: "text-warning-600",
    dot: "bg-warning-500",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  },
  CONFIRMED: {
    label: "확인",
    bg: "bg-primary-500/15",
    text: "text-primary-600",
    dot: "bg-primary-500",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
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
  COMPLETED: {
    label: "완료",
    bg: "bg-neutral-200",
    text: "text-neutral-600",
    dot: "bg-neutral-500",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  CANCELLED: {
    label: "취소",
    bg: "bg-danger-500/15",
    text: "text-danger-600",
    dot: "bg-danger-500",
    icon: "M6 18L18 6M6 6l12 12",
  },
  REFUNDED: {
    label: "환불",
    bg: "bg-pink-500/15",
    text: "text-pink-500",
    dot: "bg-pink-500",
    icon: "M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6",
  },
};

// ============================================================
// Helpers
// ============================================================

// ============================================================
// Sub-components
// ============================================================

/** Status progress stepper */
function StatusStepper({ currentStatus }: { currentStatus: OrderStatus }) {
  if (currentStatus === "CANCELLED" || currentStatus === "REFUNDED") {
    const cfg = statusConfig[currentStatus];
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

  const currentIdx = STATUS_FLOW.indexOf(currentStatus);

  return (
    <div className="flex items-center gap-0 w-full">
      {STATUS_FLOW.map((status, idx) => {
        const cfg = statusConfig[status];
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
            {idx < STATUS_FLOW.length - 1 && (
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

/** Status change button */
function StatusActionButton({
  status,
  currentStatus,
  loading,
  onClick,
}: {
  status: OrderStatus;
  currentStatus: OrderStatus;
  loading: boolean;
  onClick: () => void;
}) {
  const cfg = statusConfig[status];
  const isCurrent = currentStatus === status;

  if (isCurrent) {
    return (
      <div
        className={`flex items-center justify-center gap-2 h-10 rounded-md ${cfg.bg} ${cfg.text} text-sm font-bold`}
      >
        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
        {cfg.label} (현재)
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="h-10 w-full rounded-md border border-border bg-bg-secondary text-foreground text-sm font-medium cursor-pointer hover:bg-bg-tertiary active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {cfg.label}
    </button>
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

  const canUpdateStatus =
    order?.myRole === "OWNER" ||
    order?.myRole === "ADMIN" ||
    order?.myRole === "BRANCH_OWNER" ||
    order?.myRole === "BRANCH_ADMIN" ||
    order?.myRole === "STAFF";

  // Load order detail
  useEffect(() => {
    if (!orderId) return;

    const loadOrder = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiClient.get<OrderDetail>(
          `/customer/orders/${orderId}`,
        );
        setOrder(data);
      } catch (e) {
        console.error(e);
        setError(
          e instanceof Error ? e.message : "주문을 불러올 수 없습니다",
        );
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [orderId]);

  // Update order status
  const handleStatusUpdate = async (newStatus: OrderStatus) => {
    if (!order || !orderId || !canUpdateStatus) return;

    try {
      setStatusLoading(true);
      setError(null);
      const data = await apiClient.patch<{ status: OrderStatus }>(
        `/customer/orders/${orderId}/status`,
        { status: newStatus },
      );
      setOrder((prev) => (prev ? { ...prev, status: data.status } : null));
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error ? e.message : "상태 변경에 실패했습니다",
      );
    } finally {
      setStatusLoading(false);
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
          label="결제 방법"
          value={PAYMENT_METHOD_LABEL[order.payment.method] || order.payment.method || "-"}
        />
      </div>

      {/* Status actions */}
      {canUpdateStatus && (
        <div className="bg-card rounded-md border border-border p-4 mb-3">
          <h2 className="text-sm font-extrabold text-foreground mb-1">
            상태 변경
          </h2>
          <p className="text-xs text-text-tertiary mb-3">
            주문 상태를 변경할 수 있습니다
          </p>

          <div className="grid grid-cols-2 gap-2">
            {(
              [
                "CREATED",
                "CONFIRMED",
                "PREPARING",
                "READY",
                "COMPLETED",
                "CANCELLED",
              ] as OrderStatus[]
            ).map((status) => (
              <StatusActionButton
                key={status}
                status={status}
                currentStatus={order.status}
                loading={statusLoading}
                onClick={() => handleStatusUpdate(status)}
              />
            ))}
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
            주문 상태를 변경하려면 매니저 또는 스태프 권한이 필요합니다
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
  const cfg = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-sm font-bold ${cfg.bg} ${cfg.text}`}
    >
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

