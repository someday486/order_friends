"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// ============================================================
// Types
// ============================================================

type OrderResult = {
  id: string;
  orderNo: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  items: {
    name: string;
    qty: number;
    unitPrice: number;
  }[];
};

// ============================================================
// Helpers
// ============================================================

function formatWon(amount: number) {
  return amount.toLocaleString("ko-KR") + "원";
}

function formatDateTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const statusLabel: Record<string, string> = {
  CREATED: "주문 접수",
  CONFIRMED: "주문 확인",
  PREPARING: "준비 중",
  READY: "준비 완료",
  COMPLETED: "완료",
  CANCELLED: "취소됨",
  REFUNDED: "환불됨",
};

// ============================================================
// Component
// ============================================================

export default function CompletePage() {
  const params = useParams();
  const branchId = params?.branchId as string;

  const [order, setOrder] = useState<OrderResult | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("lastOrder");
    if (saved) {
      try {
        setOrder(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  if (!order) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="p-10 text-center">
          <p className="text-text-secondary">주문 정보를 찾을 수 없습니다.</p>
          <Link href={`/order/branch/${branchId}`} className="inline-block mt-4 text-foreground underline">
            메뉴로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="p-6 text-center">
        {/* Success Icon */}
        <div className="text-[60px] mb-4">✅</div>

        <h1 className="text-2xl font-extrabold mb-2 text-foreground">
          주문이 완료되었습니다!
        </h1>
        <p className="text-text-secondary m-0">
          주문 번호를 확인해주세요.
        </p>
      </div>

      {/* Order Info */}
      <div className="mx-4 mb-6 p-4 rounded-[14px] border border-border bg-bg-secondary">
        <div className="flex justify-between items-center py-2">
          <span className="text-text-tertiary">주문번호</span>
          <span className="font-mono font-bold text-lg text-foreground">
            {order.orderNo}
          </span>
        </div>

        <div className="flex justify-between items-center py-2">
          <span className="text-text-tertiary">주문상태</span>
          <span className="text-success font-semibold">
            {statusLabel[order.status] ?? order.status}
          </span>
        </div>

        <div className="flex justify-between items-center py-2">
          <span className="text-text-tertiary">주문일시</span>
          <span className="text-foreground">{formatDateTime(order.createdAt)}</span>
        </div>

        <div className="flex justify-between items-center py-2 border-t border-border pt-3 mt-1">
          <span className="text-text-tertiary">결제금액</span>
          <span className="text-xl font-extrabold text-foreground">{formatWon(order.totalAmount)}</span>
        </div>
      </div>

      {/* Order Items */}
      <div className="px-4">
        <h3 className="text-sm font-semibold text-text-tertiary mb-2">주문 내역</h3>
        {order.items.map((item, idx) => (
          <div key={idx} className="flex justify-between py-2 border-b border-border">
            <span className="text-foreground">{item.name} × {item.qty}</span>
            <span className="text-text-secondary">{formatWon(item.unitPrice * item.qty)}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="p-4 mt-6">
        <Link href={`/order/track/${order.id}`} className="no-underline">
          <button className="w-full p-3.5 rounded-xl border-none bg-foreground text-background text-[15px] font-bold cursor-pointer mb-3">주문 상태 확인</button>
        </Link>

        <Link href={`/order/branch/${branchId}`} className="no-underline">
          <button className="w-full p-3.5 rounded-xl border border-border bg-transparent text-foreground text-[15px] font-semibold cursor-pointer">메뉴로 돌아가기</button>
        </Link>
      </div>
    </div>
  );
}
