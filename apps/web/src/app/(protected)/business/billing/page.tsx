'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CreditCard, Landmark, RefreshCw, WalletCards } from 'lucide-react';
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

type SubscriptionResponse = {
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'TRIAL';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextBillingAt: string;
  planName: string;
  planPrice: number;
  cardCompany?: string | null;
  cardNumber?: string | null;
  cardOwner?: string | null;
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
      return '체험 중';
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

export default function BusinessBillingPage() {
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [brandsError, setBrandsError] = useState<string | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [summary, setSummary] = useState<BillingSummaryResponse | null>(null);
  const [records, setRecords] = useState<BillingRecordResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const manageableBrands = useMemo(
    () =>
      brands.filter(
        (brand) => canManageBrand(brand.myRole) && brand.billing_tier === 'NON_PG',
      ),
    [brands],
  );
  const selectedBrand =
    manageableBrands.find((brand) => brand.id === selectedBrandId) ?? null;

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
      } catch (error) {
        if (!active) {
          return;
        }
        setBrandsError(
          parseApiErrorMessage(
            error,
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

    const loadBilling = async () => {
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

        const [subscriptionRes, summaryRes, recordsRes] = await Promise.all([
          apiClient
            .get<SubscriptionResponse>(
              `/billing/subscription?brandId=${encodeURIComponent(selectedBrand.id)}`,
            )
            .catch((error) => {
              if (isApiNotFound(error)) {
                return null;
              }
              throw error;
            }),
          apiClient
            .get<BillingSummaryResponse>(
              `/billing/summary?brandId=${encodeURIComponent(selectedBrand.id)}&months=6`,
            )
            .catch((error) => {
              if (isApiNotFound(error)) {
                return null;
              }
              throw error;
            }),
          apiClient
            .get<BillingRecordResponse[]>(
              `/billing/records?brandId=${encodeURIComponent(selectedBrand.id)}&limit=12`,
            )
            .catch((error) => {
              if (isApiNotFound(error)) {
                return [];
              }
              throw error;
            }),
        ]);

        if (!active) {
          return;
        }

        setSubscription(subscriptionRes);
        setSummary(summaryRes);
        setRecords(recordsRes);
      } catch (error) {
        if (!active) {
          return;
        }
        setError(
          parseApiErrorMessage(
            error,
            '구독 빌링 정보를 불러오지 못했습니다.',
          ),
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadBilling();

    return () => {
      active = false;
    };
  }, [selectedBrand]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/business/payments"
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-text-secondary no-underline transition-colors hover:text-foreground"
          >
            <ArrowLeft size={16} />
            결제 운영 허브로 돌아가기
          </Link>
          <h1 className="mt-3 text-2xl font-black text-foreground">
            무통장 전용 브랜드 빌링
          </h1>
          <p className="mt-2 text-[13px] leading-6 text-text-secondary">
            카드 등록 여부, 월 이용료, 최근 청구 내역을 한 화면에서 확인합니다.
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
            운영 중인 무통장 전용 브랜드가 없습니다. PG 이용 브랜드는
            <Link href="/business/settlement" className="ml-1 font-semibold text-foreground">
              정산 화면
            </Link>
            에서 확인할 수 있습니다.
          </CardContent>
        </Card>
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
              label="월 이용료"
              value={subscription ? formatWon(subscription.planPrice) : '-'}
              icon={Landmark}
            />
            <MetricCard
              label="최근 6개월 결제 합계"
              value={formatWon(summary?.totalSuccessAmount ?? 0)}
              icon={CreditCard}
            />
            <MetricCard
              label="실패 건수"
              value={String(summary?.totalFailedCount ?? 0)}
              icon={RefreshCw}
            />
          </section>

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
                  value={subscription?.planName ?? '아직 등록된 플랜이 없습니다'}
                />
                <InfoRow
                  label="결제 카드"
                  value={
                    subscription?.cardCompany && subscription?.cardNumber
                      ? `${subscription.cardCompany} ${subscription.cardNumber}`
                      : '아직 등록된 카드가 없습니다'
                  }
                />
                <InfoRow
                  label="정기 결제 주기"
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
                <div className="rounded-2xl border border-border bg-background px-4 py-4 text-[13px] leading-6 text-text-secondary">
                  카드 등록과 구독 상태를 먼저 확인해두면 운영 문의에 대응하기 훨씬
                  쉬워집니다. 이후 카드 교체 UI가 들어와도 같은 흐름 위에서 자연스럽게
                  이어갈 수 있도록 정리해둔 화면입니다.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-2 flex items-center gap-2">
                  <CreditCard size={18} className="text-text-secondary" />
                  <CardTitle className="mb-0">최근 청구 건강도</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow
                  label="최근 성공 결제"
                  value={summary?.lastPaidAt ? formatDateTimeFull(summary.lastPaidAt) : '-'}
                />
                <InfoRow
                  label="다음 청구 시각"
                  value={
                    summary?.nextBillingAt
                      ? formatDateTimeFull(summary.nextBillingAt)
                      : subscription?.nextBillingAt
                        ? formatDateTimeFull(subscription.nextBillingAt)
                        : '-'
                  }
                />
                <InfoRow label="조회 기준" value="최근 6개월" />
                <div className="rounded-2xl border border-border bg-background px-4 py-4 text-[13px] leading-6 text-text-secondary">
                  실패 건수가 늘어나면 카드 상태를 먼저 확인해 주세요. 자동 재시도는
                  백엔드 배치가 처리하고, 이 화면은 운영자가 현재 상태를 빠르게 확인하는
                  데 집중합니다.
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
                  아직 기록된 청구 내역이 없습니다.
                </div>
              ) : (
                records.map((record) => (
                  <div
                    key={record.id}
                    className="grid gap-3 rounded-2xl border border-border bg-background px-4 py-4 md:grid-cols-[1.1fr_0.8fr_0.8fr_auto]"
                  >
                    <div>
                      <div className="text-[13px] font-black text-foreground">
                        {record.billingPeriodStart} ~ {record.billingPeriodEnd}
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
