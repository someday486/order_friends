"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import OrderHeader from "./OrderHeader";
import StatusActions from "./StatusActions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type OrderStatus = "NEW" | "PAID" | "PREPARING" | "SHIPPED" | "DONE" | "CANCELED";

type OrderItem = {
  id: string;
  name: string;
  option?: string;
  qty: number;
  unitPrice: number;
};

type OrderDetail = {
  id: string;
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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function formatWon(amount: number) {
  return amount.toLocaleString("ko-KR") + "원";
}

export default function OrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params?.orderId;

  if (!orderId) return <div style={{ color: "#ff8a8a" }}>주문 ID가 없습니다.</div>;


  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchOrder() {
    setLoading(true);
    setErr(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      const token = data.session?.access_token;
      if (!token) throw new Error("로그인이 필요합니다 (access_token 없음)");

      const res = await fetch(`${API_BASE}/admin/orders/${encodeURIComponent(orderId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`주문 조회 실패: ${res.status} ${text}`);
      }

      setOrder((await res.json()) as OrderDetail);
    } catch (e: any) {
      setErr(e?.message ?? "주문 조회 실패");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (loading) return <div style={{ color: "white" }}>Loading...</div>;
  if (err) return <div style={{ color: "#ff8a8a" }}>{err}</div>;
  if (!order) return <div style={{ color: "#ff8a8a" }}>주문 데이터가 없습니다.</div>;

  return (
    <div>
      <OrderHeader orderId={order.id} orderedAt={order.orderedAt} initialStatus={order.status} />

      <StatusActions
        orderId={order.id}
        initialStatus={order.status}
        onStatusChange={() => {
          // ✅ PATCH 성공 후 최신 상태를 다시 GET으로 반영
          fetchOrder();
        }}
      />

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
              <div style={v}>{order.customer.name}</div>
            </div>
            <div style={kv}>
              <div style={k}>연락처</div>
              <div style={v}>{order.customer.phone}</div>
            </div>
            <div style={kv}>
              <div style={k}>주소</div>
              <div style={v}>
                {order.customer.address1}
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
              <div style={v}>{order.payment.method}</div>
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

            <div style={{ borderTop: "1px solid #222", marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
              <div style={{ color: "#aaa" }}>총 결제금액</div>
              <div style={{ fontWeight: 800 }}>{formatWon(order.payment.total)}</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

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
