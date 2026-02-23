"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { formatWon } from "@/lib/format";
import {
  loadCustomerInfoDraft,
  saveCustomerInfoDraft,
  saveLastOrderRecord,
} from "@/lib/order-session";
import { KakaoQuickLoginButton } from "@/components/auth/KakaoQuickLoginButton";

type ShopProduct = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  sortOrder?: number;
};

type ShopBrandResponse = {
  brandId: string;
  brandSlug: string;
  brandName: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  fulfillmentType: "DELIVERY";
  paymentMethods: string[];
  products: ShopProduct[];
};

type CartItem = ShopProduct & { qty: number };
type CreatedOrder = {
  id: string;
  orderNo: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  items: {
    productName: string;
    qty: number;
    unitPrice: number;
    options?: string[];
  }[];
};

const PAYMENT_LABEL: Record<string, string> = {
  CARD: "카드",
  CASH: "현금",
  TRANSFER: "계좌이체",
};

function parseApiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const raw = error.message ?? "";

  const jsonStart = raw.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart)) as {
        message?: string | string[];
      };
      if (Array.isArray(parsed.message) && parsed.message.length > 0) {
        return String(parsed.message[0]);
      }
      if (typeof parsed.message === "string" && parsed.message.trim()) {
        return parsed.message;
      }
    } catch {
      // Ignore parse error and fallback to raw message.
    }
  }

  return raw || fallback;
}

export default function ShopBrandPage() {
  const router = useRouter();
  const params = useParams();
  const brandSlug = String(params?.brandSlug ?? "");

  const [data, setData] = useState<ShopBrandResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState("CARD");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress1, setCustomerAddress1] = useState("");
  const [customerAddress2, setCustomerAddress2] = useState("");
  const [customerMemo, setCustomerMemo] = useState("");
  const [customerInfoReady, setCustomerInfoReady] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const saved = loadCustomerInfoDraft();
    if (saved) {
      setCustomerName(saved.customerName);
      setCustomerPhone(saved.customerPhone);
      setCustomerAddress1(saved.customerAddress1);
      setCustomerAddress2(saved.customerAddress2);
      setCustomerMemo(saved.customerMemo);
    }
    setCustomerInfoReady(true);
  }, []);

  useEffect(() => {
    if (!customerInfoReady) return;
    saveCustomerInfoDraft({
      customerName,
      customerPhone,
      customerAddress1,
      customerAddress2,
      customerMemo,
    });
  }, [
    customerAddress1,
    customerAddress2,
    customerInfoReady,
    customerMemo,
    customerName,
    customerPhone,
  ]);

  useEffect(() => {
    if (!brandSlug) return;

    const loadShop = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.get<ShopBrandResponse>(
          `/public/shop/brands/${encodeURIComponent(brandSlug)}`,
          { auth: false },
        );
        setData(response);
      } catch (e) {
        setError(parseApiErrorMessage(e, "온라인샵 정보를 불러오지 못했습니다."));
      } finally {
        setLoading(false);
      }
    };

    void loadShop();
  }, [brandSlug]);

  useEffect(() => {
    if (!data) return;
    if (data.paymentMethods.length === 0) {
      setPaymentMethod("CARD");
      return;
    }
    if (!data.paymentMethods.includes(paymentMethod)) {
      setPaymentMethod(data.paymentMethods[0]);
    }
  }, [data, paymentMethod]);

  const filteredProducts = useMemo(() => {
    const products = data?.products ?? [];
    const keyword = query.trim().toLowerCase();
    if (!keyword) return products;

    return products.filter((product) => {
      const target = `${product.name} ${product.description ?? ""}`.toLowerCase();
      return target.includes(keyword);
    });
  }, [data, query]);

  const cartItems = useMemo<CartItem[]>(() => {
    if (!data) return [];
    return data.products
      .filter((product) => (cart[product.id] ?? 0) > 0)
      .map((product) => ({ ...product, qty: cart[product.id] ?? 0 }));
  }, [cart, data]);

  const totalQty = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.qty, 0),
    [cartItems],
  );
  const totalAmount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.qty, 0),
    [cartItems],
  );

  const updateQty = (productId: string, nextQty: number) => {
    setCart((prev) => {
      if (nextQty <= 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: nextQty };
    });
  };

  const submitOrder = async () => {
    if (!data) return;
    if (cartItems.length === 0) {
      setSubmitError("상품을 1개 이상 선택해주세요.");
      return;
    }
    if (!customerName.trim()) {
      setSubmitError("주문자 이름을 입력해주세요.");
      return;
    }
    if (!customerPhone.trim()) {
      setSubmitError("연락처를 입력해주세요.");
      return;
    }
    if (!customerAddress1.trim()) {
      setSubmitError("배송 주소를 입력해주세요.");
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);

      const response = await apiClient.post<CreatedOrder>(
        `/public/shop/brands/${encodeURIComponent(data.brandSlug)}/orders`,
        {
          customerName,
          customerPhone,
          customerAddress1,
          customerAddress2: customerAddress2 || undefined,
          customerMemo: customerMemo || undefined,
          paymentMethod,
          items: cartItems.map((item) => ({
            productId: item.id,
            qty: item.qty,
          })),
        },
        { auth: false },
      );

      saveLastOrderRecord({
        order: response,
        brandSlug: data.brandSlug,
      });
      router.push(`/order/track/${encodeURIComponent(response.id)}`);
    } catch (e) {
      setSubmitError(parseApiErrorMessage(e, "주문 생성에 실패했습니다."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="h-40 rounded-2xl border border-border bg-bg-secondary animate-pulse" />
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
            <div className="h-96 rounded-2xl border border-border bg-bg-secondary animate-pulse" />
            <div className="h-96 rounded-2xl border border-border bg-bg-secondary animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-4xl mx-auto p-6">
          <div className="card p-6 text-center">
            <div className="text-base font-semibold mb-2">온라인샵을 불러올 수 없습니다.</div>
            <p className="text-sm text-text-secondary">{error ?? "잠시 후 다시 시도해주세요."}</p>
            {error?.includes("온라인샵 주문을 처리할 지점이 설정되지 않았습니다.") ? (
              <div className="mt-3 text-xs text-text-tertiary">
                브랜드 관리자에서 지점을 1개 이상 등록하고 주문 설정에서 배송 주문을 활성화해주세요.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <header className="overflow-hidden rounded-2xl border border-border bg-bg-secondary">
          <div className="relative h-36 md:h-44">
            {data.coverImageUrl ? (
              <Image
                src={data.coverImageUrl}
                alt={data.brandName}
                fill
                sizes="100vw"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-r from-primary-600/30 via-primary-400/20 to-bg-tertiary" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
          </div>
          <div className="p-4 md:p-5 flex items-center gap-3">
            {data.logoUrl ? (
              <Image
                src={data.logoUrl}
                alt={data.brandName}
                width={48}
                height={48}
                className="w-12 h-12 rounded-full border border-border object-cover"
                unoptimized
              />
            ) : (
              <div className="w-12 h-12 rounded-full border border-border bg-bg-tertiary flex items-center justify-center text-lg font-bold">
                {data.brandName.slice(0, 1)}
              </div>
            )}
            <div>
              <h1 className="text-xl font-extrabold">{data.brandName} 온라인샵</h1>
              <p className="text-sm text-text-secondary">브랜드 상품을 온라인으로 간편하게 배송 주문하세요.</p>
            </div>
          </div>
        </header>

        <main className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
          <section className="card p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-base font-bold">상품 선택</h2>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="상품 검색"
                className="input-field h-10 w-full max-w-xs"
                aria-label="상품 검색"
              />
            </div>

            {filteredProducts.length === 0 ? (
              <div className="rounded-xl border border-border bg-bg-tertiary p-5 text-sm text-text-secondary">
                표시할 상품이 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredProducts.map((product) => {
                  const qty = cart[product.id] ?? 0;
                  return (
                    <article
                      key={product.id}
                      className="rounded-xl border border-border bg-bg-secondary p-3 md:p-4 flex items-start gap-3"
                    >
                      {product.imageUrl ? (
                        <Image
                          src={product.imageUrl}
                          alt={product.name}
                          width={88}
                          height={88}
                          className="w-20 h-20 md:w-22 md:h-22 rounded-lg object-cover border border-border"
                          unoptimized
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-lg border border-border bg-bg-tertiary" />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-sm md:text-base font-bold truncate">{product.name}</h3>
                            {product.categoryName ? (
                              <p className="text-xs text-text-tertiary mt-1">{product.categoryName}</p>
                            ) : null}
                          </div>
                          <div className="text-sm font-semibold whitespace-nowrap">{formatWon(product.price)}</div>
                        </div>
                        {product.description ? (
                          <p className="mt-2 text-sm text-text-secondary line-clamp-2">{product.description}</p>
                        ) : null}

                        <div className="mt-3 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="w-8 h-8 rounded-md border border-border bg-bg-tertiary hover:bg-bg-primary transition-colors"
                            onClick={() => updateQty(product.id, qty - 1)}
                            aria-label={`${product.name} 수량 감소`}
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-sm font-semibold">{qty}</span>
                          <button
                            type="button"
                            className="w-8 h-8 rounded-md border border-border bg-bg-tertiary hover:bg-bg-primary transition-colors"
                            onClick={() => updateQty(product.id, qty + 1)}
                            aria-label={`${product.name} 수량 증가`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

            <aside className="card p-4 h-fit sticky top-4">
              <h2 className="text-base font-bold">배송 주문</h2>
              <p className="mt-1 text-xs text-text-secondary">
                선택 상품 {totalQty}개 · 총 {formatWon(totalAmount)}
              </p>

              <KakaoQuickLoginButton
                className="mt-3"
                beforeLogin={() =>
                  saveCustomerInfoDraft({
                    customerName,
                    customerPhone,
                    customerAddress1,
                    customerAddress2,
                    customerMemo,
                  })
                }
              />

              <div className="mt-4 space-y-2 max-h-52 overflow-y-auto pr-1">
              {cartItems.length === 0 ? (
                <div className="rounded-lg border border-border bg-bg-tertiary p-3 text-sm text-text-secondary">
                  장바구니가 비어 있습니다.
                </div>
              ) : (
                cartItems.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border bg-bg-tertiary p-3">
                    <div className="text-sm font-semibold">{item.name}</div>
                    <div className="mt-1 text-xs text-text-secondary">
                      {item.qty}개 · {formatWon(item.price * item.qty)}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 space-y-3">
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="input-field h-10 w-full"
                placeholder="주문자 이름"
                aria-label="주문자 이름"
              />
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="input-field h-10 w-full"
                placeholder="연락처"
                aria-label="연락처"
              />
              <input
                value={customerAddress1}
                onChange={(e) => setCustomerAddress1(e.target.value)}
                className="input-field h-10 w-full"
                placeholder="배송 주소"
                aria-label="배송 주소"
              />
              <input
                value={customerAddress2}
                onChange={(e) => setCustomerAddress2(e.target.value)}
                className="input-field h-10 w-full"
                placeholder="상세 주소 (선택)"
                aria-label="상세 주소"
              />
              <textarea
                value={customerMemo}
                onChange={(e) => setCustomerMemo(e.target.value)}
                className="input-field min-h-[80px] w-full"
                placeholder="요청사항 (선택)"
                aria-label="요청사항"
              />

              <div>
                <div className="text-sm font-semibold mb-2">결제수단</div>
                <div className="grid grid-cols-1 gap-2">
                  {data.paymentMethods.map((method) => (
                    <label
                      key={method}
                      className={`rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                        paymentMethod === method
                          ? "border-primary-500 bg-primary-500/10 text-primary-500"
                          : "border-border bg-bg-tertiary"
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment-method"
                        value={method}
                        checked={paymentMethod === method}
                        onChange={() => setPaymentMethod(method)}
                        className="sr-only"
                      />
                      {PAYMENT_LABEL[method] ?? method}
                    </label>
                  ))}
                </div>
              </div>

              {submitError ? <p className="text-sm text-danger-500">{submitError}</p> : null}

              <button
                type="button"
                onClick={submitOrder}
                disabled={submitting}
                className="w-full h-11 rounded-lg bg-primary-500 text-white font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "주문 처리 중..." : `배송 주문하기 (${formatWon(totalAmount)})`}
              </button>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
