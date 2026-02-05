"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabaseClient";

// ============================================================
// Types
// ============================================================

type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";

type OrderItem = {
  id: string;
  product_name: string;
  option_name?: string | null;
  quantity: number;
  unit_price: number;
};

type OrderDetail = {
  id: string;
  order_no: string | null;
  customer_name: string;
  customer_phone: string;
  customer_address?: string;
  customer_memo?: string;
  total_amount: number;
  status: OrderStatus;
  created_at: string;
  branch?: {
    id: string;
    name: string;
  };
  items: OrderItem[];
  myRole?: string;
};

// ============================================================
// Constants
// ============================================================

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const statusLabel: Record<OrderStatus, string> = {
  PENDING: "대기",
  CONFIRMED: "확인",
  PREPARING: "준비중",
  READY: "준비완료",
  COMPLETED: "완료",
  CANCELLED: "취소",
};

const statusColor: Record<OrderStatus, string> = {
  PENDING: "#f59e0b",
  CONFIRMED: "#3b82f6",
  PREPARING: "#3b82f6",
  READY: "#10b981",
  COMPLETED: "#6b7280",
  CANCELLED: "#ef4444",
};

const STATUS_OPTIONS: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
];

// ============================================================
// Helpers
// ============================================================

async function getAccessToken() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) throw new Error("No access_token (로그인 필요)");
  return token;
}

function formatWon(amount: number) {
  return amount.toLocaleString("ko-KR") + "원";
}

function formatDateTime(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================
// Component
// ============================================================

export default function CustomerOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params?.orderId;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const canUpdateStatus = order?.myRole === "OWNER" || order?.myRole === "ADMIN";

  // Load order detail
  useEffect(() => {
    if (!orderId) return;

    const loadOrder = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = await getAccessToken();

        const res = await fetch(`${API_BASE}/customer/orders/${orderId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`주문 조회 실패: ${res.status}`);
        }

        const data = await res.json();
        setOrder(data);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "주문 조회 중 오류 발생");
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [orderId]);

  // Update order status
  const handleStatusUpdate = async (newStatus: OrderStatus) => {
    if (!order || !orderId) return;
    if (!canUpdateStatus) {
      alert("권한이 없습니다. OWNER 또는 ADMIN만 상태를 변경할 수 있습니다.");
      return;
    }

    try {
      setStatusLoading(true);
      setError(null);
      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/customer/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`상태 변경 실패: ${res.status} ${text}`);
      }

      const data = await res.json();
      setOrder((prev) => (prev ? { ...prev, status: data.status } : null));
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "상태 변경 중 오류 발생");
    } finally {
      setStatusLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <Link href="/customer/orders" style={{ color: "white", textDecoration: "none" }}>
          ← 주문 목록
        </Link>
        <div style={{ marginTop: 24 }}>로딩 중...</div>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div>
        <Link href="/customer/orders" style={{ color: "white", textDecoration: "none" }}>
          ← 주문 목록
        </Link>
        <div style={errorBox}>{error}</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div>
        <Link href="/customer/orders" style={{ color: "white", textDecoration: "none" }}>
          ← 주문 목록
        </Link>
        <div style={{ marginTop: 24, color: "#666" }}>주문을 찾을 수 없습니다.</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/customer/orders" style={{ color: "white", textDecoration: "none" }}>
          ← 주문 목록
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>주문 상세</h1>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 28,
              padding: "0 12px",
              borderRadius: 999,
              background: statusColor[order.status] + "20",
              color: statusColor[order.status],
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {statusLabel[order.status]}
          </span>
        </div>

        <div style={{ marginTop: 8, color: "#aaa", fontSize: 13 }}>
          주문번호{" "}
          <span style={{ fontFamily: "monospace", color: "#fff" }}>
            {order.order_no ?? order.id}
          </span>{" "}
          · {formatDateTime(order.created_at)}
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      {/* Content */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
        {/* Left: Items */}
        <section style={card}>
          <div style={cardTitle}>주문 상품</div>

          <div style={{ marginTop: 12, border: "1px solid #222", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#0f0f0f" }}>
                <tr>
                  <th style={th}>상품명</th>
                  <th style={th}>옵션</th>
                  <th style={{ ...th, textAlign: "right" }}>수량</th>
                  <th style={{ ...th, textAlign: "right" }}>단가</th>
                  <th style={{ ...th, textAlign: "right" }}>합계</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} style={{ borderTop: "1px solid #222" }}>
                    <td style={td}>{item.product_name}</td>
                    <td style={{ ...td, color: "#aaa" }}>{item.option_name ?? "-"}</td>
                    <td style={{ ...td, textAlign: "right" }}>{item.quantity}</td>
                    <td style={{ ...td, textAlign: "right" }}>{formatWon(item.unit_price)}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {formatWon(item.unit_price * item.quantity)}
                    </td>
                  </tr>
                ))}
                {order.items.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ ...td, textAlign: "center", color: "#666" }}>
                      상품 없음
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, color: "#aaa" }}>총 결제금액</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{formatWon(order.total_amount)}</div>
          </div>
        </section>

        {/* Right: Customer Info & Status Update */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section style={card}>
            <div style={cardTitle}>고객 정보</div>

            <div style={kv}>
              <div style={k}>이름</div>
              <div style={v}>{order.customer_name || "-"}</div>
            </div>
            <div style={kv}>
              <div style={k}>연락처</div>
              <div style={v}>{order.customer_phone || "-"}</div>
            </div>
            <div style={kv}>
              <div style={k}>주소</div>
              <div style={v}>{order.customer_address || "-"}</div>
            </div>
            <div style={kv}>
              <div style={k}>메모</div>
              <div style={v}>{order.customer_memo || "-"}</div>
            </div>
            {order.branch && (
              <div style={kv}>
                <div style={k}>지점</div>
                <div style={v}>{order.branch.name}</div>
              </div>
            )}
          </section>

          {canUpdateStatus && (
            <section style={card}>
              <div style={cardTitle}>상태 변경</div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 4, marginBottom: 12 }}>
                OWNER/ADMIN만 변경 가능
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusUpdate(status)}
                    disabled={statusLoading || order.status === status}
                    style={{
                      ...statusBtn,
                      background: order.status === status ? statusColor[status] + "30" : "transparent",
                      borderColor: order.status === status ? statusColor[status] : "#333",
                      color: order.status === status ? statusColor[status] : "white",
                      opacity: order.status === status ? 1 : 0.7,
                      cursor: order.status === status ? "default" : "pointer",
                    }}
                  >
                    {statusLabel[status]}
                    {order.status === status && " (현재)"}
                  </button>
                ))}
              </div>

              {statusLoading && (
                <div style={{ marginTop: 12, fontSize: 12, color: "#666", textAlign: "center" }}>
                  변경 중...
                </div>
              )}
            </section>
          )}

          {!canUpdateStatus && (
            <section style={card}>
              <div style={cardTitle}>권한 정보</div>
              <div style={{ marginTop: 12, fontSize: 13, color: "#aaa" }}>
                현재 역할: {order.myRole || "VIEWER"}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
                주문 상태를 변경하려면 OWNER 또는 ADMIN 권한이 필요합니다.
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Styles
// ============================================================

const card: React.CSSProperties = {
  border: "1px solid #222",
  borderRadius: 12,
  padding: 16,
  background: "#0b0b0b",
};

const cardTitle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 14,
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 700,
  color: "#aaa",
};

const td: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
  color: "white",
};

const kv: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "80px 1fr",
  gap: 10,
  padding: "8px 0",
};

const k: React.CSSProperties = { color: "#aaa", fontSize: 13 };
const v: React.CSSProperties = { color: "white", fontSize: 13 };

const statusBtn: React.CSSProperties = {
  height: 36,
  padding: "0 16px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "transparent",
  color: "white",
  fontWeight: 600,
  fontSize: 13,
  transition: "all 0.15s",
};

const errorBox: React.CSSProperties = {
  border: "1px solid #ff4444",
  borderRadius: 12,
  padding: 16,
  background: "#1a0000",
  color: "#ff8888",
  marginTop: 16,
  marginBottom: 16,
};
