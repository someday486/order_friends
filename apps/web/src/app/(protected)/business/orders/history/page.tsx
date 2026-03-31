'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ClipboardList,
  Filter,
  PackageCheck,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { businessOrders, type BusinessOrder } from '@/lib/businessMockData';
import {
  deleteBusinessOrderImportBatch,
  getBusinessOrderImportBatches,
  mapImportedBatchToBusinessOrder,
  type BusinessImportedOrderBatch,
} from '@/lib/businessOrderImportStorage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import toast from 'react-hot-toast';

const STATUS_FILTERS: Array<'전체' | BusinessOrder['status']> = [
  '전체',
  '작성중',
  '승인대기',
  '출고준비',
  '부분출고',
  '정산대기',
];

type DecoratedOrder = BusinessOrder & {
  source: 'mock' | 'upload';
  fileName?: string;
  rowCount?: number;
};

export default function BusinessOrderHistoryPage() {
  const searchParams = useSearchParams();
  const [activeFilter, setActiveFilter] = useState<(typeof STATUS_FILTERS)[number]>('전체');
  const [uploadedBatches, setUploadedBatches] = useState<BusinessImportedOrderBatch[]>([]);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void getBusinessOrderImportBatches()
      .then((next) => {
        if (active) {
          setUploadedBatches(next);
        }
      })
      .catch(() => {
        if (active) {
          setUploadedBatches([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleDeleteBatch(batchId: string) {
    try {
      setDeletingBatchId(batchId);
      await deleteBusinessOrderImportBatch(batchId);
      setUploadedBatches((current) => current.filter((batch) => batch.id !== batchId));
      toast.success('업로드 주문서를 삭제했습니다.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '업로드 주문서 삭제에 실패했습니다.';
      toast.error(message);
    } finally {
      setDeletingBatchId(null);
    }
  }

  const mergedOrders = useMemo<DecoratedOrder[]>(() => {
    const importedOrders = uploadedBatches.map((batch) => ({
      ...mapImportedBatchToBusinessOrder(batch),
      source: 'upload' as const,
      fileName: batch.fileName,
      rowCount: batch.rowCount,
    }));

    const mockOrders = businessOrders.map((order) => ({
      ...order,
      source: 'mock' as const,
    }));

    return [...importedOrders, ...mockOrders];
  }, [uploadedBatches]);

  const filteredOrders = useMemo(() => {
    if (activeFilter === '전체') return mergedOrders;
    return mergedOrders.filter((order) => order.status === activeFilter);
  }, [activeFilter, mergedOrders]);

  const totalAmount = filteredOrders.reduce((sum, order) => sum + order.amount, 0);
  const draftCount = mergedOrders.filter((order) => order.status === '작성중').length;
  const pendingCount = mergedOrders.filter((order) => order.status === '승인대기').length;
  const readyCount = mergedOrders.filter((order) => order.status === '출고준비').length;

  const latestUploadedBatch = uploadedBatches[0] ?? null;
  const arrivedFromUpload = searchParams.get('source') === 'upload';

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="표시 중 발주금액" value={`${totalAmount.toLocaleString()}원`} />
        <SummaryCard label="작성중" value={`${draftCount}건`} />
        <SummaryCard label="승인대기" value={`${pendingCount}건`} />
        <SummaryCard label="출고준비" value={`${readyCount}건`} />
      </section>

      {arrivedFromUpload && latestUploadedBatch ? (
        <Card className="rounded-[28px] p-0">
          <CardContent className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <UploadCloud size={20} />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-foreground">
                  최근 업로드가 주문내역에 반영되었습니다.
                </div>
                <div className="mt-1 text-[13px] leading-5 text-text-secondary">
                  {latestUploadedBatch.fileName} · {latestUploadedBatch.rowCount}건 · {latestUploadedBatch.supplierName}
                </div>
              </div>
            </div>

            <Badge variant="info" className="h-fit px-3 py-1">
              작성중 초안
            </Badge>
          </CardContent>
        </Card>
      ) : null}

      {latestUploadedBatch ? (
        <Card className="rounded-[28px] p-0">
          <CardHeader className="border-b border-border px-6 py-5">
            <CardTitle className="mb-0">최근 업로드 배치</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 px-6 py-5 md:grid-cols-4">
            <UploadInfoCard label="파일명" value={latestUploadedBatch.fileName} />
            <UploadInfoCard label="거래처" value={latestUploadedBatch.supplierName} />
            <UploadInfoCard label="주문일자" value={latestUploadedBatch.orderDate} />
            <UploadInfoCard
              label="행 / 수량"
              value={`${latestUploadedBatch.rowCount}건 / ${latestUploadedBatch.totalQty}개`}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-[28px] p-0">
        <CardHeader className="px-6 py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <ClipboardList size={18} className="text-text-secondary" />
                <CardTitle className="mb-0">대량 발주 주문내역</CardTitle>
              </div>
              <p className="text-[13px] leading-5 text-text-secondary">
                업로드된 초안과 기존 발주 건을 한 화면에서 확인할 수 있습니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={`rounded-full px-4 py-2 text-[13px] font-semibold ${
                    filter === activeFilter
                      ? 'bg-foreground text-background'
                      : 'border border-border bg-background text-text-secondary hover:bg-bg-tertiary hover:text-foreground'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-6">
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-[13px] leading-5 text-text-secondary">
            <Filter size={16} />
            업로드 저장분은 `작성중` 상태로 먼저 표시합니다. 승인/발주서 발행 API는 다음 단계에서 연결합니다.
          </div>

          <div className="overflow-hidden rounded-2xl border border-border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead className="bg-bg-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                      발주번호
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                      구분
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                      매장
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                      공급처
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                      품목
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary">
                      수량
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary">
                      금액
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                      납기
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                      상태
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                      결제
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary">
                      관리
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="border-t border-border">
                      <td className="px-4 py-4 text-[13px] font-black text-foreground">
                        <Link
                          href={`/business/orders/${order.id}`}
                          className="underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
                        >
                          {order.id}
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-[13px]">
                        {order.source === 'upload' ? (
                          <Badge variant="info">업로드</Badge>
                        ) : (
                          <Badge variant="default">기존</Badge>
                        )}
                      </td>
                      <td className="px-4 py-4 text-[13px] text-foreground">{order.merchant}</td>
                      <td className="px-4 py-4 text-[13px] text-text-secondary">{order.supplier}</td>
                      <td className="px-4 py-4 text-[13px] text-text-secondary">
                        <div>{order.itemSummary}</div>
                        {order.source === 'upload' && order.fileName ? (
                          <div className="mt-1 text-[12px] text-text-tertiary">
                            {order.fileName}
                            {typeof order.rowCount === 'number' ? ` · ${order.rowCount}행` : ''}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-right text-[13px] font-semibold text-foreground">
                        {order.qty}
                      </td>
                      <td className="px-4 py-4 text-right text-[13px] font-semibold text-foreground">
                        {order.amount.toLocaleString()}원
                      </td>
                      <td className="px-4 py-4 text-[13px] text-text-secondary">{order.deliveryDate}</td>
                      <td className="px-4 py-4 text-[13px]">
                        <StatusPill label={order.status} />
                      </td>
                      <td className="px-4 py-4 text-[13px] text-text-secondary">{order.paymentStatus}</td>
                      <td className="px-4 py-4 text-right text-[13px]">
                        {order.source === 'upload' ? (
                          <button
                            type="button"
                            onClick={() => void handleDeleteBatch(order.id)}
                            disabled={deletingBatchId === order.id}
                            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                            {deletingBatchId === order.id ? '삭제 중...' : '삭제'}
                          </button>
                        ) : (
                          <span className="text-text-tertiary">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-10 text-center text-[13px] text-text-secondary">
                        선택한 상태에 해당하는 발주 건이 없습니다.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <PackageCheck size={18} className="text-text-secondary" />
            <CardTitle className="mb-0">운영 메모</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <MemoCard title="작성중" body="업로드 직후에는 초안으로 저장해 두고, 승인 전 검토나 공급처 재분류를 할 수 있게 두는 흐름이 안전합니다." />
          <MemoCard title="부분출고" body="부분 출고 건은 송장 매칭과 입고 현황 페이지에서 함께 추적하도록 연결하면 좋습니다." />
          <MemoCard title="정산대기" body="후불 거래처는 납기 완료 후 정산대기로 자동 이동하는 정책을 붙일 수 있습니다." />
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-bg-secondary p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
        {label}
      </div>
      <div className="mt-3 break-keep text-xl font-black text-foreground md:text-[22px]">{value}</div>
    </div>
  );
}

function UploadInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background px-4 py-4">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">
        {label}
      </div>
      <div className="mt-3 break-words text-[13px] font-semibold leading-5 text-foreground">{value}</div>
    </div>
  );
}

function StatusPill({ label }: { label: string }) {
  const tone =
    label === '출고준비'
      ? 'bg-emerald-500/15 text-emerald-700'
      : label === '승인대기'
      ? 'bg-amber-500/15 text-amber-700'
      : label === '부분출고'
      ? 'bg-sky-500/15 text-sky-700'
      : label === '작성중'
      ? 'bg-violet-500/15 text-violet-700'
      : 'bg-neutral-500/15 text-text-secondary';

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

function MemoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="text-[13px] font-black text-foreground">{title}</div>
      <div className="mt-2 text-[13px] leading-5 text-text-secondary">{body}</div>
    </div>
  );
}
