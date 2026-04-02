'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type {
  TossPaymentsWidgets,
  WidgetAgreementWidget,
  WidgetPaymentMethodWidget,
} from '@tosspayments/tosspayments-sdk';
import {
  getTossWidgetClientKey,
  getTossWidgetVariantKeys,
} from '@/lib/toss-payment';

export type TossPaymentWidgetRequest = {
  orderId: string;
  orderName: string;
  customerName?: string | null;
  customerMobilePhone?: string | null;
  successUrl: string;
  failUrl: string;
};

export type TossPaymentWidgetController = {
  requestPayment: (request: TossPaymentWidgetRequest) => Promise<void>;
};

type TossPaymentWidgetProps = {
  amount: number;
  customerKey: string | null;
  active: boolean;
  onReadyChange?: (controller: TossPaymentWidgetController | null) => void;
  onErrorChange?: (message: string | null) => void;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return '결제 위젯을 불러오지 못했습니다.';
}

export function TossPaymentWidget({
  amount,
  customerKey,
  active,
  onReadyChange,
  onErrorChange,
}: TossPaymentWidgetProps) {
  const clientKey = getTossWidgetClientKey();
  const variantKeys = getTossWidgetVariantKeys();
  const paymentMethodId = useId().replace(/[:]/g, '-');
  const agreementId = useId().replace(/[:]/g, '-');
  const widgetsRef = useRef<TossPaymentsWidgets | null>(null);
  const paymentMethodWidgetRef = useRef<WidgetPaymentMethodWidget | null>(null);
  const agreementWidgetRef = useRef<WidgetAgreementWidget | null>(null);
  const [loading, setLoading] = useState(false);
  const [widgetError, setWidgetError] = useState<string | null>(null);

  useEffect(() => {
    onErrorChange?.(widgetError);
  }, [onErrorChange, widgetError]);

  useEffect(() => {
    async function destroyWidgets() {
      const paymentMethodWidget = paymentMethodWidgetRef.current;
      const agreementWidget = agreementWidgetRef.current;

      paymentMethodWidgetRef.current = null;
      agreementWidgetRef.current = null;
      widgetsRef.current = null;
      onReadyChange?.(null);

      await Promise.allSettled([
        paymentMethodWidget?.destroy(),
        agreementWidget?.destroy(),
      ]);
    }

    if (!active) {
      setLoading(false);
      setWidgetError(null);
      void destroyWidgets();
      return;
    }

    if (!clientKey) {
      const message = '결제 위젯 키가 설정되지 않았습니다.';
      setWidgetError(message);
      onReadyChange?.(null);
      return;
    }

    if (!customerKey) {
      const message = '결제 고객 식별키를 만들지 못했습니다.';
      setWidgetError(message);
      onReadyChange?.(null);
      return;
    }

    let cancelled = false;
    const resolvedClientKey = clientKey;
    const resolvedCustomerKey = customerKey;

    async function initializeWidget() {
      setLoading(true);
      setWidgetError(null);
      onReadyChange?.(null);

      try {
        const { loadTossPayments } =
          await import('@tosspayments/tosspayments-sdk');
        const tossPayments = await loadTossPayments(resolvedClientKey);
        if (cancelled) return;

        const widgets = tossPayments.widgets({
          customerKey: resolvedCustomerKey,
        });
        await widgets.setAmount({ currency: 'KRW', value: amount });
        if (cancelled) return;

        const paymentMethodWidget = await widgets.renderPaymentMethods({
          selector: `#${paymentMethodId}`,
          variantKey: variantKeys.paymentMethod ?? undefined,
        });
        if (cancelled) {
          await paymentMethodWidget.destroy().catch(() => undefined);
          return;
        }

        const agreementWidget = await widgets.renderAgreement({
          selector: `#${agreementId}`,
          variantKey: variantKeys.agreement ?? undefined,
        });
        if (cancelled) {
          await Promise.allSettled([
            paymentMethodWidget.destroy(),
            agreementWidget.destroy(),
          ]);
          return;
        }

        widgetsRef.current = widgets;
        paymentMethodWidgetRef.current = paymentMethodWidget;
        agreementWidgetRef.current = agreementWidget;
        onReadyChange?.({
          requestPayment: async (request) => {
            const currentWidgets = widgetsRef.current;
            if (!currentWidgets) {
              throw new Error('결제 위젯이 아직 준비되지 않았습니다.');
            }

            await currentWidgets.requestPayment({
              orderId: request.orderId,
              orderName: request.orderName,
              customerName: request.customerName ?? undefined,
              customerMobilePhone: request.customerMobilePhone ?? undefined,
              successUrl: request.successUrl,
              failUrl: request.failUrl,
            });
          },
        });
      } catch (error: unknown) {
        if (cancelled) return;
        setWidgetError(getErrorMessage(error));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initializeWidget();

    return () => {
      cancelled = true;
      void destroyWidgets();
    };
  }, [
    active,
    agreementId,
    amount,
    clientKey,
    customerKey,
    onReadyChange,
    paymentMethodId,
    variantKeys.agreement,
    variantKeys.paymentMethod,
  ]);

  useEffect(() => {
    if (!active) return;
    if (!widgetsRef.current) return;

    void widgetsRef.current
      .setAmount({ currency: 'KRW', value: amount })
      .catch((error: unknown) => {
        setWidgetError(getErrorMessage(error));
      });
  }, [active, amount]);

  if (!active) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-2xl border border-border bg-bg-secondary p-4">
        <div className="mb-3 text-sm font-semibold text-foreground">
          카드 결제
        </div>
        <div
          id={paymentMethodId}
          className={loading ? 'min-h-[140px] opacity-60' : 'min-h-[140px]'}
        />
      </div>

      <div className="rounded-2xl border border-border bg-bg-secondary p-4">
        <div className="mb-3 text-sm font-semibold text-foreground">
          약관 동의
        </div>
        <div id={agreementId} className="min-h-[96px]" />
      </div>

      {loading && (
        <p className="text-xs text-text-tertiary">
          결제 위젯을 불러오는 중입니다.
        </p>
      )}

      {widgetError && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-500">
          {widgetError}
        </div>
      )}
    </div>
  );
}
