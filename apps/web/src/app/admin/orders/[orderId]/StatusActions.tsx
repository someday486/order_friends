"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabaseClient"; // ✅ 너희 파일 구조에 맞는 정답 import

type OrderStatus = "NEW" | "PAID" | "PREPARING" | "SHIPPED" | "DONE" | "CANCELED";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

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

async function getAccessToken() {
  const supabase = createClient(); // ✅ 매번 브라우저 세션 기반으로 가져옴
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) throw new Error("No access_token (로그인 필요)");
  return token;
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
      const token = await getAccessToken();

      const res = await fetch(
        `${API_BASE}/admin/orders/${encodeURIComponent(orderId)}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`, // ✅ 핵심
          },
          body: JSON.stringify({ status: next }),
        }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${text}`);
      }

      const data = (await res.json()) as { id: string; status: OrderStatus };

      setStatus(data.status);
      onStatusChange(data.status);
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
