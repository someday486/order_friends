"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatDateTimeFull, formatWon } from "@/lib/format";
import { ORDER_STATUS_LABEL_LONG, type OrderStatus } from "@/types/common";
import { apiClient } from "@/lib/api-client";
import { loadLastOrderRecord } from "@/lib/order-session";

type PaymentMethod = "CARD" | "TRANSFER" | "CASH";
type FulfillmentType = "PICKUP" | "DELIVERY" | "DINE_IN";

type TransferAccountInfo = {
  bankName?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
} | null;

type OrderItemInfo = {
  name: string;
  qty: number;
  unitPrice: number;
  options: string[];
};

type OrderInfo = {
  id: string;
  orderNo: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  paymentMethod: PaymentMethod | null;
  fulfillmentType: FulfillmentType | null;
  transferAccount: TransferAccountInfo;
  customerName: string | null;
  customerPhone: string | null;
  customerAddress1: string | null;
  customerAddress2: string | null;
  customerMemo: string | null;
  branchId?: string | null;
  items: OrderItemInfo[];
};

const STATUS_STEPS: OrderStatus[] = [
  "CREATED",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
];

const POLL_INTERVAL_MS = 10000; // 10초 (30초에서 단축)

function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    value === "CREATED" ||
    value === "CONFIRMED" ||
    value === "PREPARING" ||
    value === "READY" ||
    value === "COMPLETED" ||
    value === "CANCELLED" ||
    value === "REFUNDED"
  );
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === "CARD" || value === "TRANSFER" || value === "CASH";
}

function isFulfillmentType(value: unknown): value is FulfillmentType {
  return value === "PICKUP" || value === "DELIVERY" || value === "DINE_IN";
}

function toText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function extractCustomerValue(
  source: Record<string, unknown>,
  customer: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const direct = toText(source[key]);
    if (direct) return direct;
    const nested = toText(customer[key]);
    if (nested) return nested;
  }
  return null;
}

function normalizeOrder(raw: unknown): OrderInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;

  const id = toText(source.id);
  const orderNo = toText(source.orderNo ?? source.order_no ?? source.id);
  const status = source.status;
  const totalAmount = toNumber(source.totalAmount ?? source.total_amount);
  const createdAt = toText(source.createdAt ?? source.created_at);

  if (!id || !orderNo || !isOrderStatus(status) || totalAmount === null || !createdAt) {
    return null;
  }

  const customerRaw =
    source.customer && typeof source.customer === "object"
      ? (source.customer as Record<string, unknown>)
      : {};

  const paymentMethodRaw = toText(source.paymentMethod ?? source.payment_method);
  const fulfillmentTypeRaw = toText(source.fulfillmentType ?? source.fulfillment_type);

  const transferAccountRaw =
    source.transferAccount && typeof source.transferAccount === "object"
      ? (source.transferAccount as Record<string, unknown>)
      : source.transfer_account && typeof source.transfer_account === "object"
        ? (source.transfer_account as Record<string, unknown>)
        : null;

  const items = Array.isArray(source.items) ? source.items : [];

  return {
    id,
    orderNo,
    status,
    totalAmount,
    createdAt,
    paymentMethod: isPaymentMethod(paymentMethodRaw) ? paymentMethodRaw : null,
    fulfillmentType: isFulfillmentType(fulfillmentTypeRaw) ? fulfillmentTypeRaw : null,
    transferAccount: transferAccountRaw
      ? {
          bankName: toText(transferAccountRaw.bankName ?? transferAccountRaw.bank_name) || null,
          accountNumber:
            toText(transferAccountRaw.accountNumber ?? transferAccountRaw.account_number) || null,
          accountHolder:
            toText(transferAccountRaw.accountHolder ?? transferAccountRaw.account_holder) || null,
        }
      : null,
    branchId: toText(source.branchId ?? source.branch_id),
    customerName: extractCustomerValue(source, customerRaw, ["customerName", "customer_name", "name"]),
    customerPhone: extractCustomerValue(source, customerRaw, ["customerPhone", "customer_phone", "phone"]),
    customerAddress1: extractCustomerValue(source, customerRaw, [
      "customerAddress1",
      "customer_address1",
      "address1",
    ]),
    customerAddress2: extractCustomerValue(source, customerRaw, [
      "customerAddress2",
      "customer_address2",
      "address2",
    ]),
    customerMemo: extractCustomerValue(source, customerRaw, ["customerMemo", "customer_memo", "memo"]),
    items: items.map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      const name =
        toText(row.name) ??
        toText(row.productName) ??
        toText(row.product_name_snapshot) ??
        "-";
      const qty = toNumber(row.qty) ?? 0;
      const unitPrice = toNumber(row.unitPrice ?? row.unit_price) ?? 0;
      const options = Array.isArray(row.options)
        ? row.options
            .map((option) => toText(option))
            .filter((option): option is string => Boolean(option))
        : [];

      return { name, qty, unitPrice, options };
    }),
  };
}

function mergeOrder(primary: OrderInfo, fallback: OrderInfo | null): OrderInfo {
  if (!fallback || fallback.id !== primary.id) return primary;

  return {
    ...primary,
    paymentMethod: primary.paymentMethod ?? fallback.paymentMethod,
    fulfillmentType: primary.fulfillmentType ?? fallback.fulfillmentType,
    transferAccount: primary.transferAccount ?? fallback.transferAccount,
    customerName: primary.customerName ?? fallback.customerName,
    customerPhone: primary.customerPhone ?? fallback.customerPhone,
    customerAddress1: primary.customerAddress1 ?? fallback.customerAddress1,
    customerAddress2: primary.customerAddress2 ?? fallback.customerAddress2,
    customerMemo: primary.customerMemo ?? fallback.customerMemo,
    branchId: primary.branchId ?? fallback.branchId,
    items: primary.items.length > 0 ? primary.items : fallback.items,
  };
}

function paymentMethodLabel(method: PaymentMethod | null): string {
  if (method === "CARD") return "카드";
  if (method === "TRANSFER") return "계좌이체";
  if (method === "CASH") return "현금";
  return "미확인";
}

function fulfillmentTypeLabel(type: FulfillmentType | null): string {
  if (type === "PICKUP") return "포장";
  if (type === "DELIVERY") return "배달";
  if (type === "DINE_IN") return "매장";
  return "-";
}

function statusHint(status: OrderStatus): string {
  if (status === "CREATED") return "주문이 접수됐어요. 매장에서 확인 중입니다 🕐";
  if (status === "CONFIRMED") return "주문이 확인됐어요! 곧 준비를 시작합니다 👍";
  if (status === "PREPARING") return "열심히 준비하고 있어요! 잠시만 기다려주세요 ☕";
  if (status === "READY") return "준비가 완료됐어요! 지금 바로 수령하러 오세요 🎉";
  if (status === "COMPLETED") return "주문이 완료됐습니다. 즐거운 시간 되세요 😊";
  if (status === "CANCELLED") return "주문이 취소됐습니다. 궁금하신 점은 매장으로 문의해 주세요.";
  return "환불이 완료됐습니다.";
}

function paymentGuide(method: PaymentMethod | null): { title: string; description: string } {
  if (method === "CARD") {
    return {
      title: "카드 결제 안내",
      description: "카드 승인/취소 내역은 카드사 또는 결제 알림에서 확인해 주세요.",
    };
  }
  if (method === "TRANSFER") {
    return {
      title: "계좌이체 안내",
      description: "입금자명은 주문자명과 동일하게 맞춰 주세요. 입금 확인 후 주문 상태가 변경됩니다.",
    };
  }
  if (method === "CASH") {
    return {
      title: "현금 결제 안내",
      description: "현장 결제 유형입니다. 수령 시 매장 안내에 따라 결제를 진행해 주세요.",
    };
  }
  return {
    title: "결제 안내",
    description: "결제 유형을 확인할 수 없습니다. 결제 관련 문의는 매장으로 연락해 주세요.",
  };
}

function playReadySound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const times = [0, 0.15, 0.3];
    times.forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + t + 0.12);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.12);
    });
  } catch {
    // 브라우저 정책으로 소리 재생 실패 시 조용히 무시
  }
}

export default function TrackOrderPage() {
  const params = useParams();
  const orderId = params?.orderId as string;
  const cachedOrder = useMemo(() => normalizeOrder(loadLastOrderRecord({})), []);

  const [order, setOrder] = useState<OrderInfo | null>(() => {
    if (cachedOrder?.id === orderId) return cachedOrder;
    return null;
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const prevStatusRef = useRef<OrderStatus | null>(null);

  const fetchOrder = useCallback(
    async (isBackground = false) => {
      try {
        if (isBackground) {
          setIsRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const data = await apiClient.get<unknown>(`/public/orders/${orderId}`, { auth: false });
        const normalized = normalizeOrder(data);
        if (!normalized) {
          throw new Error("주문 정보를 확인할 수 없습니다.");
        }

        const merged = mergeOrder(normalized, cachedOrder);

        // READY 상태 전환 감지 → 소리 재생
        if (merged.status === "READY" && prevStatusRef.current !== "READY") {
          playReadySound();
        }
        prevStatusRef.current = merged.status;

        setOrder(merged);
        setLastUpdatedAt(new Date());
      } catch (e: unknown) {
        const message = (e as Error)?.message ?? "조회 중 오류가 발생했습니다.";
        if (cachedOrder?.id === orderId) {
          setOrder(cachedOrder);
          setError(null);
          return;
        }
        setError(message.includes("404") ? "주문을 찾을 수 없습니다." : message);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [cachedOrder, orderId],
  );

  useEffect(() => {
    if (orderId) {
      void fetchOrder(false);
    }
  }, [fetchOrder, orderId]);

  // 10초 polling (완료/취소 상태면 중단)
  useEffect(() => {
    if (!orderId) return;
    const terminal = order?.status === "COMPLETED" || order?.status === "CANCELLED" || order?.status === "REFUNDED";
    if (terminal) return;

    const interval = setInterval(() => {
      void fetchOrder(true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchOrder, orderId, order?.status]);

  // ── 로딩 ──
  if (loading && !order) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="flex flex-col items-center justify-center h-screen gap-3">
          <svg className="animate-spin w-8 h-8 text-primary-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-text-secondary text-sm">주문 조회 중...</p>
        </div>
      </div>
    );
  }

  // ── 에러 ──
  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="p-10 text-center">
          <div className="text-4xl mb-4">😕</div>
          <p className="text-danger-500 mb-4">{error}</p>
          <button
            onClick={() => { void fetchOrder(false); }}
            className="py-2 px-4 rounded-lg border border-border bg-transparent text-foreground text-[13px] cursor-pointer hover:bg-bg-tertiary transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <p className="text-text-secondary text-center p-10">주문을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const isCancelled = order.status === "CANCELLED" || order.status === "REFUNDED";
  const isCompleted = order.status === "COMPLETED";
  const isReady = order.status === "READY";
  const currentStepIndex = STATUS_STEPS.indexOf(order.status);
  const guide = paymentGuide(order.paymentMethod);

  const timeline = isCancelled
    ? [
        {
          id: "CREATED",
          title: ORDER_STATUS_LABEL_LONG.CREATED,
          description: statusHint("CREATED"),
          state: "done" as const,
        },
        {
          id: order.status,
          title: ORDER_STATUS_LABEL_LONG[order.status] ?? order.status,
          description: statusHint(order.status),
          state: "current" as const,
        },
      ]
    : STATUS_STEPS.map((step, idx) => ({
        id: step,
        title: ORDER_STATUS_LABEL_LONG[step] ?? step,
        description: statusHint(step),
        state: (idx < currentStepIndex
          ? "done"
          : idx === currentStepIndex
            ? "current"
            : "upcoming") as "done" | "current" | "upcoming",
      }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── READY 상태 배너 ── */}
      {isReady && (
        <div className="sticky top-0 z-30 bg-success-500 text-white px-4 py-3 flex items-center justify-center gap-2 shadow-lg animate-pulse-slow">
          <span className="text-lg">🎉</span>
          <span className="font-bold text-sm">준비 완료! 지금 수령하러 오세요</span>
          <span className="text-lg">🎉</span>
        </div>
      )}

      {/* ── Header ── */}
      <header className={`sticky ${isReady ? "top-[52px]" : "top-0"} z-20 flex items-center justify-between px-4 py-3 border-b border-border bg-background`}>
        <h1 className="m-0 text-lg font-bold text-foreground">주문 진행 현황</h1>
        <div className="flex items-center gap-2">
          {isRefreshing && (
            <svg className="animate-spin w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          <button
            onClick={() => { void fetchOrder(false); }}
            className="py-2 px-3 rounded-lg border border-border bg-transparent text-foreground text-xs cursor-pointer hover:bg-bg-tertiary transition-colors"
          >
            새로고침
          </button>
        </div>
      </header>

      <div className="max-w-xl mx-auto p-4 space-y-4">
        {/* ── 주문번호 카드 ── */}
        <section className="rounded-2xl border border-border bg-bg-secondary p-4">
          <div className="text-xs text-text-tertiary">주문번호</div>
          <div className="text-2xl font-extrabold font-mono text-foreground mt-1">{order.orderNo}</div>
          <div className="mt-2 text-xs text-text-secondary">
            주문일시: {formatDateTimeFull(order.createdAt)}
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                isCompleted
                  ? "bg-success-500/20 text-success-600"
                  : isCancelled
                    ? "bg-danger-500/20 text-danger-500"
                    : isReady
                      ? "bg-success-500 text-white animate-pulse-slow"
                      : "bg-primary-500/20 text-primary-500"
              }`}
            >
              {isReady && "✓ "}
              {ORDER_STATUS_LABEL_LONG[order.status] ?? order.status}
            </span>
          </div>
          {lastUpdatedAt && (
            <div className="mt-2 text-[11px] text-text-tertiary">
              마지막 업데이트: {lastUpdatedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              {!isCancelled && !isCompleted && (
                <span className="ml-1 opacity-60">(10초마다 자동 갱신)</span>
              )}
            </div>
          )}
        </section>

        {/* ── 진행 타임라인 ── */}
        <section className="rounded-2xl border border-border bg-bg-secondary p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">진행 상황</h2>
          <div className="relative pl-6">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
            {timeline.map((step, idx) => {
              const isCurrent = step.state === "current";
              const isDone = step.state === "done";
              const dotClass = isDone
                ? "bg-success-500 border-success-500"
                : isCurrent
                  ? "bg-primary-500 border-primary-500"
                  : "bg-bg-tertiary border-border";

              return (
                <div key={step.id} className={idx === timeline.length - 1 ? "relative" : "relative pb-4"}>
                  <div
                    className={`absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full border-2 ${dotClass} ${
                      isCurrent && step.id === "READY" ? "animate-pulse" : ""
                    }`}
                  />
                  <div
                    className={`rounded-xl border p-3 ${
                      isCurrent
                        ? step.id === "READY"
                          ? "border-success-500/50 bg-success-500/10"
                          : "border-primary-500/50 bg-primary-500/10"
                        : isDone
                          ? "border-success-500/30 bg-success-500/5"
                          : "border-border bg-background"
                    }`}
                  >
                    <div className="text-sm font-semibold text-foreground">{step.title}</div>
                    <div className="mt-1 text-xs text-text-secondary">{step.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 취소된 경우: 다시 주문하기 ── */}
        {isCancelled && order.branchId && (
          <section className="rounded-2xl border border-border bg-bg-secondary p-4">
            <p className="text-sm text-text-secondary mb-3">다시 주문하시겠어요?</p>
            <Link href={`/order/branch/${order.branchId}`} className="no-underline">
              <button className="w-full py-3 rounded-xl bg-foreground text-background font-bold text-sm cursor-pointer">
                메뉴로 돌아가기
              </button>
            </Link>
          </section>
        )}

        {/* ── 결제 안내 ── */}
        <section className="rounded-2xl border border-border bg-bg-secondary p-4">
          <h2 className="text-sm font-semibold text-foreground mb-2">{guide.title}</h2>
          <div className="text-xs text-text-secondary leading-5">{guide.description}</div>
          {order.paymentMethod === "TRANSFER" && order.transferAccount ? (
            <div className="mt-3 rounded-lg bg-bg-tertiary px-3 py-2.5 text-xs text-text-secondary leading-6">
              <div className="font-semibold text-foreground mb-1">입금 계좌 정보</div>
              <div>은행명: <span className="font-medium text-foreground">{order.transferAccount.bankName?.trim() || "-"}</span></div>
              <div>계좌번호: <span className="font-medium text-foreground">{order.transferAccount.accountNumber?.trim() || "-"}</span></div>
              <div>예금주: <span className="font-medium text-foreground">{order.transferAccount.accountHolder?.trim() || "-"}</span></div>
            </div>
          ) : null}
          <div className="mt-3 text-xs text-text-tertiary">
            결제수단: {paymentMethodLabel(order.paymentMethod)} · 주문방식: {fulfillmentTypeLabel(order.fulfillmentType)}
          </div>
        </section>

        {/* ── 주문자 정보 ── */}
        <section className="rounded-2xl border border-border bg-bg-secondary p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">주문 정보</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-text-tertiary">이름</span>
              <span className="text-foreground text-right">{order.customerName ?? "-"}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-text-tertiary">연락처</span>
              <span className="text-foreground text-right">{order.customerPhone ?? "-"}</span>
            </div>
            {(order.customerAddress1 || order.customerAddress2) && (
              <div className="flex justify-between gap-3">
                <span className="text-text-tertiary">주소</span>
                <span className="text-foreground text-right">
                  {[order.customerAddress1, order.customerAddress2].filter(Boolean).join(" ")}
                </span>
              </div>
            )}
            {order.customerMemo && (
              <div className="flex justify-between gap-3">
                <span className="text-text-tertiary">요청사항</span>
                <span className="text-foreground text-right">{order.customerMemo}</span>
              </div>
            )}
          </div>
        </section>

        {/* ── 주문 내역 ── */}
        <section className="rounded-2xl border border-border bg-bg-secondary p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">주문 내역</h2>
          <div className="space-y-2">
            {order.items.map((item, idx) => (
              <div key={`${item.name}-${idx}`} className="rounded-lg bg-background px-3 py-2">
                <div className="flex justify-between gap-3">
                  <div className="text-sm text-foreground">
                    {item.name} × {item.qty}
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {formatWon(item.unitPrice * item.qty)}
                  </div>
                </div>
                {item.options.length > 0 ? (
                  <div className="mt-1 text-xs text-text-tertiary">{item.options.join(", ")}</div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border flex justify-between">
            <span className="text-sm font-semibold text-foreground">총 결제금액</span>
            <span className="text-lg font-extrabold text-foreground">{formatWon(order.totalAmount)}</span>
          </div>
        </section>
      </div>
    </div>
  );
}
