"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
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

type OrderItem = {
  id: string;
  name: string;
  option?: string;
  qty: number;
  unitPrice: number;
};

type OrderDetail = {
  id: string;
  orderNo: string | null;
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
    method: string;
    subtotal: number;
    shippingFee: number;
    discount: number;
    total: number;
  };
  items: OrderItem[];
  myRole?: string;
};

// ============================================================
// Constants
// ============================================================

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const statusLabel: Record<OrderStatus, string> = {
  CREATED: "주문접수",
  CONFIRMED: "확인",
  PREPARING: "준비중",
  READY: "준비완료",
  COMPLETED: "완료",
  CANCELLED: "취소",
  REFUNDED: "환불",
};

const statusBadgeClasses: Record<OrderStatus, string> = {
  CREATED: "bg-warning-500/20 text-warning-500",
  CONFIRMED: "bg-primary-500/20 text-primary-500",
  PREPARING: "bg-primary-500/20 text-primary-500",
  READY: "bg-success/20 text-success",
  COMPLETED: "bg-neutral-500/20 text-neutral-500",
  CANCELLED: "bg-danger-500/20 text-danger-500",
  REFUNDED: "bg-pink-500/20 text-pink-400",
};

const statusBtnActiveClasses: Record<OrderStatus, string> = {
  CREATED: "bg-warning-500/30 border-warning-500 text-warning-500",
  CONFIRMED: "bg-primary-500/30 border-primary-500 text-primary-500",
  PREPARING: "bg-primary-500/30 border-primary-500 text-primary-500",
  READY: "bg-success/30 border-success text-success",
  COMPLETED: "bg-neutral-500/30 border-neutral-500 text-neutral-500",
  CANCELLED: "bg-danger-500/30 border-danger-500 text-danger-500",
  REFUNDED: "bg-pink-500/30 border-pink-400 text-pink-400",
};

const STATUS_OPTIONS: OrderStatus[] = [
  "CREATED",
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
        <Link href="/customer/orders" className="text-foreground no-underline hover:text-primary-500 transition-colors">
          ← 주문 목록
        </Link>
        <div className="mt-6 text-text-secondary">로딩 중...</div>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div>
        <Link href="/customer/orders" className="text-foreground no-underline hover:text-primary-500 transition-colors">
          ← 주문 목록
        </Link>
        <div className="border border-danger-500 rounded-xl p-4 bg-danger-500/10 text-danger-500 mt-4 mb-4">
          {error}
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div>
        <Link href="/customer/orders" className="text-foreground no-underline hover:text-primary-500 transition-colors">
          ← 주문 목록
        </Link>
        <div className="mt-6 text-text-tertiary">주문을 찾을 수 없습니다.</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href="/customer/orders" className="text-foreground no-underline hover:text-primary-500 transition-colors">
          ← 주문 목록
        </Link>

        <div className="flex items-center gap-2.5 mt-4">
          <h1 className="m-0 text-2xl font-extrabold text-foreground">주문 상세</h1>
          <span className={`inline-flex items-center h-7 px-3 rounded-full text-[13px] font-semibold ${statusBadgeClasses[order.status]}`}>
            {statusLabel[order.status]}
          </span>
        </div>

        <div className="mt-2 text-text-secondary text-[13px]">
          주문번호{" "}
          <span className="font-mono text-foreground">
            {order.orderNo ?? order.id}
          </span>{" "}
          · {formatDateTime(order.orderedAt)}
        </div>
      </div>

      {error && (
        <div className="border border-danger-500 rounded-xl p-4 bg-danger-500/10 text-danger-500 mb-4">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="grid grid-cols-[1.5fr_1fr] gap-4">
        {/* Left: Items */}
        <section className="card p-4">
          <div className="font-extrabold text-sm text-foreground">주문 상품</div>

          <div className="mt-3 border border-border rounded-xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead className="bg-bg-tertiary">
                <tr>
                  <th className="text-left py-2.5 px-3 text-xs font-bold text-text-secondary">상품명</th>
                  <th className="text-left py-2.5 px-3 text-xs font-bold text-text-secondary">옵션</th>
                  <th className="text-right py-2.5 px-3 text-xs font-bold text-text-secondary">수량</th>
                  <th className="text-right py-2.5 px-3 text-xs font-bold text-text-secondary">단가</th>
                  <th className="text-right py-2.5 px-3 text-xs font-bold text-text-secondary">합계</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="py-2.5 px-3 text-[13px] text-foreground">{item.name}</td>
                    <td className="py-2.5 px-3 text-[13px] text-text-secondary">{item.option ?? "-"}</td>
                    <td className="py-2.5 px-3 text-[13px] text-foreground text-right">{item.qty}</td>
                    <td className="py-2.5 px-3 text-[13px] text-foreground text-right">{formatWon(item.unitPrice)}</td>
                    <td className="py-2.5 px-3 text-[13px] text-foreground text-right">
                      {formatWon(item.unitPrice * item.qty)}
                    </td>
                  </tr>
                ))}
                {order.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-2.5 px-3 text-[13px] text-text-tertiary text-center">
                      상품 없음
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-between items-center">
            <div className="text-sm text-text-secondary">총 결제금액</div>
            <div className="text-xl font-extrabold text-foreground">{formatWon(order.payment.total)}</div>
          </div>
        </section>

        {/* Right: Customer Info & Status Update */}
        <div className="flex flex-col gap-4">
          <section className="card p-4">
            <div className="font-extrabold text-sm text-foreground">고객 정보</div>

            <div className="grid grid-cols-[80px_1fr] gap-2.5 py-2">
              <div className="text-text-secondary text-[13px]">이름</div>
              <div className="text-foreground text-[13px]">{order.customer.name || "-"}</div>
            </div>
            <div className="grid grid-cols-[80px_1fr] gap-2.5 py-2">
              <div className="text-text-secondary text-[13px]">연락처</div>
              <div className="text-foreground text-[13px]">{order.customer.phone || "-"}</div>
            </div>
            <div className="grid grid-cols-[80px_1fr] gap-2.5 py-2">
              <div className="text-text-secondary text-[13px]">주소</div>
              <div className="text-foreground text-[13px]">{order.customer.address1 || "-"}</div>
            </div>
            <div className="grid grid-cols-[80px_1fr] gap-2.5 py-2">
              <div className="text-text-secondary text-[13px]">메모</div>
              <div className="text-foreground text-[13px]">{order.customer.memo || "-"}</div>
            </div>
          </section>

          {canUpdateStatus && (
            <section className="card p-4">
              <div className="font-extrabold text-sm text-foreground">상태 변경</div>
              <div className="text-xs text-text-tertiary mt-1 mb-3">
                OWNER/ADMIN만 변경 가능
              </div>

              <div className="flex flex-col gap-2">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusUpdate(status)}
                    disabled={statusLoading || order.status === status}
                    className={`h-9 px-4 rounded-[10px] border text-[13px] font-semibold transition-all ${
                      order.status === status
                        ? `${statusBtnActiveClasses[status]} cursor-default`
                        : "border-border bg-transparent text-foreground opacity-70 cursor-pointer hover:bg-bg-tertiary"
                    }`}
                  >
                    {statusLabel[status]}
                    {order.status === status && " (현재)"}
                  </button>
                ))}
              </div>

              {statusLoading && (
                <div className="mt-3 text-xs text-text-tertiary text-center">
                  변경 중...
                </div>
              )}
            </section>
          )}

          {!canUpdateStatus && (
            <section className="card p-4">
              <div className="font-extrabold text-sm text-foreground">권한 정보</div>
              <div className="mt-3 text-[13px] text-text-secondary">
                현재 역할: {order.myRole || "VIEWER"}
              </div>
              <div className="mt-2 text-xs text-text-tertiary">
                주문 상태를 변경하려면 OWNER 또는 ADMIN 권한이 필요합니다.
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
