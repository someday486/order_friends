import { PackageCheck, Warehouse } from 'lucide-react';
import { receiptStatuses } from '@/lib/businessMockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function BusinessReceiptsPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="입고 완료" value="1건" />
        <Metric label="부분 입고" value="1건" />
        <Metric label="입고 예정" value="1건" />
      </section>

      <Card>
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <Warehouse size={18} className="text-text-secondary" />
            <CardTitle className="mb-0">입고 현황</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {receiptStatuses.map((receipt) => (
            <div
              key={receipt.id}
              className="grid gap-3 rounded-2xl border border-border bg-background px-4 py-4 md:grid-cols-[1fr_0.8fr_0.8fr_auto]"
            >
              <div>
                <div className="text-[13px] font-black text-foreground">{receipt.poNumber}</div>
                <div className="mt-1 text-[13px] text-text-secondary">{receipt.supplier}</div>
              </div>
              <div className="text-[13px] text-text-secondary">
                <div className="text-xs text-text-tertiary">예정시각</div>
                <div className="mt-1 font-semibold text-foreground">{receipt.expectedDate}</div>
              </div>
              <div className="text-[13px] text-text-secondary">
                <div className="text-xs text-text-tertiary">입고율</div>
                <div className="mt-1 font-semibold text-foreground">{receipt.receivedRate}</div>
              </div>
              <div className="flex items-center justify-start md:justify-end">
                <ReceiptBadge label={receipt.issue} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <PackageCheck size={18} className="text-text-secondary" />
            <CardTitle className="mb-0">운영 포인트</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <TipCard title="부분 입고 추적" body="잔량 대기 건은 발주번호 기준으로 재입고 예정일을 이어서 기록하면 좋습니다." />
          <TipCard title="입고 차이 코드" body="파손, 품절, 중량 차이 같은 사유를 드롭다운 코드로 통일하면 분석이 쉬워집니다." />
          <TipCard title="정산 연결" body="입고 완료 건만 결제대기 카드에 반영되도록 연결하면 운영자가 놓치지 않습니다." />
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-bg-secondary p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
        {label}
      </div>
      <div className="mt-3 break-keep text-xl font-black text-foreground md:text-[22px]">{value}</div>
    </div>
  );
}

function ReceiptBadge({ label }: { label: string }) {
  const tone =
    label === '정상 입고'
      ? 'bg-emerald-500/15 text-emerald-700'
      : label === '부분 입고 / 잔량 대기'
      ? 'bg-amber-500/15 text-amber-700'
      : 'bg-neutral-500/15 text-text-secondary';

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

function TipCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="text-[13px] font-black text-foreground">{title}</div>
      <div className="mt-2 text-[13px] leading-5 text-text-secondary">{body}</div>
    </div>
  );
}
