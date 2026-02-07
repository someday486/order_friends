"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

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
// Constants
// ============================================================

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

// ============================================================
// Helpers
// ============================================================

function formatWon(amount: number) {
  return amount.toLocaleString("ko-KR") + "원";
}

// ============================================================
// Component
// ============================================================

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const brandSlug = params?.brandSlug as string;
  const branchSlug = params?.branchSlug as string;

  const [branchId, setBranchId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress1, setCustomerAddress1] = useState("");
  const [customerAddress2, setCustomerAddress2] = useState("");
  const [customerMemo, setCustomerMemo] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CARD" | "TRANSFER" | "CASH">("CARD");

  useEffect(() => {
    const savedCart = sessionStorage.getItem("orderCart");
    const savedBranchId = sessionStorage.getItem("orderBranchId");
    const savedBrandSlug = sessionStorage.getItem("orderBrandSlug");
    const savedBranchSlug = sessionStorage.getItem("orderBranchSlug");

    if (!savedCart || !savedBranchId || savedBrandSlug !== brandSlug || savedBranchSlug !== branchSlug) {
      router.replace(`/order/${brandSlug}/${branchSlug}`);
      return;
    }

    setBranchId(savedBranchId);

    try {
      setCart(JSON.parse(savedCart));
    } catch {
      router.replace(`/order/${brandSlug}/${branchSlug}`);
    }
  }, [brandSlug, branchSlug, router]);

  const totalAmount = cart.reduce((sum, item) => sum + item.itemPrice * item.qty, 0);

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      alert("이름을 입력해 주세요.");
      return;
    }

    if (!branchId) {
      setError("가게 정보를 불러올 수 없습니다.");
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

      const res = await fetch(`${API_BASE}/public/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`주문 실패: ${res.status} ${text}`);
      }

      const result = await res.json();

      sessionStorage.removeItem("orderCart");
      sessionStorage.removeItem("orderBranchId");
      sessionStorage.removeItem("orderBrandSlug");
      sessionStorage.removeItem("orderBranchSlug");

      sessionStorage.setItem("lastOrder", JSON.stringify(result));
      router.push(`/order/${brandSlug}/${branchSlug}/complete`);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? "주문 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-text-tertiary">장바구니가 비어 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-background border-b border-border px-4 py-3">
          <Link
            href={`/order/${brandSlug}/${branchSlug}`}
            className="text-sm text-text-secondary hover:text-foreground transition-colors"
          >
            ← 뒤로
          </Link>
          <h1 className="text-xl font-bold text-foreground mt-2">주문 작성</h1>
        </header>

        <main className="p-4 pb-8">
          {/* Order Items */}
          <section className="py-4 border-b border-border">
            <h2 className="text-sm font-bold text-text-secondary mb-3">주문 내역</h2>
            {cart.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">{item.product.name}</div>
                  {item.selectedOptions.length > 0 && (
                    <div className="text-2xs text-text-tertiary mt-0.5">
                      {item.selectedOptions.map((o) => o.name).join(", ")}
                    </div>
                  )}
                  <div className="text-xs text-text-secondary mt-1">
                    {formatWon(item.itemPrice)} x {item.qty}
                  </div>
                </div>
                <div className="text-sm font-bold text-foreground">{formatWon(item.itemPrice * item.qty)}</div>
              </div>
            ))}
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-border-light">
              <span className="text-sm text-text-secondary">총 결제금액</span>
              <span className="text-xl font-extrabold text-foreground">{formatWon(totalAmount)}</span>
            </div>
          </section>

          {/* Customer Info */}
          <section className="py-4 border-b border-border">
            <h2 className="text-sm font-bold text-text-secondary mb-3">고객 정보</h2>

            <div className="mb-4">
              <label className="block text-xs text-text-secondary mb-1.5 font-medium">이름 *</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="홍길동"
                className="input-field"
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs text-text-secondary mb-1.5 font-medium">연락처</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="010-1234-5678"
                className="input-field"
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs text-text-secondary mb-1.5 font-medium">주소</label>
              <input
                type="text"
                value={customerAddress1}
                onChange={(e) => setCustomerAddress1(e.target.value)}
                placeholder="기본 주소"
                className="input-field mb-2"
              />
              <input
                type="text"
                value={customerAddress2}
                onChange={(e) => setCustomerAddress2(e.target.value)}
                placeholder="상세 주소"
                className="input-field"
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs text-text-secondary mb-1.5 font-medium">요청사항</label>
              <textarea
                value={customerMemo}
                onChange={(e) => setCustomerMemo(e.target.value)}
                placeholder="요청사항을 입력해 주세요"
                rows={2}
                className="input-field resize-y"
              />
            </div>
          </section>

          {/* Payment Method */}
          <section className="py-4 border-b border-border">
            <h2 className="text-sm font-bold text-text-secondary mb-3">결제 수단</h2>
            <div className="flex gap-2">
              {(["CARD", "TRANSFER", "CASH"] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`
                    flex-1 py-3 rounded-md border text-sm font-semibold transition-all duration-150 touch-feedback
                    ${
                      paymentMethod === method
                        ? "bg-foreground text-background border-foreground"
                        : "bg-bg-secondary text-foreground border-border hover:bg-bg-tertiary"
                    }
                  `}
                >
                  {method === "CARD" && "카드"}
                  {method === "TRANSFER" && "계좌이체"}
                  {method === "CASH" && "현금"}
                </button>
              ))}
            </div>
          </section>

          {/* Error */}
          {error && (
            <p className="text-danger-500 text-sm mt-4 animate-shake">{error}</p>
          )}

          {/* Submit */}
          <button
            className="w-full py-4 mt-6 rounded-md bg-primary-500 text-white font-bold text-base
              hover:bg-primary-600 active:scale-95 transition-all duration-150 touch-feedback
              disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSubmit}
            disabled={loading || !customerName.trim()}
          >
            {loading ? "주문 중..." : `${formatWon(totalAmount)} 결제하기`}
          </button>
        </main>
      </div>
    </div>
  );
}
