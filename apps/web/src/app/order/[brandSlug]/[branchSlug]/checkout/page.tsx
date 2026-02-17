"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api-client";
import { formatWon } from "@/lib/format";
import {
  clearCheckoutDraft,
  loadCheckoutDraft,
  saveLastOrderRecord,
} from "@/lib/order-session";

type FulfillmentType = "PICKUP" | "DELIVERY" | "DINE_IN";
type PaymentMethod = "CARD" | "TRANSFER" | "CASH";

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

type CreateOrderResult = {
  id: string;
  orderNo?: string | null;
  status?: string;
  totalAmount?: number;
  createdAt?: string;
  items?: unknown[];
};

type PublicBranchConfigResponse = {
  enabledFulfillmentTypes?: string[] | null;
  allowedPaymentMethods?: string[] | null;
};

const DEFAULT_FULFILLMENT_TYPES: FulfillmentType[] = ["PICKUP"];
const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = ["CARD", "TRANSFER", "CASH"];

function isFulfillmentType(value: unknown): value is FulfillmentType {
  return value === "PICKUP" || value === "DELIVERY" || value === "DINE_IN";
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === "CARD" || value === "TRANSFER" || value === "CASH";
}

function getFulfillmentLabel(type: FulfillmentType) {
  if (type === "PICKUP") return "포장";
  if (type === "DELIVERY") return "배달";
  return "매장";
}

function getPaymentLabel(method: PaymentMethod) {
  if (method === "CARD") return "카드";
  if (method === "TRANSFER") return "계좌이체";
  return "현금";
}

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const brandSlug = params?.brandSlug as string;
  const branchSlug = params?.branchSlug as string;

  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [branchId, setBranchId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [enabledFulfillmentTypes, setEnabledFulfillmentTypes] = useState<FulfillmentType[]>(
    DEFAULT_FULFILLMENT_TYPES,
  );
  const [allowedPaymentMethods, setAllowedPaymentMethods] = useState<PaymentMethod[]>(
    DEFAULT_PAYMENT_METHODS,
  );
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>("PICKUP");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CARD");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress1, setCustomerAddress1] = useState("");
  const [customerAddress2, setCustomerAddress2] = useState("");
  const [customerMemo, setCustomerMemo] = useState("");

  useEffect(() => {
    let cancelled = false;

    const initializeCheckout = async () => {
      const recovered = loadCheckoutDraft({ brandSlug, branchSlug });
      if (!recovered) {
        router.replace(`/order/${brandSlug}/${branchSlug}`);
        return;
      }

      const recoveredFulfillmentTypes = Array.isArray(recovered.enabledFulfillmentTypes)
        ? recovered.enabledFulfillmentTypes.filter(isFulfillmentType)
        : [];
      const recoveredPaymentMethods = Array.isArray(recovered.allowedPaymentMethods)
        ? recovered.allowedPaymentMethods.filter(isPaymentMethod)
        : [];

      let normalizedFulfillmentTypes =
        recoveredFulfillmentTypes.length > 0 ? recoveredFulfillmentTypes : DEFAULT_FULFILLMENT_TYPES;
      let normalizedPaymentMethods =
        recoveredPaymentMethods.length > 0 ? recoveredPaymentMethods : DEFAULT_PAYMENT_METHODS;

      try {
        const latestConfig = await apiClient.get<PublicBranchConfigResponse>(
          `/public/branches/${encodeURIComponent(recovered.branchId)}`,
          { auth: false },
        );

        const latestFulfillmentTypes = Array.isArray(latestConfig?.enabledFulfillmentTypes)
          ? latestConfig.enabledFulfillmentTypes.filter(isFulfillmentType)
          : [];
        const latestPaymentMethods = Array.isArray(latestConfig?.allowedPaymentMethods)
          ? latestConfig.allowedPaymentMethods.filter(isPaymentMethod)
          : [];

        if (latestFulfillmentTypes.length > 0) {
          normalizedFulfillmentTypes = latestFulfillmentTypes;
        }
        if (latestPaymentMethods.length > 0) {
          normalizedPaymentMethods = latestPaymentMethods;
        }
      } catch {
        // Keep draft values when live config fetch fails.
      }

      const selectedFulfillment = isFulfillmentType(recovered.selectedFulfillmentType)
        ? recovered.selectedFulfillmentType
        : normalizedFulfillmentTypes[0];
      const selectedPayment = isPaymentMethod(recovered.selectedPaymentMethod)
        ? recovered.selectedPaymentMethod
        : normalizedPaymentMethods[0];

      if (cancelled) return;

      setBranchId(recovered.branchId);
      setCart(recovered.cart as CartItem[]);
      setEnabledFulfillmentTypes(normalizedFulfillmentTypes);
      setAllowedPaymentMethods(normalizedPaymentMethods);
      setFulfillmentType(
        normalizedFulfillmentTypes.includes(selectedFulfillment)
          ? selectedFulfillment
          : normalizedFulfillmentTypes[0],
      );
      setPaymentMethod(
        normalizedPaymentMethods.includes(selectedPayment)
          ? selectedPayment
          : normalizedPaymentMethods[0],
      );
      setReady(true);
    };

    initializeCheckout();
    return () => {
      cancelled = true;
    };
  }, [brandSlug, branchSlug, router]);

  const totalAmount = useMemo(
    () => cart.reduce((sum, item) => sum + item.itemPrice * item.qty, 0),
    [cart],
  );

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      toast.error("이름을 입력해 주세요.");
      return;
    }

    if (!branchId) {
      setError("매장 정보가 올바르지 않습니다.");
      return;
    }

    if (fulfillmentType === "DELIVERY" && !customerAddress1.trim()) {
      toast.error("배달 주문은 주소가 필요합니다.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        branchId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress1: customerAddress1 || undefined,
        customerAddress2: customerAddress2 || undefined,
        customerMemo: customerMemo || undefined,
        paymentMethod,
        fulfillmentType,
        items: cart.map((item) => ({
          productId: item.product.id,
          qty: item.qty,
          options: item.selectedOptions.map((opt) => ({ optionId: opt.id })),
        })),
      };

      const result = await apiClient.post<CreateOrderResult>("/public/orders", payload, {
        auth: false,
      });

      clearCheckoutDraft();
      saveLastOrderRecord({
        order: result,
        branchId,
        brandSlug,
        branchSlug,
      });

      const query = result?.id ? `?orderId=${encodeURIComponent(result.id)}` : "";
      router.push(`/order/${brandSlug}/${branchSlug}/complete${query}`);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? "주문 처리 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-text-secondary">주문 정보를 불러오는 중...</p>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-text-secondary">장바구니가 비어 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-lg mx-auto">
        <header className="sticky top-0 z-30 bg-background border-b border-border px-4 py-3">
          <Link
            href={`/order/${brandSlug}/${branchSlug}`}
            className="text-sm text-text-secondary hover:text-foreground transition-colors"
          >
            이전으로
          </Link>
          <h1 className="text-xl font-bold text-foreground mt-2">주문서 작성</h1>
        </header>

        <main className="p-4 pb-8">
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

          <section className="py-4 border-b border-border">
            <h2 className="text-sm font-bold text-text-secondary mb-3">주문 방식</h2>
            <div className="flex gap-2">
              {enabledFulfillmentTypes.map((type) => (
                <button
                  key={type}
                  data-testid={`fulfillment-${type.toLowerCase()}`}
                  onClick={() => setFulfillmentType(type)}
                  className={`
                    flex-1 py-3 rounded-md border text-sm font-semibold transition-all duration-150 touch-feedback
                    ${
                      fulfillmentType === type
                        ? "bg-foreground text-background border-foreground"
                        : "bg-bg-secondary text-foreground border-border hover:bg-bg-tertiary"
                    }
                  `}
                >
                  {getFulfillmentLabel(type)}
                </button>
              ))}
            </div>
          </section>

          <section className="py-4 border-b border-border">
            <h2 className="text-sm font-bold text-text-secondary mb-3">고객 정보</h2>

            <div className="mb-4">
              <label className="block text-xs text-text-secondary mb-1.5 font-medium">이름 *</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                data-testid="customer-name-input"
                placeholder="이름"
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
              <label className="block text-xs text-text-secondary mb-1.5 font-medium">
                {fulfillmentType === "DELIVERY" ? "배달 주소 *" : "주소"}
              </label>
              <input
                type="text"
                value={customerAddress1}
                onChange={(e) => setCustomerAddress1(e.target.value)}
                data-testid="customer-address1-input"
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

          <section className="py-4 border-b border-border">
            <h2 className="text-sm font-bold text-text-secondary mb-3">결제 수단</h2>
            <div className="flex gap-2">
              {allowedPaymentMethods.map((method) => (
                <button
                  key={method}
                  data-testid={`payment-${method.toLowerCase()}`}
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
                  {getPaymentLabel(method)}
                </button>
              ))}
            </div>
          </section>

          {error && <p className="text-danger-500 text-sm mt-4">{error}</p>}

          <button
            data-testid="submit-order-button"
            className="w-full py-4 mt-6 rounded-md bg-primary-500 text-white font-bold text-base
              hover:bg-primary-600 active:scale-95 transition-all duration-150 touch-feedback
              disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSubmit}
            disabled={submitting || !customerName.trim()}
          >
            {submitting ? "주문 중..." : `${formatWon(totalAmount)} 결제하기`}
          </button>
        </main>
      </div>
    </div>
  );
}


