"use client";

import { useState } from "react";

type OrderStatus = "NEW" | "PAID" | "PREPARING" | "SHIPPED" | "DONE" | "CANCELED";

const FLOW: OrderStatus[] = ["NEW", "PAID", "PREPARING", "SHIPPED", "DONE"];
export const statusLabel: Record<OrderStatus, string> = {
  NEW: "신규",
  PAID: "결제완료",
  PREPARING: "준비중",
  SHIPPED: "배송중",
  DONE: "완료",
  CANCELED: "취소",
};

function nextStatus(s: OrderStatus) {
  const i = FLOW.indexOf(s);
  return i >= 0 ? (FLOW[i + 1] ?? null) : null;
}

export default function StatusActions({
  orderId,
  initialStatus,
  onStatusChange,
}: {
  orderId: string;
  initialStatus: OrderStatus;
  onStatusChange: (status: OrderStatus) => void;
}) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const next = nextStatus(status);

  async function onAdvance() {
    if (!next) return;
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(
        `http://localhost:4000/admin/orders/${encodeURIComponent(orderId)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${text}`);
      }

      const data = (await res.json()) as { id: string; status: OrderStatus };

      setStatus(data.status);
      onStatusChange(data.status); // ✅ 부모(헤더 뱃지)도 갱신
    } catch (e: any) {
      setErr(e?.message ?? "요청 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button style={btnGhost} disabled={loading}>
        취소
      </button>

      <button style={btnPrimary} onClick={onAdvance} disabled={!next || loading}>
        {loading ? "변경 중..." : next ? `${statusLabel[next]}로 변경` : "상태 변경 완료"}
      </button>

      <div style={{ color: "#aaa", fontSize: 12 }}>
        현재: <b style={{ color: "white" }}>{statusLabel[status]}</b>
        {err ? <span style={{ marginLeft: 8, color: "#ff8a8a" }}>({err})</span> : null}
      </div>
    </div>
  );
}

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
