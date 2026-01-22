"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import StatusActions, { statusLabel } from "./StatusActions";

type OrderStatus = "NEW" | "PAID" | "PREPARING" | "SHIPPED" | "DONE" | "CANCELED";

function statusTone(status: OrderStatus) {
  return { border: "#2b2b2b", bg: "#121212", text: "#ffffff" };
}

export default function OrderHeader({
  orderId,
  orderedAt,
  initialStatus,
}: {
  orderId: string;
  orderedAt: string;
  initialStatus: OrderStatus;
}) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const tone = useMemo(() => statusTone(status), [status]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div>
        <Link href="/admin/orders" style={{ color: "white", textDecoration: "none" }}>
          {"← 주문 목록"}
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
              border: `1px solid ${tone.border}`,
              background: tone.bg,
              color: tone.text,
              fontSize: 12,
            }}
          >
            {statusLabel[status]}
          </span>
        </div>

        <div style={{ marginTop: 6, color: "#aaa", fontSize: 13 }}>
          주문번호 <span style={{ fontFamily: "monospace", color: "#fff" }}>{orderId}</span> · {orderedAt}
        </div>
      </div>

      <StatusActions
        orderId={orderId}
        initialStatus={status}
        onStatusChange={(s) => setStatus(s)} // ✅ 헤더 뱃지 동기화
      />
    </div>
  );
}
