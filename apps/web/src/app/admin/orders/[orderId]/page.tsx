import OrderHeader from "./OrderHeader";


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

// ✅ 일단은 더미 데이터 (나중에 API로 교체)
function mockOrder(orderId: string): OrderDetail {
  return {
    id: orderId,
    orderedAt: "2026-01-21 10:12",
    status: "PAID",
    customer: {
      name: "김민지",
      phone: "010-1234-5678",
      address1: "서울시 강남구 테헤란로 123",
      address2: "101동 1004호",
      memo: "문 앞에 놓아주세요.",
    },
    payment: {
      method: "CARD",
      subtotal: 32000,
      shippingFee: 3000,
      discount: 0,
      total: 35000,
    },
    items: [
      { id: "I-1", name: "닭가슴살 10팩", option: "오리지널", qty: 1, unitPrice: 22000 },
      { id: "I-2", name: "프로틴바", option: "초코", qty: 2, unitPrice: 5000 },
    ],
  };
}

function formatWon(amount: number) {
  return amount.toLocaleString("ko-KR") + "원";
}

function statusLabel(status: OrderStatus) {
  const map: Record<OrderStatus, string> = {
    NEW: "신규",
    PAID: "결제완료",
    PREPARING: "준비중",
    SHIPPED: "배송중",
    DONE: "완료",
    CANCELED: "취소",
  };
  return map[status];
}

function statusTone(status: OrderStatus) {
  // 다크 테마에서 쓸 “톤”만 구분
  switch (status) {
    case "NEW":
      return { border: "#2b2b2b", bg: "#101010", text: "#ffffff" };
    case "PAID":
      return { border: "#2b2b2b", bg: "#121212", text: "#ffffff" };
    case "PREPARING":
      return { border: "#2b2b2b", bg: "#121212", text: "#ffffff" };
    case "SHIPPED":
      return { border: "#2b2b2b", bg: "#121212", text: "#ffffff" };
    case "DONE":
      return { border: "#2b2b2b", bg: "#121212", text: "#ffffff" };
    case "CANCELED":
      return { border: "#2b2b2b", bg: "#121212", text: "#ffffff" };
  }
}

const STATUS_FLOW: OrderStatus[] = ["NEW", "PAID", "PREPARING", "SHIPPED", "DONE"];

function nextStatus(current: OrderStatus): OrderStatus | null {
  const idx = STATUS_FLOW.indexOf(current);
  if (idx === -1) return null;
  return STATUS_FLOW[idx + 1] ?? null;
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = mockOrder(orderId);

  const tone = statusTone(order.status);
  const next = nextStatus(order.status);

  return (
    <div>
      <OrderHeader orderId={order.id} orderedAt={order.orderedAt} initialStatus={order.status} />

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

const btnPrimary: React.CSSProperties = {
  height: 36,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "white",
  color: "#000",
  fontWeight: 800,
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  height: 36,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "transparent",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};
