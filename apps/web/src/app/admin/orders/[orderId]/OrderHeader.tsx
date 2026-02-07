"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StatusActions, { statusLabel } from "./StatusActions";

type OrderStatus =
  | "CREATED"
  | "NEW"
  | "PAID"
  | "PREPARING"
  | "SHIPPED"
  | "DONE"
  | "CANCELED";

export default function OrderHeader({
  orderId,
  orderedAt,
  initialStatus,
  onStatusChanged,
}: {
  orderId: string;
  orderedAt: string;
  initialStatus: OrderStatus;
  onStatusChanged?: () => void;
}) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <Link href="/admin/orders" className="text-foreground no-underline hover:text-primary-500 transition-colors">
          ← 주문 목록
        </Link>

        <div className="flex items-center gap-2.5 mt-2.5">
          <h1 className="m-0 text-[22px] font-extrabold text-foreground">주문 상세</h1>
          <span className="inline-flex items-center h-[26px] px-2.5 rounded-full border border-border bg-bg-tertiary text-foreground text-xs">
            {statusLabel[status]}
          </span>
        </div>

        <div className="mt-1.5 text-text-secondary text-[13px]">
          주문번호 <span className="font-mono text-foreground">{orderId}</span> · {orderedAt}
        </div>
      </div>

      <StatusActions
        orderId={orderId}
        initialStatus={status}
        onStatusChange={(s) => {
          setStatus(s);
          onStatusChanged?.();
        }}
      />
    </div>
  );
}
