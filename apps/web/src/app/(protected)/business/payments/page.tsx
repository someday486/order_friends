'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CreditCard,
  Landmark,
  ReceiptText,
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

type SubscriptionResponse = {
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'TRIAL';
  nextBillingAt: string;
  planName: string;
  planPrice: number;
  cardCompany?: string | null;
  cardNumber?: string | null;
};

type BillingSummaryResponse = {
  totalSuccessAmount: number;
  totalFailedCount: number;
  lastPaidAt?: string | null;
  nextBillingAt?: string | null;
};

type SettlementSummaryResponse = {
  totalSales: number;
  totalRefunds: number;
  totalCommission: number;
  totalNetSettlement: number;
};

type SettlementPeriodResponse = {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: 'PENDING' | 'CALCULATED' | 'SETTLED';
  netSettlement: number;
  settledAt?: string | null;
};

type OverviewState =
  | {
      kind: 'PG';
      summary: SettlementSummaryResponse;
      latestPeriod: SettlementPeriodResponse | null;
    }
  | {
      kind: 'NON_PG';
      subscription: SubscriptionResponse | null;
      summary: BillingSummaryResponse | null;
    }
  | null;

function canManageBrand(role: string | null | undefined) {
  return role === 'OWNER' || role === 'ADMIN';
}

function getBillingTierLabel(tier: BillingTier | null | undefined) {
  return tier === 'NON_PG' ? '무통장 전용' : 'PG 이용';
}

function getSubscriptionStatusLabel(
  status: SubscriptionResponse['status'] | null | undefined,
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
    default:
      return '-';
  }
}

function getPeriodStatusLabel(
  status: SettlementPeriodResponse['status'] | null | undefined,
) {
  switch (status) {
    case 'PENDING':
      return '집계 대기';
    case 'CALCULATED':
      return '정산 계산 완료';
    case 'SETTLED':
      return '정산 완료';
    default:
      return '-';
  }
}

function isApiNotFound(error: unknown) {
  return error instanceof Error && error.message.includes('API Error: 404');
}

export default function BusinessPaymentsPage() {
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [brandsError, setBrandsError] = useState<string | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [overview, setOverview] = useState<OverviewState>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const manageableBrands = useMemo(
    () => brands.filter((brand) => canManageBrand(brand.myRole)),
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
        const firstManageable = rows.find((brand) => canManageBrand(brand.myRole));
        setSelectedBrandId((current) => current || firstManageable?.id || '');
      } catch (error) {
        if (!active) {
          return;
        }
        setBrandsError(
          parseApiErrorMessage(
            error,
            '브랜드 목록을 불러오지 못했습니다.',
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

    const loadOverview = async () => {
      if (!selectedBrand) {
        setOverview(null);
        setOverviewError(null);
        return;
      }

      try {
        setOverviewLoading(true);
        setOverviewError(null);

        if (selectedBrand.billing_tier === 'NON_PG') {
          const [subscription, summary] = await Promise.all([
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
          ]);

          if (!active) {
            return;
          }

          setOverview({
            kind: 'NON_PG',
            subscription,
            summary,
          });
          return;
        }

        const [summary, periods] = await Promise.all([
          apiClient.get<SettlementSummaryResponse>(
            `/settlement/summary?brandId=${encodeURIComponent(selectedBrand.id)}&months=6`,
          ),
          apiClient.get<SettlementPeriodResponse[]>(
            `/settlement/periods?brandId=${encodeURIComponent(selectedBrand.id)}&limit=1`,
          ),
        ]);

        if (!active) {
          return;
        }

        setOverview({
          kind: 'PG',
          summary,
          latestPeriod: periods[0] ?? null,
        });
      } catch (error) {
        if (!active) {
          return;
        }
        setOverview(null);
        setOverviewError(
          parseApiErrorMessage(
            error,
            '결제 운영 정보를 불러오지 못했습니다.',
          ),
        );
      } finally {
        if (active) {
          setOverviewLoading(false);
        }
      }
    };

    void loadOverview();

    return () => {
      active = false;
    };
  }, [selectedBrand]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section className="rounded-[28px] border border-border bg-[linear-gradient(135deg,_rgba(245,158,11,0.12),_rgba(255,255,255,0)),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.18),_transparent_32%)] p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-text-tertiary">
              Payment Operations
            </div>
            <h1 className="mt-3 text-2xl font-black leading-tight tracking-tight text-foreground md:text-3xl">
              브랜드별 결제 운영 방식과
              <br className="hidden md:block" /> 정산 흐름을 한 화면에서 확인하세요.
            </h1>
            <p className="mt-4 max-w-2xl text-[13px] leading-6 text-text-secondary md:text-sm">
              PG 이용 브랜드는 정산 중심으로, 무통장 전용 브랜드는 월 구독 빌링 중심으로
              관리할 수 있게 정리했습니다. 현재 브랜드에 맞는 화면으로 바로 이동할 수
              있습니다.
            </p>
          </div>

          <Card className="border-border/80 bg-background/80" padding="lg">
            <CardHeader className="mb-3">
              <CardTitle className="mb-0 text-base">조회할 브랜드</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="block text-[13px] font-semibold text-text-secondary">
                운영 브랜드 선택
              </label>
              <select
                value={selectedBrandId}
                onChange={(event) => setSelectedBrandId(event.target.value)}
                className="input-field"
                disabled={brandsLoading || manageableBrands.length === 0}
              >
                {manageableBrands.length === 0 ? (
                  <option value="">운영 가능한 브랜드가 없습니다</option>
                ) : null}
                {manageableBrands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name} · {getBillingTierLabel(brand.billing_tier)}
                  </option>
                ))}
              </select>
              {selectedBrand ? (
                <div className="rounded-2xl border border-border bg-bg-secondary px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-text-tertiary">
                    Billing Tier
                  </div>
                  <div className="mt-2 text-[15px] font-black text-foreground">
                    {getBillingTierLabel(selectedBrand.billing_tier)}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>

      {brandsError ? <ErrorCard message={brandsError} /> : null}

      {selectedBrand ? (
        <section className="grid gap-4 xl:grid-cols-2">
          <LinkCard
            href="/business/billing"
            icon={WalletCards}
            title="월 구독 / 빌링 관리"
            description="무통장 전용 브랜드의 카드 등록 상태, 구독 상태, 최근 청구 내역을 확인합니다."
            emphasis={
              selectedBrand.billing_tier === 'NON_PG'
                ? '현재 선택한 브랜드에 맞는 기본 운영 화면입니다.'
                : 'PG 브랜드는 이 화면보다 정산 화면 사용 빈도가 더 높습니다.'
            }
          />
          <LinkCard
            href="/business/settlement"
            icon={ReceiptText}
            title="PG 정산 관리"
            description="PG 이용 브랜드의 월별 정산 기간, 수수료, 정산 예정 금액을 확인합니다."
            emphasis={
              selectedBrand.billing_tier === 'PG'
                ? '현재 선택한 브랜드에 맞는 기본 운영 화면입니다.'
                : '무통장 전용 브랜드는 이 화면보다 빌링 화면이 더 중요합니다.'
            }
          />
        </section>
      ) : null}

      {overviewError ? <ErrorCard message={overviewError} /> : null}

      {overviewLoading ? (
        <div className="rounded-2xl border border-border bg-bg-secondary p-6 text-sm text-text-secondary">
          최신 결제 운영 정보를 불러오는 중입니다.
        </div>
      ) : null}

      {selectedBrand && overview ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          {overview.kind === 'NON_PG' ? (
            <>
              <Card>
                <CardHeader>
                  <div className="mb-2 flex items-center gap-2">
                    <WalletCards size={18} className="text-text-secondary" />
                    <CardTitle className="mb-0">무통장 전용 브랜드 빌링 요약</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <MetricCard
                    label="구독 상태"
                    value={getSubscriptionStatusLabel(overview.subscription?.status)}
                    icon={CreditCard}
                  />
                  <MetricCard
                    label="월 이용료"
                    value={
                      overview.subscription
                        ? formatWon(overview.subscription.planPrice)
                        : '-'
                    }
                    icon={Landmark}
                  />
                  <MetricCard
                    label="최근 6개월 결제 합계"
                    value={formatWon(overview.summary?.totalSuccessAmount ?? 0)}
                    icon={ReceiptText}
                  />
                  <MetricCard
                    label="실패 건수"
                    value={String(overview.summary?.totalFailedCount ?? 0)}
                    icon={CreditCard}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="mb-2 flex items-center gap-2">
                    <CreditCard size={18} className="text-text-secondary" />
                    <CardTitle className="mb-0">결제 수단 요약</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-[13px] text-text-secondary">
                  <InfoRow
                    label="등록 카드"
                    value={
                      overview.subscription?.cardCompany && overview.subscription?.cardNumber
                        ? `${overview.subscription.cardCompany} ${overview.subscription.cardNumber}`
                        : '아직 등록된 카드가 없습니다'
                    }
                  />
                  <InfoRow
                    label="다음 결제일"
                    value={
                      overview.subscription?.nextBillingAt
                        ? formatDateTimeFull(overview.subscription.nextBillingAt)
                        : '-'
                    }
                  />
                  <InfoRow
                    label="최근 결제 시각"
                    value={
                      overview.summary?.lastPaidAt
                        ? formatDateTimeFull(overview.summary.lastPaidAt)
                        : '-'
                    }
                  />
                  <div className="rounded-2xl border border-border bg-background px-4 py-4">
                    <div className="text-[13px] font-semibold text-foreground">
                      운영 메모
                    </div>
                    <div className="mt-2 leading-6">
                      무통장 전용 브랜드는 주문 결제와 별개로 월 이용료를 청구합니다.
                      카드 등록과 구독 상태를 먼저 확인해 두면 운영 문의 대응이 훨씬
                      수월합니다.
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="mb-2 flex items-center gap-2">
                    <ReceiptText size={18} className="text-text-secondary" />
                    <CardTitle className="mb-0">PG 브랜드 정산 요약</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <MetricCard
                    label="최근 6개월 총 매출"
                    value={formatWon(overview.summary.totalSales)}
                    icon={Landmark}
                  />
                  <MetricCard
                    label="최근 6개월 총 환불"
                    value={formatWon(overview.summary.totalRefunds)}
                    icon={CreditCard}
                  />
                  <MetricCard
                    label="최근 6개월 총 수수료"
                    value={formatWon(overview.summary.totalCommission)}
                    icon={ReceiptText}
                  />
                  <MetricCard
                    label="정산 예정 합계"
                    value={formatWon(overview.summary.totalNetSettlement)}
                    icon={WalletCards}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="mb-2 flex items-center gap-2">
                    <CreditCard size={18} className="text-text-secondary" />
                    <CardTitle className="mb-0">가장 최근 정산 기간</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-[13px] text-text-secondary">
                  <InfoRow
                    label="정산 상태"
                    value={getPeriodStatusLabel(overview.latestPeriod?.status)}
                  />
                  <InfoRow
                    label="기간"
                    value={
                      overview.latestPeriod
                        ? `${overview.latestPeriod.periodStart} ~ ${overview.latestPeriod.periodEnd}`
                        : '아직 계산된 정산 기간이 없습니다'
                    }
                  />
                  <InfoRow
                    label="정산 예정 금액"
                    value={formatWon(overview.latestPeriod?.netSettlement ?? 0)}
                  />
                  <InfoRow
                    label="정산 완료 시각"
                    value={
                      overview.latestPeriod?.settledAt
                        ? formatDateTimeFull(overview.latestPeriod.settledAt)
                        : '-'
                    }
                  />
                  <div className="rounded-2xl border border-border bg-background px-4 py-4">
                    <div className="text-[13px] font-semibold text-foreground">
                      운영 메모
                    </div>
                    <div className="mt-2 leading-6">
                      PG 브랜드는 매출 건별 수수료를 기준으로 정산 기간이 계산됩니다.
                      자세한 기간별 내역은 정산 상세 화면에서 계속 확인할 수 있습니다.
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </section>
      ) : null}

      {!brandsLoading && manageableBrands.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-[13px] text-text-secondary">
            운영 가능한 브랜드가 아직 없습니다. 브랜드 OWNER 또는 ADMIN 권한이 있는
            브랜드가 연결되면 결제 운영 화면을 사용할 수 있습니다.
          </CardContent>
        </Card>
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
    <div className="rounded-2xl border border-border bg-background px-4 py-4">
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

function LinkCard({
  href,
  icon: Icon,
  title,
  description,
  emphasis,
}: {
  href: string;
  icon: typeof CreditCard;
  title: string;
  description: string;
  emphasis: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-border bg-bg-secondary p-5 no-underline transition-colors hover:bg-bg-tertiary"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background text-foreground">
          <Icon size={20} />
        </div>
        <ArrowRight
          size={18}
          className="text-text-tertiary transition-transform group-hover:translate-x-0.5"
        />
      </div>
      <div className="mt-4 text-[16px] font-black text-foreground">{title}</div>
      <div className="mt-2 text-[13px] leading-6 text-text-secondary">
        {description}
      </div>
      <div className="mt-4 rounded-2xl border border-border bg-background px-4 py-3 text-[13px] leading-6 text-text-secondary">
        {emphasis}
      </div>
    </Link>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-background px-4 py-4 md:flex-row md:items-center md:justify-between">
      <div className="text-text-tertiary">{label}</div>
      <div className="font-semibold text-foreground">{value}</div>
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
