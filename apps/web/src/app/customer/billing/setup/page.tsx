'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, CreditCard, LoaderCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSelectedBrand } from '@/hooks/useSelectedBrand';
import { apiClient } from '@/lib/api-client';
import { parseApiErrorMessage } from '@/lib/api-error';
import {
  getOrCreateTossCustomerKey,
  getTossWidgetClientKey,
} from '@/lib/toss-payment';

type BrandSummary = {
  id: string;
  name: string;
  billing_tier?: 'PG' | 'NON_PG' | null;
  myRole?: string | null;
};

type SubscriptionResponse = {
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'TRIAL';
  hasPaymentMethod: boolean;
};

function isApiNotFound(error: unknown) {
  return error instanceof Error && error.message.includes('API Error: 404');
}

export default function CustomerBillingSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { selectBrand } = useSelectedBrand();

  const brandId = searchParams.get('brandId')?.trim() ?? '';
  const authKey = searchParams.get('authKey')?.trim() ?? '';
  const returnedCustomerKey = searchParams.get('customerKey')?.trim() ?? '';
  const errorCode = searchParams.get('code')?.trim() ?? '';
  const errorMessage = searchParams.get('message')?.trim() ?? '';

  const [brand, setBrand] = useState<BrandSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tossClientKey = getTossWidgetClientKey();

  const fallbackCustomerKey = useMemo(() => {
    if (!brandId) {
      return null;
    }

    return getOrCreateTossCustomerKey(`brand-${brandId}`);
  }, [brandId]);

  useEffect(() => {
    if (!brandId) {
      setLoading(false);
      setError('브랜드 정보가 없어 결제 수단 등록 화면을 열 수 없습니다.');
      return;
    }

    let active = true;

    const loadSetupState = async () => {
      try {
        setLoading(true);
        setError(null);

        const brands = await apiClient.get<BrandSummary[]>('/customer/brands');
        if (!active) {
          return;
        }

        const currentBrand = brands.find((item) => item.id === brandId) ?? null;
        setBrand(currentBrand);
        selectBrand(brandId);

        if (!currentBrand) {
          setError('브랜드 정보를 찾을 수 없습니다.');
          return;
        }

        if (currentBrand.billing_tier !== 'NON_PG') {
          router.replace('/customer/payments');
          return;
        }

        const subscription = await apiClient
          .get<SubscriptionResponse>(
            `/billing/subscription?brandId=${encodeURIComponent(brandId)}`,
          )
          .catch((fetchError) => {
            if (isApiNotFound(fetchError)) {
              return null;
            }
            throw fetchError;
          });

        if (!active) {
          return;
        }

        if (subscription?.hasPaymentMethod) {
          router.replace('/customer/billing');
        }
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(
          parseApiErrorMessage(
            loadError,
            '결제 수단 등록 상태를 확인하지 못했습니다.',
          ),
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadSetupState();

    return () => {
      active = false;
    };
  }, [brandId, router, selectBrand]);

  useEffect(() => {
    if (!errorCode || !errorMessage) {
      return;
    }

    setError(`카드 등록에 실패했습니다. (${errorCode}) ${errorMessage}`);
  }, [errorCode, errorMessage]);

  useEffect(() => {
    if (!brandId || !authKey || !returnedCustomerKey) {
      return;
    }

    let active = true;

    const registerBillingKey = async () => {
      try {
        setSubmitting(true);
        setError(null);

        await apiClient.post('/billing/billing-key', {
          brandId,
          authKey,
          customerKey: returnedCustomerKey,
        });

        if (!active) {
          return;
        }

        toast.success('결제 수단을 등록했습니다. 14일 무료 체험이 시작됩니다.');
        router.replace('/customer/billing');
      } catch (registerError) {
        if (!active) {
          return;
        }
        setError(
          parseApiErrorMessage(
            registerError,
            '결제 수단 등록을 완료하지 못했습니다.',
          ),
        );
      } finally {
        if (active) {
          setSubmitting(false);
        }
      }
    };

    void registerBillingKey();

    return () => {
      active = false;
    };
  }, [authKey, brandId, returnedCustomerKey, router]);

  const handleOpenBillingAuth = async () => {
    if (!brandId || !fallbackCustomerKey) {
      setError('브랜드 정보가 없어 카드 등록을 진행할 수 없습니다.');
      return;
    }

    if (!tossClientKey) {
      setError('토스 결제 키가 설정되지 않았습니다.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const { loadTossPayments } = await import('@tosspayments/tosspayments-sdk');
      const tossPayments = await loadTossPayments(tossClientKey);
      const payment = tossPayments.payment({
        customerKey: fallbackCustomerKey,
      });
      const origin = window.location.origin;

      await payment.requestBillingAuth({
        method: 'CARD',
        customerEmail: user?.email ?? null,
        customerName: brand?.name ?? '브랜드 오너',
        successUrl: `${origin}/customer/billing/setup?brandId=${encodeURIComponent(brandId)}`,
        failUrl: `${origin}/customer/billing/setup?brandId=${encodeURIComponent(brandId)}`,
      });
    } catch (requestError) {
      setError(
        parseApiErrorMessage(
          requestError,
          '카드 등록 창을 여는 중 문제가 발생했습니다.',
        ),
      );
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4">
        <div className="rounded-2xl border border-border bg-bg-secondary px-6 py-5 text-center">
          <div className="text-sm font-semibold text-foreground">
            결제 수단 등록 상태를 확인하고 있어요.
          </div>
          <p className="mt-2 text-[13px] text-text-secondary">
            브랜드 정보와 무료 체험 시작 조건을 함께 확인하는 중입니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <div>
        <Link
          href="/customer/billing"
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-text-secondary no-underline transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} />
          빌링 화면으로 돌아가기
        </Link>
        <h1 className="mt-3 text-2xl font-black text-foreground">결제 수단 등록</h1>
        <p className="mt-2 text-[14px] leading-6 text-text-secondary">
          14일 무료 체험 후 월 ₩33,000부터 자동 결제됩니다. 카드 등록이
          끝나면 바로 브랜드 운영을 시작할 수 있어요.
        </p>
      </div>

      <section className="rounded-3xl border border-border bg-bg-secondary p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500">
            <CreditCard size={22} />
          </div>
          <div className="flex-1">
            <div className="text-lg font-black text-foreground">
              {brand?.name ?? '브랜드'} 카드 등록
            </div>
            <div className="mt-2 text-[13px] leading-6 text-text-secondary">
              토스 자동결제 등록창에서 카드를 등록하면 Starter 플랜 14일 무료
              체험이 바로 시작됩니다. 무료 체험이 끝나면 등록한 카드로 자동
              결제가 진행됩니다.
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-border bg-background px-4 py-4 text-[13px] leading-6 text-text-secondary">
          등록 완료 후에는 월 이용료, 주문 한도, 최근 청구 내역을 빌링 화면에서
          바로 확인할 수 있습니다.
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-[13px] text-danger-500">
            {error}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleOpenBillingAuth()}
            disabled={submitting}
            className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-60"
          >
            {submitting ? <LoaderCircle size={16} className="animate-spin" /> : null}
            {submitting ? '등록 중...' : '카드 등록하기'}
          </button>
          <Link
            href="/customer/payments"
            className="inline-flex items-center rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground no-underline transition-colors hover:bg-bg-tertiary"
          >
            나중에 할게요
          </Link>
        </div>
      </section>
    </div>
  );
}
