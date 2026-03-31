import { Building2, Clock3, Users2 } from 'lucide-react';
import { type ComponentType } from 'react';
import { businessSuppliers } from '@/lib/businessMockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function BusinessSuppliersPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="활성 공급처" value={`${businessSuppliers.length}곳`} icon={Users2} />
        <SummaryCard label="평균 리드타임" value="D+1.3" icon={Clock3} />
        <SummaryCard label="오늘 협의 필요" value="1곳" icon={Building2} />
      </section>

      <Card>
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <Users2 size={18} className="text-text-secondary" />
            <CardTitle className="mb-0">공급처 디렉터리</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-3">
          {businessSuppliers.map((supplier) => (
            <article
              key={supplier.id}
              className="rounded-[26px] border border-border bg-background p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="break-keep text-[15px] font-black leading-5 text-foreground">{supplier.name}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {supplier.categories.map((category) => (
                      <span
                        key={category}
                        className="rounded-full border border-border bg-bg-secondary px-3 py-1 text-xs font-semibold text-text-secondary"
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {supplier.rating}
                </span>
              </div>

              <div className="mt-5 grid gap-3 rounded-2xl border border-border bg-bg-secondary p-4">
                <Info label="리드타임" value={supplier.leadTime} />
                <Info label="발주 마감" value={supplier.cutoffLabel} />
                <Info label="최소 주문금액" value={supplier.minimumAmount} />
                <Info label="정산 조건" value={supplier.paymentTerms} />
                <Info label="담당 연락처" value={supplier.contact} />
              </div>
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-text-tertiary">{label}</div>
      <div className="mt-1 text-[13px] font-semibold leading-5 text-foreground">{value}</div>
    </div>
  );
}
