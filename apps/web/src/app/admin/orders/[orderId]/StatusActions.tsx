"use client";

import { Suspense, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";

// Types

type OrderStatus =
  | "CREATED"
  | "NEW"
  | "PAID"
  | "PREPARING"
  | "SHIPPED"
  | "DONE"
  | "CANCELED";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

// CREATED를 시작 상태로 포함
const FLOW: OrderStatus[] = ["CREATED", "PAID", "PREPARING", "SHIPPED", "DONE"];

export const statusLabel: Record<OrderStatus, string> = {
  CREATED: "접수",
  NEW: "접수",
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
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) throw new Error("No access_token (로그인 필요)");
  return token;
}

function StatusActionsContent({
  orderId,
  initialStatus,
  onStatusChange,
  branchId,
}: {
  orderId: string;
  initialStatus: OrderStatus;
  onStatusChange: (status: OrderStatus) => void;
  branchId?: string | null;
}) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const resolvedBranchId = branchId ?? searchParams?.get("branchId") ?? "";

  // 부모에서 내려오는 initialStatus가 바뀌면 상태 업데이트
  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  const next = nextStatus(status);

  async function onAdvance() {
    if (!next) return;

    setLoading(true);
    setErr(null);

    try {
      const token = await getAccessToken();
      const query = resolvedBranchId ? `?branchId=${encodeURIComponent(resolvedBranchId)}` : "";

      const res = await fetch(`${API_BASE}/admin/orders/${encodeURIComponent(orderId)}/status${query}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: next }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${text}`);
      }

      const data = (await res.json()) as { id: string; status: OrderStatus };

      setStatus(data.status);
      onStatusChange(data.status);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "요청 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2 items-center">
      <button
        className="h-9 px-3 rounded-lg border border-border bg-transparent text-foreground font-bold cursor-pointer hover:bg-bg-tertiary transition-colors"
        disabled={loading}
      >
        취소
      </button>

      <button
        className="btn-primary h-9 px-3"
        onClick={onAdvance}
        disabled={!next || loading}
      >
        {loading ? "변경 중..." : next ? `${statusLabel[next]}로 변경` : "상태 변경 완료"}
      </button>

      <div className="text-text-secondary text-xs">
        현재: <b className="text-foreground">{statusLabel[status]}</b>
        {err ? <span className="ml-2 text-danger-500">({err})</span> : null}
      </div>
    </div>
  );
}

export default function StatusActions({
  orderId,
  initialStatus,
  onStatusChange,
  branchId,
}: {
  orderId: string;
  initialStatus: OrderStatus;
  onStatusChange: (status: OrderStatus) => void;
  branchId?: string | null;
}) {
  return (
    <Suspense fallback={<div className="text-muted">로딩 중...</div>}>
      <StatusActionsContent
        orderId={orderId}
        initialStatus={initialStatus}
        onStatusChange={onStatusChange}
        branchId={branchId}
      />
    </Suspense>
  );
}
