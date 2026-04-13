'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
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
  totalSales: number;
  totalRefunds: number;
  commissionRate: number;
  commissionAmount: number;
  netSettlement: number;
  status: 'PENDING' | 'CALCULATED' | 'SETTLED';
  settledAt?: string | null;
};

type SettlementLineItemResponse = {
  id: string;
  paymentId: string;
  orderId: string;
  saleAmount: number;
  commissionAmount: number;
  netAmount: number;
  createdAt: string;
};

type SettlementPeriodDetailResponse = SettlementPeriodResponse & {
  lineItems: SettlementLineItemResponse[];
};

function canManageBrand(role: string | null | undefined) {
  return role === 'OWNER' || role === 'ADMIN';
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

function getPeriodStatusClass(
  status: SettlementPeriodResponse['status'] | null | undefined,
) {
  switch (status) {
    case 'PENDING':
      return 'bg-warning-500/15 text-warning-500';
    case 'CALCULATED':
      return 'bg-primary-500/15 text-primary-500';
    case 'SETTLED':
      return 'bg-success/15 text-success';
    default:
      return 'bg-bg-tertiary text-text-secondary';
  }
}

export default function CustomerSettlementPage() {
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [brandsError, setBrandsError] = useState<string | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [summary, setSummary] = useState<SettlementSummaryResponse | null>(null);
  const [periods, setPeriods] = useState<SettlementPeriodResponse[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [selectedPeriodDetail, setSelectedPeriodDetail] =
    useState<SettlementPeriodDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const manageableBrands = useMemo(
    () =>
      brands.filter(
        (brand) => canManageBrand(brand.myRole) && brand.billing_tier === 'PG',
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
          (brand) => canManageBrand(brand.myRole) && brand.billing_tier === 'PG',
        );
        setSelectedBrandId((current) => current || firstManageable?.id || '');
      } catch (loadError) {
        if (!active) {
          return;
        }
        setBrandsError(
          parseApiErrorMessage(loadError, 'PG 브랜드 목록을 불러오지 못했습니다.'),
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

    const loadSettlement = async () => {
      if (!selectedBrand) {
        setSummary(null);
        setPeriods([]);
        setSelectedPeriodId('');
        setSelectedPeriodDetail(null);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const [summaryRes, periodsRes] = await Promise.all([
          apiClient.get<SettlementSummaryResponse>(
            `/settlement/summary?brandId=${encodeURIComponent(selectedBrand.id)}&months=6`,
          ),
          apiClient.get<SettlementPeriodResponse[]>(
            `/settlement/periods?brandId=${encodeURIComponent(selectedBrand.id)}&limit=12`,
          ),
        ]);

        if (!active) {
          return;
        }

        setSummary(summaryRes);
        setPeriods(periodsRes);
        setSelectedPeriodId((current) => current || periodsRes[0]?.id || '');
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(
          parseApiErrorMessage(loadError, '정산 정보를 불러오지 못했습니다.'),
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadSettlement();

    return () => {
      active = false;
    };
  }, [selectedBrand]);

  useEffect(() => {
    let active = true;

    const loadDetail = async () => {
      if (!selectedBrand || !selectedPeriodId) {
        setSelectedPeriodDetail(null);
        return;
      }

      try {
        setDetailLoading(true);
        const detail = await apiClient.get<SettlementPeriodDetailResponse>(
          `/settlement/periods/${encodeURIComponent(selectedPeriodId)}?brandId=${encodeURIComponent(selectedBrand.id)}`,
        );
        if (!active) {
          return;
        }
        setSelectedPeriodDetail(detail);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setSelectedPeriodDetail(null);
        setError(
          parseApiErrorMessage(
            loadError,
            '정산 기간 상세를 불러오지 못했습니다.',
          ),
        );
      } finally {
        if (active) {
          setDetailLoading(false);
        }
      }
    };

    void loadDetail();

    return () => {
      active = false;
    };
  }, [selectedBrand, selectedPeriodId]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/customer/payments"
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-text-secondary no-underline transition-colors hover:text-foreground"
          >
            <ArrowLeft size={16} />
            결제 운영 화면으로 돌아가기
          </Link>
          <h1 className="mt-3 text-2xl font-black text-foreground">
            PG 정산 현황
          </h1>
          <p className="mt-2 text-[13px] leading-6 text-text-secondary">
            월별 정산 기간, 수수료, 정산 예정 금액을 브랜드별로 확인합니다.
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
              <option value="">PG 브랜드가 없습니다</option>
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
            운영 중인 PG 브랜드가 없습니다. 무통장 전용 브랜드는{' '}
            <Link href="/customer/billing" className="ml-1 font-semibold text-foreground">
              빌링 화면
            </Link>
            에서 확인할 수 있습니다.
          </CardContent>
        </Card>
      ) : null}

      {selectedBrand ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <MetricCard
              label="최근 6개월 총 매출"
              value={formatWon(summary?.totalSales ?? 0)}
              icon={Landmark}
            />
            <MetricCard
              label="최근 6개월 총 환불"
              value={formatWon(summary?.totalRefunds ?? 0)}
              icon={CreditCard}
            />
            <MetricCard
              label="최근 6개월 총 수수료"
              value={formatWon(summary?.totalCommission ?? 0)}
              icon={ReceiptText}
            />
            <MetricCard
              label="정산 예정 합계"
              value={formatWon(summary?.totalNetSettlement ?? 0)}
              icon={WalletCards}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <Card>
              <CardHeader>
                <div className="mb-2 flex items-center gap-2">
                  <ReceiptText size={18} className="text-text-secondary" />
                  <CardTitle className="mb-0">정산 기간 목록</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <div className="rounded-2xl border border-border bg-background px-4 py-5 text-[13px] text-text-secondary">
                    정산 기간을 불러오는 중입니다.
                  </div>
                ) : periods.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-background px-4 py-5 text-[13px] text-text-secondary">
                    아직 계산된 정산 기간이 없습니다.
                  </div>
                ) : (
                  periods.map((period) => (
                    <button
                      key={period.id}
                      type="button"
                      onClick={() => setSelectedPeriodId(period.id)}
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                        selectedPeriodId === period.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-background hover:bg-bg-tertiary'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[13px] font-black text-foreground">
                            {period.periodStart} ~ {period.periodEnd}
                          </div>
                          <div className="mt-2 text-[13px] text-text-secondary">
                            정산 예정 금액: {formatWon(period.netSettlement)}
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getPeriodStatusClass(period.status)}`}
                        >
                          {getPeriodStatusLabel(period.status)}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-2 flex items-center gap-2">
                  <WalletCards size={18} className="text-text-secondary" />
                  <CardTitle className="mb-0">선택한 정산 기간 상세</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {detailLoading ? (
                  <div className="rounded-2xl border border-border bg-background px-4 py-5 text-[13px] text-text-secondary">
                    정산 상세를 불러오는 중입니다.
                  </div>
                ) : !selectedPeriodDetail ? (
                  <div className="rounded-2xl border border-border bg-background px-4 py-5 text-[13px] text-text-secondary">
                    확인할 정산 기간을 선택해 주세요.
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      <InfoRow
                        label="총 매출"
                        value={formatWon(selectedPeriodDetail.totalSales)}
                      />
                      <InfoRow
                        label="총 환불"
                        value={formatWon(selectedPeriodDetail.totalRefunds)}
                      />
                      <InfoRow
                        label="수수료율"
                        value={`${(selectedPeriodDetail.commissionRate * 100).toFixed(2)}%`}
                      />
                      <InfoRow
                        label="총 수수료"
                        value={formatWon(selectedPeriodDetail.commissionAmount)}
                      />
                    </div>

                    <InfoRow
                      label="정산 완료 시각"
                      value={
                        selectedPeriodDetail.settledAt
                          ? formatDateTimeFull(selectedPeriodDetail.settledAt)
                          : '-'
                      }
                    />

                    <div className="rounded-2xl border border-border bg-background p-4">
                      <div className="text-[13px] font-black text-foreground">
                        정산 라인 아이템
                      </div>
                      <div className="mt-3 space-y-3">
                        {selectedPeriodDetail.lineItems.length === 0 ? (
                          <div className="text-[13px] text-text-secondary">
                            아직 집계된 라인 아이템이 없습니다.
                          </div>
                        ) : (
                          selectedPeriodDetail.lineItems.map((item) => (
                            <div
                              key={item.id}
                              className="grid gap-3 rounded-2xl border border-border bg-bg-secondary px-4 py-4 md:grid-cols-[1fr_0.8fr_0.8fr]"
                            >
                              <div>
                                <div className="text-[13px] font-semibold text-foreground">
                                  주문 {item.orderId}
                                </div>
                                <div className="mt-1 text-[12px] text-text-secondary">
                                  생성 시각: {formatDateTimeFull(item.createdAt)}
                                </div>
                              </div>
                              <div className="text-[13px] text-text-secondary">
                                <div className="text-xs text-text-tertiary">매출 / 수수료</div>
                                <div className="mt-1 font-semibold text-foreground">
                                  {formatWon(item.saleAmount)} /{' '}
                                  {formatWon(item.commissionAmount)}
                                </div>
                              </div>
                              <div className="text-[13px] text-text-secondary">
                                <div className="text-xs text-text-tertiary">정산 반영액</div>
                                <div className="mt-1 font-semibold text-foreground">
                                  {formatWon(item.netAmount)}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </section>
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
    <div className="rounded-2xl border border-border bg-background px-4 py-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
        {label}
      </div>
      <div className="mt-2 text-[14px] font-semibold text-foreground">{value}</div>
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
