"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api-client";
import { formatWon } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import {
  loadCustomerInfoFromAuthenticatedUser,
  loadCustomerInfoFromLatestOrder,
  persistCustomerInfoToUserMetadata,
} from "@/lib/customer-info-autofill";
import {
  loadCustomerInfoDraft,
  saveCustomerInfoDraft,
  saveLastOrderRecord,
} from "@/lib/order-session";
import { supabaseBrowser } from "@/lib/supabase/client";
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

export type ShopBrandResponse = {
  brandId: string;
  brandSlug: string;
  brandName: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  fulfillmentType: "DELIVERY";
  paymentMethods: string[];
  transferAccount?: {
    bankName?: string | null;
    accountNumber?: string | null;
    accountHolder?: string | null;
  } | null;
  products: ShopProduct[];
};

type CartItem = ShopProduct & { qty: number };
type CreatedOrder = {
  id: string;
  orderNo: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  transferAccount?: {
    bankName?: string | null;
    accountNumber?: string | null;
    accountHolder?: string | null;
  } | null;
  items: {
    productName: string;
    qty: number;
    unitPrice: number;
    options?: string[];
  }[];
};

const PAYMENT_LABEL: Record<string, string> = {
  CARD: "💳 카드",
  CASH: "💵 현금",
  TRANSFER: "🏦 계좌이체",
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

// ── 상품 이미지 폴백 아이콘 ──
function ProductImageFallback() {
  return (
    <div className="h-28 w-28 rounded-2xl border border-border bg-bg-tertiary flex items-center justify-center flex-shrink-0 md:h-36 md:w-36">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-tertiary">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 01-8 0" />
      </svg>
    </div>
  );
}

export default function ShopBrandPageClient({
  brandSlug,
  initialData,
}: {
  brandSlug: string;
  initialData: ShopBrandResponse | null;
}) {
  const router = useRouter();
  const { status, user } = useAuth();

  const checkoutRef = useRef<HTMLElement>(null);

  // 서버에서 데이터를 받은 경우 즉시 렌더링, 없으면 클라이언트 fetch
  const [data, setData] = useState<ShopBrandResponse | null>(initialData);
  const [loading, setLoading] = useState(initialData === null);
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
  const [authInfoLoaded, setAuthInfoLoaded] = useState(false);
  const authInfoRequestedRef = useRef(false);
  const [loadingLastOrderInfo, setLoadingLastOrderInfo] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
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
    if (status !== "authenticated") {
      authInfoRequestedRef.current = false;
      setAuthInfoLoaded(false);
    }
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!customerInfoReady) return;
    if (authInfoRequestedRef.current) return;

    authInfoRequestedRef.current = true;
    let cancelled = false;

    const fillFromAuthenticatedUser = async () => {
      const next = await loadCustomerInfoFromAuthenticatedUser(user?.user_metadata);
      if (cancelled) return;

      setCustomerName((prev) => prev || next.customerName || "");
      setCustomerPhone((prev) => prev || next.customerPhone || "");
      setCustomerAddress1((prev) => prev || next.customerAddress1 || "");
      setCustomerAddress2((prev) => prev || next.customerAddress2 || "");
      setCustomerMemo((prev) => prev || next.customerMemo || "");
      setAuthInfoLoaded(true);
    };

    void fillFromAuthenticatedUser();

    return () => {
      cancelled = true;
    };
  }, [customerInfoReady, status, user?.user_metadata]);

  const handleLoadLastOrderInfo = async () => {
    if (status !== "authenticated") {
      toast("간편로그인 후 이용해 주세요.");
      return;
    }

    setLoadingLastOrderInfo(true);
    const next = await loadCustomerInfoFromLatestOrder();
    setLoadingLastOrderInfo(false);

    const draft = loadCustomerInfoDraft();
    const merged = {
      customerName: next.customerName || draft?.customerName || "",
      customerPhone: next.customerPhone || draft?.customerPhone || "",
      customerAddress1: next.customerAddress1 || draft?.customerAddress1 || "",
      customerAddress2: next.customerAddress2 || draft?.customerAddress2 || "",
      customerMemo: next.customerMemo || draft?.customerMemo || "",
    };

    const hasData = Boolean(
      merged.customerName ||
        merged.customerPhone ||
        merged.customerAddress1 ||
        merged.customerAddress2 ||
        merged.customerMemo,
    );

    if (!hasData) {
      toast("불러올 지난 주문 정보가 없습니다.");
      return;
    }

    setCustomerName((prev) => merged.customerName || prev);
    setCustomerPhone((prev) => merged.customerPhone || prev);
    setCustomerAddress1((prev) => merged.customerAddress1 || prev);
    setCustomerAddress2((prev) => merged.customerAddress2 || prev);
    setCustomerMemo((prev) => merged.customerMemo || prev);
    setAuthInfoLoaded(true);
    toast.success("지난 주문 정보를 불러왔습니다.");
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      saveCustomerInfoDraft({
        customerName,
        customerPhone,
        customerAddress1,
        customerAddress2,
        customerMemo,
      });

      const { error: signOutError } = await supabaseBrowser.auth.signOut();
      if (signOutError) {
        toast.error(signOutError.message || "로그아웃에 실패했습니다.");
        return;
      }

      toast.success("로그아웃되었습니다.");
    } finally {
      setLoggingOut(false);
    }
  };

  // 서버에서 데이터를 못 받은 경우에만 클라이언트에서 fetch
  useEffect(() => {
    if (initialData !== null) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      saveCustomerInfoDraft({
        customerName,
        customerPhone,
        customerAddress1,
        customerAddress2,
        customerMemo,
      });

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
        order: {
          ...response,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerAddress1: customerAddress1.trim(),
          customerAddress2: customerAddress2 || null,
          customerMemo: customerMemo || null,
          paymentMethod,
          fulfillmentType: "DELIVERY",
          transferAccount: response.transferAccount ?? data.transferAccount ?? null,
        },
        brandSlug: data.brandSlug,
      });
      if (status === "authenticated") {
        void persistCustomerInfoToUserMetadata({
          customerName,
          customerPhone,
          customerAddress1,
          customerAddress2,
          customerMemo,
        });
      }
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
          <div className="h-44 rounded-2xl border border-border bg-bg-secondary animate-pulse" />
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
          <div className="card p-10 text-center">
            <div className="text-3xl mb-3">😕</div>
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
      <div className="max-w-6xl mx-auto px-4 py-6 pb-28 lg:pb-6">
        {/* ── 브랜드 헤더 ── */}
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
              <p className="text-sm text-text-secondary">온라인으로 간편하게 배송 주문하세요.</p>
            </div>
          </div>
        </header>

        <main className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
          {/* ── 상품 목록 ── */}
          <section className="card p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-base font-bold whitespace-nowrap">상품 선택</h2>
              <div className="relative flex-1 max-w-xs">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="상품 검색"
                  className="input-field h-10 w-full pl-8"
                  aria-label="상품 검색"
                />
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="rounded-xl border border-border bg-bg-tertiary p-8 text-center text-sm text-text-secondary">
                표시할 상품이 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredProducts.map((product) => {
                  const qty = cart[product.id] ?? 0;
                  return (
                    <article
                      key={product.id}
                      className="rounded-2xl border border-border bg-bg-secondary p-3 md:p-4 flex items-start gap-4"
                    >
                      {product.imageUrl ? (
                        <Image
                          src={product.imageUrl}
                          alt={product.name}
                          width={144}
                          height={144}
                          className="h-28 w-28 rounded-2xl object-cover border border-border flex-shrink-0 md:h-36 md:w-36"
                          unoptimized
                        />
                      ) : (
                        <ProductImageFallback />
                      )}

                      <div className="flex min-h-28 flex-1 flex-col md:min-h-36">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="text-base md:text-lg font-bold break-keep">{product.name}</h3>
                            {product.categoryName ? (
                              <p className="text-xs text-text-tertiary mt-0.5">{product.categoryName}</p>
                            ) : null}
                          </div>
                          <div className="text-sm md:text-base font-bold whitespace-nowrap text-foreground">{formatWon(product.price)}</div>
                        </div>
                        {product.description ? (
                          <p className="mt-2 text-sm md:text-base text-text-secondary line-clamp-3">{product.description}</p>
                        ) : null}

                        <div className="mt-auto pt-4 flex items-center justify-end">
                          {qty === 0 ? (
                            /* qty=0: "담기" 버튼 */
                            <button
                              type="button"
                              onClick={() => updateQty(product.id, 1)}
                              className="h-10 px-5 rounded-xl border border-primary-500 text-primary-500 text-sm font-semibold bg-primary-500/5 hover:bg-primary-500/15 transition-colors"
                              aria-label={`${product.name} 장바구니에 담기`}
                            >
                              담기
                            </button>
                          ) : (
                            /* qty>0: 수량 조절 */
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="w-11 h-11 rounded-xl border border-border bg-bg-tertiary hover:bg-bg-primary transition-colors text-lg font-bold"
                                onClick={() => updateQty(product.id, qty - 1)}
                                aria-label={`${product.name} 수량 감소`}
                              >
                                −
                              </button>
                              <span className="w-10 text-center text-sm font-bold">{qty}</span>
                              <button
                                type="button"
                                className="w-11 h-11 rounded-xl border border-border bg-bg-tertiary hover:bg-bg-primary transition-colors text-lg font-bold"
                                onClick={() => updateQty(product.id, qty + 1)}
                                aria-label={`${product.name} 수량 증가`}
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── 주문 사이드바 ── */}
          <aside ref={checkoutRef} className="card p-4 h-fit lg:sticky lg:top-4">
            <h2 className="text-base font-bold">배송 주문</h2>

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
            {status === "authenticated" ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleLoadLastOrderInfo}
                  disabled={loadingLastOrderInfo || loggingOut}
                  className="h-10 rounded-xl border border-border bg-bg-tertiary text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loadingLastOrderInfo ? "불러오는 중..." : "이전 주문 불러오기"}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut || loadingLastOrderInfo}
                  className="h-10 rounded-xl border border-border bg-bg-tertiary text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loggingOut ? "로그아웃 중..." : "로그아웃"}
                </button>
              </div>
            ) : null}
            {status === "authenticated" && authInfoLoaded ? (
              <p className="mt-1.5 text-xs text-text-secondary">
                로그인 정보 기반으로 고객 정보가 자동 입력되었습니다.
              </p>
            ) : null}

            {/* 장바구니 요약 */}
            <div className="mt-4 rounded-2xl border border-border bg-bg-tertiary overflow-hidden">
              {cartItems.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-sm text-text-tertiary">상품을 선택하면 여기에 표시됩니다.</p>
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto divide-y divide-border">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
                      <span className="text-sm truncate">{item.name}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-text-tertiary">×{item.qty}</span>
                        <span className="text-sm font-semibold">{formatWon(item.price * item.qty)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {cartItems.length > 0 && (
                <div className="flex justify-between items-center px-4 py-3 border-t border-border bg-bg-secondary">
                  <span className="text-sm font-semibold">합계</span>
                  <span className="text-base font-extrabold">{formatWon(totalAmount)}</span>
                </div>
              )}
            </div>

            {/* 주문자 정보 */}
            <div className="mt-4 space-y-2.5">
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="input-field h-11 w-full"
                placeholder="주문자 이름 *"
                aria-label="주문자 이름"
              />
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="input-field h-11 w-full"
                placeholder="연락처 *"
                aria-label="연락처"
                inputMode="tel"
              />
              <input
                value={customerAddress1}
                onChange={(e) => setCustomerAddress1(e.target.value)}
                className="input-field h-11 w-full"
                placeholder="배송 주소 *"
                aria-label="배송 주소"
              />
              <input
                value={customerAddress2}
                onChange={(e) => setCustomerAddress2(e.target.value)}
                className="input-field h-11 w-full"
                placeholder="상세 주소 (선택)"
                aria-label="상세 주소"
              />
              <textarea
                value={customerMemo}
                onChange={(e) => setCustomerMemo(e.target.value)}
                className="input-field min-h-[72px] w-full"
                placeholder="요청사항 (선택)"
                aria-label="요청사항"
              />

              {/* 결제수단 */}
              <div>
                <div className="text-sm font-semibold mb-2">결제수단</div>
                <div className="grid grid-cols-1 gap-2">
                  {data.paymentMethods.map((method) => (
                    <label
                      key={method}
                      className={`rounded-xl border px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                        paymentMethod === method
                          ? "border-primary-500 bg-primary-500/10 text-primary-500 font-semibold"
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
                {paymentMethod === "TRANSFER" && data.transferAccount ? (
                  <div className="mt-2 rounded-xl border border-warning-200 bg-warning-50 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-sm">🏦</span>
                      <div className="text-xs font-bold text-foreground">입금 계좌 정보</div>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">은행명</span>
                        <span className="font-semibold">{data.transferAccount?.bankName?.trim() || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">계좌번호</span>
                        <span className="font-semibold font-mono">{data.transferAccount?.accountNumber?.trim() || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">예금주</span>
                        <span className="font-semibold">{data.transferAccount?.accountHolder?.trim() || "-"}</span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-warning-600">
                      입금 확인 후 주문이 처리됩니다.
                    </p>
                  </div>
                ) : null}
              </div>

              {submitError ? (
                <p className="text-sm text-danger-500 bg-danger-500/5 rounded-xl px-3 py-2">{submitError}</p>
              ) : null}

              <button
                type="button"
                onClick={submitOrder}
                disabled={submitting || cartItems.length === 0}
                className="w-full p-4 rounded-2xl border-none bg-foreground text-background text-base font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    주문 처리 중...
                  </>
                ) : (
                  `배송 주문하기${totalAmount > 0 ? ` (${formatWon(totalAmount)})` : ""}`
                )}
              </button>
            </div>
          </aside>
        </main>
      </div>

      {/* ── 모바일 전용 스티키 장바구니 바 ── */}
      {totalQty > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 px-4 pb-4 pt-2 bg-background/95 backdrop-blur-sm border-t border-border">
          <button
            type="button"
            onClick={() => checkoutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="w-full p-4 rounded-2xl border-none bg-foreground text-background text-base font-bold cursor-pointer flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-500 text-white text-xs font-bold">
                {totalQty}
              </span>
              장바구니 보기
            </span>
            <span className="font-extrabold">{formatWon(totalAmount)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
