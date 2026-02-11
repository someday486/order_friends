"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatDateTimeFull, formatWon } from "@/lib/format";
import { ORDER_STATUS_LABEL_LONG, type OrderStatus } from "@/types/common";
import { apiClient } from "@/lib/api-client";

// ============================================================
// Types
// ============================================================

type OrderInfo = {
  id: string;
  orderNo: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  items: {
    name: string;
    qty: number;
    unitPrice: number;
  }[];
};

// ============================================================
// Constants
// ============================================================

const statusBadgeClasses: Record<string, string> = {
  CREATED: "bg-primary-500/30 text-primary-500",
  CONFIRMED: "bg-purple-500/30 text-purple-400",
  PREPARING: "bg-warning-500/30 text-warning-500",
  READY: "bg-success/30 text-success",
  COMPLETED: "bg-neutral-500/30 text-neutral-500",
  CANCELLED: "bg-danger-500/30 text-danger-500",
  REFUNDED: "bg-pink-500/30 text-pink-400",
};

const STATUS_STEPS = ["CREATED", "CONFIRMED", "PREPARING", "READY", "COMPLETED"];

// ============================================================
// Helpers
// ============================================================

// ============================================================
// Component
// ============================================================

export default function TrackOrderPage() {
  const params = useParams();
  const orderId = params?.orderId as string;

  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 주문 조회
  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await apiClient.get<OrderInfo>(`/public/orders/${orderId}`, { auth: false });
      setOrder(data);
    } catch (e: unknown) {
      const message = (e as Error)?.message ?? "조회 중 오류가 발생했습니다.";
      setError(message.includes("404") ? "주문을 찾을 수 없습니다." : message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    }
  }, [orderId, fetchOrder]);

  // 자동 새로고침 (30초마다)
  useEffect(() => {
    if (!orderId) return;

    const interval = setInterval(fetchOrder, 30000);

    return () => clearInterval(interval);
  }, [orderId, fetchOrder]);

  // 현재 상태 인덱스
  const currentStepIndex = order ? STATUS_STEPS.indexOf(order.status) : -1;

  // ============================================================
  // Render
  // ============================================================

  if (loading && !order) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <p className="text-text-secondary text-center p-10">주문 조회 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="p-10 text-center">
          <p className="text-danger-500 mb-4">{error}</p>
          <button onClick={fetchOrder} className="py-2 px-4 rounded-lg border border-border bg-transparent text-foreground text-[13px] cursor-pointer hover:bg-bg-tertiary transition-colors">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <p className="text-text-secondary text-center p-10">주문을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const isCancelled = order.status === "CANCELLED" || order.status === "REFUNDED";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-border">
        <h1 className="m-0 text-xl font-bold text-foreground">주문 상태</h1>
        <button onClick={fetchOrder} className="py-2 px-4 rounded-lg border border-border bg-transparent text-foreground text-[13px] cursor-pointer hover:bg-bg-tertiary transition-colors">
          새로고침
        </button>
      </header>

      {/* Order Number */}
      <div className="p-4 text-center">
        <div className="text-[13px] text-text-tertiary">주문번호</div>
        <div className="text-2xl font-extrabold font-mono mt-1 text-foreground">
          {order.orderNo}
        </div>
      </div>

      {/* Status */}
      <div className="px-4 pb-6">
        {isCancelled ? (
          <div className="p-5 rounded-xl bg-danger-500/20 text-center">
            <div className="text-[32px]">❌</div>
            <div className="mt-2 text-lg font-bold text-danger-500">
              {ORDER_STATUS_LABEL_LONG[order.status] ?? order.status}
            </div>
          </div>
        ) : (
          <div>
            {/* Progress Steps */}
            <div className="flex justify-between relative">
              {STATUS_STEPS.map((step, idx) => {
                const isActive = idx <= currentStepIndex;
                const isCurrent = idx === currentStepIndex;

                return (
                  <div key={step} className="text-center flex-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-sm font-bold ${
                        isActive ? "bg-success text-white" : "bg-bg-tertiary text-text-secondary"
                      } ${isCurrent ? "ring-2 ring-foreground" : ""}`}
                    >
                      {isActive ? "✓" : idx + 1}
                    </div>
                    <div
                      className={`mt-2 text-[11px] ${
                        isActive ? "text-foreground" : "text-text-tertiary"
                      } ${isCurrent ? "font-bold" : "font-normal"}`}
                    >
                      {ORDER_STATUS_LABEL_LONG[step as OrderStatus] ?? step}
                    </div>
                  </div>
                );
              })}

              {/* Progress Line (background) */}
              <div className="absolute top-4 left-[10%] right-[10%] h-0.5 bg-bg-tertiary -z-10" />
              {/* Progress Line (active) */}
              <div
                className="absolute top-4 left-[10%] h-0.5 bg-success -z-10 transition-all duration-300"
                style={{ width: `${Math.max(0, currentStepIndex) * 20}%` }}
              />
            </div>

            {/* Current Status Message */}
            <div className="mt-6 p-4 rounded-xl bg-bg-secondary text-center">
              <span className={`inline-block py-1.5 px-4 rounded-full font-bold ${statusBadgeClasses[order.status] || "bg-bg-tertiary text-foreground"}`}>
                {ORDER_STATUS_LABEL_LONG[order.status] ?? order.status}
              </span>
              <div className="mt-3 text-[13px] text-text-tertiary">
                {order.status === "CREATED" && "주문이 접수되었습니다. 곧 확인해드릴게요!"}
                {order.status === "CONFIRMED" && "주문이 확인되었습니다. 준비를 시작합니다."}
                {order.status === "PREPARING" && "주문을 준비하고 있습니다. 잠시만 기다려주세요."}
                {order.status === "READY" && "준비가 완료되었습니다! 픽업해주세요."}
                {order.status === "COMPLETED" && "주문이 완료되었습니다. 감사합니다!"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Order Details */}
      <div className="m-4 p-4 rounded-[14px] border border-border bg-bg-secondary">
        <h3 className="text-sm font-semibold text-text-tertiary mb-3">주문 내역</h3>

        {order.items.map((item, idx) => (
          <div key={idx} className="flex justify-between py-2">
            <span className="text-foreground">
              {item.name} × {item.qty}
            </span>
            <span className="text-text-secondary">{formatWon(item.unitPrice * item.qty)}</span>
          </div>
        ))}

        <div className="flex justify-between py-2 border-t border-border pt-3 mt-2">
          <span className="font-semibold text-foreground">총 결제금액</span>
          <span className="text-lg font-extrabold text-foreground">{formatWon(order.totalAmount)}</span>
        </div>

        <div className="mt-3 text-xs text-text-tertiary">
          주문일시: {formatDateTimeFull(order.createdAt)}
        </div>
      </div>
    </div>
  );
}
