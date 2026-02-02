"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// ============================================================
// Types
// ============================================================

type OrderInfo = {
  id: string;
  orderNo: string;
  status: string;
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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const statusLabel: Record<string, string> = {
  CREATED: "주문 접수",
  CONFIRMED: "주문 확인",
  PREPARING: "준비 중",
  READY: "준비 완료",
  COMPLETED: "완료",
  CANCELLED: "취소됨",
  REFUNDED: "환불됨",
};

const statusColor: Record<string, string> = {
  CREATED: "#3b82f6",
  CONFIRMED: "#8b5cf6",
  PREPARING: "#f59e0b",
  READY: "#10b981",
  COMPLETED: "#6b7280",
  CANCELLED: "#ef4444",
  REFUNDED: "#ec4899",
};

const STATUS_STEPS = ["CREATED", "CONFIRMED", "PREPARING", "READY", "COMPLETED"];

// ============================================================
// Helpers
// ============================================================

function formatWon(amount: number) {
  return amount.toLocaleString("ko-KR") + "원";
}

function formatDateTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
  const fetchOrder = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE}/public/orders/${orderId}`);

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("주문을 찾을 수 없습니다.");
        }
        throw new Error(`조회 실패: ${res.status}`);
      }

      const data = await res.json();
      setOrder(data);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? "조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  // 자동 새로고침 (30초마다)
  useEffect(() => {
    if (!orderId) return;

    const interval = setInterval(() => {
      fetchOrder();
    }, 30000);

    return () => clearInterval(interval);
  }, [orderId]);

  // 현재 상태 인덱스
  const currentStepIndex = order ? STATUS_STEPS.indexOf(order.status) : -1;

  // ============================================================
  // Render
  // ============================================================

  if (loading && !order) {
    return (
      <div style={pageContainer}>
        <p style={{ color: "#aaa", textAlign: "center", padding: 40 }}>주문 조회 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageContainer}>
        <div style={{ padding: 40, textAlign: "center" }}>
          <p style={{ color: "#ff8a8a", marginBottom: 16 }}>{error}</p>
          <button onClick={fetchOrder} style={refreshBtn}>
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div style={pageContainer}>
        <p style={{ color: "#aaa", textAlign: "center", padding: 40 }}>주문을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const isCancelled = order.status === "CANCELLED" || order.status === "REFUNDED";

  return (
    <div style={pageContainer}>
      {/* Header */}
      <header style={header}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>주문 상태</h1>
        <button onClick={fetchOrder} style={refreshBtn}>
          새로고침
        </button>
      </header>

      {/* Order Number */}
      <div style={{ padding: "16px", textAlign: "center" }}>
        <div style={{ fontSize: 13, color: "#888" }}>주문번호</div>
        <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "monospace", marginTop: 4 }}>
          {order.orderNo}
        </div>
      </div>

      {/* Status */}
      <div style={{ padding: "0 16px 24px 16px" }}>
        {isCancelled ? (
          <div
            style={{
              padding: 20,
              borderRadius: 12,
              background: "#ef444420",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 32 }}>❌</div>
            <div style={{ marginTop: 8, fontSize: 18, fontWeight: 700, color: "#ef4444" }}>
              {statusLabel[order.status]}
            </div>
          </div>
        ) : (
          <div>
            {/* Progress Steps */}
            <div style={{ display: "flex", justifyContent: "space-between", position: "relative" }}>
              {STATUS_STEPS.map((step, idx) => {
                const isActive = idx <= currentStepIndex;
                const isCurrent = idx === currentStepIndex;

                return (
                  <div key={step} style={{ textAlign: "center", flex: 1 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: isActive ? "#10b981" : "#333",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto",
                        fontSize: 14,
                        fontWeight: 700,
                        border: isCurrent ? "2px solid #fff" : "none",
                      }}
                    >
                      {isActive ? "✓" : idx + 1}
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 11,
                        color: isActive ? "#fff" : "#666",
                        fontWeight: isCurrent ? 700 : 400,
                      }}
                    >
                      {statusLabel[step]}
                    </div>
                  </div>
                );
              })}

              {/* Progress Line */}
              <div
                style={{
                  position: "absolute",
                  top: 16,
                  left: "10%",
                  right: "10%",
                  height: 2,
                  background: "#333",
                  zIndex: -1,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 16,
                  left: "10%",
                  width: `${Math.max(0, currentStepIndex) * 20}%`,
                  height: 2,
                  background: "#10b981",
                  zIndex: -1,
                  transition: "width 0.3s",
                }}
              />
            </div>

            {/* Current Status Message */}
            <div
              style={{
                marginTop: 24,
                padding: 16,
                borderRadius: 12,
                background: "#0a0a0a",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  padding: "6px 16px",
                  borderRadius: 999,
                  background: (statusColor[order.status] ?? "#333") + "30",
                  color: statusColor[order.status] ?? "#fff",
                  fontWeight: 700,
                }}
              >
                {statusLabel[order.status]}
              </div>
              <div style={{ marginTop: 12, fontSize: 13, color: "#888" }}>
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
      <div style={orderCard}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "#888", marginBottom: 12 }}>주문 내역</h3>

        {order.items.map((item, idx) => (
          <div key={idx} style={itemRow}>
            <span>
              {item.name} × {item.qty}
            </span>
            <span style={{ color: "#aaa" }}>{formatWon(item.unitPrice * item.qty)}</span>
          </div>
        ))}

        <div style={{ ...itemRow, borderTop: "1px solid #333", paddingTop: 12, marginTop: 8 }}>
          <span style={{ fontWeight: 600 }}>총 결제금액</span>
          <span style={{ fontSize: 18, fontWeight: 800 }}>{formatWon(order.totalAmount)}</span>
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
          주문일시: {formatDateTime(order.createdAt)}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Styles
// ============================================================

const pageContainer: React.CSSProperties = {
  minHeight: "100vh",
  background: "#000",
  color: "#fff",
};

const header: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: 16,
  borderBottom: "1px solid #222",
};

const refreshBtn: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "transparent",
  color: "#fff",
  fontSize: 13,
  cursor: "pointer",
};

const orderCard: React.CSSProperties = {
  margin: 16,
  padding: 16,
  borderRadius: 14,
  border: "1px solid #222",
  background: "#0a0a0a",
};

const itemRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "8px 0",
};
