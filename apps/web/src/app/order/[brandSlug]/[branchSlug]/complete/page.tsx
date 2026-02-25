"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { formatDateTimeFull, formatWon } from "@/lib/format";
import { ORDER_STATUS_LABEL_LONG, type OrderStatus } from "@/types/common";
import { apiClient } from "@/lib/api-client";
import { loadLastOrderRecord } from "@/lib/order-session";

type OrderResult = {
  id: string;
  orderNo: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  items: Array<{
    name: string;
    qty: number;
    unitPrice: number;
  }>;
};

function normalizeOrder(raw: unknown): OrderResult | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  if (typeof source.id !== "string") return null;

  const orderNo = source.orderNo ?? source.order_no ?? source.id;
  const status = source.status;
  const totalAmount = source.totalAmount ?? source.total_amount;
  const createdAt = source.createdAt ?? source.created_at;
  const items = Array.isArray(source.items) ? source.items : [];

  if (typeof orderNo !== "string") return null;
  if (typeof status !== "string") return null;
  if (typeof totalAmount !== "number") return null;
  if (typeof createdAt !== "string") return null;

  return {
    id: source.id,
    orderNo,
    status: status as OrderStatus,
    totalAmount,
    createdAt,
    items: items.map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      const name =
        typeof row.name === "string"
          ? row.name
          : typeof row.productName === "string"
            ? row.productName
            : typeof row.product_name_snapshot === "string"
              ? row.product_name_snapshot
              : "-";
      const qty = typeof row.qty === "number" ? row.qty : 0;
      const unitPrice =
        typeof row.unitPrice === "number"
          ? row.unitPrice
          : typeof row.unit_price === "number"
            ? row.unit_price
            : 0;

      return { name, qty, unitPrice };
    }),
  };
}

export default function CompletePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const brandSlug = params?.brandSlug as string;
  const branchSlug = params?.branchSlug as string;
  const orderId = searchParams.get("orderId");

  const [order, setOrder] = useState<OrderResult | null>(() =>
    normalizeOrder(loadLastOrderRecord({ brandSlug, branchSlug })),
  );
  const [loading, setLoading] = useState<boolean>(!order && Boolean(orderId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (order || !orderId) return;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiClient.get(`/public/orders/${orderId}`, { auth: false });
        const normalized = normalizeOrder(data);
        if (!normalized) {
          setError("주문 정보를 확인할 수 없습니다.");
          return;
        }
        setOrder(normalized);
      } catch (e: unknown) {
        setError((e as Error)?.message ?? "주문 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [order, orderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-text-secondary">주문 정보를 불러오는 중...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="p-10 text-center">
          <p className="text-text-secondary">{error ?? "주문 정보를 찾을 수 없습니다."}</p>
          <Link
            href={`/order/${brandSlug}/${branchSlug}`}
            className="inline-block mt-4 text-foreground underline"
          >
            메뉴로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="p-6 text-center">
        <div className="text-[40px] mb-3">완료</div>
        <h1 className="text-2xl font-extrabold mb-2">주문이 완료되었습니다</h1>
        <p className="text-text-secondary">주문 번호를 확인해 주세요</p>
      </div>

      <div className="mx-4 mb-6 p-4 rounded-md border border-border bg-bg-secondary">
        <div className="flex justify-between items-center py-2">
          <span className="text-text-secondary">주문번호</span>
          <span className="font-mono font-bold text-lg">{order.orderNo}</span>
        </div>

        <div className="flex justify-between items-center py-2">
          <span className="text-text-secondary">주문상태</span>
          <span className="text-success font-semibold">
            {ORDER_STATUS_LABEL_LONG[order.status] ?? order.status}
          </span>
        </div>

        <div className="flex justify-between items-center py-2">
          <span className="text-text-secondary">주문일시</span>
          <span>{formatDateTimeFull(order.createdAt)}</span>
        </div>

        <div className="flex justify-between items-center py-2 border-t border-border pt-3 mt-1">
          <span className="text-text-secondary">결제금액</span>
          <span className="text-xl font-extrabold">{formatWon(order.totalAmount)}</span>
        </div>
      </div>

      <div className="px-4">
        <h3 className="text-sm font-semibold text-text-secondary mb-2">주문 내역</h3>
        {order.items.map((item, idx) => (
          <div key={idx} className="flex justify-between py-2 border-b border-border">
            <span>
              {item.name} x {item.qty}
            </span>
            <span className="text-text-secondary">{formatWon(item.unitPrice * item.qty)}</span>
          </div>
        ))}
      </div>

      <div className="p-4 mt-6">
        <Link href={`/order/track/${order.id}`} className="no-underline">
          <button className="w-full py-3.5 rounded-md border-none bg-foreground text-background text-[15px] font-bold cursor-pointer mb-3 hover:opacity-90 transition-opacity">
            주문 상태 확인
          </button>
        </Link>

        <Link href={`/order/${brandSlug}/${branchSlug}`} className="no-underline">
          <button className="w-full py-3.5 rounded-md border border-border bg-transparent text-foreground text-[15px] font-semibold cursor-pointer hover:bg-bg-tertiary transition-colors">
            메뉴로 돌아가기
          </button>
        </Link>
      </div>
    </div>
  );
}
