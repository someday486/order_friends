'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  PackageCheck,
  Phone,
  Store,
  Trash2,
  Truck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { businessOrders, type BusinessOrder } from '@/lib/businessMockData';
import {
  deleteBusinessOrderImportBatch,
  getBusinessOrderImportBatchById,
  updateBusinessOrderImportBatch,
  type BusinessImportedOrderBatch,
} from '@/lib/businessOrderImportStorage';
import {
  getBusinessOrderStatusSuccessMessage,
  getBusinessOrderStatusTone,
  getBusinessOrderWorkflowActions,
  type BusinessOrderWorkflowAction,
} from '@/lib/businessOrderWorkflow';
import toast from 'react-hot-toast';

export default function BusinessOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [uploadedBatch, setUploadedBatch] = useState<BusinessImportedOrderBatch | null>(null);
  const [isLoadingBatch, setIsLoadingBatch] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoadingBatch(true);

    void getBusinessOrderImportBatchById(params.orderId)
      .then((next) => {
        if (active) {
          setUploadedBatch(next);
        }
      })
      .catch(() => {
        if (active) {
          setUploadedBatch(null);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingBatch(false);
        }
      });

    return () => {
      active = false;
    };
  }, [params.orderId]);

  const mockOrder = useMemo(
    () => businessOrders.find((order) => order.id === params.orderId) ?? null,
    [params.orderId],
  );

  const detailType = uploadedBatch ? 'upload' : mockOrder ? 'mock' : 'missing';

  const summary = useMemo(() => {
    if (uploadedBatch) {
      return {
        id: uploadedBatch.id,
        displayId: uploadedBatch.displayId ?? uploadedBatch.id,
        supplier: uploadedBatch.supplierName,
        merchant: '엑셀 업로드',
        itemSummary: uploadedBatch.itemSummary,
        qty: uploadedBatch.totalQty,
        amount: uploadedBatch.totalAmount,
        orderedAt: uploadedBatch.uploadedAt,
        deliveryDate: uploadedBatch.orderDate,
        status: uploadedBatch.status,
        paymentStatus: uploadedBatch.paymentStatus,
      };
    }

    return mockOrder;
  }, [mockOrder, uploadedBatch]);

  async function handleStatusChange(nextStatus: BusinessOrder['status']) {
    if (!uploadedBatch || uploadedBatch.status === nextStatus) return;

    try {
      setIsPending(true);
      const nextBatch = await updateBusinessOrderImportBatch(
        uploadedBatch.id,
        nextStatus,
      );
      setUploadedBatch(nextBatch);
      toast.success(getBusinessOrderStatusSuccessMessage(nextStatus));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '주문 상태 변경에 실패했습니다.';
      toast.error(message);
    } finally {
      setIsPending(false);
    }
  }

  async function handleDeleteBatch() {
    if (!uploadedBatch || isPending) return;

    try {
      setIsPending(true);
      await deleteBusinessOrderImportBatch(uploadedBatch.id);
      toast.success('업로드 주문서를 삭제했습니다.');
      router.push('/business/orders/history');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '업로드 주문서 삭제에 실패했습니다.';
      toast.error(message);
    } finally {
      setIsPending(false);
    }
  }

  if (isLoadingBatch && !uploadedBatch && !mockOrder) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Card className="rounded-[28px] p-0">
          <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
            <div className="text-xl font-black text-foreground">주문서를 불러오는 중입니다.</div>
            <div className="text-[13px] leading-5 text-text-secondary">
              업로드한 주문서를 서버에서 확인하고 있습니다.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (detailType === 'missing' || !summary) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Card className="rounded-[28px] p-0">
          <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
            <div className="text-xl font-black text-foreground">발주를 찾을 수 없습니다.</div>
            <div className="text-[13px] leading-5 text-text-secondary">
              주문내역에서 다시 선택하거나 업로드 페이지에서 새 초안을 만들어 주세요.
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/business/orders/history" className="btn-secondary px-5 py-3 text-sm">
                주문내역으로
              </Link>
              <Link href="/business/orders/upload" className="btn-primary px-5 py-3 text-sm">
                주문서 업로드
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/business/orders/history"
          className="inline-flex items-center gap-2 rounded-2xl border border-border bg-bg-secondary px-4 py-3 text-[13px] font-semibold text-foreground transition-colors hover:bg-bg-tertiary"
        >
          <ArrowLeft size={16} />
          주문내역으로
        </Link>

        {detailType === 'upload' ? (
          <div className="flex flex-wrap gap-2">
            {getBusinessOrderWorkflowActions(summary.status).map((action) => (
              <WorkflowActionButton
                key={action.nextStatus}
                action={action}
                disabled={isPending}
                onClick={() => void handleStatusChange(action.nextStatus)}
              />
            ))}
            <button
              type="button"
              onClick={() => void handleDeleteBatch()}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={16} />
              {isPending ? '처리 중...' : '업로드 삭제'}
            </button>
          </div>
        ) : null}
      </div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
        <Card className="rounded-[28px] p-0">
          <CardHeader className="border-b border-border px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <ClipboardList size={18} className="text-text-secondary" />
                  <CardTitle className="mb-0">발주 요약</CardTitle>
                </div>
                <div className="text-xl font-black tracking-tight text-foreground md:text-[22px]">
                  {'displayId' in summary ? summary.displayId : summary.id}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {detailType === 'upload' ? <Badge variant="info">업로드 초안</Badge> : <Badge variant="default">기존 발주</Badge>}
                <StatusPill label={summary.status} />
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 px-6 py-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryBox icon={Store} label="스토어" value={summary.merchant} />
              <SummaryBox icon={Truck} label="공급처" value={summary.supplier} />
              <SummaryBox icon={PackageCheck} label="수량" value={`${summary.qty}개`} />
              <SummaryBox
                icon={CheckCircle2}
                label="발주금액"
                value={`${summary.amount.toLocaleString()}원`}
              />
            </div>

            <div className="rounded-[24px] border border-border bg-bg-secondary p-5">
              <div className="text-[13px] font-semibold text-foreground">품목 요약</div>
              <div className="mt-2 text-[13px] leading-5 text-text-secondary">{summary.itemSummary}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] p-0">
          <CardHeader className="border-b border-border px-6 py-5">
            <CardTitle className="mb-0">발주 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-6 py-5">
            <InfoLine label="주문일시" value={summary.orderedAt} />
            <InfoLine label="납기" value={summary.deliveryDate} />
            <InfoLine label="결제상태" value={summary.paymentStatus} />
            <InfoLine label="상태" value={summary.status} />
            {uploadedBatch ? <InfoLine label="업로드파일" value={uploadedBatch.fileName} /> : null}
            {uploadedBatch ? (
              <InfoLine label="헤더 행" value={`${uploadedBatch.headerRowIndex + 1}행`} />
            ) : null}
          </CardContent>
        </Card>
      </section>

      {uploadedBatch ? (
        <Card className="overflow-hidden rounded-[28px] p-0">
          <CardHeader className="border-b border-border px-6 py-5">
            <div className="mb-2 flex items-center gap-2">
              <PackageCheck size={18} className="text-text-secondary" />
              <CardTitle className="mb-0">업로드 상세 행</CardTitle>
            </div>
            <div className="text-[13px] leading-5 text-text-secondary">
              실제 저장된 업로드 행입니다. 이후 단계에서 행 편집과 공급처 재분류를 붙일 수 있습니다.
            </div>
          </CardHeader>

          <CardContent className="px-0 pb-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px]">
                <thead className="bg-bg-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                      업체주문번호
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                      품목명
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary">
                      수량
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary">
                      공급가
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary">
                      합계
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                      수령인
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                      연락처
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                      주소
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {uploadedBatch.rows.map((row) => (
                    <tr key={`${uploadedBatch.id}-${row.merchantOrderNo}-${row.productName}`} className="border-t border-border">
                      <td className="px-4 py-4 text-[13px] font-semibold text-foreground">
                        {row.merchantOrderNo}
                      </td>
                      <td className="px-4 py-4 text-[13px] text-foreground">{row.productName}</td>
                      <td className="px-4 py-4 text-right text-[13px] text-foreground">{row.quantity}</td>
                      <td className="px-4 py-4 text-right text-[13px] text-text-secondary">
                        {row.unitPrice == null ? '-' : `${row.unitPrice.toLocaleString()}원`}
                      </td>
                      <td className="px-4 py-4 text-right text-[13px] font-semibold text-foreground">
                        {row.lineAmount == null ? '-' : `${row.lineAmount.toLocaleString()}원`}
                      </td>
                      <td className="px-4 py-4 text-[13px] text-foreground">{row.recipientName}</td>
                      <td className="px-4 py-4 text-[13px] text-text-secondary">
                        <div className="inline-flex items-center gap-2">
                          <Phone size={14} />
                          {row.recipientPhone}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-[13px] text-text-secondary">
                        <div className="max-w-[360px] whitespace-normal break-words">
                          {row.recipientAddress}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-[28px] p-0">
          <CardHeader className="border-b border-border px-6 py-5">
            <CardTitle className="mb-0">기존 발주 메모</CardTitle>
          </CardHeader>
          <CardContent className="px-6 py-5 text-[13px] leading-5 text-text-secondary">
            기존 목업 발주는 아직 행 단위 상세 데이터가 없어서 요약 정보만 표시합니다. 실제 서버 저장 모델이 붙으면 동일한 상세 테이블로 확장할 수 있습니다.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryBox({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Store;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-border bg-background px-4 py-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">
        <Icon size={14} />
        {label}
      </div>
      <div className="mt-3 text-[13px] font-semibold leading-5 text-foreground">{value}</div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-background px-4 py-3 text-[13px] md:flex-row md:items-center md:justify-between">
      <span className="text-text-secondary">{label}</span>
      <span className="text-left font-semibold text-foreground md:text-right">{value}</span>
    </div>
  );
}

function WorkflowActionButton({
  action,
  disabled,
  onClick,
}: {
  action: BusinessOrderWorkflowAction;
  disabled: boolean;
  onClick: () => void;
}) {
  const toneClass =
    action.tone === 'secondary'
      ? 'border border-border bg-background text-text-secondary hover:bg-bg-tertiary hover:text-foreground'
      : action.tone === 'success'
      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
      : 'bg-foreground text-background hover:opacity-90';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
    >
      {action.label}
    </button>
  );
}

function StatusPill({ label }: { label: BusinessOrder['status'] }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${getBusinessOrderStatusTone(label)}`}
    >
      {label}
    </span>
  );
}
