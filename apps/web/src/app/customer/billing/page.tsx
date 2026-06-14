'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  CreditCard,
  Landmark,
  RefreshCw,
  WalletCards,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { apiClient } from '@/lib/api-client';
import { parseApiErrorMessage } from '@/lib/api-error';
import { formatDateTimeFull, formatWon } from '@/lib/format';

type BillingTier = 'PG' | 'NON_PG';

type BrandOption = {
  id: string;
  name: string;
  billing_tier?: BillingTier | null;
  myRole?: string | null;
};

type SubscriptionPlanOptionResponse = {
  id: string;
  name: string;
  price: number;
  maxMonthlyOrders: number | null;
  isCurrent: boolean;
};

type SubscriptionResponse = {
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'TRIAL';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextBillingAt: string;
  planName: string;
  planPrice: number;
  planMaxMonthlyOrders: number | null;
  cardCompany?: string | null;
  cardNumber?: string | null;
  cardOwner?: string | null;
  hasPaymentMethod: boolean;
  currentOrderCount: number;
  hasExceededLimit: boolean;
  availablePlans: SubscriptionPlanOptionResponse[];
  scheduledPlanName?: string | null;
  scheduledPlanPrice?: number | null;
  scheduledPlanMaxMonthlyOrders?: number | null;
  scheduledPlanEffectiveAt?: string | null;
};

type BillingSummaryResponse = {
  totalSuccessAmount: number;
  totalFailedCount: number;
  lastPaidAt?: string | null;
  nextBillingAt?: string | null;
};

type BillingRecordResponse = {
  id: string;
  amount: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
  provider: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  attemptedAt?: string | null;
  paidAt?: string | null;
  failureReason?: string | null;
  retryCount: number;
  createdAt: string;
};

type ChangePlanResponse = {
  effectiveDate: string;
  proratedAmount?: number;
  newPlan: SubscriptionPlanOptionResponse;
};

function canManageBrand(role: string | null | undefined) {
  return role === 'OWNER' || role === 'ADMIN';
}

function getStatusLabel(
  status:
    | SubscriptionResponse['status']
    | BillingRecordResponse['status']
    | null
    | undefined,
) {
  switch (status) {
    case 'ACTIVE':
      return '정상 이용 중';
    case 'PAST_DUE':
      return '미납 또는 재시도 예정';
    case 'CANCELLED':
      return '해지됨';
    case 'TRIAL':
      return '무료 체험 중';
    case 'PENDING':
      return '청구 예정';
    case 'SUCCESS':
      return '결제 완료';
    case 'FAILED':
      return '결제 실패';
    case 'REFUNDED':
      return '환불 완료';
    default:
      return '-';
  }
}

function getStatusClass(
  status:
    | SubscriptionResponse['status']
    | BillingRecordResponse['status']
    | null
    | undefined,
) {
  switch (status) {
    case 'ACTIVE':
    case 'SUCCESS':
      return 'bg-success/15 text-success';
    case 'PAST_DUE':
    case 'FAILED':
      return 'bg-danger-500/15 text-danger-500';
    case 'TRIAL':
    case 'PENDING':
      return 'bg-warning-500/15 text-warning-500';
    case 'CANCELLED':
    case 'REFUNDED':
      return 'bg-text-tertiary/15 text-text-secondary';
    default:
      return 'bg-bg-tertiary text-text-secondary';
  }
}

function isApiNotFound(error: unknown) {
  return error instanceof Error && error.message.includes('API Error: 404');
}

function formatUsageLabel(subscription: SubscriptionResponse | null) {
  if (!subscription) {
    return '-';
  }

  if (subscription.planMaxMonthlyOrders === null) {
    return `${subscription.currentOrderCount}건 / 무제한`;
  }

  return `${subscription.currentOrderCount}건 / ${subscription.planMaxMonthlyOrders}건`;
}

function formatPlanLimit(limit: number | null | undefined) {
  return limit === null || limit === undefined ? '월 주문 무제한' : `월 ${limit}건`;
}

export default function CustomerBillingPage() {
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [brandsError, setBrandsError] = useState<string | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(
    null,
  );
  const [summary, setSummary] = useState<BillingSummaryResponse | null>(null);
  const [records, setRecords] = useState<BillingRecordResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changingPlanId, setChangingPlanId] = useState<string | null>(null);

  const manageableBrands = useMemo(
    () =>
      brands.filter(
        (brand) => canManageBrand(brand.myRole) && brand.billing_tier === 'NON_PG',
      ),
    [brands],
  );
  const selectedBrand =
    manageableBrands.find((brand) => brand.id === selectedBrandId) ?? null;

  const loadBilling = async (brandId: string) => {
    const [subscriptionRes, summaryRes, recordsRes] = await Promise.all([
      apiClient
        .get<SubscriptionResponse>(
          `/billing/subscription?brandId=${encodeURIComponent(brandId)}`,
        )
        .catch((fetchError) => {
          if (isApiNotFound(fetchError)) {
            return null;
          }
          throw fetchError;
        }),
      apiClient
        .get<BillingSummaryResponse>(
          `/billing/summary?brandId=${encodeURIComponent(brandId)}&months=6`,
        )
        .catch((fetchError) => {
          if (isApiNotFound(fetchError)) {
            return null;
          }
          throw fetchError;
        }),
      apiClient
        .get<BillingRecordResponse[]>(
          `/billing/records?brandId=${encodeURIComponent(brandId)}&limit=12`,
        )
        .catch((fetchError) => {
          if (isApiNotFound(fetchError)) {
            return [];
          }
          throw fetchError;
        }),
    ]);

    setSubscription(subscriptionRes);
    setSummary(summaryRes);
    setRecords(recordsRes);
  };

  useEffect(() => {
    let active = true;

    const loadBrands = async () => {
      try {
        setBrandsLoading(true);
        setBrandsError(null);
        const rows = await apiClient.get<BrandOption[]>('/customer/brands');
        if (!active) {
          return;
        }

        setBrands(rows);
        const firstManageable = rows.find(
          (brand) =>
            canManageBrand(brand.myRole) && brand.billing_tier === 'NON_PG',
        );
        setSelectedBrandId((current) => current || firstManageable?.id || '');
      } catch (loadError) {
        if (!active) {
          return;
        }
        setBrandsError(
          parseApiErrorMessage(
            loadError,
            '무통장 전용 브랜드 목록을 불러오지 못했습니다.',
          ),
        );
      } finally {
        if (active) {
          setBrandsLoading(false);
        }
      }
    };

    void loadBrands();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const fetchBilling = async () => {
      if (!selectedBrand) {
        setSubscription(null);
        setSummary(null);
        setRecords([]);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        await loadBilling(selectedBrand.id);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(
          parseApiErrorMessage(
            loadError,
            '브랜드 빌링 정보를 불러오지 못했습니다.',
          ),
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void fetchBilling();

    return () => {
      active = false;
    };
  }, [selectedBrand]);

  const handlePlanChange = async (planId: string) => {
    if (!selectedBrand || !subscription) {
      return;
    }

    try {
      setChangingPlanId(planId);
      const result = await apiClient.put<ChangePlanResponse>(
        '/billing/subscription/plan',
        {
          brandId: selectedBrand.id,
          planId,
        },
      );

      const message =
        result.proratedAmount && result.proratedAmount > 0
          ? `${result.newPlan.name} 플랜으로 즉시 업그레이드됐습니다. 오늘 추가 청구 금액은 ${formatWon(result.proratedAmount)}입니다.`
          : `${result.newPlan.name} 플랜 변경 요청이 저장됐습니다. 적용 시각은 ${formatDateTimeFull(result.effectiveDate)}입니다.`;
      toast.success(message);
      await loadBilling(selectedBrand.id);
    } catch (changeError) {
      toast.error(
        parseApiErrorMessage(changeError, '플랜 변경을 완료하지 못했습니다.'),
      );
    } finally {
      setChangingPlanId(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/customer/payments"
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-text-secondary no-underline transition-colors hover:text-foreground"
          >
            <ArrowLeft size={16} />
            주문 결제 화면으로 돌아가기
          </Link>
          <h1 className="mt-3 text-2xl font-black text-foreground">
            무통장 전용 브랜드 이용료/구독
          </h1>
          <p className="mt-2 text-[13px] leading-6 text-text-secondary">
            무료 체험, 등록 카드, 월 구독 상태와 청구 이력을 한 화면에서 확인할
            수 있습니다.
          </p>
        </div>

        <div className="min-w-[260px]">
          <label className="mb-2 block text-[13px] font-semibold text-text-secondary">
            브랜드 선택
          </label>
          <select
            value={selectedBrandId}
            onChange={(event) => setSelectedBrandId(event.target.value)}
            className="input-field"
            disabled={brandsLoading || manageableBrands.length === 0}
          >
            {manageableBrands.length === 0 ? (
              <option value="">무통장 전용 브랜드가 없습니다</option>
            ) : null}
            {manageableBrands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {brandsError ? <ErrorCard message={brandsError} /> : null}
      {error ? <ErrorCard message={error} /> : null}

      {!brandsLoading && manageableBrands.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-[13px] text-text-secondary">
            운영 중인 무통장 전용 브랜드가 없습니다. PG 이용 브랜드는{' '}
            <Link href="/customer/settlement" className="font-semibold text-foreground">
              정산 화면
            </Link>
            에서 확인할 수 있습니다.
          </CardContent>
        </Card>
      ) : null}

      {selectedBrand && subscription?.status === 'TRIAL' ? (
        <div className="rounded-2xl border border-warning-500/40 bg-warning-500/10 px-5 py-4 text-[13px] leading-6 text-warning-500">
          <div className="font-semibold">14일 무료 체험이 진행 중입니다.</div>
          <div className="mt-1">
            체험 종료 예정 시각: {formatDateTimeFull(subscription.currentPeriodEnd)}
          </div>
          <div className="mt-1 text-warning-600/90">
            체험이 끝나면 Starter 플랜 월 {formatWon(subscription.planPrice)}이
            자동 청구됩니다.
          </div>
        </div>
      ) : null}

      {selectedBrand ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <MetricCard
              label="구독 상태"
              value={getStatusLabel(subscription?.status)}
              icon={WalletCards}
            />
            <MetricCard
              label="현재 플랜"
              value={
                subscription
                  ? `${subscription.planName} · ${formatWon(subscription.planPrice)}`
                  : '-'
              }
              icon={Landmark}
            />
            <MetricCard
              label="이번 기간 사용량"
              value={formatUsageLabel(subscription)}
              icon={RefreshCw}
            />
            <MetricCard
              label="최근 6개월 결제 합계"
              value={formatWon(summary?.totalSuccessAmount ?? 0)}
              icon={CreditCard}
            />
          </section>

          {!subscription?.hasPaymentMethod ? (
            <Card>
              <CardContent className="flex flex-col gap-3 py-6 text-[13px] text-text-secondary md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-semibold text-foreground">
                    아직 등록된 결제 수단이 없습니다.
                  </div>
                  <div className="mt-1 leading-6">
                    카드 등록을 끝내야 무료 체험과 월 자동 결제가 정상적으로
                    이어지고, 무통장 전용 온라인샵이 공개됩니다.
                  </div>
                </div>
                <Link
                  href={`/customer/billing/setup?brandId=${encodeURIComponent(selectedBrand.id)}`}
                  className="btn-primary inline-flex items-center justify-center px-4 py-2 text-sm"
                >
                  카드 등록하러 가기
                </Link>
              </CardContent>
            </Card>
          ) : null}

          {subscription?.hasExceededLimit ? (
            <div className="rounded-2xl border border-danger-500/30 bg-danger-500/10 px-5 py-4 text-[13px] leading-6 text-danger-500">
              <div className="font-semibold">이번 기간 주문 한도를 초과했습니다.</div>
              <div className="mt-1">
                현재 플랜 한도는 {formatPlanLimit(subscription.planMaxMonthlyOrders)}
                이고, 이번 기간 사용량은 {subscription.currentOrderCount}건입니다.
              </div>
              <div className="mt-1">
                초과가 반복되면 상위 플랜으로 자동 예약 변경될 수 있습니다.
              </div>
            </div>
          ) : null}

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
            <Card>
              <CardHeader>
                <div className="mb-2 flex items-center gap-2">
                  <WalletCards size={18} className="text-text-secondary" />
                  <CardTitle className="mb-0">구독 상세</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow
                  label="플랜"
                  value={
                    subscription
                      ? `${subscription.planName} · ${formatPlanLimit(subscription.planMaxMonthlyOrders)}`
                      : '아직 등록된 플랜이 없습니다'
                  }
                />
                <InfoRow
                  label="등록 카드"
                  value={
                    subscription?.cardCompany && subscription?.cardNumber
                      ? `${subscription.cardCompany} ${subscription.cardNumber}`
                      : '아직 등록된 카드가 없습니다'
                  }
                />
                <InfoRow
                  label="현재 결제 기간"
                  value={
                    subscription
                      ? `${formatDateTimeFull(subscription.currentPeriodStart)} ~ ${formatDateTimeFull(subscription.currentPeriodEnd)}`
                      : '-'
                  }
                />
                <InfoRow
                  label="다음 결제 예정"
                  value={
                    subscription?.nextBillingAt
                      ? formatDateTimeFull(subscription.nextBillingAt)
                      : '-'
                  }
                />
                <InfoRow
                  label="예약된 플랜 변경"
                  value={
                    subscription?.scheduledPlanName &&
                    subscription.scheduledPlanEffectiveAt
                      ? `${subscription.scheduledPlanName} · ${formatDateTimeFull(subscription.scheduledPlanEffectiveAt)} 적용`
                      : '없음'
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-2 flex items-center gap-2">
                  <CreditCard size={18} className="text-text-secondary" />
                  <CardTitle className="mb-0">사용량과 플랜 변경</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow
                  label="이번 기간 주문"
                  value={formatUsageLabel(subscription)}
                />
                <InfoRow
                  label="최근 성공 결제"
                  value={summary?.lastPaidAt ? formatDateTimeFull(summary.lastPaidAt) : '-'}
                />
                <InfoRow
                  label="실패 건수"
                  value={`${summary?.totalFailedCount ?? 0}건`}
                />

                <div className="rounded-2xl border border-border bg-background px-4 py-4">
                  <div className="text-[13px] font-semibold text-foreground">
                    이용 가능한 플랜
                  </div>
                  <div className="mt-3 space-y-3">
                    {subscription?.availablePlans?.map((plan) => (
                      <div
                        key={plan.id}
                        className="flex flex-col gap-3 rounded-2xl border border-border px-4 py-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <div className="text-[13px] font-semibold text-foreground">
                            {plan.name}
                          </div>
                          <div className="mt-1 text-[13px] text-text-secondary">
                            {formatWon(plan.price)} · {formatPlanLimit(plan.maxMonthlyOrders)}
                          </div>
                        </div>
                        {plan.isCurrent ? (
                          <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">
                            현재 이용 중
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn-primary px-4 py-2 text-sm disabled:opacity-60"
                            disabled={
                              changingPlanId === plan.id || !subscription.hasPaymentMethod
                            }
                            onClick={() => handlePlanChange(plan.id)}
                          >
                            {changingPlanId === plan.id ? '변경 중...' : '이 플랜으로 변경'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <div className="mb-2 flex items-center gap-2">
                <CreditCard size={18} className="text-text-secondary" />
                <CardTitle className="mb-0">최근 빌링 기록</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="rounded-2xl border border-border bg-background px-4 py-5 text-[13px] text-text-secondary">
                  최근 빌링 기록을 불러오는 중입니다.
                </div>
              ) : records.length === 0 ? (
                <div className="rounded-2xl border border-border bg-background px-4 py-5 text-[13px] text-text-secondary">
                  아직 저장된 청구 이력이 없습니다.
                </div>
              ) : (
                records.map((record) => (
                  <div
                    key={record.id}
                    className="grid gap-3 rounded-2xl border border-border bg-background px-4 py-4 md:grid-cols-[1.1fr_0.8fr_0.8fr_auto]"
                  >
                    <div>
                      <div className="text-[13px] font-black text-foreground">
                        {formatDateTimeFull(record.billingPeriodStart)} ~{' '}
                        {formatDateTimeFull(record.billingPeriodEnd)}
                      </div>
                      <div className="mt-1 text-[13px] text-text-secondary">
                        생성 시각: {formatDateTimeFull(record.createdAt)}
                      </div>
                      {record.failureReason ? (
                        <div className="mt-2 text-[12px] text-danger-500">
                          실패 사유: {record.failureReason}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-[13px] text-text-secondary">
                      <div className="text-xs text-text-tertiary">청구 금액</div>
                      <div className="mt-1 font-semibold text-foreground">
                        {formatWon(record.amount)}
                      </div>
                    </div>
                    <div className="text-[13px] text-text-secondary">
                      <div className="text-xs text-text-tertiary">재시도 횟수</div>
                      <div className="mt-1 font-semibold text-foreground">
                        {record.retryCount}회
                      </div>
                    </div>
                    <div className="flex items-center justify-start md:justify-end">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(record.status)}`}
                      >
                        {getStatusLabel(record.status)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof CreditCard;
}) {
  return (
    <div className="rounded-2xl border border-border bg-bg-secondary p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
          {label}
        </div>
        <Icon size={18} className="text-text-secondary" />
      </div>
      <div className="mt-3 break-words text-xl font-black text-foreground">
        {value}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-background px-4 py-4 md:flex-row md:items-center md:justify-between">
      <div className="text-[13px] text-text-tertiary">{label}</div>
      <div className="text-[13px] font-semibold text-foreground">{value}</div>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-danger-500/40 bg-danger-500/10 px-5 py-4 text-[13px] text-danger-500">
      {message}
    </div>
  );
}
