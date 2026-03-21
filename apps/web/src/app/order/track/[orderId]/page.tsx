'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { formatDateTimeFull, formatPhone, formatWon } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import { ORDER_STATUS_LABEL_LONG, type OrderStatus } from '@/types/common';
import { apiClient } from '@/lib/api-client';
import { loadLastOrderRecord, saveLastOrderRecord } from '@/lib/order-session';

type PaymentMethod = 'CARD' | 'TRANSFER' | 'CASH';
type FulfillmentType = 'PICKUP' | 'DELIVERY' | 'DINE_IN' | 'SHIPPING';

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
  requestedTime: string | null;
  paymentMethod: PaymentMethod | null;
  fulfillmentType: FulfillmentType | null;
  transferAccount: TransferAccountInfo;
  customerName: string | null;
  customerPhone: string | null;
  customerAddress1: string | null;
  customerAddress2: string | null;
  customerMemo: string | null;
  branchId?: string | null;
  branchContactPhone?: string | null;
  branchKakaoChannelUrl?: string | null;
  items: OrderItemInfo[];
};

type PublicBranchSupportInfo = {
  contactPhone?: string | null;
  kakaoChannelUrl?: string | null;
};

function toTelHref(phone: string) {
  const normalized = phone.replace(/[^\d+]/g, '');
  return normalized ? `tel:${normalized}` : null;
}

const STATUS_STEPS: OrderStatus[] = [
  'CREATED',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'COMPLETED',
];

const POLL_INTERVAL_MS = 10000; // 10초 (30초에서 단축)

function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    value === 'CREATED' ||
    value === 'CONFIRMED' ||
    value === 'PREPARING' ||
    value === 'READY' ||
    value === 'COMPLETED' ||
    value === 'CANCELLED' ||
    value === 'REFUNDED'
  );
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === 'CARD' || value === 'TRANSFER' || value === 'CASH';
}

function isFulfillmentType(value: unknown): value is FulfillmentType {
  return (
    value === 'PICKUP' ||
    value === 'DELIVERY' ||
    value === 'DINE_IN' ||
    value === 'SHIPPING'
  );
}

function toText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
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
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;

  const id = toText(source.id);
  const orderNo = toText(source.orderNo ?? source.order_no ?? source.id);
  const status = source.status;
  const totalAmount = toNumber(source.totalAmount ?? source.total_amount);
  const createdAt = toText(source.createdAt ?? source.created_at);

  if (
    !id ||
    !orderNo ||
    !isOrderStatus(status) ||
    totalAmount === null ||
    !createdAt
  ) {
    return null;
  }

  const customerRaw =
    source.customer && typeof source.customer === 'object'
      ? (source.customer as Record<string, unknown>)
      : {};

  const paymentMethodRaw = toText(
    source.paymentMethod ?? source.payment_method,
  );
  const fulfillmentTypeRaw = toText(
    source.fulfillmentType ?? source.fulfillment_type,
  );
  const requestedTime = toText(source.requestedTime ?? source.requested_time);

  const transferAccountRaw =
    source.transferAccount && typeof source.transferAccount === 'object'
      ? (source.transferAccount as Record<string, unknown>)
      : source.transfer_account && typeof source.transfer_account === 'object'
        ? (source.transfer_account as Record<string, unknown>)
        : null;

  const items = Array.isArray(source.items) ? source.items : [];

  return {
    id,
    orderNo,
    status,
    totalAmount,
    createdAt,
    requestedTime,
    paymentMethod: isPaymentMethod(paymentMethodRaw) ? paymentMethodRaw : null,
    fulfillmentType: isFulfillmentType(fulfillmentTypeRaw)
      ? fulfillmentTypeRaw
      : null,
    transferAccount: transferAccountRaw
      ? {
          bankName:
            toText(
              transferAccountRaw.bankName ?? transferAccountRaw.bank_name,
            ) || null,
          accountNumber:
            toText(
              transferAccountRaw.accountNumber ??
                transferAccountRaw.account_number,
            ) || null,
          accountHolder:
            toText(
              transferAccountRaw.accountHolder ??
                transferAccountRaw.account_holder,
            ) || null,
        }
      : null,
    branchId: toText(source.branchId ?? source.branch_id),
    customerName: extractCustomerValue(source, customerRaw, [
      'customerName',
      'customer_name',
      'name',
    ]),
    customerPhone: extractCustomerValue(source, customerRaw, [
      'customerPhone',
      'customer_phone',
      'phone',
    ]),
    customerAddress1: extractCustomerValue(source, customerRaw, [
      'customerAddress1',
      'customer_address1',
      'address1',
    ]),
    customerAddress2: extractCustomerValue(source, customerRaw, [
      'customerAddress2',
      'customer_address2',
      'address2',
    ]),
    customerMemo: extractCustomerValue(source, customerRaw, [
      'customerMemo',
      'customer_memo',
      'memo',
    ]),
    branchContactPhone: toText(
      source.branchContactPhone ?? source.branch_contact_phone,
    ),
    branchKakaoChannelUrl: toText(
      source.branchKakaoChannelUrl ?? source.branch_kakao_channel_url,
    ),
    items: items.map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      const name =
        toText(row.name) ??
        toText(row.productName) ??
        toText(row.product_name_snapshot) ??
        '-';
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
  if (
    !fallback ||
    (fallback.id !== primary.id && fallback.orderNo !== primary.orderNo)
  ) {
    return primary;
  }

  return {
    ...primary,
    paymentMethod: primary.paymentMethod ?? fallback.paymentMethod,
    fulfillmentType: primary.fulfillmentType ?? fallback.fulfillmentType,
    requestedTime: primary.requestedTime ?? fallback.requestedTime,
    transferAccount: primary.transferAccount ?? fallback.transferAccount,
    customerName: primary.customerName ?? fallback.customerName,
    customerPhone: primary.customerPhone ?? fallback.customerPhone,
    customerAddress1: primary.customerAddress1 ?? fallback.customerAddress1,
    customerAddress2: primary.customerAddress2 ?? fallback.customerAddress2,
    customerMemo: primary.customerMemo ?? fallback.customerMemo,
    branchId: primary.branchId ?? fallback.branchId,
    branchContactPhone:
      primary.branchContactPhone ?? fallback.branchContactPhone,
    branchKakaoChannelUrl:
      primary.branchKakaoChannelUrl ?? fallback.branchKakaoChannelUrl,
    items: primary.items.length > 0 ? primary.items : fallback.items,
  };
}

function matchesOrderReference(order: OrderInfo | null, reference: string) {
  if (!order) return false;
  return order.id === reference || order.orderNo === reference;
}

function parseApiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const raw = error.message ?? '';

  const jsonStart = raw.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart)) as {
        message?: string | string[];
      };
      if (Array.isArray(parsed.message) && parsed.message.length > 0) {
        return String(parsed.message[0]);
      }
      if (typeof parsed.message === 'string' && parsed.message.trim()) {
        return parsed.message;
      }
    } catch {
      // Ignore parse errors and fall back to the raw message.
    }
  }

  return raw || fallback;
}

function parseCancelErrorMessage(error: unknown): string {
  const message = parseApiErrorMessage(
    error,
    '주문 취소 처리 중 오류가 발생했어요.',
  );

  if (
    message.includes('주문을 찾을 수 없습니다') ||
    message.includes('404')
  ) {
    return '이 주문은 현재 로그인한 계정으로 취소할 수 없어요. 주문한 계정으로 다시 로그인해 주세요.';
  }

  if (message.includes('로그인 연동 이전 주문')) {
    return '이 주문은 직접 취소를 지원하기 전 주문이에요. 매장에 문의해 주세요.';
  }

  if (message.includes('현재 상태에서는 구매자가 직접 주문을 취소할 수 없습니다')) {
    return '현재 상태에서는 구매자가 직접 주문을 취소할 수 없어요. 매장 문의로 도와드릴게요.';
  }

  return message;
}

function paymentMethodLabel(method: PaymentMethod | null): string {
  if (method === 'CARD') return '카드';
  if (method === 'TRANSFER') return '계좌이체';
  if (method === 'CASH') return '현금';
  return '미확인';
}

function fulfillmentTypeLabel(type: FulfillmentType | null): string {
  if (type === 'PICKUP') return '포장';
  if (type === 'DELIVERY') return '배달';
  if (type === 'SHIPPING') return '택배';
  if (type === 'DINE_IN') return '매장';
  return '-';
}

function statusHint(status: OrderStatus): string {
  if (status === 'CREATED')
    return '주문이 접수됐어요. 매장에서 확인 중입니다 🕐';
  if (status === 'CONFIRMED')
    return '주문이 확인됐어요! 곧 준비를 시작합니다 👍';
  if (status === 'PREPARING')
    return '열심히 준비하고 있어요! 잠시만 기다려주세요 ☕';
  if (status === 'READY')
    return '준비가 완료됐어요! 지금 바로 수령하러 오세요 🎉';
  if (status === 'COMPLETED')
    return '주문이 완료됐습니다. 즐거운 시간 되세요 😊';
  if (status === 'CANCELLED')
    return '주문이 취소됐습니다. 궁금하신 점은 매장으로 문의해 주세요.';
  return '환불이 완료됐습니다.';
}

function paymentGuide(method: PaymentMethod | null): {
  title: string;
  description: string;
} {
  if (method === 'CARD') {
    return {
      title: '카드 결제 안내',
      description:
        '카드 승인/취소 내역은 카드사 또는 결제 알림에서 확인해 주세요.',
    };
  }
  if (method === 'TRANSFER') {
    return {
      title: '계좌이체 안내',
      description:
        '입금자명은 주문자명과 동일하게 맞춰 주세요. 입금 확인 후 주문 상태가 변경됩니다.',
    };
  }
  if (method === 'CASH') {
    return {
      title: '현금 결제 안내',
      description:
        '현장 결제 유형입니다. 수령 시 매장 안내에 따라 결제를 진행해 주세요.',
    };
  }
  return {
    title: '결제 안내',
    description:
      '결제 유형을 확인할 수 없습니다. 결제 관련 문의는 매장으로 연락해 주세요.',
  };
}

function refundGuide(order: OrderInfo): {
  title: string;
  summary: string;
  items: string[];
} {
  const settlementHint =
    order.paymentMethod === 'CARD'
      ? '카드 결제 취소 후 실제 환불 반영까지는 카드사 사정에 따라 3~5영업일 정도 걸릴 수 있습니다.'
      : order.paymentMethod === 'TRANSFER'
        ? '계좌이체 주문의 환불은 계좌 확인이 필요할 수 있어 매장 안내에 따라 처리됩니다.'
        : order.paymentMethod === 'CASH'
          ? '현장결제 주문의 환불 방식은 매장 정책에 따라 달라질 수 있습니다.'
          : '환불 반영 시점은 결제 수단과 매장 확인 결과에 따라 달라질 수 있습니다.';

  if (order.status === 'CREATED') {
    return {
      title: '취소 및 환불 안내',
      summary:
        '현재는 주문 접수 단계입니다. 매장 준비가 시작되기 전이면 취소와 환불이 비교적 빠르게 처리될 수 있습니다.',
      items: [
        '준비 시작 전 주문은 자동 취소 또는 빠른 환불 대상이 될 수 있습니다.',
        settlementHint,
        '환불이 지연되거나 확인이 필요하면 아래 문의 연락처로 바로 연락해 주세요.',
      ],
    };
  }

  if (order.status === 'CONFIRMED' || order.status === 'PREPARING') {
    return {
      title: '환불 가능 여부 확인 중',
      summary:
        '현재 매장에서 주문을 확인했거나 준비 중일 수 있어 자동 취소가 제한될 수 있습니다.',
      items: [
        '준비가 시작된 주문은 매장 확인 후 취소 또는 환불 가능 여부가 결정될 수 있습니다.',
        settlementHint,
        '빠른 확인이 필요하면 아래 문의 연락처로 요청해 주세요.',
      ],
    };
  }

  if (order.status === 'READY') {
    return {
      title: '수령 직전 주문 안내',
      summary:
        '준비 완료된 주문은 구매자 화면에서 바로 취소되지 않을 수 있으며 매장 확인이 우선됩니다.',
      items: [
        '준비 완료 이후에는 환불 가능 여부가 매장 정책과 진행 상황에 따라 달라집니다.',
        settlementHint,
        '취소 또는 환불이 필요하면 바로 매장에 연락해 주세요.',
      ],
    };
  }

  if (order.status === 'COMPLETED') {
    return {
      title: '완료 주문 환불 안내',
      summary:
        '완료된 주문은 단순 취소가 아니라 환불 검토가 필요한 상태입니다.',
      items: [
        '상품 누락, 오배송, 결제 오류 등의 사유가 있으면 매장 확인 후 환불이 진행됩니다.',
        settlementHint,
        '처리 기준은 매장 정책에 따라 달라질 수 있으니 문의 연락처를 이용해 주세요.',
      ],
    };
  }

  if (order.status === 'REFUNDED') {
    return {
      title: '환불 완료 안내',
      summary: '이 주문의 환불 처리는 완료되었습니다.',
      items: [
        settlementHint,
        '카드사 또는 금융기관 반영 시점은 실제 입금 시점과 차이가 있을 수 있습니다.',
        '반영 내역이 보이지 않으면 매장 또는 결제 수단 고객센터에 문의해 주세요.',
      ],
    };
  }

  return {
    title: '취소 완료 안내',
    summary: '이 주문은 취소 처리되었습니다.',
    items: [
      settlementHint,
      '실제 환불 반영 시점은 결제 수단에 따라 차이가 있을 수 있습니다.',
      '반영이 지연되면 매장으로 문의해 주세요.',
    ],
  };
}

function playReadySound() {
  try {
    const ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    )();
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
  const { status } = useAuth();
  const cachedOrder = useMemo(
    () => normalizeOrder(loadLastOrderRecord({})),
    [],
  );

  const [order, setOrder] = useState<OrderInfo | null>(() => {
    if (matchesOrderReference(cachedOrder, orderId)) return cachedOrder;
    return null;
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [usingCachedOrderFallback, setUsingCachedOrderFallback] =
    useState(false);
  const [cancelSuccessNotice, setCancelSuccessNotice] = useState<string | null>(
    null,
  );

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

        const data =
          status === 'authenticated'
            ? await apiClient
                .get<unknown>(`/me/orders/${encodeURIComponent(orderId)}`)
                .catch(() =>
                  apiClient.get<unknown>(
                    `/public/orders/${encodeURIComponent(orderId)}`,
                    {
                      auth: false,
                    },
                  ),
                )
            : await apiClient.get<unknown>(
                `/public/orders/${encodeURIComponent(orderId)}`,
                {
                  auth: false,
                },
              );
        const normalized = normalizeOrder(data);
        if (!normalized) {
          throw new Error('주문 정보를 확인할 수 없습니다.');
        }

        const merged = mergeOrder(normalized, cachedOrder);

        // READY 상태 전환 감지 → 소리 재생
        if (merged.status === 'READY' && prevStatusRef.current !== 'READY') {
          playReadySound();
        }
        prevStatusRef.current = merged.status;

        setOrder(merged);
        setUsingCachedOrderFallback(false);
        setLastUpdatedAt(new Date());
      } catch (e: unknown) {
        const message = (e as Error)?.message ?? '조회 중 오류가 발생했습니다.';
        if (matchesOrderReference(cachedOrder, orderId)) {
          setOrder(cachedOrder);
          setUsingCachedOrderFallback(true);
          setError(null);
          return;
        }
        setUsingCachedOrderFallback(false);
        setError(
          message.includes('404') ? '주문을 찾을 수 없습니다.' : message,
        );
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [cachedOrder, orderId, status],
  );

  useEffect(() => {
    if (!orderId || status === 'loading') return;
    void fetchOrder(false);
  }, [fetchOrder, orderId, status]);

  useEffect(() => {
    if (!order?.branchId) return;
    if (order.branchContactPhone?.trim() || order.branchKakaoChannelUrl?.trim()) {
      return;
    }

    let cancelled = false;

    apiClient
      .get<PublicBranchSupportInfo>(
        `/public/branches/${encodeURIComponent(order.branchId)}`,
        {
          auth: false,
        },
      )
      .then((branch) => {
        if (cancelled) return;
        const contactPhone = toText(branch?.contactPhone);
        const kakaoChannelUrl = toText(branch?.kakaoChannelUrl);
        if (!contactPhone && !kakaoChannelUrl) return;

        setOrder((current) =>
          current
            ? {
                ...current,
                branchContactPhone: current.branchContactPhone ?? contactPhone,
                branchKakaoChannelUrl:
                  current.branchKakaoChannelUrl ?? kakaoChannelUrl,
              }
            : current,
        );
      })
      .catch(() => {
        // non-fatal
      });

    return () => {
      cancelled = true;
    };
  }, [order?.branchContactPhone, order?.branchId, order?.branchKakaoChannelUrl]);

  // 10초 polling (완료/취소 상태면 중단)
  useEffect(() => {
    if (!orderId || status === 'loading') return;
    const terminal =
      order?.status === 'COMPLETED' ||
      order?.status === 'CANCELLED' ||
      order?.status === 'REFUNDED';
    if (terminal) return;

    const interval = setInterval(() => {
      void fetchOrder(true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchOrder, orderId, order?.status, status]);

  // ── 로딩 ──
  if (loading && !order) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="flex flex-col items-center justify-center h-screen gap-3">
          <svg
            className="animate-spin w-8 h-8 text-primary-500"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
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
            onClick={() => {
              void fetchOrder(false);
            }}
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
        <p className="text-text-secondary text-center p-10">
          주문을 찾을 수 없습니다.
        </p>
      </div>
    );
  }

  const isCancelled =
    order.status === 'CANCELLED' || order.status === 'REFUNDED';
  const isRefunded = order.status === 'REFUNDED';
  const isCompleted = order.status === 'COMPLETED';
  const isReady = order.status === 'READY';
  const currentStepIndex = STATUS_STEPS.indexOf(order.status);
  const guide = paymentGuide(order.paymentMethod);
  const refundNotice = refundGuide(order);
  const showCancelAction =
    !usingCachedOrderFallback && !isCancelled && !isCompleted;
  const cancelActionLabel =
    order.status === 'CREATED' ? '주문 취소' : '주문 취소 문의';
  const topStatusNotice = cancelSuccessNotice
    ? {
        tone: 'danger' as const,
        title: '주문 취소가 완료되었어요.',
        description: '주문 상태와 진행 상황이 바로 취소됨으로 업데이트됐어요.',
      }
    : isRefunded
      ? {
          tone: 'refund' as const,
          title: '환불이 완료되었어요.',
          description:
            '이 주문은 환불 완료 상태로 반영되었어요. 카드사나 금융기관 반영까지는 조금 더 걸릴 수 있어요.',
        }
      : isCancelled
        ? {
            tone: 'danger' as const,
            title: '주문이 취소되었어요.',
            description:
              '이 주문은 취소 상태로 반영되었고 더 이상 진행되지 않아요. 필요하면 아래 문의 정보로 매장에 연락해 주세요.',
          }
        : null;

  const handleCancelAction = useCallback(async () => {
    if (order.status === 'CREATED') {
      if (status !== 'authenticated') {
        toast('로그인 후 주문을 취소할 수 있어요.');
        const next = `${window.location.pathname}${window.location.search}`;
        window.location.assign(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      try {
        await apiClient.post(
          `/me/orders/${encodeURIComponent(order.id)}/cancel`,
          {},
        );
        const cancelledOrder: OrderInfo = {
          ...order,
          status: 'CANCELLED',
        };
        setOrder(cancelledOrder);
        setLastUpdatedAt(new Date());
        setCancelSuccessNotice('주문이 취소되었어요.');
        saveLastOrderRecord({
          order: cancelledOrder,
          branchId: cancelledOrder.branchId ?? null,
        });
        toast.success('주문이 취소되었어요.');
        void fetchOrder(true);
      } catch (error) {
        toast.error(parseCancelErrorMessage(error));
      }
      return;
    }

    if (order.branchKakaoChannelUrl?.trim()) {
      window.open(
        order.branchKakaoChannelUrl.trim(),
        '_blank',
        'noopener,noreferrer',
      );
      return;
    }

    const telHref = order.branchContactPhone?.trim()
      ? toTelHref(order.branchContactPhone.trim())
      : null;

    if (telHref) {
      window.location.href = telHref;
      return;
    }

    toast('주문 취소는 매장 문의로 도와드리고 있어요.');
  }, [
    fetchOrder,
    order.branchContactPhone,
    order.branchKakaoChannelUrl,
    order.id,
    order.status,
    status,
  ]);

  const timeline = isCancelled
    ? [
        {
          id: 'CREATED',
          title: ORDER_STATUS_LABEL_LONG.CREATED,
          description: statusHint('CREATED'),
          state: 'done' as const,
        },
        {
          id: order.status,
          title: ORDER_STATUS_LABEL_LONG[order.status] ?? order.status,
          description: statusHint(order.status),
          state: 'current' as const,
        },
      ]
    : STATUS_STEPS.map((step, idx) => ({
        id: step,
        title: ORDER_STATUS_LABEL_LONG[step] ?? step,
        description: statusHint(step),
        state: (idx < currentStepIndex
          ? 'done'
          : idx === currentStepIndex
            ? 'current'
            : 'upcoming') as 'done' | 'current' | 'upcoming',
      }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── READY 상태 배너 ── */}
      {isReady && (
        <div className="sticky top-0 z-30 bg-success-500 text-white px-4 py-3 flex items-center justify-center gap-2 shadow-lg animate-pulse-slow">
          <span className="text-lg">🎉</span>
          <span className="font-bold text-sm">
            준비 완료! 지금 수령하러 오세요
          </span>
          <span className="text-lg">🎉</span>
        </div>
      )}

      {/* ── Header ── */}
      <header
        className={`sticky ${isReady ? 'top-[52px]' : 'top-0'} z-20 flex items-center justify-between px-4 py-3 border-b border-border bg-background`}
      >
        <h1 className="m-0 text-lg font-bold text-foreground">
          주문 진행 현황
        </h1>
        <div className="flex items-center gap-2">
          {isRefreshing && (
            <svg
              className="animate-spin w-4 h-4 text-text-tertiary"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          <button
            onClick={() => {
              void fetchOrder(false);
            }}
            className="py-2 px-3 rounded-lg border border-border bg-transparent text-foreground text-xs cursor-pointer hover:bg-bg-tertiary transition-colors"
          >
            새로고침
          </button>
        </div>
      </header>

      <div className="max-w-xl mx-auto p-4 space-y-4">
        {topStatusNotice && (
          <section
            className={`rounded-2xl border p-4 ${
              topStatusNotice.tone === 'refund'
                ? 'border-pink-500/30 bg-pink-500/10'
                : 'border-danger-500/30 bg-danger-500/10'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {topStatusNotice.title}
                </div>
                <div className="mt-1 text-xs leading-5 text-text-secondary">
                  {topStatusNotice.description}
                </div>
              </div>
              {cancelSuccessNotice && (
                <button
                  type="button"
                  onClick={() => setCancelSuccessNotice(null)}
                  className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground"
                >
                  닫기
                </button>
              )}
            </div>
          </section>
        )}
        {usingCachedOrderFallback && (
          <section className="rounded-2xl border border-warning-500/30 bg-warning-500/10 p-4">
            <div className="text-sm font-semibold text-foreground">
              최신 주문 상태를 다시 확인하는 중이에요.
            </div>
            <div className="mt-1 text-xs leading-5 text-text-secondary">
              현재 화면은 브라우저에 저장된 최근 주문 정보를 바탕으로 보이고
              있어요. 최신 상태 확인이 끝날 때까지 취소 버튼은 숨겨집니다.
            </div>
          </section>
        )}
        {/* ── 주문번호 카드 ── */}
        {(order.branchContactPhone?.trim() ||
          order.branchKakaoChannelUrl?.trim()) && (
          <section className="rounded-2xl border border-border bg-bg-secondary p-4">
            <h2 className="text-sm font-semibold text-foreground mb-2">
              문의 안내
            </h2>
            <div className="flex flex-wrap gap-2">
              {order.branchContactPhone?.trim() && (
                <a
                  href={toTelHref(order.branchContactPhone.trim()) ?? undefined}
                  className="inline-flex items-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground no-underline hover:bg-bg-tertiary transition-colors"
                >
                  전화 문의 {formatPhone(order.branchContactPhone.trim())}
                </a>
              )}
              {order.branchKakaoChannelUrl?.trim() && (
                <a
                  href={order.branchKakaoChannelUrl.trim()}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground no-underline hover:bg-bg-tertiary transition-colors"
                >
                  카카오톡 상담
                </a>
              )}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-border bg-bg-secondary p-4">
          <div className="text-xs text-text-tertiary">주문번호</div>
          <div className="text-2xl font-extrabold font-mono text-foreground mt-1">
            {order.orderNo}
          </div>
          <div className="mt-2 text-xs text-text-secondary">
            주문일시: {formatDateTimeFull(order.createdAt)}
          </div>
          {order.requestedTime && (
            <div className="mt-1 text-xs text-text-secondary">
              픽업 희망 시간: {formatDateTimeFull(order.requestedTime)}
            </div>
          )}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                isCompleted
                  ? 'bg-success-500/20 text-success-600'
                  : isCancelled
                    ? 'bg-danger-500/20 text-danger-500'
                    : isReady
                      ? 'bg-success-500 text-white animate-pulse-slow'
                      : 'bg-primary-500/20 text-primary-500'
              }`}
            >
              {isReady && '✓ '}
              {ORDER_STATUS_LABEL_LONG[order.status] ?? order.status}
            </span>
          </div>
          {lastUpdatedAt && (
            <div className="mt-2 text-[11px] text-text-tertiary">
              마지막 업데이트:{' '}
              {lastUpdatedAt.toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
              {!isCancelled && !isCompleted && (
                <span className="ml-1 opacity-60">(10초마다 자동 갱신)</span>
              )}
            </div>
          )}
        </section>

        {/* ── 진행 타임라인 ── */}
        <section className="rounded-2xl border border-border bg-bg-secondary p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            진행 상황
          </h2>
          {isCancelled && (
            <div
              className={`mb-3 rounded-xl border px-3 py-3 text-sm ${
                isRefunded
                  ? 'border-pink-500/30 bg-pink-500/10 text-pink-100'
                  : 'border-danger-500/30 bg-danger-500/10 text-danger-100'
              }`}
            >
              <div className="font-semibold text-foreground">
                {isRefunded ? '환불이 완료되었어요.' : '주문이 취소되었어요.'}
              </div>
              <div className="mt-1 text-xs leading-5 text-text-secondary">
                {isRefunded
                  ? '결제 수단에 따라 환불 반영까지 영업일 기준 며칠 더 걸릴 수 있어요.'
                  : '해당 주문은 더 이상 진행되지 않으며, 필요하면 아래 문의 정보로 매장에 연락하실 수 있어요.'}
              </div>
            </div>
          )}
          <div className="relative pl-6">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
            {timeline.map((step, idx) => {
              const isCurrent = step.state === 'current';
              const isDone = step.state === 'done';
              const isCancelledStep = step.id === 'CANCELLED';
              const isRefundedStep = step.id === 'REFUNDED';
              const dotClass = isDone
                ? 'bg-success-500 border-success-500'
                : isCurrent
                  ? isCancelledStep
                    ? 'bg-danger-500 border-danger-500'
                    : isRefundedStep
                      ? 'bg-pink-500 border-pink-500'
                      : 'bg-primary-500 border-primary-500'
                  : 'bg-bg-tertiary border-border';

              return (
                <div
                  key={step.id}
                  className={
                    idx === timeline.length - 1 ? 'relative' : 'relative pb-4'
                  }
                >
                  <div
                    className={`absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full border-2 ${dotClass} ${
                      isCurrent && step.id === 'READY' ? 'animate-pulse' : ''
                    }`}
                  />
                  <div
                    className={`rounded-xl border p-3 ${
                      isCurrent
                        ? isCancelledStep
                          ? 'border-danger-500/40 bg-danger-500/10'
                          : isRefundedStep
                            ? 'border-pink-500/40 bg-pink-500/10'
                            : step.id === 'READY'
                           ? 'border-success-500/50 bg-success-500/10'
                           : 'border-primary-500/50 bg-primary-500/10'
                        : isDone
                          ? 'border-success-500/30 bg-success-500/5'
                          : 'border-border bg-background'
                    }`}
                  >
                    <div className="text-sm font-semibold text-foreground">
                      {step.title}
                    </div>
                    <div className="mt-1 text-xs text-text-secondary">
                      {step.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 취소된 경우: 다시 주문하기 ── */}
        {isCancelled && order.branchId && (
          <section className="rounded-2xl border border-border bg-bg-secondary p-4">
            <p className="text-sm text-text-secondary mb-3">
              다시 주문하시겠어요?
            </p>
            <Link
              href={`/order/branch/${order.branchId}`}
              className="no-underline"
            >
              <button className="w-full py-3 rounded-xl bg-foreground text-background font-bold text-sm cursor-pointer">
                메뉴로 돌아가기
              </button>
            </Link>
          </section>
        )}

        {/* ── 결제 안내 ── */}
        <section className="rounded-2xl border border-border bg-bg-secondary p-4">
          <h2 className="text-sm font-semibold text-foreground mb-2">
            {guide.title}
          </h2>
          <div className="text-xs text-text-secondary leading-5">
            {guide.description}
          </div>
          <div className="mt-3 rounded-lg border border-border bg-background px-3 py-3">
            <div className="text-xs font-semibold text-foreground">
              {refundNotice.title}
            </div>
            <p className="mt-1 text-xs leading-5 text-text-secondary">
              {refundNotice.summary}
            </p>
            <div className="mt-2 space-y-2">
              {refundNotice.items.map((item) => (
                <div
                  key={item}
                  className="rounded-lg bg-bg-tertiary px-3 py-2 text-xs leading-5 text-text-secondary"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
          {order.paymentMethod === 'TRANSFER' && order.transferAccount ? (
            <div className="mt-3 rounded-lg bg-bg-tertiary px-3 py-2.5 text-xs text-text-secondary leading-6">
              <div className="font-semibold text-foreground mb-1">
                입금 계좌 정보
              </div>
              <div>
                은행명:{' '}
                <span className="font-medium text-foreground">
                  {order.transferAccount.bankName?.trim() || '-'}
                </span>
              </div>
              <div>
                계좌번호:{' '}
                <span className="font-medium text-foreground">
                  {order.transferAccount.accountNumber?.trim() || '-'}
                </span>
              </div>
              <div>
                예금주:{' '}
                <span className="font-medium text-foreground">
                  {order.transferAccount.accountHolder?.trim() || '-'}
                </span>
              </div>
            </div>
          ) : null}
          <div className="mt-3 text-xs text-text-tertiary">
            결제수단: {paymentMethodLabel(order.paymentMethod)} · 주문방식:{' '}
            {fulfillmentTypeLabel(order.fulfillmentType)}
          </div>
        </section>

        {/* ── 주문자 정보 ── */}
        <section className="rounded-2xl border border-border bg-bg-secondary p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            주문 정보
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-text-tertiary">이름</span>
              <span className="text-foreground text-right">
                {order.customerName ?? '-'}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-text-tertiary">연락처</span>
              <span className="text-foreground text-right">
                {order.customerPhone ?? '-'}
              </span>
            </div>
            {(order.customerAddress1 || order.customerAddress2) && (
              <div className="flex justify-between gap-3">
                <span className="text-text-tertiary">주소</span>
                <span className="text-foreground text-right">
                  {[order.customerAddress1, order.customerAddress2]
                    .filter(Boolean)
                    .join(' ')}
                </span>
              </div>
            )}
            {order.customerMemo && (
              <div className="flex justify-between gap-3">
                <span className="text-text-tertiary">요청사항</span>
                <span className="text-foreground text-right">
                  {order.customerMemo}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* ── 주문 내역 ── */}
        <section className="rounded-2xl border border-border bg-bg-secondary p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            주문 내역
          </h2>
          <div className="space-y-2">
            {order.items.map((item, idx) => (
              <div
                key={`${item.name}-${idx}`}
                className="rounded-lg bg-background px-3 py-2"
              >
                <div className="flex justify-between gap-3">
                  <div className="text-sm text-foreground">
                    {item.name} × {item.qty}
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {formatWon(item.unitPrice * item.qty)}
                  </div>
                </div>
                {item.options.length > 0 ? (
                  <div className="mt-1 text-xs text-text-tertiary">
                    {item.options.join(', ')}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border flex justify-between">
            <span className="text-sm font-semibold text-foreground">
              총 결제금액
            </span>
            <span className="text-lg font-extrabold text-foreground">
              {formatWon(order.totalAmount)}
            </span>
          </div>
        </section>
        {showCancelAction && (
          <section className="rounded-2xl border border-danger-500/30 bg-danger-500/5 p-4">
            <div className="text-sm font-semibold text-foreground">
              주문 취소가 필요하신가요?
            </div>
            <p className="mt-1 text-xs leading-5 text-text-secondary">
              주문 접수 단계에서는 로그인 후 바로 취소할 수 있고, 그 이후 상태는 매장 문의로 빠르게 도와드리고 있습니다.
            </p>
            <button
              type="button"
              onClick={handleCancelAction}
              className="mt-3 w-full rounded-xl border-none bg-danger-500 px-4 py-3 text-sm font-bold text-white cursor-pointer hover:opacity-90 transition-opacity"
            >
              {cancelActionLabel}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
