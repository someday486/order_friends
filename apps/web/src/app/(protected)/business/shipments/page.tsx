import Link from 'next/link';
import { AlertTriangle, Route, Truck } from 'lucide-react';
import { shipmentPresets } from '@/lib/businessMockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

const shipmentIssues = [
  {
    id: 'ISSUE-01',
    title: '주문번호 없음',
    detail: '로젠 3월 31일 파일에서 4행이 주문번호 없이 들어왔습니다.',
  },
  {
    id: 'ISSUE-02',
    title: '송장번호 중복',
    detail: '한진 CSV에서 동일 송장번호가 2건 반복되어 예외 큐에 보류했습니다.',
  },
  {
    id: 'ISSUE-03',
    title: '헤더행 오인식',
    detail: 'CJ 파일은 2행이 헤더라서 프리셋 적용 전 수동 확인이 필요합니다.',
  },
];

export default function BusinessShipmentsPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <div className="mb-2 flex items-center gap-2">
              <Truck size={18} className="text-text-secondary" />
              <CardTitle className="mb-0">송장 매칭 프리셋</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {shipmentPresets.map((preset) => (
              <div
                key={preset.id}
                className="rounded-2xl border border-border bg-background px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[13px] font-black text-foreground">{preset.name}</div>
                  <div className="text-xs text-text-tertiary">{preset.lastUsed}</div>
                </div>
                <div className="mt-2 text-[13px] leading-5 text-text-secondary">
                  주문번호: {preset.orderHeader} · 송장번호: {preset.waybillHeader} · 헤더행:{' '}
                  {preset.headerRow}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-2 flex items-center gap-2">
              <Route size={18} className="text-text-secondary" />
              <CardTitle className="mb-0">바로 이동</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link
              href="/business/orders/upload"
              className="block rounded-2xl border border-border bg-background p-4 transition-colors hover:bg-bg-tertiary"
            >
              <div className="text-[13px] font-black text-foreground">주문서업로드로 이동</div>
              <div className="mt-2 text-[13px] leading-5 text-text-secondary">
                운송장 파일을 올리고 헤더행과 주문번호/송장번호 컬럼을 바로 맞출 수 있습니다.
              </div>
            </Link>
            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="text-[13px] font-black text-foreground">다음 단계 제안</div>
              <div className="mt-2 text-[13px] leading-5 text-text-secondary">
                저장된 프리셋을 브랜드별로 서버에 보관하고, 예외 큐를 재처리하는 액션을 붙이면 운영이 더 편해집니다.
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle size={18} className="text-text-secondary" />
            <CardTitle className="mb-0">예외 큐</CardTitle>
          </div>
          <p className="text-[13px] leading-5 text-text-secondary">
            실제 운영에서는 이 영역에 미매칭 송장, 중복 송장, 주문번호 누락을 모아두면 좋습니다.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {shipmentIssues.map((issue) => (
            <div key={issue.id} className="rounded-2xl border border-border bg-background p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                {issue.id}
              </div>
              <div className="mt-2 text-[13px] font-black text-foreground">{issue.title}</div>
              <div className="mt-2 text-[13px] leading-5 text-text-secondary">{issue.detail}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
