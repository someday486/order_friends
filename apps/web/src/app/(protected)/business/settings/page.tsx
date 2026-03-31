import { Settings2, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

const policies = [
  {
    title: '발주 마감 정책',
    body: '공급처별 마감 시각이 다를 수 있으므로 브랜드 공통 기본값과 공급처별 override를 나눠두는 것이 좋습니다.',
  },
  {
    title: '결제 정책',
    body: '예치금 우선 차감, 후불 허용 대상, 미입금 경고 기준을 브랜드 단위로 설정할 수 있어야 합니다.',
  },
  {
    title: '업로드 정책',
    body: '주문서, 송장, 입고 파일별 허용 확장자와 헤더 검증 실패 처리 방식을 따로 둘 수 있습니다.',
  },
];

export default function BusinessSettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <Settings2 size={18} className="text-text-secondary" />
            <CardTitle className="mb-0">운영 설정</CardTitle>
          </div>
          <p className="text-[13px] leading-5 text-text-secondary">
            실제 저장은 아직 붙이지 않았고, 지금은 어떤 설정군이 필요한지 골조만 잡아두었습니다.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {policies.map((policy) => (
            <div key={policy.title} className="rounded-2xl border border-border bg-background p-5">
              <div className="text-[15px] font-black leading-5 text-foreground">{policy.title}</div>
              <div className="mt-3 text-[13px] leading-5 text-text-secondary">{policy.body}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="mb-2 flex items-center gap-2">
              <SlidersHorizontal size={18} className="text-text-secondary" />
              <CardTitle className="mb-0">권장 설정 예시</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <SettingRow label="기본 발주 마감" value="오전 10:30" />
            <SettingRow label="후불 허용 공급처" value="미남과일, 완도마켓" />
            <SettingRow label="업로드 허용 형식" value="CSV, XLSX" />
            <SettingRow label="헤더행 자동 감지 범위" value="1~10행" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-2 flex items-center gap-2">
              <ShieldCheck size={18} className="text-text-secondary" />
              <CardTitle className="mb-0">운영 안전장치</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Guardrail title="승인 전 발주서 발행 차단" body="대표 승인 없이 공급처에 자동 발행되지 않도록 막아두는 흐름입니다." />
            <Guardrail title="헤더 검증 실패 시 저장 금지" body="주문번호/송장번호 컬럼이 없으면 업로드를 끝까지 진행하지 않도록 합니다." />
            <Guardrail title="정산 전 입고 확인" body="입고 완료 여부가 없는 주문은 결제대기로 넘기지 않는 기준입니다." />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-background px-4 py-4 md:flex-row md:items-center md:justify-between">
      <div className="text-[13px] text-text-secondary">{label}</div>
      <div className="w-full break-words text-left text-[13px] font-semibold text-foreground md:w-auto md:text-right">{value}</div>
    </div>
  );
}

function Guardrail({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="text-[13px] font-black text-foreground">{title}</div>
      <div className="mt-2 text-[13px] leading-5 text-text-secondary">{body}</div>
    </div>
  );
}
