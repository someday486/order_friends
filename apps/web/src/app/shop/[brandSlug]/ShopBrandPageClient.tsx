'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AddressSearchFields } from '@/components/order/AddressSearchFields';
import Modal from '@/components/ui/Modal';
import { apiClient } from '@/lib/api-client';
import { formatWon } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import {
  loadCustomerInfoFromAuthenticatedUser,
  loadCustomerInfoFromLatestOrder,
  persistCustomerInfoToUserMetadata,
} from '@/lib/customer-info-autofill';
import {
  loadCustomerInfoDraft,
  saveCustomerInfoDraft,
  saveLastOrderRecord,
} from '@/lib/order-session';
import { supabaseBrowser } from '@/lib/supabase/client';

type ShopProduct = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  discountPrice?: number;
  urgentDiscountEndAt?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[];
  categoryId?: string | null;
  categoryName?: string | null;
  sortOrder?: number;
};

export type ShopBrandResponse = {
  brandId: string;
  brandSlug: string;
  brandName: string;
  cashReceiptEnabled?: boolean | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  fulfillmentType: 'DELIVERY';
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
  CARD: '💳 카드',
  TRANSFER: '🏦 계좌이체',
};

function normalizePhoneNumber(value: string) {
  return value.replace(/[^\d]/g, '');
}

function parseApiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const raw = error.message ?? '';

  const jsonStart = raw.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart)) as {
        message?: string | string[];
      };
      if (Array.isArray(parsed.message) && parsed.message.length > 0) {
        return String(parsed.message[0]);
      }
      if (typeof parsed.message === 'string' && parsed.message.trim()) {
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
    <div className="h-32 w-32 rounded-2xl border border-border bg-bg-tertiary flex items-center justify-center flex-shrink-0 md:h-44 md:w-44">
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-text-tertiary"
      >
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 01-8 0" />
      </svg>
    </div>
  );
}

function getShopProductImageUrls(product: ShopProduct): string[] {
  const imageUrls = Array.isArray(product.imageUrls)
    ? product.imageUrls
        .filter((url): url is string => typeof url === 'string')
        .map((url) => url.trim())
        .filter(Boolean)
    : [];
  if (imageUrls.length > 0) return imageUrls;
  if (product.imageUrl && product.imageUrl.trim()) return [product.imageUrl.trim()];
  return [];
}

function hasActiveUrgentDiscount(product: ShopProduct) {
  return (
    typeof product.discountPrice === 'number' &&
    product.discountPrice >= 0 &&
    product.discountPrice < product.price
  );
}

function getEffectivePrice(product: ShopProduct) {
  return hasActiveUrgentDiscount(product) ? product.discountPrice! : product.price;
}

function getUrgentDiscountRemainingLabel(urgentDiscountEndAt?: string | null) {
  if (!urgentDiscountEndAt) return null;
  const endTs = Date.parse(urgentDiscountEndAt);
  if (Number.isNaN(endTs)) return null;
  const diffMs = endTs - Date.now();
  if (diffMs <= 0) return '곧 종료';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return '1분 미만';
  if (minutes < 60) return `${minutes}분 남음`;
  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  if (remainMinutes === 0) return `${hours}시간 남음`;
  return `${hours}시간 ${remainMinutes}분 남음`;
}

function ShopProductImageCarousel({
  product,
  onOpenPreview,
}: {
  product: ShopProduct;
  onOpenPreview: (product: ShopProduct, startIndex?: number) => void;
}) {
  const imageUrls = getShopProductImageUrls(product);
  const [index, setIndex] = useState(0);

  const safeIndex = imageUrls.length > 0 ? index % imageUrls.length : 0;
  const currentUrl = imageUrls[safeIndex] ?? null;

  if (!currentUrl) {
    return <ProductImageFallback />;
  }

  return (
    <div className="group relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-2xl border border-border bg-bg-tertiary md:h-44 md:w-44">
      <button
        type="button"
        onClick={() => onOpenPreview(product, safeIndex)}
        className="relative h-full w-full border-0 p-0"
        aria-label={`${product.name} 이미지 크게 보기`}
      >
        <Image
          src={currentUrl}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 128px, 176px"
          quality={100}
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-2 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
          크게 보기
        </div>
      </button>

      {imageUrls.length > 1 && (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIndex((prev) => (prev === 0 ? imageUrls.length - 1 : prev - 1));
            }}
            className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/55 text-white text-xs leading-none inline-flex items-center justify-center hover:bg-black/70 transition-colors"
            aria-label="이전 이미지"
          >
            {'<'}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIndex((prev) => (prev === imageUrls.length - 1 ? 0 : prev + 1));
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/55 text-white text-xs leading-none inline-flex items-center justify-center hover:bg-black/70 transition-colors"
            aria-label="다음 이미지"
          >
            {'>'}
          </button>
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1">
            {imageUrls.slice(0, 5).map((_, dotIndex) => (
              <span
                key={dotIndex}
                className={`w-1.5 h-1.5 rounded-full ${
                  dotIndex === safeIndex ? 'bg-white' : 'bg-white/45'
                }`}
              />
            ))}
          </div>
        </>
      )}
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
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState('CARD');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress1, setCustomerAddress1] = useState('');
  const [customerAddress2, setCustomerAddress2] = useState('');
  const [customerMemo, setCustomerMemo] = useState('');
  const [cashReceiptRequested, setCashReceiptRequested] = useState(false);
  const [customerInfoReady, setCustomerInfoReady] = useState(false);
  const [authInfoLoaded, setAuthInfoLoaded] = useState(false);
  const authInfoRequestedRef = useRef(false);
  const [loadingLastOrderInfo, setLoadingLastOrderInfo] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<ShopProduct | null>(
    null,
  );
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const normalizedCashReceiptPhone = useMemo(
    () => normalizePhoneNumber(customerPhone),
    [customerPhone],
  );
  const supportsReceiptRequest =
    paymentMethod === 'TRANSFER';
  const canRequestReceipt =
    data?.cashReceiptEnabled === true && supportsReceiptRequest;

  useEffect(() => {
    if (canRequestReceipt) return;
    setCashReceiptRequested(false);
  }, [canRequestReceipt]);

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
    if (status !== 'authenticated') {
      authInfoRequestedRef.current = false;
      setAuthInfoLoaded(false);
    }
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (!customerInfoReady) return;
    if (authInfoRequestedRef.current) return;

    authInfoRequestedRef.current = true;
    let cancelled = false;

    const fillFromAuthenticatedUser = async () => {
      const next = await loadCustomerInfoFromAuthenticatedUser(
        user?.user_metadata,
      );
      if (cancelled) return;

      setCustomerName((prev) => prev || next.customerName || '');
      setCustomerPhone((prev) => prev || next.customerPhone || '');
      setCustomerAddress1((prev) => prev || next.customerAddress1 || '');
      setCustomerAddress2((prev) => prev || next.customerAddress2 || '');
      setCustomerMemo((prev) => prev || next.customerMemo || '');
      setAuthInfoLoaded(true);
    };

    void fillFromAuthenticatedUser();

    return () => {
      cancelled = true;
    };
  }, [customerInfoReady, status, user?.user_metadata]);

  const handleLoadLastOrderInfo = async () => {
    if (status !== 'authenticated') {
      toast('간편로그인 후 이용해 주세요.');
      return;
    }

    setLoadingLastOrderInfo(true);
    const next = await loadCustomerInfoFromLatestOrder();
    setLoadingLastOrderInfo(false);

    const draft = loadCustomerInfoDraft();
    const merged = {
      customerName: next.customerName || draft?.customerName || '',
      customerPhone: next.customerPhone || draft?.customerPhone || '',
      customerAddress1: next.customerAddress1 || draft?.customerAddress1 || '',
      customerAddress2: next.customerAddress2 || draft?.customerAddress2 || '',
      customerMemo: next.customerMemo || draft?.customerMemo || '',
    };

    const hasData = Boolean(
      merged.customerName ||
      merged.customerPhone ||
      merged.customerAddress1 ||
      merged.customerAddress2 ||
      merged.customerMemo,
    );

    if (!hasData) {
      toast('불러올 지난 주문 정보가 없습니다.');
      return;
    }

    setCustomerName((prev) => merged.customerName || prev);
    setCustomerPhone((prev) => merged.customerPhone || prev);
    setCustomerAddress1((prev) => merged.customerAddress1 || prev);
    setCustomerAddress2((prev) => merged.customerAddress2 || prev);
    setCustomerMemo((prev) => merged.customerMemo || prev);
    setAuthInfoLoaded(true);
    toast.success('지난 주문 정보를 불러왔습니다.');
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
        toast.error(signOutError.message || '로그아웃에 실패했습니다.');
        return;
      }

      toast.success('로그아웃되었습니다.');
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
        setError(
          parseApiErrorMessage(e, '온라인샵 정보를 불러오지 못했습니다.'),
        );
      } finally {
        setLoading(false);
      }
    };

    void loadShop();
  }, [brandSlug, initialData]);

  useEffect(() => {
    if (!data) return;
    if (data.paymentMethods.length === 0) {
      setPaymentMethod('CARD');
      return;
    }
    if (!data.paymentMethods.includes(paymentMethod)) {
      setPaymentMethod(data.paymentMethods[0]);
    }
  }, [data, paymentMethod]);

  const filteredProducts = useMemo(() => {
    const products = data?.products ?? [];
    const keyword = query.trim().toLowerCase();
    const filtered = !keyword
      ? products
      : products.filter((product) => {
      const target =
        `${product.name} ${product.description ?? ''}`.toLowerCase();
      return target.includes(keyword);
    });

    return [...filtered].sort((a, b) => {
      const aUrgent = hasActiveUrgentDiscount(a);
      const bUrgent = hasActiveUrgentDiscount(b);
      if (aUrgent !== bUrgent) return aUrgent ? -1 : 1;

      const aSort = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const bSort = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
      if (aSort !== bSort) return aSort - bSort;

      return a.name.localeCompare(b.name, 'ko');
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
    () => cartItems.reduce((sum, item) => sum + getEffectivePrice(item) * item.qty, 0),
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

  const openProductPreview = (product: ShopProduct, startIndex = 0) => {
    const imageUrls = getShopProductImageUrls(product);
    if (imageUrls.length === 0) return;
    const safeIndex = Math.min(Math.max(0, startIndex), imageUrls.length - 1);
    setPreviewImageIndex(safeIndex);
    setPreviewProduct(product);
  };

  const submitOrder = async () => {
    if (!data) return;
    if (cartItems.length === 0) {
      setSubmitError('상품을 1개 이상 선택해주세요.');
      return;
    }
    if (!customerName.trim()) {
      setSubmitError('주문자 이름을 입력해주세요.');
      return;
    }
    if (!customerPhone.trim()) {
      setSubmitError('연락처를 입력해주세요.');
      return;
    }
    if (!customerAddress1.trim()) {
      setSubmitError('배송 주소를 입력해주세요.');
      return;
    }

    if (
      canRequestReceipt &&
      cashReceiptRequested &&
      ![10, 11].includes(normalizedCashReceiptPhone.length)
    ) {
      setSubmitError('현금영수증 발급을 위해 휴대폰 번호를 정확히 입력해주세요.');
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
          cashReceipt: canRequestReceipt && cashReceiptRequested
            ? {
                requested: true,
                type: 'INCOME_DEDUCTION',
                identityType: 'PHONE',
                identityValue: normalizedCashReceiptPhone,
              }
            : undefined,
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
          fulfillmentType: 'DELIVERY',
          transferAccount:
            response.transferAccount ?? data.transferAccount ?? null,
        },
        brandSlug: data.brandSlug,
      });
      if (status === 'authenticated') {
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
      setSubmitError(parseApiErrorMessage(e, '주문 생성에 실패했습니다.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-[1180px] px-4 py-6">
          <div className="h-44 rounded-2xl border border-border bg-bg-secondary animate-pulse" />
          <div className="mt-4 grid grid-cols-1 gap-4 lg:mx-auto lg:max-w-[1012px] lg:grid-cols-[680px_320px] lg:gap-3">
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
            <div className="text-base font-semibold mb-2">
              온라인샵을 불러올 수 없습니다.
            </div>
            <p className="text-sm text-text-secondary">
              {error ?? '잠시 후 다시 시도해주세요.'}
            </p>
            {error?.includes(
              '온라인샵 주문을 처리할 지점이 설정되지 않았습니다.',
            ) ? (
              <div className="mt-3 text-xs text-text-tertiary">
                브랜드 관리자에서 지점을 1개 이상 등록하고 주문 설정에서 배송
                주문을 활성화해주세요.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1180px] px-4 py-6 pb-28 lg:pb-6">
        {/* ── 브랜드 헤더 ── */}
        <header className="overflow-hidden rounded-2xl border border-border bg-bg-secondary lg:mx-auto lg:max-w-[1012px]">
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
              <h1 className="text-xl font-extrabold">
                {data.brandName} 온라인샵
              </h1>
              <p className="text-sm text-text-secondary">
                온라인으로 간편하게 배송 주문하세요.
              </p>
            </div>
          </div>
        </header>

        <main className="mt-4 grid grid-cols-1 gap-4 lg:mx-auto lg:max-w-[1012px] lg:grid-cols-[680px_320px] lg:gap-3">
          {/* ── 상품 목록 ── */}
          <section className="card p-4 lg:max-w-[680px]">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-base font-bold whitespace-nowrap">
                상품 선택
              </h2>
              <div className="relative flex-1 max-w-[260px]">
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
              <div className="space-y-3 lg:max-w-[620px]">
                {filteredProducts.map((product) => {
                  const qty = cart[product.id] ?? 0;
                  const hasDiscount = hasActiveUrgentDiscount(product);
                  const discountRate = hasDiscount
                    ? Math.round(
                        ((product.price - product.discountPrice!) / product.price) * 100,
                      )
                    : 0;
                  const urgentLabel = hasDiscount
                    ? getUrgentDiscountRemainingLabel(product.urgentDiscountEndAt)
                    : null;
                  return (
                    <article
                      key={product.id}
                      className="rounded-2xl border border-border bg-bg-secondary p-3 md:p-4 flex items-start gap-4"
                    >
                      <ShopProductImageCarousel
                        product={product}
                        onOpenPreview={openProductPreview}
                      />

                      <div className="flex min-h-32 flex-1 flex-col md:min-h-44">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="text-base md:text-lg font-bold break-keep">
                              {product.name}
                            </h3>
                            {hasDiscount && (
                              <div className="mt-1">
                                <span className="inline-flex items-center rounded-full bg-danger-500 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse-slow">
                                  ⚡ 긴급할인{urgentLabel ? ` · ${urgentLabel}` : ''}
                                </span>
                              </div>
                            )}
                            {product.categoryName ? (
                              <p className="text-xs text-text-tertiary mt-0.5">
                                {product.categoryName}
                              </p>
                            ) : null}
                          </div>
                          <div className="text-right whitespace-nowrap">
                            {hasDiscount ? (
                              <>
                                <div className="text-[11px] md:text-xs text-text-tertiary line-through">
                                  {formatWon(product.price)}
                                </div>
                                <div className="text-[11px] md:text-xs font-bold text-danger-500">
                                  {discountRate}% 할인
                                </div>
                                <div className="text-base md:text-lg font-extrabold text-danger-500">
                                  {formatWon(product.discountPrice ?? product.price)}
                                </div>
                              </>
                            ) : (
                              <div className="text-sm md:text-base font-bold text-foreground">
                                {formatWon(product.price)}
                              </div>
                            )}
                          </div>
                        </div>
                        {product.description ? (
                          <p className="mt-2 text-sm md:text-base text-text-secondary line-clamp-3">
                            {product.description}
                          </p>
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
                              <span className="w-10 text-center text-sm font-bold">
                                {qty}
                              </span>
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
          <aside
            ref={checkoutRef}
            className="card p-4 h-fit lg:sticky lg:top-4 lg:w-[320px]"
          >
            <h2 className="text-base font-bold">배송 주문</h2>

            {status === 'authenticated' ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void handleLoadLastOrderInfo();
                  }}
                  disabled={loadingLastOrderInfo || loggingOut}
                  className="h-10 rounded-xl border border-border bg-bg-tertiary text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loadingLastOrderInfo
                    ? '불러오는 중...'
                    : '이전 주문 불러오기'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleLogout();
                  }}
                  disabled={loggingOut || loadingLastOrderInfo}
                  className="h-10 rounded-xl border border-border bg-bg-tertiary text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loggingOut ? '로그아웃 중...' : '로그아웃'}
                </button>
              </div>
            ) : null}
            {status === 'authenticated' && authInfoLoaded ? (
              <p className="mt-1.5 text-xs text-text-secondary">
                로그인 정보 기반으로 고객 정보가 자동 입력되었습니다.
              </p>
            ) : null}

            {/* 장바구니 요약 */}
            <div className="mt-4 rounded-2xl border border-border bg-bg-tertiary overflow-hidden">
              {cartItems.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-sm text-text-tertiary">
                    상품을 선택하면 여기에 표시됩니다.
                  </p>
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto divide-y divide-border">
                  {cartItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-4 py-2.5 gap-3"
                    >
                      <span className="text-sm truncate">{item.name}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-text-tertiary">
                          ×{item.qty}
                        </span>
                        <span className="text-sm font-semibold">
                          {formatWon(getEffectivePrice(item) * item.qty)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {cartItems.length > 0 && (
                <div className="flex justify-between items-center px-4 py-3 border-t border-border bg-bg-secondary">
                  <span className="text-sm font-semibold">합계</span>
                  <span className="text-base font-extrabold">
                    {formatWon(totalAmount)}
                  </span>
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
              <AddressSearchFields
                addressLabel="배송 주소"
                address1={customerAddress1}
                address2={customerAddress2}
                onAddress1Change={setCustomerAddress1}
                onAddress2Change={setCustomerAddress2}
                address1Placeholder="배송 주소 *"
                address2Placeholder="상세 주소 (선택)"
                className="space-y-0"
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
                          ? 'border-primary-500 bg-primary-500/10 text-primary-500 font-semibold'
                          : 'border-border bg-bg-tertiary'
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
                {paymentMethod === 'TRANSFER' && data.transferAccount ? (
                  <div className="mt-2 rounded-xl border border-warning-200 bg-warning-50 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-sm">🏦</span>
                      <div className="text-xs font-bold text-foreground">
                        입금 계좌 정보
                      </div>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">은행명</span>
                        <span className="font-semibold">
                          {data.transferAccount?.bankName?.trim() || '-'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">계좌번호</span>
                        <span className="font-semibold font-mono">
                          {data.transferAccount?.accountNumber?.trim() || '-'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">예금주</span>
                        <span className="font-semibold">
                          {data.transferAccount?.accountHolder?.trim() || '-'}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-warning-600">
                      입금 확인 후 주문이 처리됩니다.
                    </p>
                  </div>
                ) : null}

                {canRequestReceipt ? (
                  <div className="mt-3 rounded-xl border border-border bg-bg-secondary p-3">
                    <label className="flex items-center gap-3 text-sm font-semibold text-foreground">
                      <input
                        type="checkbox"
                        checked={cashReceiptRequested}
                        onChange={(e) =>
                          setCashReceiptRequested(e.target.checked)
                        }
                      />
                      현금영수증 발급 요청
                    </label>
                    <p className="mt-2 text-xs text-text-secondary">
                      주문자 휴대폰 번호로 소득공제용 현금영수증을 발급합니다.
                    </p>
                    {cashReceiptRequested ? (
                      <div className="mt-3 rounded-lg border border-border bg-background px-3 py-3 text-sm text-text-secondary">
                        발급 번호: {customerPhone.trim() || '휴대폰 번호를 먼저 입력해 주세요.'}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {submitError ? (
                <p className="text-sm text-danger-500 bg-danger-500/5 rounded-xl px-3 py-2">
                  {submitError}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  void submitOrder();
                }}
                disabled={submitting || cartItems.length === 0}
                className="w-full p-4 rounded-2xl border-none bg-foreground text-background text-base font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg
                      className="animate-spin w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    주문 처리 중...
                  </>
                ) : (
                  `배송 주문하기${totalAmount > 0 ? ` (${formatWon(totalAmount)})` : ''}`
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
            onClick={() =>
              checkoutRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              })
            }
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

      <Modal
        open={previewProduct !== null}
        onClose={() => {
          setPreviewProduct(null);
          setPreviewImageIndex(0);
        }}
        title={previewProduct?.name ?? '상품 이미지'}
        width={960}
      >
        {previewProduct ? (() => {
          const imageUrls = getShopProductImageUrls(previewProduct);
          const currentUrl = imageUrls[previewImageIndex] ?? imageUrls[0] ?? null;
          if (!currentUrl) return null;

          return (
            <div className="space-y-4">
              <div className="relative mx-auto w-full max-w-[820px] overflow-hidden rounded-2xl border border-border bg-bg-tertiary">
                <div className="relative aspect-square w-full">
                  <Image
                    src={currentUrl}
                    alt={previewProduct.name}
                    fill
                    sizes="(max-width: 1024px) 92vw, 820px"
                    quality={100}
                    className="object-contain"
                  />
                </div>
                {imageUrls.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewImageIndex((prev) =>
                          prev === 0 ? imageUrls.length - 1 : prev - 1,
                        )
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/55 text-white text-sm leading-none inline-flex items-center justify-center hover:bg-black/70 transition-colors"
                      aria-label="이전 이미지"
                    >
                      {'<'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewImageIndex((prev) =>
                          prev === imageUrls.length - 1 ? 0 : prev + 1,
                        )
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/55 text-white text-sm leading-none inline-flex items-center justify-center hover:bg-black/70 transition-colors"
                      aria-label="다음 이미지"
                    >
                      {'>'}
                    </button>
                  </>
                )}
              </div>

              {imageUrls.length > 1 && (
                <div className="flex items-center justify-center gap-2">
                  {imageUrls.map((url, idx) => (
                    <button
                      key={`${url}-${idx}`}
                      type="button"
                      onClick={() => setPreviewImageIndex(idx)}
                      className={`w-2.5 h-2.5 rounded-full ${
                        idx === previewImageIndex ? 'bg-foreground' : 'bg-border'
                      }`}
                      aria-label={`이미지 ${idx + 1}`}
                    />
                  ))}
                </div>
              )}

              {previewProduct.description ? (
                <p className="text-sm text-text-secondary">
                  {previewProduct.description}
                </p>
              ) : null}
            </div>
          );
        })() : null}
      </Modal>
    </div>
  );
}
