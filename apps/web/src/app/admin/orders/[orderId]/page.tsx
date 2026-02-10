"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { useSelectedBranch } from "@/hooks/useSelectedBranch";
import BranchSelector from "@/components/admin/BranchSelector";

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

const STATUS_FLOW: OrderStatus[] = ["CREATED", "CONFIRMED", "PREPARING", "READY", "COMPLETED"];

const statusLabel: Record<OrderStatus, string> = {
  CREATED: "접수",
  CONFIRMED: "확인",
  PREPARING: "준비중",
  READY: "준비완료",
  COMPLETED: "완료",
  CANCELLED: "취소",
  REFUNDED: "환불",
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

// ============================================================
// Component
// ============================================================

function OrderDetailPageContent() {
  const params = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const orderId = params?.orderId;

  const initialBranchId = useMemo(() => searchParams?.get("branchId") ?? "", [searchParams]);
  const { branchId, selectBranch } = useSelectedBranch();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  useEffect(() => {
    if (initialBranchId) selectBranch(initialBranchId);
  }, [initialBranchId, selectBranch]);

  const isCancellable = useMemo(() => {
    if (!order) return false;
    return order.status !== "COMPLETED" && order.status !== "CANCELLED" && order.status !== "REFUNDED";
  }, [order]);

  // 주문 상세 조회
  useEffect(() => {
    if (!orderId) return;
    if (!branchId) return;

    const fetchOrder = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await apiClient.get<OrderDetail>(`/admin/orders/${encodeURIComponent(orderId)}?branchId=${encodeURIComponent(branchId)}`);
        setOrder(data);
      } catch (e: unknown) {
        const err = e as Error;
        setError(err?.message ?? "조회 실패");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, branchId]);

  // 상태 변경
  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!order) return;
    if (!branchId) return;

    try {
      setStatusLoading(true);
      setError(null);

      const data = await apiClient.patch<{ id: string; status: OrderStatus }>(`/admin/orders/${encodeURIComponent(order.id)}/status?branchId=${encodeURIComponent(branchId)}`, { status: newStatus });
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
    if (!confirm("정말 주문을 취소하시겠습니까?")) return;
    await handleStatusChange("CANCELLED");
  };

  // ============================================================
  // Render
  // ============================================================

  if (!branchId) {
    return (
      <div>
        <Link href="/admin/orders" className="text-foreground no-underline hover:text-primary-500 transition-colors">
          ← 주문 목록
        </Link>
        <div className="mt-3">
          <BranchSelector />
        </div>
        <p className="text-text-secondary mt-3">가게를 선택해주세요.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <p className="text-text-secondary">불러오는 중...</p>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div>
        <Link href="/admin/orders" className="text-foreground no-underline hover:text-primary-500 transition-colors">
          ← 주문 목록
        </Link>
        <p className="text-danger-500 mt-4">{error}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div>
        <Link href="/admin/orders" className="text-foreground no-underline hover:text-primary-500 transition-colors">
          ← 주문 목록
        </Link>
        <p className="text-text-secondary mt-4">주문을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const next = nextStatus(order.status);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Link href="/admin/orders" className="text-foreground no-underline hover:text-primary-500 transition-colors">
            ← 주문 목록
          </Link>

          <div className="flex items-center gap-2.5 mt-2.5">
            <h1 className="m-0 text-[22px] font-extrabold text-foreground">주문 상세</h1>
            <span className="inline-flex items-center h-[26px] px-2.5 rounded-full border border-border bg-bg-tertiary text-foreground text-xs">
              {statusLabel[order.status]}
            </span>
          </div>

          <div className="mt-1.5 text-text-secondary text-[13px]">
            주문번호{" "}
            <span className="font-mono text-foreground">{order.orderNo ?? order.id}</span>{" "}
            · {formatDateTime(order.orderedAt)}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 items-center">
          {isCancellable && (
            <button
              className="h-9 px-4 rounded-lg border border-border bg-transparent text-foreground font-bold cursor-pointer hover:bg-bg-tertiary transition-colors"
              onClick={handleCancel}
              disabled={statusLoading}
            >
              취소
            </button>
          )}

          {next && (
            <button
              className="btn-primary h-9 px-4"
              onClick={() => handleStatusChange(next)}
              disabled={statusLoading}
            >
              {statusLoading ? "변경 중..." : `${statusLabel[next]}로 변경`}
            </button>
          )}

          {error && <span className="text-danger-500 text-xs">{error}</span>}
        </div>
      </div>

      {/* Content */}
      <div className="mt-[18px] grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] gap-3.5">
        {/* Left: Items */}
        <section className="card p-3.5">
          <div className="font-extrabold text-sm text-foreground">주문 상품</div>

          <div className="mt-2.5 border border-border rounded-xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead className="bg-bg-tertiary">
                <tr>
                  <th className="text-left py-2.5 px-3 text-xs font-bold text-text-secondary">상품</th>
                  <th className="text-left py-2.5 px-3 text-xs font-bold text-text-secondary">옵션</th>
                  <th className="text-right py-2.5 px-3 text-xs font-bold text-text-secondary">수량</th>
                  <th className="text-right py-2.5 px-3 text-xs font-bold text-text-secondary">단가</th>
                  <th className="text-right py-2.5 px-3 text-xs font-bold text-text-secondary">합계</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it) => (
                  <tr key={it.id} className="border-t border-border">
                    <td className="py-2.5 px-3 text-[13px] text-foreground">{it.name}</td>
                    <td className="py-2.5 px-3 text-[13px] text-text-secondary">{it.option ?? "-"}</td>
                    <td className="py-2.5 px-3 text-[13px] text-foreground text-right">{it.qty}</td>
                    <td className="py-2.5 px-3 text-[13px] text-foreground text-right">{formatWon(it.unitPrice)}</td>
                    <td className="py-2.5 px-3 text-[13px] text-foreground text-right">{formatWon(it.unitPrice * it.qty)}</td>
                  </tr>
                ))}
                {order.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-2.5 px-3 text-[13px] text-center text-text-tertiary">
                      상품 없음
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-2.5">
            <div className="border border-border rounded-xl p-3 bg-bg-secondary">
              <div className="text-text-secondary text-xs">상품 합계</div>
              <div className="mt-1.5 font-extrabold text-foreground">{formatWon(order.payment.subtotal)}</div>
            </div>
            <div className="border border-border rounded-xl p-3 bg-bg-secondary">
              <div className="text-text-secondary text-xs">총 결제금액</div>
              <div className="mt-1.5 font-extrabold text-foreground">{formatWon(order.payment.total)}</div>
            </div>
          </div>
        </section>

        {/* Right: Customer & Payment */}
        <div className="flex flex-col gap-3.5">
          <section className="card p-3.5">
            <div className="font-extrabold text-sm text-foreground">고객 정보</div>

            <div className="grid grid-cols-[90px_1fr] gap-2.5 py-2">
              <div className="text-text-secondary text-[13px]">이름</div>
              <div className="text-foreground text-[13px]">{order.customer.name || "-"}</div>
            </div>
            <div className="grid grid-cols-[90px_1fr] gap-2.5 py-2">
              <div className="text-text-secondary text-[13px]">연락처</div>
              <div className="text-foreground text-[13px]">{order.customer.phone || "-"}</div>
            </div>
            <div className="grid grid-cols-[90px_1fr] gap-2.5 py-2">
              <div className="text-text-secondary text-[13px]">주소</div>
              <div className="text-foreground text-[13px]">
                {order.customer.address1 || "-"}
                {order.customer.address2 ? `, ${order.customer.address2}` : ""}
              </div>
            </div>
            <div className="grid grid-cols-[90px_1fr] gap-2.5 py-2">
              <div className="text-text-secondary text-[13px]">메모</div>
              <div className="text-foreground text-[13px]">{order.customer.memo ?? "-"}</div>
            </div>
          </section>

          <section className="card p-3.5">
            <div className="font-extrabold text-sm text-foreground">결제 정보</div>

            <div className="grid grid-cols-[90px_1fr] gap-2.5 py-2">
              <div className="text-text-secondary text-[13px]">결제수단</div>
              <div className="text-foreground text-[13px]">{paymentMethodLabel[order.payment.method] ?? order.payment.method}</div>
            </div>
            <div className="grid grid-cols-[90px_1fr] gap-2.5 py-2">
              <div className="text-text-secondary text-[13px]">상품금액</div>
              <div className="text-foreground text-[13px]">{formatWon(order.payment.subtotal)}</div>
            </div>
            <div className="grid grid-cols-[90px_1fr] gap-2.5 py-2">
              <div className="text-text-secondary text-[13px]">배송비</div>
              <div className="text-foreground text-[13px]">{formatWon(order.payment.shippingFee)}</div>
            </div>
            <div className="grid grid-cols-[90px_1fr] gap-2.5 py-2">
              <div className="text-text-secondary text-[13px]">할인</div>
              <div className="text-foreground text-[13px]">{formatWon(order.payment.discount)}</div>
            </div>

            <div className="border-t border-border mt-2.5 pt-2.5 flex justify-between">
              <div className="text-text-secondary">총 결제금액</div>
              <div className="font-extrabold text-foreground">{formatWon(order.payment.total)}</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense fallback={<div className="text-muted">로딩 중...</div>}>
      <OrderDetailPageContent />
    </Suspense>
  );
}
