"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { formatPhone } from "@/lib/format";
import { useSelectedBranch } from "@/hooks/useSelectedBranch";
import BranchSelector from "@/components/admin/BranchSelector";
import {
  type DepositMatchStatus,
  FULFILLMENT_TYPE_LABEL,
  ORDER_STATUS_DISPLAY_LABEL,
  getOrderStatusDisplay,
  type FulfillmentType,
  type OrderStatus,
} from "@/types/common";

type OrderItem = {
  id: string;
  name: string;
  option?: string;
  qty: number;
  unitPrice: number;
};

type OrderDetail = {
  id: string;
  orderNo?: string | null;
  orderedAt: string;
  status: OrderStatus;
  depositMatchStatus?: DepositMatchStatus | null;
  fulfillmentType?: FulfillmentType | null;
  customer: {
    name: string;
    phone: string;
    address1: string;
    address2?: string;
    memo?: string;
  };
  payment: {
    method: "CARD" | "TRANSFER" | "CASH" | null;
    subtotal: number;
    shippingFee: number;
    discount: number;
    total: number;
  };
  cashReceiptRequest?: {
    requested: boolean;
    type?: string | null;
    identityType?: string | null;
    identityValue?: string | null;
  } | null;
  cashReceiptIssue?: {
    provider?: string | null;
    status: string;
    issuedAt?: string | null;
    approvalNo?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  } | null;
  items: OrderItem[];
};

const ALL_BRANCHES_VALUE = "__ALL_BRANCHES__";

const CASH_RECEIPT_TYPE_LABEL: Record<string, string> = {
  INCOME_DEDUCTION: "소득공제용",
  EXPENSE_PROOF: "지출증빙용",
};

const STATUS_FLOW: OrderStatus[] = [
  "CREATED",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
];

const CASH_RECEIPT_STATUS_LABEL: Record<string, string> = {
  REQUESTED: "발행 요청됨",
  ISSUED: "발행 완료",
  FAILED: "발행 실패",
  CANCEL_REQUESTED: "취소 요청됨",
  CANCELLED: "취소 완료",
};

const paymentMethodLabel: Record<string, string> = {
  CARD: "카드",
  TRANSFER: "계좌이체",
  CASH: "현금",
};

const depositMatchLabel: Record<DepositMatchStatus, string> = {
  PENDING: "입금대기",
  AUTO_MATCHED: "자동입금확인",
};

const depositMatchClass: Record<DepositMatchStatus, string> = {
  PENDING: "border-warning-200 bg-warning-50 text-warning-700",
  AUTO_MATCHED: "border-success/30 bg-success/10 text-success",
};

function formatWon(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}

function formatBusinessNumber(value: string) {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{3})(\d{2})(\d{5})/, "$1-$2-$3");
  }
  return value;
}

function getCashReceiptIdentityLabel(identityType?: string | null) {
  if (identityType === "PHONE") return "휴대폰 번호";
  if (identityType === "BUSINESS_NUMBER") return "사업자등록번호";
  return "식별번호";
}

function formatCashReceiptIdentityValue(
  identityType?: string | null,
  identityValue?: string | null,
) {
  if (!identityValue) return "-";
  if (identityType === "PHONE") return formatPhone(identityValue);
  if (identityType === "BUSINESS_NUMBER") {
    return formatBusinessNumber(identityValue);
  }
  return identityValue;
}

function formatCashReceiptProvider(value?: string | null) {
  if (!value) return "-";
  return value.trim().toUpperCase() === "POPBILL" ? "Popbill" : value;
}

function getCashReceiptStatusLabel(status?: string | null) {
  if (!status) return "-";
  return CASH_RECEIPT_STATUS_LABEL[status] ?? status;
}

function formatDateTime(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function nextStatus(current: OrderStatus): OrderStatus | null {
  const idx = STATUS_FLOW.indexOf(current);
  if (idx === -1) return null;
  return STATUS_FLOW[idx + 1] ?? null;
}

function OrderDetailPageContent() {
  const params = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const orderId = params?.orderId;

  const initialBranchId = useMemo(
    () => searchParams?.get("branchId") ?? "",
    [searchParams],
  );
  const { branchId, selectBranch } = useSelectedBranch();
  const branchIdFromQuery =
    initialBranchId && initialBranchId !== ALL_BRANCHES_VALUE
      ? initialBranchId
      : "";
  const selectedBranchId =
    branchId && branchId !== ALL_BRANCHES_VALUE ? branchId : "";
  const effectiveBranchId = branchIdFromQuery || selectedBranchId;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  useEffect(() => {
    if (branchIdFromQuery && branchId !== branchIdFromQuery) {
      selectBranch(branchIdFromQuery);
    }
  }, [branchId, branchIdFromQuery, selectBranch]);

  const isCancellable = useMemo(() => {
    if (!order) return false;
    return (
      order.status !== "COMPLETED" &&
      order.status !== "CANCELLED" &&
      order.status !== "REFUNDED"
    );
  }, [order]);
  const isRefundable = useMemo(() => order?.status === "COMPLETED", [order]);

  useEffect(() => {
    if (!orderId || !effectiveBranchId) return;

    const fetchOrder = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await apiClient.get<OrderDetail>(
          `/admin/orders/${encodeURIComponent(orderId)}?branchId=${encodeURIComponent(effectiveBranchId)}`,
        );
        setOrder(data);
      } catch (e: unknown) {
        const err = e as Error;
        setError(err?.message ?? "조회에 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void fetchOrder();
  }, [effectiveBranchId, orderId]);

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!order || !effectiveBranchId) return;

    try {
      setStatusLoading(true);
      setError(null);

      await apiClient.patch<{ id: string; status: OrderStatus }>(
        `/admin/orders/${encodeURIComponent(order.id)}/status?branchId=${encodeURIComponent(effectiveBranchId)}`,
        { status: newStatus },
      );
      const refreshed = await apiClient.get<OrderDetail>(
        `/admin/orders/${encodeURIComponent(order.id)}?branchId=${encodeURIComponent(effectiveBranchId)}`,
      );
      setOrder(refreshed);
    } catch (e: unknown) {
      const err = e as Error;
      setError(err?.message ?? "상태 변경에 실패했습니다.");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!order) return;
    if (!confirm("정말 주문을 취소하시겠습니까?")) return;
    await handleStatusChange("CANCELLED");
  };

  const handleRefund = async () => {
    if (!order) return;
    if (!confirm("완료된 주문을 환불 처리하시겠습니까?"))
      return;
    await handleStatusChange("REFUNDED");
  };

  if (!effectiveBranchId) {
    return (
      <div>
        <Link
          href="/admin/orders"
          className="text-foreground no-underline transition-colors hover:text-primary-500"
        >
          ← 주문 목록
        </Link>
        <div className="mt-3">
          <BranchSelector />
        </div>
        <p className="mt-3 text-text-secondary">지점을 선택해주세요.</p>
      </div>
    );
  }

  if (loading) {
    return <p className="text-text-secondary">불러오는 중...</p>;
  }

  if (error && !order) {
    return (
      <div>
        <Link
          href="/admin/orders"
          className="text-foreground no-underline transition-colors hover:text-primary-500"
        >
          ← 주문 목록
        </Link>
        <p className="mt-4 text-danger-500">{error}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div>
        <Link
          href="/admin/orders"
          className="text-foreground no-underline transition-colors hover:text-primary-500"
        >
          ← 주문 목록
        </Link>
        <p className="mt-4 text-text-secondary">주문을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const displayStatus = getOrderStatusDisplay(order.status);
  const next = nextStatus(order.status);
  const nextDisplay = next ? getOrderStatusDisplay(next) : null;
  const nextButtonLabel =
    next && nextDisplay === displayStatus
      ? "다음 단계로 변경"
      : nextDisplay
        ? `${ORDER_STATUS_DISPLAY_LABEL[nextDisplay]}로 변경`
        : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/orders"
            className="text-foreground no-underline transition-colors hover:text-primary-500"
          >
            ← 주문 목록
          </Link>

          <div className="mt-2.5 flex items-center gap-2.5">
            <h1 className="m-0 text-[22px] font-extrabold text-foreground">
              주문 상세
            </h1>
            <span className="inline-flex h-[26px] items-center rounded-full border border-border bg-bg-tertiary px-2.5 text-xs text-foreground">
              {ORDER_STATUS_DISPLAY_LABEL[displayStatus]}
            </span>
            {order.depositMatchStatus && (
              <span
                className={`inline-flex h-[26px] items-center rounded-full border px-2.5 text-xs ${depositMatchClass[order.depositMatchStatus]}`}
              >
                {depositMatchLabel[order.depositMatchStatus]}
              </span>
            )}
            {order.fulfillmentType && (
              <span className="inline-flex h-[26px] items-center rounded-full border border-border bg-bg-secondary px-2.5 text-xs text-foreground">
                {FULFILLMENT_TYPE_LABEL[order.fulfillmentType]}
              </span>
            )}
          </div>

          <div className="mt-1.5 text-[13px] text-text-secondary">
            주문번호{" "}
            <span className="font-mono text-foreground">
              {order.orderNo ?? order.id}
            </span>{" "}
            · {formatDateTime(order.orderedAt)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isCancellable && (
            <button
              className="h-9 cursor-pointer rounded-lg border border-border bg-transparent px-4 font-bold text-foreground transition-colors hover:bg-bg-tertiary"
              onClick={handleCancel}
              disabled={statusLoading}
            >
              취소
            </button>
          )}

          {isRefundable && (
            <button
              className="h-9 cursor-pointer rounded-lg border border-danger-200 bg-danger-50 px-4 font-bold text-danger-600 transition-colors hover:bg-danger-100"
              onClick={handleRefund}
              disabled={statusLoading}
            >
              환불
            </button>
          )}

          {next && nextButtonLabel && (
            <button
              className="btn-primary h-9 px-4"
              onClick={() => handleStatusChange(next)}
              disabled={statusLoading}
            >
              {statusLoading ? "변경 중..." : nextButtonLabel}
            </button>
          )}

          {error && <span className="text-xs text-danger-500">{error}</span>}
        </div>
      </div>

      <div className="mt-[18px] grid grid-cols-1 gap-3.5 md:grid-cols-[1.2fr_0.8fr]">
        <section className="card p-3.5">
          <div className="text-sm font-extrabold text-foreground">주문 상품</div>

          <div className="mt-2.5 overflow-hidden rounded-xl border border-border">
            <table className="w-full border-collapse">
              <thead className="bg-bg-tertiary">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-text-secondary">
                    상품
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-text-secondary">
                    옵션
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold text-text-secondary">
                    수량
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold text-text-secondary">
                    단가
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold text-text-secondary">
                    합계
                  </th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-3 py-2.5 text-[13px] text-foreground">
                      {item.name}
                    </td>
                    <td className="px-3 py-2.5 text-[13px] text-text-secondary">
                      {item.option ?? "-"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] text-foreground">
                      {item.qty}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] text-foreground">
                      {formatWon(item.unitPrice)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] text-foreground">
                      {formatWon(item.unitPrice * item.qty)}
                    </td>
                  </tr>
                ))}
                {order.items.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-2.5 text-center text-[13px] text-text-tertiary"
                    >
                      상품 정보가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-border bg-bg-secondary p-3">
              <div className="text-xs text-text-secondary">상품 합계</div>
              <div className="mt-1.5 font-extrabold text-foreground">
                {formatWon(order.payment.subtotal)}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-bg-secondary p-3">
              <div className="text-xs text-text-secondary">총 결제금액</div>
              <div className="mt-1.5 font-extrabold text-foreground">
                {formatWon(order.payment.total)}
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3.5">
          <section className="card p-3.5">
            <div className="text-sm font-extrabold text-foreground">고객 정보</div>

            <div className="grid grid-cols-[90px_1fr] gap-2.5 py-2">
              <div className="text-[13px] text-text-secondary">이름</div>
              <div className="text-[13px] text-foreground">
                {order.customer.name || "-"}
              </div>
            </div>
            <div className="grid grid-cols-[90px_1fr] gap-2.5 py-2">
              <div className="text-[13px] text-text-secondary">연락처</div>
              <div className="text-[13px] text-foreground">
                {order.customer.phone || "-"}
              </div>
            </div>
            <div className="grid grid-cols-[90px_1fr] gap-2.5 py-2">
              <div className="text-[13px] text-text-secondary">주소</div>
              <div className="text-[13px] text-foreground">
                {order.customer.address1 || "-"}
                {order.customer.address2 ? `, ${order.customer.address2}` : ""}
              </div>
            </div>
            <div className="grid grid-cols-[90px_1fr] gap-2.5 py-2">
              <div className="text-[13px] text-text-secondary">메모</div>
              <div className="text-[13px] text-foreground">
                {order.customer.memo ?? "-"}
              </div>
            </div>
          </section>

          <section className="card p-3.5">
            <div className="text-sm font-extrabold text-foreground">결제 정보</div>

            <div className="grid grid-cols-[90px_1fr] gap-2.5 py-2">
              <div className="text-[13px] text-text-secondary">주문 방식</div>
              <div className="text-[13px] text-foreground">
                {order.fulfillmentType
                  ? FULFILLMENT_TYPE_LABEL[order.fulfillmentType]
                  : "-"}
              </div>
            </div>
            <div className="grid grid-cols-[90px_1fr] gap-2.5 py-2">
              <div className="text-[13px] text-text-secondary">결제수단</div>
              <div className="text-[13px] text-foreground">
                {order.payment.method
                  ? (paymentMethodLabel[order.payment.method] ?? order.payment.method)
                  : "-"}
              </div>
            </div>
            <div className="grid grid-cols-[90px_1fr] gap-2.5 py-2">
              <div className="text-[13px] text-text-secondary">상품금액</div>
              <div className="text-[13px] text-foreground">
                {formatWon(order.payment.subtotal)}
              </div>
            </div>
            <div className="grid grid-cols-[90px_1fr] gap-2.5 py-2">
              <div className="text-[13px] text-text-secondary">배달비</div>
              <div className="text-[13px] text-foreground">
                {formatWon(order.payment.shippingFee)}
              </div>
            </div>
            <div className="grid grid-cols-[90px_1fr] gap-2.5 py-2">
              <div className="text-[13px] text-text-secondary">할인</div>
              <div className="text-[13px] text-foreground">
                {formatWon(order.payment.discount)}
              </div>
            </div>

            <div className="mt-2.5 flex justify-between border-t border-border pt-2.5">
              <div className="text-text-secondary">총 결제금액</div>
              <div className="font-extrabold text-foreground">
                {formatWon(order.payment.total)}
              </div>
            </div>
          </section>

          {order.cashReceiptRequest?.requested && (
            <section className="card p-3.5">
              <div className="text-sm font-extrabold text-foreground">
                현금영수증 요청 정보
              </div>

              <div className="grid grid-cols-[90px_1fr] gap-2.5 py-2">
                <div className="text-[13px] text-text-secondary">발행 요청</div>
                <div className="text-[13px] text-foreground">요청됨</div>
              </div>
              <div className="grid grid-cols-[90px_1fr] gap-2.5 py-2">
                <div className="text-[13px] text-text-secondary">발급 유형</div>
                <div className="text-[13px] text-foreground">
                  {CASH_RECEIPT_TYPE_LABEL[order.cashReceiptRequest.type || ""] ||
                    order.cashReceiptRequest.type ||
                    "-"}
                </div>
              </div>
              <div className="grid grid-cols-[90px_1fr] gap-2.5 py-2">
                <div className="text-[13px] text-text-secondary">
                  {getCashReceiptIdentityLabel(order.cashReceiptRequest.identityType)}
                </div>
                <div className="text-[13px] text-foreground">
                  {formatCashReceiptIdentityValue(
                    order.cashReceiptRequest.identityType,
                    order.cashReceiptRequest.identityValue,
                  )}
                </div>
              </div>
            </section>
          )}

          {order.cashReceiptRequest?.requested && (
            <section className="card p-3.5">
              <div className="text-sm font-extrabold text-foreground">
                현금영수증 발행 결과
              </div>

              {order.cashReceiptIssue ? (
                <>
                  <div className="grid grid-cols-[90px_1fr] gap-2.5 py-2">
                    <div className="text-[13px] text-text-secondary">발행 상태</div>
                    <div className="text-[13px] text-foreground">
                      {getCashReceiptStatusLabel(order.cashReceiptIssue.status)}
                    </div>
                  </div>
                  <div className="grid grid-cols-[90px_1fr] gap-2.5 py-2">
                    <div className="text-[13px] text-text-secondary">발급사</div>
                    <div className="text-[13px] text-foreground">
                      {formatCashReceiptProvider(order.cashReceiptIssue.provider)}
                    </div>
                  </div>
                  <div className="grid grid-cols-[90px_1fr] gap-2.5 py-2">
                    <div className="text-[13px] text-text-secondary">발행 시각</div>
                    <div className="text-[13px] text-foreground">
                      {formatDateTime(order.cashReceiptIssue.issuedAt ?? "")}
                    </div>
                  </div>
                  <div className="grid grid-cols-[90px_1fr] gap-2.5 py-2">
                    <div className="text-[13px] text-text-secondary">승인번호</div>
                    <div className="text-[13px] text-foreground">
                      {order.cashReceiptIssue.approvalNo || "-"}
                    </div>
                  </div>
                  {order.cashReceiptIssue.errorMessage && (
                    <div className="grid grid-cols-[90px_1fr] gap-2.5 py-2">
                      <div className="text-[13px] text-text-secondary">실패 사유</div>
                      <div className="text-[13px] text-foreground">
                        {order.cashReceiptIssue.errorMessage}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-2 text-[13px] text-text-secondary">
                  아직 발행 결과가 없습니다. 주문 완료 후 발행 여부를 확인할 수 있습니다.
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense fallback={<div className="text-muted">로딩 중...</div>}>
      <OrderDetailPageContent />
    </Suspense>
  );
}
