"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { formatDateTimeFull, formatWon } from "@/lib/format";
import { ORDER_STATUS_LABEL_LONG, type OrderStatus } from "@/types/common";
import { apiClient } from "@/lib/api-client";
import { loadLastOrderRecord } from "@/lib/order-session";

type OrderResult = {
  id: string;
  orderNo: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  paymentMethod?: string | null;
  transferAccount?: {
    bankName?: string | null;
    accountNumber?: string | null;
    accountHolder?: string | null;
  } | null;
  items: Array<{
    name: string;
    qty: number;
    unitPrice: number;
  }>;
};

function normalizeOrder(raw: unknown): OrderResult | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  if (typeof source.id !== "string") return null;

  const orderNo = source.orderNo ?? source.order_no ?? source.id;
  const status = source.status;
  const totalAmount = source.totalAmount ?? source.total_amount;
  const createdAt = source.createdAt ?? source.created_at;
  const items = Array.isArray(source.items) ? source.items : [];

  if (typeof orderNo !== "string") return null;
  if (typeof status !== "string") return null;
  if (typeof totalAmount !== "number") return null;
  if (typeof createdAt !== "string") return null;

  const transferAccountRaw =
    source.transferAccount && typeof source.transferAccount === "object"
      ? (source.transferAccount as Record<string, unknown>)
      : null;

  return {
    id: source.id,
    orderNo,
    status: status as OrderStatus,
    totalAmount,
    createdAt,
    paymentMethod: typeof source.paymentMethod === "string" ? source.paymentMethod : null,
    transferAccount: transferAccountRaw
      ? {
          bankName: typeof transferAccountRaw.bankName === "string" ? transferAccountRaw.bankName : null,
          accountNumber: typeof transferAccountRaw.accountNumber === "string" ? transferAccountRaw.accountNumber : null,
          accountHolder: typeof transferAccountRaw.accountHolder === "string" ? transferAccountRaw.accountHolder : null,
        }
      : null,
    items: items.map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      const name =
        typeof row.name === "string"
          ? row.name
          : typeof row.productName === "string"
            ? row.productName
            : typeof row.product_name_snapshot === "string"
              ? row.product_name_snapshot
              : "-";
      const qty = typeof row.qty === "number" ? row.qty : 0;
      const unitPrice =
        typeof row.unitPrice === "number"
          ? row.unitPrice
          : typeof row.unit_price === "number"
            ? row.unit_price
            : 0;

      return { name, qty, unitPrice };
    }),
  };
}

// ── 체크마크 SVG 애니메이션 ──
function AnimatedCheckmark() {
  return (
    <div className="relative flex items-center justify-center">
      {/* 배경 원 */}
      <div className="w-24 h-24 rounded-full bg-success-500/15 flex items-center justify-center animate-scale-in">
        <div className="w-16 h-16 rounded-full bg-success-500/25 flex items-center justify-center">
          <svg
            width="40"
            height="40"
            viewBox="0 0 60 60"
            fill="none"
            className="drop-shadow-sm"
          >
            <circle cx="30" cy="30" r="28" fill="#34C759" />
            <path
              d="M16 30 L26 40 L44 20"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="60"
              strokeDashoffset="60"
              style={{
                animation: "checkDraw 0.5s ease-out 0.2s forwards",
              }}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ── 컨페티 파티클 ──
function Confetti() {
  const particles = [
    { color: "#FF3B30", x: 10, y: -20, r: -30, delay: 0 },
    { color: "#34C759", x: 80, y: -35, r: 45, delay: 0.05 },
    { color: "#FF9500", x: 50, y: -50, r: -15, delay: 0.1 },
    { color: "#3742FA", x: 20, y: -30, r: 60, delay: 0.07 },
    { color: "#FF3B30", x: 70, y: -15, r: -45, delay: 0.12 },
    { color: "#34C759", x: 35, y: -55, r: 30, delay: 0.03 },
    { color: "#FF9500", x: 90, y: -40, r: -60, delay: 0.08 },
    { color: "#3742FA", x: 5, y: -25, r: 20, delay: 0.15 },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-sm opacity-0"
          style={{
            left: `${p.x}%`,
            top: "40%",
            backgroundColor: p.color,
            animation: `confettiFall 1.2s ease-out ${p.delay}s forwards`,
            transform: `rotate(${p.r}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export default function CompletePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const branchId = params?.branchId as string;
  const orderId = searchParams.get("orderId");

  const [order, setOrder] = useState<OrderResult | null>(() =>
    normalizeOrder(loadLastOrderRecord({ branchId })),
  );
  const [loading, setLoading] = useState<boolean>(!order && Boolean(orderId));
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (order || !orderId) return;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiClient.get(`/public/orders/${orderId}`, { auth: false });
        const normalized = normalizeOrder(data);
        if (!normalized) {
          setError("주문 정보를 확인할 수 없습니다.");
          return;
        }
        setOrder(normalized);
      } catch (e: unknown) {
        setError((e as Error)?.message ?? "주문 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [order, orderId]);

  // 주문 완료 시 confetti 실행
  useEffect(() => {
    if (order) {
      const timer = setTimeout(() => setShowConfetti(true), 300);
      return () => clearTimeout(timer);
    }
  }, [order]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin w-8 h-8 text-primary-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-text-secondary text-sm">주문 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="p-10 text-center">
          <div className="text-4xl mb-4">😕</div>
          <p className="text-text-secondary mb-4">{error ?? "주문 정보를 찾을 수 없습니다."}</p>
          <Link href={`/order/branch/${branchId}`} className="inline-block mt-2 text-primary-500 text-sm underline">
            메뉴로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* confetti 애니메이션 CSS */}
      <style>{`
        @keyframes checkDraw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes confettiFall {
          0% { opacity: 1; transform: translateY(0) rotate(0deg); }
          100% { opacity: 0; transform: translateY(180px) rotate(360deg); }
        }
      `}</style>

      <div className="min-h-screen bg-background text-foreground relative">
        {showConfetti && <Confetti />}

        {/* ── 성공 히어로 ── */}
        <div className="pt-12 pb-8 px-6 text-center flex flex-col items-center gap-4">
          <AnimatedCheckmark />
          <div>
            <h1 className="text-2xl font-extrabold text-foreground mb-1">주문이 완료됐어요!</h1>
            <p className="text-text-secondary text-sm">
              매장에서 주문을 확인하고 있습니다.<br />잠시만 기다려 주세요.
            </p>
          </div>
        </div>

        {/* ── 주문 요약 카드 ── */}
        <div className="mx-4 mb-4 rounded-2xl border border-border bg-bg-secondary overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-bg-tertiary">
            <div className="text-xs text-text-tertiary mb-1">주문번호</div>
            <div className="font-mono font-extrabold text-xl text-foreground">{order.orderNo}</div>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-text-tertiary">주문상태</span>
              <span className="text-sm font-semibold text-success-600">
                {ORDER_STATUS_LABEL_LONG[order.status] ?? order.status}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-text-tertiary">주문일시</span>
              <span className="text-sm text-foreground">{formatDateTimeFull(order.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center border-t border-border pt-3">
              <span className="text-sm font-semibold text-foreground">결제금액</span>
              <span className="text-xl font-extrabold text-foreground">{formatWon(order.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* ── 계좌이체 안내 ── */}
        {order.paymentMethod === "TRANSFER" && order.transferAccount && (
          <div className="mx-4 mb-4 rounded-2xl border border-warning-200 bg-warning-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">🏦</span>
              <div className="text-sm font-bold text-foreground">입금 계좌 정보</div>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-text-tertiary">은행명</span>
                <span className="font-semibold">{order.transferAccount.bankName?.trim() || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">계좌번호</span>
                <span className="font-semibold font-mono">{order.transferAccount.accountNumber?.trim() || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">예금주</span>
                <span className="font-semibold">{order.transferAccount.accountHolder?.trim() || "-"}</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-warning-600">
              입금 확인 후 주문 상태가 변경됩니다. 입금자명을 정확히 입력해 주세요.
            </p>
          </div>
        )}

        {/* ── 주문 내역 ── */}
        {order.items.length > 0 && (
          <div className="mx-4 mb-6">
            <h3 className="text-xs font-bold text-text-tertiary uppercase tracking-wide mb-3">주문 내역</h3>
            <div className="rounded-2xl border border-border bg-bg-secondary overflow-hidden">
              {order.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex justify-between px-4 py-3 border-b border-border last:border-0"
                >
                  <span className="text-sm text-foreground">
                    {item.name} <span className="text-text-tertiary">× {item.qty}</span>
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatWon(item.unitPrice * item.qty)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CTA 버튼 ── */}
        <div className="px-4 pb-8 space-y-3">
          {/* Primary: 주문 추적 */}
          <Link href={`/order/track/${order.id}`} className="no-underline block">
            <button className="w-full p-4 rounded-2xl border-none bg-foreground text-background text-base font-bold cursor-pointer flex items-center justify-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              내 주문 상태 확인하기
            </button>
          </Link>

          {/* Secondary: 메뉴로 */}
          <Link href={`/order/branch/${branchId}`} className="no-underline block">
            <button className="w-full p-3.5 rounded-2xl border border-border bg-transparent text-foreground text-sm font-semibold cursor-pointer">
              메뉴로 돌아가기
            </button>
          </Link>
        </div>
      </div>
    </>
  );
}
