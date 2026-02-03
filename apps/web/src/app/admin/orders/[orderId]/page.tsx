"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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

type OrderItem = {
  id: string;
  name: string;
  option?: string;
  qty: number;
  unitPrice: number;
};

type OrderDetail = {
  id: string;
  orderNo?: string | null;
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
    method: "CARD" | "TRANSFER" | "CASH";
    subtotal: number;
    shippingFee: number;
    discount: number;
    total: number;
  };
  items: OrderItem[];
};

// ============================================================
// Constants
// ============================================================

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const STATUS_FLOW: OrderStatus[] = ["CREATED", "CONFIRMED", "PREPARING", "READY", "COMPLETED"];

const statusLabel: Record<OrderStatus, string> = {
  CREATED: "신규",
  CONFIRMED: "확인됨",
  PREPARING: "준비중",
  READY: "준비완료",
  COMPLETED: "완료",
  CANCELLED: "취소됨",
  REFUNDED: "환불됨",
};

const paymentMethodLabel: Record<string, string> = {
  CARD: "카드",
  TRANSFER: "계좌이체",
  CASH: "현금",
};

// ============================================================
// Helpers
// ============================================================

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

function nextStatus(current: OrderStatus): OrderStatus | null {
  const idx = STATUS_FLOW.indexOf(current);
  if (idx === -1) return null;
  return STATUS_FLOW[idx + 1] ?? null;
}

async function getAccessToken() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) throw new Error("No access_token (로그인 필요)");
  return token;
}

async function readErrorText(res: Response) {
  // JSON으로 떨어질 수도, 텍스트로 떨어질 수도 있어서 둘 다 처리
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const j = await res.json().catch(() => null);
    return j ? JSON.stringify(j) : "";
  }
  return await res.text().catch(() => "");
}

// ============================================================
// Component
// ============================================================

export default function OrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params?.orderId;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const isCancellable = useMemo(() => {
    if (!order) return false;
    return order.status !== "COMPLETED" && order.status !== "CANCELLED" && order.status !== "REFUNDED";
  }, [order]);

  // 주문 상세 조회
  useEffect(() => {
    if (!orderId) return;

    const fetchOrder = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = await getAccessToken();

        const res = await fetch(`${API_BASE}/admin/orders/${encodeURIComponent(orderId)}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const text = await readErrorText(res);
          throw new Error(`주문 조회 실패: ${res.status} ${text}`);
        }

        const data = (await res.json()) as OrderDetail;
        setOrder(data);
      } catch (e: unknown) {
        const err = e as Error;
        setError(err?.message ?? "조회 실패");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  // 상태 변경
  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!order) return;

    try {
      setStatusLoading(true);
      setError(null);

      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/admin/orders/${encodeURIComponent(order.id)}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const text = await readErrorText(res);
        throw new Error(`상태 변경 실패: ${res.status} ${text}`);
      }

      const data = (await res.json()) as { id: string; status: OrderStatus };
      setOrder((prev) => (prev ? { ...prev, status: data.status } : null));
    } catch (e: unknown) {
      const err = e as Error;
      setError(err?.message ?? "상태 변경 실패");
    } finally {
      setStatusLoading(false);
    }
  };

  // 취소 처리
  const handleCancel = async () => {
    if (!order) return;
    if (!confirm("정말 이 주문을 취소하시겠습니까?")) return;
    await handleStatusChange("CANCELLED");
  };

  // ============================================================
  // Render
  // ============================================================

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "#aaa" }}>불러오는 중...</p>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div style={{ padding: 24 }}>
        <Link href="/admin/orders" style={{ color: "white", textDecoration: "none" }}>
          ← 주문 목록
        </Link>
        <p style={{ color: "#ff8a8a", marginTop: 16 }}>{error}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ padding: 24 }}>
        <Link href="/admin/orders" style={{ color: "white", textDecoration: "none" }}>
          ← 주문 목록
        </Link>
        <p style={{ color: "#aaa", marginTop: 16 }}>주문을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const next = nextStatus(order.status);

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <Link href="/admin/orders" style={{ color: "white", textDecoration: "none" }}>
            ← 주문 목록
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>주문 상세</h1>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 26,
                padding: "0 10px",
                borderRadius: 999,
                border: "1px solid #333",
                background: "#121212",
                color: "#fff",
                fontSize: 12,
              }}
            >
              {statusLabel[order.status]}
            </span>
          </div>

          <div style={{ marginTop: 6, color: "#aaa", fontSize: 13 }}>
            주문번호{" "}
            <span style={{ fontFamily: "monospace", color: "#fff" }}>{order.orderNo ?? order.id}</span>{" "}
            · {formatDateTime(order.orderedAt)}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isCancellable && (
            <button style={btnGhost} onClick={handleCancel} disabled={statusLoading}>
              취소
            </button>
          )}

          {next && (
            <button style={btnPrimary} onClick={() => handleStatusChange(next)} disabled={statusLoading}>
              {statusLoading ? "변경 중..." : `${statusLabel[next]}로 변경`}
            </button>
          )}

          {error && <span style={{ color: "#ff8a8a", fontSize: 12 }}>{error}</span>}
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 14 }}>
        {/* 왼쪽: 상품/요약 */}
        <section style={card}>
          <div style={cardTitle}>주문 상품</div>

          <div style={{ marginTop: 10, border: "1px solid #222", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#0f0f0f" }}>
                <tr>
                  <th style={th}>상품</th>
                  <th style={th}>옵션</th>
                  <th style={{ ...th, textAlign: "right" }}>수량</th>
                  <th style={{ ...th, textAlign: "right" }}>단가</th>
                  <th style={{ ...th, textAlign: "right" }}>합계</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it) => (
                  <tr key={it.id} style={{ borderTop: "1px solid #222" }}>
                    <td style={td}>{it.name}</td>
                    <td style={{ ...td, color: "#aaa" }}>{it.option ?? "-"}</td>
                    <td style={{ ...td, textAlign: "right" }}>{it.qty}</td>
                    <td style={{ ...td, textAlign: "right" }}>{formatWon(it.unitPrice)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{formatWon(it.unitPrice * it.qty)}</td>
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

          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={miniCard}>
              <div style={miniLabel}>상품 소계</div>
              <div style={miniValue}>{formatWon(order.payment.subtotal)}</div>
            </div>
            <div style={miniCard}>
              <div style={miniLabel}>총 결제금액</div>
              <div style={miniValue}>{formatWon(order.payment.total)}</div>
            </div>
          </div>
        </section>

        {/* 오른쪽: 고객/결제 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <section style={card}>
            <div style={cardTitle}>고객 정보</div>

            <div style={kv}>
              <div style={k}>이름</div>
              <div style={v}>{order.customer.name || "-"}</div>
            </div>
            <div style={kv}>
              <div style={k}>연락처</div>
              <div style={v}>{order.customer.phone || "-"}</div>
            </div>
            <div style={kv}>
              <div style={k}>주소</div>
              <div style={v}>
                {order.customer.address1 || "-"}
                {order.customer.address2 ? `, ${order.customer.address2}` : ""}
              </div>
            </div>
            <div style={kv}>
              <div style={k}>메모</div>
              <div style={v}>{order.customer.memo ?? "-"}</div>
            </div>
          </section>

          <section style={card}>
            <div style={cardTitle}>결제 정보</div>

            <div style={kv}>
              <div style={k}>결제수단</div>
              <div style={v}>{paymentMethodLabel[order.payment.method] ?? order.payment.method}</div>
            </div>
            <div style={kv}>
              <div style={k}>상품금액</div>
              <div style={v}>{formatWon(order.payment.subtotal)}</div>
            </div>
            <div style={kv}>
              <div style={k}>배송비</div>
              <div style={v}>{formatWon(order.payment.shippingFee)}</div>
            </div>
            <div style={kv}>
              <div style={k}>할인</div>
              <div style={v}>{formatWon(order.payment.discount)}</div>
            </div>

            <div
              style={{
                borderTop: "1px solid #222",
                marginTop: 10,
                paddingTop: 10,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <div style={{ color: "#aaa" }}>총 결제금액</div>
              <div style={{ fontWeight: 800 }}>{formatWon(order.payment.total)}</div>
            </div>
          </section>
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
  borderRadius: 14,
  padding: 14,
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
  gridTemplateColumns: "90px 1fr",
  gap: 10,
  padding: "8px 0",
};

const k: React.CSSProperties = { color: "#aaa", fontSize: 13 };
const v: React.CSSProperties = { color: "white", fontSize: 13 };

const miniCard: React.CSSProperties = {
  border: "1px solid #222",
  borderRadius: 12,
  padding: 12,
  background: "#090909",
};

const miniLabel: React.CSSProperties = { color: "#aaa", fontSize: 12 };
const miniValue: React.CSSProperties = { marginTop: 6, fontWeight: 800 };

const btnPrimary: React.CSSProperties = {
  height: 36,
  padding: "0 16px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "white",
  color: "#000",
  fontWeight: 800,
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  height: 36,
  padding: "0 16px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "transparent",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};
