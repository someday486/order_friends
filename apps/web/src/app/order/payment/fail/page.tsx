'use client';

import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  clearPendingPaymentRecord,
  loadPendingPaymentRecord,
} from '@/lib/order-session';

function normalizeMessage(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export default function OrderPaymentFailPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const code = normalizeMessage(searchParams.get('code'));
  const message = normalizeMessage(searchParams.get('message'));

  const pendingPayment = useMemo(
    () => loadPendingPaymentRecord({ orderId }),
    [orderId],
  );

  const checkoutHref = pendingPayment?.checkoutPath ?? '/';
  const orderHref = orderId
    ? pendingPayment?.completePath
      ? `${pendingPayment.completePath}?orderId=${encodeURIComponent(orderId)}`
      : `/order/track/${orderId}`
    : '/';

  useEffect(() => {
    clearPendingPaymentRecord();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-bg-secondary p-6 text-center">
        <h1 className="text-lg font-bold">결제가 완료되지 않았습니다.</h1>
        <p className="mt-2 text-sm text-text-secondary">
          {message ??
            '결제가 중단되었거나 승인에 실패했습니다. 다시 시도해주세요.'}
        </p>
        {code && (
          <p className="mt-2 text-xs text-text-tertiary">오류 코드: {code}</p>
        )}
        <div className="mt-5 space-y-2">
          <Link
            href={checkoutHref}
            className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-background no-underline"
          >
            주문서로 돌아가기
          </Link>
          <Link
            href={orderHref}
            className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-border px-4 text-sm font-semibold text-foreground no-underline"
          >
            주문 상태 보기
          </Link>
        </div>
      </div>
    </div>
  );
}
