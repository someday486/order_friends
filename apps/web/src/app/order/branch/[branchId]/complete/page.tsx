"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// ============================================================
// Types
// ============================================================

type OrderResult = {
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

const statusLabel: Record<string, string> = {
  CREATED: "주문 접수",
  CONFIRMED: "주문 확인",
  PREPARING: "준비 중",
  READY: "준비 완료",
  COMPLETED: "완료",
  CANCELLED: "취소됨",
  REFUNDED: "환불됨",
};

// ============================================================
// Component
// ============================================================

export default function CompletePage() {
  const params = useParams();
  const branchId = params?.branchId as string;

  const [order, setOrder] = useState<OrderResult | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("lastOrder");
    if (saved) {
      try {
        setOrder(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  if (!order) {
    return (
      <div style={pageContainer}>
        <div style={{ padding: 40, textAlign: "center" }}>
          <p style={{ color: "#aaa" }}>주문 정보를 찾을 수 없습니다.</p>
          <Link href={`/order/branch/${branchId}`} style={linkStyle}>
            메뉴로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={pageContainer}>
      <div style={{ padding: 24, textAlign: "center" }}>
        {/* Success Icon */}
        <div style={{ fontSize: 60, marginBottom: 16 }}>✅</div>

        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px 0" }}>
          주문이 완료되었습니다!
        </h1>
        <p style={{ color: "#aaa", margin: 0 }}>
          주문 번호를 확인해주세요.
        </p>
      </div>

      {/* Order Info */}
      <div style={orderCard}>
        <div style={infoRow}>
          <span style={{ color: "#888" }}>주문번호</span>
          <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 18 }}>
            {order.orderNo}
          </span>
        </div>

        <div style={infoRow}>
          <span style={{ color: "#888" }}>주문상태</span>
          <span style={{ color: "#10b981", fontWeight: 600 }}>
            {statusLabel[order.status] ?? order.status}
          </span>
        </div>

        <div style={infoRow}>
          <span style={{ color: "#888" }}>주문일시</span>
          <span>{formatDateTime(order.createdAt)}</span>
        </div>

        <div style={{ ...infoRow, borderTop: "1px solid #333", paddingTop: 12, marginTop: 4 }}>
          <span style={{ color: "#888" }}>결제금액</span>
          <span style={{ fontSize: 20, fontWeight: 800 }}>{formatWon(order.totalAmount)}</span>
        </div>
      </div>

      {/* Order Items */}
      <div style={{ padding: "0 16px" }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "#888", marginBottom: 8 }}>주문 내역</h3>
        {order.items.map((item, idx) => (
          <div key={idx} style={itemRow}>
            <span>{item.name} × {item.qty}</span>
            <span style={{ color: "#aaa" }}>{formatWon(item.unitPrice * item.qty)}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ padding: 16, marginTop: 24 }}>
        <Link href={`/order/track/${order.id}`} style={{ textDecoration: "none" }}>
          <button style={primaryBtn}>주문 상태 확인</button>
        </Link>

        <Link href={`/order/branch/${branchId}`} style={{ textDecoration: "none" }}>
          <button style={ghostBtn}>메뉴로 돌아가기</button>
        </Link>
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

const orderCard: React.CSSProperties = {
  margin: "0 16px 24px 16px",
  padding: 16,
  borderRadius: 14,
  border: "1px solid #222",
  background: "#0a0a0a",
};

const infoRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 0",
};

const itemRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "8px 0",
  borderBottom: "1px solid #222",
};

const primaryBtn: React.CSSProperties = {
  width: "100%",
  padding: "14px",
  borderRadius: 12,
  border: "none",
  background: "#fff",
  color: "#000",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  marginBottom: 12,
};

const ghostBtn: React.CSSProperties = {
  width: "100%",
  padding: "14px",
  borderRadius: 12,
  border: "1px solid #333",
  background: "transparent",
  color: "#fff",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};

const linkStyle: React.CSSProperties = {
  display: "inline-block",
  marginTop: 16,
  color: "#fff",
  textDecoration: "underline",
};
