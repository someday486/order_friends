'use client';

import Link from 'next/link';
import { type ComponentType } from 'react';
import {
  ArrowRight,
  Boxes,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  PackageSearch,
  Truck,
  Users2,
  Warehouse,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  businessOrders,
  businessProducts,
  businessSuppliers,
  businessTopSummary,
  receiptStatuses,
  shipmentPresets,
} from '@/lib/businessMockData';

const quickActions = [
  {
    href: '/business/orders/upload',
    title: '주문서 업로드',
    description: '엑셀이나 CSV 주문서를 바로 올리고 컬럼 매핑을 시작합니다.',
    icon: FileSpreadsheet,
  },
  {
    href: '/business/products',
    title: '상품 리스트',
    description: '공급처별 발주 가능 상품과 마감 시간을 한 번에 확인합니다.',
    icon: PackageSearch,
  },
  {
    href: '/business/orders/history',
    title: '주문 내역',
    description: '확인 대기, 출고 준비, 결제 대기 상태를 빠르게 훑어봅니다.',
    icon: ClipboardList,
  },
  {
    href: '/customer/payments',
    title: '결제 운영',
    description: '빌링과 정산 흐름을 브랜드별 운영 방식에 맞춰 확인합니다.',
    icon: CreditCard,
  },
];

export default function BusinessDashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section className="overflow-hidden rounded-[28px] border border-border bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.2),_transparent_28%),linear-gradient(135deg,_rgba(255,255,255,0),_rgba(251,191,36,0.08))] p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">
              B2B Procurement
            </div>
            <h1 className="mt-3 text-2xl font-black leading-tight tracking-tight text-foreground md:text-3xl">
              발주, 송장, 결제를
              <br className="hidden md:block" /> 한 흐름으로 정리했습니다.
            </h1>
            <p className="mt-4 max-w-2xl text-[13px] leading-5 text-text-secondary md:text-sm">
              B2C 운영 화면과 분리해서, 상품 탐색부터 주문서 업로드, 송장 매칭, 입고와
              결제 확인까지 B2B 운영 흐름만 이어지도록 정리한 대시보드입니다.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/business/orders/upload"
                className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm"
              >
                주문서 업로드 시작
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/business/products"
                className="inline-flex items-center gap-2 rounded-2xl border border-border bg-bg-secondary px-5 py-3 text-[13px] font-semibold text-foreground transition-colors hover:bg-bg-tertiary"
              >
                상품 리스트 보기
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <HeroMetric label="입치기" value={businessTopSummary.deposit} />
            <HeroMetric label="상품 대기" value={businessTopSummary.points} />
            <HeroMetric label="결제 대기" value={businessTopSummary.paymentPending} />
            <HeroMetric label="미매칭 송장" value={businessTopSummary.unmatchedWaybills} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group rounded-2xl border border-border bg-bg-secondary p-4 transition-all hover:-translate-y-0.5 hover:bg-bg-tertiary"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-background text-foreground">
              <action.icon size={22} />
            </div>
            <div className="text-[15px] font-black leading-5 text-foreground">{action.title}</div>
            <div className="mt-2 text-[13px] leading-5 text-text-secondary">
              {action.description}
            </div>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <Card>
          <CardHeader>
            <div className="mb-2 flex items-center gap-2">
              <Boxes size={18} className="text-text-secondary" />
              <CardTitle className="mb-0">오늘 바로 확인할 항목</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <DashboardChecklist
              title="상품 카탈로그"
              count={`${businessProducts.length}개`}
              hint="공급처별 발주 가능 상품"
            />
            <DashboardChecklist
              title="진행 중 발주"
              count={`${businessOrders.length}건`}
              hint="확인 대기와 출고 준비 포함"
            />
            <DashboardChecklist
              title="활성 공급처"
              count={`${businessSuppliers.length}곳`}
              hint="오늘 발주 가능한 거래처"
            />
            <DashboardChecklist
              title="입고 추적"
              count={`${receiptStatuses.length}건`}
              hint="부분 입고와 입고 예정 포함"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-2 flex items-center gap-2">
              <Truck size={18} className="text-text-secondary" />
              <CardTitle className="mb-0">송장 매칭 준비</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {shipmentPresets.map((preset) => (
              <div
                key={preset.id}
                className="rounded-2xl border border-border bg-background px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[13px] font-semibold text-foreground">{preset.name}</div>
                  <div className="text-xs text-text-tertiary">{preset.lastUsed}</div>
                </div>
                <div className="mt-2 text-xs leading-5 text-text-secondary">
                  주문번호: {preset.orderHeader} · 송장번호: {preset.waybillHeader} · 헤더 행{' '}
                  {preset.headerRow}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div className="mb-2 flex items-center gap-2">
              <ClipboardList size={18} className="text-text-secondary" />
              <CardTitle className="mb-0">최근 발주 흐름</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {businessOrders.map((order) => (
              <div
                key={order.id}
                className="grid gap-3 rounded-2xl border border-border bg-background px-4 py-4 md:grid-cols-[1.2fr_0.8fr_0.8fr_auto]"
              >
                <div>
                  <div className="text-[13px] font-black text-foreground">{order.id}</div>
                  <div className="mt-1 text-[13px] leading-5 text-text-secondary">
                    {order.merchant} · {order.itemSummary}
                  </div>
                </div>
                <div className="text-[13px] text-text-secondary">
                  <div className="text-xs text-text-tertiary">공급처</div>
                  <div className="mt-1 font-semibold text-foreground">{order.supplier}</div>
                </div>
                <div className="text-[13px] text-text-secondary">
                  <div className="text-xs text-text-tertiary">납기</div>
                  <div className="mt-1 font-semibold text-foreground">{order.deliveryDate}</div>
                </div>
                <div className="flex items-center justify-start md:justify-end">
                  <StatusPill label={order.status} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-2 flex items-center gap-2">
              <Warehouse size={18} className="text-text-secondary" />
              <CardTitle className="mb-0">입고 이슈</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {receiptStatuses.map((receipt) => (
              <div
                key={receipt.id}
                className="rounded-2xl border border-border bg-background px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[13px] font-semibold text-foreground">{receipt.poNumber}</div>
                  <div className="text-xs text-text-tertiary">{receipt.expectedDate}</div>
                </div>
                <div className="mt-2 text-[13px] text-text-secondary">{receipt.supplier}</div>
                <div className="mt-3 flex items-center justify-between text-[13px]">
                  <span className="text-text-tertiary">{receipt.issue}</span>
                  <span className="font-black text-foreground">{receipt.receivedRate}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SmallLinkCard
          href="/business/suppliers"
          icon={Users2}
          title="공급처"
          description="납기, 마감 시간, 최소 주문 금액 기준으로 정리합니다."
        />
        <SmallLinkCard
          href="/business/shipments"
          icon={Truck}
          title="송장 매칭"
          description="헤더 프리셋과 미매칭 예외 건을 빠르게 확인합니다."
        />
        <SmallLinkCard
          href="/business/settings"
          icon={CreditCard}
          title="운영 설정"
          description="발주 마감, 결제 방식, 업로드 규칙을 관리합니다."
        />
      </section>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/80 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
        {label}
      </div>
      <div className="mt-3 break-keep text-xl font-black text-foreground md:text-[22px]">
        {value}
      </div>
    </div>
  );
}

function DashboardChecklist({
  title,
  count,
  hint,
}: {
  title: string;
  count: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background px-4 py-4">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">
        {title}
      </div>
      <div className="mt-3 break-keep text-xl font-black text-foreground md:text-[22px]">
        {count}
      </div>
      <div className="mt-1 text-[13px] leading-5 text-text-secondary">{hint}</div>
    </div>
  );
}

function StatusPill({ label }: { label: string }) {
  const tone =
    label === '출고준비'
      ? 'bg-emerald-500/15 text-emerald-700'
      : label === '확인대기'
        ? 'bg-amber-500/15 text-amber-700'
        : label === '부분출고'
          ? 'bg-sky-500/15 text-sky-700'
          : 'bg-neutral-500/15 text-text-secondary';

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}

function SmallLinkCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-border bg-bg-secondary p-4 transition-all hover:-translate-y-0.5 hover:bg-bg-tertiary"
    >
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-background text-foreground">
        <Icon size={20} />
      </div>
      <div className="text-[15px] font-black leading-5 text-foreground">{title}</div>
      <div className="mt-2 text-[13px] leading-5 text-text-secondary">{description}</div>
    </Link>
  );
}
