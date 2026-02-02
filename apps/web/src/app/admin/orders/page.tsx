"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

// ============================================================
// Types
// ============================================================

type OrderStatus =
  | "CREATED"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

type Order = {
  id: string;
  orderNo?: string | null;
  orderedAt: string;
  customerName: string;
  totalAmount: number;
  status: OrderStatus;
};

// ============================================================
// Constants
// ============================================================

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const STATUS_OPTIONS: { value: OrderStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "CREATED", label: "신규" },
  { value: "CONFIRMED", label: "확인됨" },
  { value: "PREPARING", label: "준비중" },
  { value: "READY", label: "준비완료" },
  { value: "COMPLETED", label: "완료" },
  { value: "CANCELLED", label: "취소됨" },
  { value: "REFUNDED", label: "환불됨" },
];

const statusLabel: Record<OrderStatus, string> = {
  CREATED: "신규",
  CONFIRMED: "확인됨",
  PREPARING: "준비중",
  READY: "준비완료",
  COMPLETED: "완료",
  CANCELLED: "취소됨",
  REFUNDED: "환불됨",
};

const statusColor: Record<OrderStatus, string> = {
  CREATED: "#3b82f6",
  CONFIRMED: "#8b5cf6",
  PREPARING: "#f59e0b",
  READY: "#10b981",
  COMPLETED: "#6b7280",
  CANCELLED: "#ef4444",
  REFUNDED: "#ec4899",
};

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
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================
// Component
// ============================================================

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");

  // 주문 목록 조회
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        setErr(null);

        const token = await getAccessToken();

        const res = await fetch(`${API_BASE}/admin/orders`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`주문 목록 조회 실패: ${res.status} ${text}`);
        }

        const data = (await res.json()) as Order[];
        setOrders(data);
      } catch (e: unknown) {
        const error = e as Error;
        setErr(error?.message ?? "조회 실패");
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

<<<<<<< HEAD
  console.log("ORDERS_RAW", orders);
=======
  // 필터링
  useEffect(() => {
    if (statusFilter === "ALL") {
      setFilteredOrders(orders);
    } else {
      setFilteredOrders(orders.filter((o) => o.status === statusFilter));
    }
  }, [orders, statusFilter]);

  // 새로고침
  const handleRefresh = async () => {
    try {
      setLoading(true);
      setErr(null);

      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/admin/orders`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`주문 목록 조회 실패: ${res.status} ${text}`);
      }

      const data = (await res.json()) as Order[];
      setOrders(data);
    } catch (e: unknown) {
      const error = e as Error;
      setErr(error?.message ?? "조회 실패");
    } finally {
      setLoading(false);
    }
  };

>>>>>>> origin/claude_code_test
  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>주문 관리</h1>
          <p style={{ color: "#aaa", margin: "4px 0 0 0", fontSize: 13 }}>
            총 {filteredOrders.length}건
          </p>
        </div>

        <button style={btnPrimary} onClick={handleRefresh} disabled={loading}>
          {loading ? "로딩..." : "새로고침"}
        </button>
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            style={{
              ...filterBtn,
              background: statusFilter === opt.value ? "#333" : "transparent",
              borderColor: statusFilter === opt.value ? "#555" : "#333",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {err && <p style={{ color: "#ff8a8a", marginBottom: 16 }}>{err}</p>}

      {/* Table */}
      <div
        style={{
          border: "1px solid #222",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#0f0f0f" }}>
            <tr>
              <th style={th}>주문번호</th>
              <th style={th}>고객명</th>
              <th style={th}>상태</th>
              <th style={{ ...th, textAlign: "right" }}>금액</th>
              <th style={th}>주문일시</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} style={{ ...td, textAlign: "center", color: "#666" }}>
                  불러오는 중...
                </td>
              </tr>
            )}

            {!loading && filteredOrders.length === 0 && (
              <tr>
                <td colSpan={5} style={{ ...td, textAlign: "center", color: "#666" }}>
                  주문이 없습니다.
                </td>
              </tr>
            )}

            {!loading &&
              filteredOrders.map((order) => (
                <tr
                  key={order.id}
                  style={{ borderTop: "1px solid #222", cursor: "pointer" }}
                >
                  <td style={td}>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      style={{ color: "white", textDecoration: "none" }}
                    >
                      {order.orderNo ?? order.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td style={td}>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      style={{ color: "white", textDecoration: "none" }}
                    >
                      {order.customerName || "-"}
                    </Link>
                  </td>
                  <td style={td}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        height: 24,
                        padding: "0 10px",
                        borderRadius: 999,
                        background: statusColor[order.status] + "20",
                        color: statusColor[order.status],
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {statusLabel[order.status]}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      style={{ color: "white", textDecoration: "none" }}
                    >
                      {formatWon(order.totalAmount)}
                    </Link>
                  </td>
                  <td style={{ ...td, color: "#aaa" }}>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      style={{ color: "#aaa", textDecoration: "none" }}
                    >
                      {formatDateTime(order.orderedAt)}
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// Styles
// ============================================================

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  fontSize: 12,
  fontWeight: 700,
  color: "#aaa",
};

const td: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: 13,
  color: "white",
};

const btnPrimary: React.CSSProperties = {
  height: 36,
  padding: "0 16px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "white",
  color: "#000",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 13,
};

const filterBtn: React.CSSProperties = {
  height: 32,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "transparent",
  color: "white",
  fontWeight: 500,
  cursor: "pointer",
  fontSize: 12,
};
