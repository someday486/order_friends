'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CreditCard, Landmark, WalletCards } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { apiClient } from '@/lib/api-client';
import { parseApiErrorMessage } from '@/lib/api-error';

type BillingTier = 'PG' | 'NON_PG';

type BrandOption = {
  id: string;
  name: string;
  billing_tier?: BillingTier | null;
  myRole?: string | null;
};

function canManageBrand(role: string | null | undefined) {
  return role === 'OWNER' || role === 'ADMIN';
}

function getBillingTierLabel(tier: BillingTier | null | undefined) {
  return tier === 'NON_PG' ? '무통장 전용' : 'PG 이용';
}

function getCheckoutLabel(tier: BillingTier | null | undefined) {
  return tier === 'NON_PG'
    ? '주문자는 계좌이체로만 주문합니다.'
    : '주문자는 토스 결제 위젯으로 결제합니다.';
}

export default function CustomerPaymentsPage() {
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState('');

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
        setLoading(true);
        setError(null);
        const rows = await apiClient.get<BrandOption[]>('/customer/brands');
        if (!active) {
          return;
        }

        setBrands(rows);
        const firstManageable = rows.find((brand) => canManageBrand(brand.myRole));
        setSelectedBrandId((current) => current || firstManageable?.id || '');
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          parseApiErrorMessage(
            loadError,
            '브랜드 목록을 불러오지 못했습니다.',
          ),
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadBrands();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <section className="rounded-[28px] border border-border bg-[linear-gradient(135deg,_rgba(245,158,11,0.12),_rgba(255,255,255,0)),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.18),_transparent_32%)] p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-text-tertiary">
              Order Payments
            </div>
            <h1 className="mt-3 text-2xl font-black leading-tight tracking-tight text-foreground md:text-3xl">
              주문자가 사용하는 결제 방식을
              <br className="hidden md:block" /> 셀러 운영 화면에서 확인하세요.
            </h1>
            <p className="mt-4 max-w-2xl text-[13px] leading-6 text-text-secondary md:text-sm">
              온라인샵 주문 결제는 브랜드의 결제 정책을 기준으로 동작합니다.
              PG 이용 브랜드는 토스 결제 위젯만, 무통장 전용 브랜드는 계좌이체만
              노출됩니다. 셀러의 월 이용료와 정산 내역은 별도 화면에서 관리합니다.
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
                disabled={loading || manageableBrands.length === 0}
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
              <div className="rounded-2xl border border-border bg-bg-secondary px-4 py-3 text-[13px] leading-6 text-text-secondary">
                주문자가 보는 결제 방식은 이 화면에서 확인하고, 셀러 이용료와 PG 정산은
                아래 바로가기에서 같은 고객 운영 영역 안에서 이어서 확인할 수
                있습니다.
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-danger-500/40 bg-danger-500/10 px-5 py-4 text-[13px] text-danger-500">
          {error}
        </div>
      ) : null}

      {!loading && manageableBrands.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-[13px] text-text-secondary">
            운영 가능한 브랜드가 없습니다. 브랜드 OWNER 또는 ADMIN 권한이
            연결되면 결제 운영 기준을 확인할 수 있습니다.
          </CardContent>
        </Card>
      ) : null}

      {selectedBrand ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <MetricCard
              label="결제 운영 방식"
              value={getBillingTierLabel(selectedBrand.billing_tier)}
              icon={WalletCards}
            />
            <MetricCard
              label="주문 결제 흐름"
              value={
                selectedBrand.billing_tier === 'NON_PG'
                  ? '계좌이체 전용'
                  : '토스 결제 위젯'
              }
              icon={CreditCard}
            />
            <MetricCard
              label="관리 위치"
              value="브랜드 / 스토어 설정"
              icon={Landmark}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="mb-0 text-base">현재 적용 중인 규칙</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-[13px] leading-6 text-text-secondary">
                <InfoRow label="브랜드" value={selectedBrand.name} />
                <InfoRow
                  label="결제 정책"
                  value={getBillingTierLabel(selectedBrand.billing_tier)}
                />
                <InfoRow
                  label="주문자 결제"
                  value={getCheckoutLabel(selectedBrand.billing_tier)}
                />
                <div className="rounded-2xl border border-border bg-background px-4 py-4">
                  PG 이용 브랜드는 토스 결제 위젯만 노출하고, 무통장 전용
                  브랜드는 브랜드나 스토어에 등록된 입금 계좌를 기준으로 주문을
                  받습니다.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="mb-0 text-base">관련 운영 화면</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-[13px] leading-6 text-text-secondary">
                <div className="rounded-2xl border border-border bg-background px-4 py-4">
                  결제 정책 변경이나 계좌 정보 수정은 브랜드 / 스토어 설정에서
                  관리합니다. 셀러 이용료와 PG 정산은 아래 링크에서 같은 고객
                  운영 영역 안에서 확인할 수 있습니다.
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/customer/brands/${encodeURIComponent(selectedBrand.id)}`}
                    className="btn-primary inline-flex items-center justify-center px-4 py-2 text-sm no-underline"
                  >
                    브랜드 설정 보기
                  </Link>
                  <Link
                    href="/customer/billing"
                    className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground no-underline transition-colors hover:bg-bg-tertiary"
                  >
                    이용료/구독
                  </Link>
                  <Link
                    href="/customer/settlement"
                    className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground no-underline transition-colors hover:bg-bg-tertiary"
                  >
                    PG 정산
                  </Link>
                </div>
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
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-background px-4 py-4 md:flex-row md:items-center md:justify-between">
      <div className="text-text-tertiary">{label}</div>
      <div className="font-semibold text-foreground">{value}</div>
    </div>
  );
}
