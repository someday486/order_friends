"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatWon } from "@/lib/format";
import { apiClient } from "@/lib/api-client";

// ============================================================
// Types
// ============================================================

type ProductOption = {
  id: string;
  name: string;
  priceDelta: number;
};

type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  options: ProductOption[];
};

type CartItem = {
  product: Product;
  qty: number;
  selectedOptions: ProductOption[];
  itemPrice: number;
};

// ============================================================
// Helpers
// ============================================================


// ============================================================
// Component
// ============================================================

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const branchId = params?.branchId as string;

  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 고객 정보
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress1, setCustomerAddress1] = useState("");
  const [customerAddress2, setCustomerAddress2] = useState("");
  const [customerMemo, setCustomerMemo] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CARD" | "TRANSFER" | "CASH">("CARD");

  // 장바구니 로드
  useEffect(() => {
    const savedCart = sessionStorage.getItem("orderCart");
    const savedBranchId = sessionStorage.getItem("orderBranchId");

    if (!savedCart || savedBranchId !== branchId) {
      router.replace(`/order/branch/${branchId}`);
      return;
    }

    try {
      setCart(JSON.parse(savedCart));
    } catch {
      router.replace(`/order/branch/${branchId}`);
    }
  }, [branchId, router]);

  // 총액 계산
  const totalAmount = cart.reduce((sum, item) => sum + item.itemPrice * item.qty, 0);

  // 주문 제출
  const handleSubmit = async () => {
    if (!customerName.trim()) {
      toast.error("이름을 입력해주세요.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const orderData = {
        branchId,
        customerName,
        customerPhone: customerPhone || undefined,
        customerAddress1: customerAddress1 || undefined,
        customerAddress2: customerAddress2 || undefined,
        customerMemo: customerMemo || undefined,
        paymentMethod,
        items: cart.map((item) => ({
          productId: item.product.id,
          qty: item.qty,
          options: item.selectedOptions.map((opt) => ({ optionId: opt.id })),
        })),
      };

      const result = await apiClient.post("/public/orders", orderData, { auth: false });

      // 장바구니 클리어
      sessionStorage.removeItem("orderCart");
      sessionStorage.removeItem("orderBranchId");

      // 완료 페이지로 이동
      sessionStorage.setItem("lastOrder", JSON.stringify(result));
      router.push(`/order/branch/${branchId}/complete`);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? "주문 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // Render
  // ============================================================

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <p className="text-text-secondary text-center p-10">장바구니가 비어있습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="p-4 border-b border-border">
        <Link href={`/order/branch/${branchId}`} className="text-foreground no-underline hover:text-primary-500 transition-colors">
          ← 돌아가기
        </Link>
        <h1 className="mt-3 mb-0 text-xl font-bold text-foreground">주문서 작성</h1>
      </header>

      <main className="p-4">
        {/* 주문 내역 */}
        <section className="py-4 border-b border-border">
          <h2 className="text-sm font-bold mb-3 text-text-secondary">주문 내역</h2>
          {cart.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 py-2">
              <div className="flex-1">
                <div className="font-semibold text-foreground">{item.product.name}</div>
                {item.selectedOptions.length > 0 && (
                  <div className="text-xs text-text-tertiary mt-0.5">
                    {item.selectedOptions.map((o) => o.name).join(", ")}
                  </div>
                )}
                <div className="text-[13px] text-text-secondary mt-1">
                  {formatWon(item.itemPrice)} × {item.qty}개
                </div>
              </div>
              <div className="font-bold text-foreground">{formatWon(item.itemPrice * item.qty)}</div>
            </div>
          ))}
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-border">
            <span className="text-foreground">총 결제금액</span>
            <span className="text-xl font-extrabold text-foreground">{formatWon(totalAmount)}</span>
          </div>
        </section>

        {/* 고객 정보 */}
        <section className="py-4 border-b border-border">
          <h2 className="text-sm font-bold mb-3 text-text-secondary">고객 정보</h2>

          <div className="mb-4">
            <label className="block text-[13px] text-text-secondary mb-1.5">이름 *</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="홍길동"
              className="input-field w-full h-11"
            />
          </div>

          <div className="mb-4">
            <label className="block text-[13px] text-text-secondary mb-1.5">연락처</label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="010-1234-5678"
              className="input-field w-full h-11"
            />
          </div>

          <div className="mb-4">
            <label className="block text-[13px] text-text-secondary mb-1.5">주소</label>
            <input
              type="text"
              value={customerAddress1}
              onChange={(e) => setCustomerAddress1(e.target.value)}
              placeholder="기본 주소"
              className="input-field w-full h-11"
            />
            <input
              type="text"
              value={customerAddress2}
              onChange={(e) => setCustomerAddress2(e.target.value)}
              placeholder="상세 주소"
              className="input-field w-full h-11 mt-2"
            />
          </div>

          <div className="mb-4">
            <label className="block text-[13px] text-text-secondary mb-1.5">요청사항</label>
            <textarea
              value={customerMemo}
              onChange={(e) => setCustomerMemo(e.target.value)}
              placeholder="예: 문 앞에 놓아주세요"
              rows={2}
              className="input-field w-full h-auto py-2.5 px-3"
            />
          </div>
        </section>

        {/* 결제 수단 */}
        <section className="py-4 border-b border-border">
          <h2 className="text-sm font-bold mb-3 text-text-secondary">결제 수단</h2>
          <div className="flex gap-2">
            {(["CARD", "TRANSFER", "CASH"] as const).map((method) => (
              <button
                key={method}
                onClick={() => setPaymentMethod(method)}
                className={`flex-1 p-3 rounded-[10px] border text-sm font-semibold cursor-pointer transition-colors ${
                  paymentMethod === method
                    ? "bg-bg-tertiary border-border text-foreground"
                    : "bg-transparent border-border text-text-secondary hover:bg-bg-tertiary"
                }`}
              >
                {method === "CARD" && "카드"}
                {method === "TRANSFER" && "계좌이체"}
                {method === "CASH" && "현금"}
              </button>
            ))}
          </div>
        </section>

        {/* Error */}
        {error && <p className="text-danger-500 mt-4">{error}</p>}

        {/* Submit */}
        <button
          className="w-full p-4 mt-6 rounded-xl border-none bg-foreground text-background text-base font-bold cursor-pointer hover:opacity-90 transition-opacity"
          onClick={handleSubmit}
          disabled={loading || !customerName.trim()}
        >
          {loading ? "주문 중..." : `${formatWon(totalAmount)} 결제하기`}
        </button>
      </main>
    </div>
  );
}
