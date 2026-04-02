'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import {
  clearCheckoutDraft,
  clearPendingPaymentRecord,
  loadPendingPaymentRecord,
  saveLastOrderRecord,
} from '@/lib/order-session';

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return '결제 확인에 실패했습니다.';
}

export default function OrderPaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentKey = searchParams.get('paymentKey');
  const orderId = searchParams.get('orderId');
  const amountParam = searchParams.get('amount');
  const amount = Number(amountParam ?? '0');
  const pendingPayment = useMemo(
    () => loadPendingPaymentRecord({ orderId }),
    [orderId],
  );
  const fallbackHref = useMemo(() => {
    if (!orderId) {
      return pendingPayment?.completePath ?? '/';
    }

    if (pendingPayment?.completePath) {
      return `${pendingPayment.completePath}?orderId=${encodeURIComponent(orderId)}`;
    }

    return `/order/track/${orderId}`;
  }, [orderId, pendingPayment?.completePath]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const completeHref = fallbackHref;

    if (!paymentKey || !orderId || !Number.isFinite(amount) || amount <= 0) {
      setError('결제 결과 정보가 올바르지 않습니다.');
      return;
    }

    let cancelled = false;

    const confirmPayment = async () => {
      try {
        await apiClient.post(
          '/payments/confirm',
          {
            orderId,
            paymentKey,
            amount,
          },
          { auth: false },
        );

        const latestOrder = await apiClient
          .get(`/public/orders/${orderId}`, { auth: false })
          .catch(() => null);

        if (cancelled) return;

        if (latestOrder) {
          saveLastOrderRecord({
            order: latestOrder,
            branchId: pendingPayment?.branchId,
            brandSlug: pendingPayment?.brandSlug,
            branchSlug: pendingPayment?.branchSlug,
            cartSnapshot: pendingPayment?.cartSnapshot ?? null,
          });
        }

        clearCheckoutDraft();
        clearPendingPaymentRecord();
        router.replace(completeHref);
      } catch (nextError: unknown) {
        if (cancelled) return;
        setError(getErrorMessage(nextError));
      }
    };

    void confirmPayment();

    return () => {
      cancelled = true;
    };
  }, [amount, fallbackHref, orderId, paymentKey, pendingPayment, router]);

  if (!error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-foreground" />
          <h1 className="text-lg font-bold">결제를 확인하는 중입니다.</h1>
          <p className="text-sm text-text-secondary">
            잠시만 기다리시면 주문 완료 페이지로 이동합니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-bg-secondary p-6 text-center">
        <h1 className="text-lg font-bold">결제 확인에 실패했습니다.</h1>
        <p className="mt-2 text-sm text-text-secondary">{error}</p>
        <Link
          href={fallbackHref}
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-background no-underline"
        >
          주문 페이지로 이동
        </Link>
      </div>
    </div>
  );
}
