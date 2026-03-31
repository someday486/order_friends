import { CreditCard, Landmark, ReceiptText } from 'lucide-react';
import { type ComponentType } from 'react';
import { businessOrders, businessSuppliers, businessTopSummary } from '@/lib/businessMockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function BusinessPaymentsPage() {
  const postpaidOrders = businessOrders.filter((order) => order.paymentStatus === '후불 예정');
  const postpaidAmount = postpaidOrders.reduce((sum, order) => sum + order.amount, 0);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="예치금 잔액" value={businessTopSummary.deposit} icon={Landmark} />
        <MetricCard label="적립금" value={businessTopSummary.points} icon={CreditCard} />
        <MetricCard label="후불 예정금액" value={`${postpaidAmount.toLocaleString()}원`} icon={ReceiptText} />
        <MetricCard label="결제대기" value={businessTopSummary.paymentPending} icon={CreditCard} />
      </section>

      <Card>
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <CreditCard size={18} className="text-text-secondary" />
            <CardTitle className="mb-0">결제 스케줄</CardTitle>
          </div>
          <p className="text-[13px] leading-5 text-text-secondary">
            공급처별 정산 조건과 후불 예정 금액을 함께 보이게 배치했습니다.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {businessSuppliers.map((supplier, index) => (
            <div
              key={supplier.id}
              className="grid gap-3 rounded-2xl border border-border bg-background px-4 py-4 md:grid-cols-[1fr_0.8fr_0.8fr_auto]"
            >
              <div>
                <div className="break-keep text-[15px] font-black leading-5 text-foreground">{supplier.name}</div>
                <div className="mt-1 text-[13px] leading-5 text-text-secondary">{supplier.paymentTerms}</div>
              </div>
              <div className="text-[13px] text-text-secondary">
                <div className="text-xs text-text-tertiary">최소 주문금액</div>
                <div className="mt-1 font-semibold text-foreground">{supplier.minimumAmount}</div>
              </div>
              <div className="text-[13px] text-text-secondary">
                <div className="text-xs text-text-tertiary">이번 주 예정</div>
                <div className="mt-1 font-semibold text-foreground">
                  {(postpaidOrders[index]?.amount ?? 0).toLocaleString()}원
                </div>
              </div>
              <div className="flex items-center justify-start md:justify-end">
                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-700">
                  정산 예정
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="mb-2 flex items-center gap-2">
              <Landmark size={18} className="text-text-secondary" />
              <CardTitle className="mb-0">예치금 운영 메모</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Note title="자동 차감 기준" body="브랜드별 한도 이상 주문은 관리자 확인 후 차감되도록 정책을 나눌 수 있습니다." />
            <Note title="미입금 알림" body="예치금 부족 시 발주 제출 단계에서 경고를 주고, 결제 페이지로 유도하면 됩니다." />
            <Note title="정산 근거" body="발주번호, 입고완료, 송장 매칭 이력을 결제 근거와 함께 묶어 보여주면 편합니다." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-2 flex items-center gap-2">
              <ReceiptText size={18} className="text-text-secondary" />
              <CardTitle className="mb-0">바로 할 작업</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            <TaskBox title="결제대기 3건" body="후불 거래처의 납기 완료 여부를 확인하고 정산대기로 넘기기" />
            <TaskBox title="예치금 부족 알림" body="월말 프로모션 매장 2곳에 충전 요청 보내기" />
            <TaskBox title="세금계산서 체크" body="공급처별 정산 메모와 영수증 발행 일자 맞추기" />
          </CardContent>
        </Card>
      </section>
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
  icon: ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-border bg-bg-secondary p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
          {label}
        </div>
        <Icon size={18} className="text-text-secondary" />
      </div>
      <div className="mt-3 break-keep text-xl font-black text-foreground md:text-[22px]">{value}</div>
    </div>
  );
}

function Note({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="text-[13px] font-black text-foreground">{title}</div>
      <div className="mt-2 text-[13px] leading-5 text-text-secondary">{body}</div>
    </div>
  );
}

function TaskBox({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="text-[13px] font-black text-foreground">{title}</div>
      <div className="mt-2 text-[13px] leading-5 text-text-secondary">{body}</div>
    </div>
  );
}
