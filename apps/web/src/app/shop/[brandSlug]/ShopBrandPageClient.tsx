'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { KakaoQuickLoginButton } from '@/components/auth/KakaoQuickLoginButton';
import { PublicAuthActions } from '@/components/auth/PublicAuthActions';
import { AddressSearchFields } from '@/components/order/AddressSearchFields';
import { TossPaymentWidget } from '@/components/order/TossPaymentWidget';
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
  clearPendingPaymentRecord,
  loadCustomerInfoDraft,
  saveCustomerInfoDraft,
  saveLastOrderRecord,
  savePendingPaymentRecord,
} from '@/lib/order-session';
import { supabaseBrowser } from '@/lib/supabase/client';
import {
  getOrCreateTossCustomerKey,
  getTossRedirectUrls,
  normalizeMobilePhone,
} from '@/lib/toss-payment';

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
  fulfillmentType: 'SHIPPING';
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

type PreparePaymentResult = {
  orderId: string;
  orderNo?: string | null;
  amount: number;
  orderName: string;
  customerName: string;
  customerPhone: string;
};

type CardWidgetController = {
  requestPayment: (request: {
    orderId: string;
    orderName: string;
    customerName?: string | null;
    customerMobilePhone?: string | null;
    successUrl: string;
    failUrl: string;
  }) => Promise<void>;
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
    <div className="h-28 w-28 rounded-2xl border border-border bg-bg-tertiary flex items-center justify-center flex-shrink-0 sm:h-32 sm:w-32 md:h-44 md:w-44">
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
    <div className="group relative h-28 w-28 flex-shrink-0 overflow-hidden rounded-2xl border border-border bg-bg-tertiary sm:h-32 sm:w-32 md:h-44 md:w-44">
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
  const [cashReceiptUseCustomerPhone, setCashReceiptUseCustomerPhone] =
    useState(true);
  const [cashReceiptPhone, setCashReceiptPhone] = useState('');
  const [customerInfoReady, setCustomerInfoReady] = useState(false);
  const [authInfoLoaded, setAuthInfoLoaded] = useState(false);
  const authInfoRequestedRef = useRef(false);
  const [loadingLastOrderInfo, setLoadingLastOrderInfo] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [tossCustomerKey, setTossCustomerKey] = useState<string | null>(null);
  const [cardWidgetReady, setCardWidgetReady] = useState(false);
  const [cardWidgetError, setCardWidgetError] = useState<string | null>(null);
  const cardWidgetControllerRef = useRef<CardWidgetController | null>(null);
  const [previewProduct, setPreviewProduct] = useState<ShopProduct | null>(
    null,
  );
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const handleCardWidgetReadyChange = useCallback(
    (controller: CardWidgetController | null) => {
      cardWidgetControllerRef.current = controller;
      setCardWidgetReady(Boolean(controller));
    },
    [],
  );
  const normalizedCustomerPhone = useMemo(
    () => normalizePhoneNumber(customerPhone),
    [customerPhone],
  );
  const normalizedManualCashReceiptPhone = useMemo(
    () => normalizePhoneNumber(cashReceiptPhone),
    [cashReceiptPhone],
  );
  const normalizedCashReceiptPhone = useMemo(
    () =>
      cashReceiptUseCustomerPhone
        ? normalizedCustomerPhone
        : normalizedManualCashReceiptPhone,
    [
      cashReceiptUseCustomerPhone,
      normalizedCustomerPhone,
      normalizedManualCashReceiptPhone,
    ],
  );
  const supportsReceiptRequest =
    paymentMethod === 'TRANSFER';
  const canRequestReceipt =
    data?.cashReceiptEnabled === true && supportsReceiptRequest;

  useEffect(() => {
    if (canRequestReceipt) return;
    setCashReceiptRequested(false);
    setCashReceiptUseCustomerPhone(true);
    setCashReceiptPhone('');
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
    setTossCustomerKey(getOrCreateTossCustomerKey(user?.id ?? null));
  }, [user?.id]);

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

  const handleBeforeLogin = () => {
    saveCustomerInfoDraft({
      customerName,
      customerPhone,
      customerAddress1,
      customerAddress2,
      customerMemo,
    });
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
  const paymentSummary = useMemo(
    () =>
      (data?.paymentMethods ?? [])
        .map((method) => PAYMENT_LABEL[method] ?? method)
        .join(' · '),
    [data?.paymentMethods],
  );
  const productCount = data?.products.length ?? 0;
  const cartSummaryText =
    totalQty > 0 ? `${totalQty}개 상품 · ${formatWon(totalAmount)}` : '상품을 고르면 여기에 요약됩니다.';

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
    if (status !== 'authenticated') {
      setSubmitError('로그인 후 주문할 수 있어요.');
      const next = `${window.location.pathname}${window.location.search}`;
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
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

    if (paymentMethod === 'CARD' && !cardWidgetControllerRef.current) {
      setSubmitError(cardWidgetError || '결제 위젯을 준비하는 중입니다.');
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
        { auth: true },
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
          fulfillmentType: 'SHIPPING',
          transferAccount:
            response.transferAccount ?? data.transferAccount ?? null,
        },
        brandSlug: data.brandSlug,
      });

      if (paymentMethod === 'CARD') {
        const preparePayment = await apiClient.post<PreparePaymentResult>(
          '/payments/prepare',
          {
            orderId: response.id,
            amount: response.totalAmount,
            paymentMethod: 'CARD',
          },
          { auth: false },
        );
        const redirectUrls = getTossRedirectUrls();
        savePendingPaymentRecord({
          orderId: preparePayment.orderId,
          checkoutPath: `/shop/${encodeURIComponent(data.brandSlug)}`,
          completePath: `/order/track/${encodeURIComponent(
            preparePayment.orderId,
          )}`,
          brandSlug: data.brandSlug,
          cartSnapshot: cartItems,
        });
        await cardWidgetControllerRef.current!.requestPayment({
          orderId: preparePayment.orderId,
          orderName: preparePayment.orderName,
          customerName: preparePayment.customerName || customerName.trim(),
          customerMobilePhone: normalizeMobilePhone(
            preparePayment.customerPhone || customerPhone.trim(),
          ),
          successUrl: redirectUrls.successUrl,
          failUrl: redirectUrls.failUrl,
        });
        return;
      }

      clearPendingPaymentRecord();
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
      <div className="min-h-screen bg-[linear-gradient(180deg,#f6f3ee_0%,#f3f0eb_32%,#f8f7f5_100%)] text-foreground">
        <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
          <div className="h-72 animate-pulse rounded-[32px] border border-black/6 bg-white/80 shadow-sm" />
          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="h-[720px] animate-pulse rounded-[32px] border border-black/6 bg-white/80 shadow-sm" />
            <div className="h-[720px] animate-pulse rounded-[32px] border border-black/6 bg-white/80 shadow-sm" />
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
              '온라인샵 주문을 처리할 스토어/출고지가 설정되지 않았습니다.',
            ) ? (
              <div className="mt-3 text-xs text-text-tertiary">
                브랜드 관리자에서 스토어/출고지를 1개 이상 등록하고 주문 설정에서 배송
                주문을 활성화해주세요.
              </div>
            ) : (
              <div className="mt-2">
                <KakaoQuickLoginButton
                  beforeLogin={handleBeforeLogin}
                  className="w-full"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f3ee_0%,#f3f0eb_32%,#f8f7f5_100%)] text-foreground">
      <div className="mx-auto max-w-[1240px] px-4 py-6 pb-28 md:px-6 md:py-8 xl:pb-8">
        <header className="relative overflow-hidden rounded-[32px] border border-black/6 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.08)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.2),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.14),transparent_24%)]" />
          <div className="relative h-[260px] md:h-[320px]">
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
              <div className="absolute inset-0 bg-[linear-gradient(125deg,rgba(59,130,246,0.18),rgba(168,85,247,0.14),rgba(255,255,255,0.96))]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/15 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
            <div className="relative flex h-full flex-col justify-between p-6 text-white md:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/14 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-white/90 backdrop-blur">
                  ONLINE ORDER
                </span>
                <span className="rounded-full bg-black/25 px-3 py-1 text-xs text-white/85 backdrop-blur">
                  상품 {productCount}개
                </span>
                <span className="rounded-full bg-black/25 px-3 py-1 text-xs text-white/85 backdrop-blur">
                  {paymentSummary || '결제 방식 준비 중'}
                </span>
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-4">
                    {data.logoUrl ? (
                      <Image
                        src={data.logoUrl}
                        alt={data.brandName}
                        width={64}
                        height={64}
                        className="h-16 w-16 rounded-full border border-white/25 object-cover shadow-lg"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-white/10 text-xl font-bold shadow-lg backdrop-blur">
                        {data.brandName.slice(0, 1)}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-white/80">온라인 주문</p>
                      <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">
                        {data.brandName}
                      </h1>
                    </div>
                  </div>
                  <p className="mt-4 max-w-xl text-sm leading-6 text-white/78 md:text-base">
                    상품을 고르고 주문 정보를 입력하면 바로 주문할 수 있습니다.
                    오른쪽 주문 패널에서 수량, 결제 방식, 입금 안내를 한 번에 확인하세요.
                  </p>
                </div>

                <div className="rounded-[28px] border border-white/15 bg-black/25 p-4 text-white shadow-lg backdrop-blur-md">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                    Quick Access
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/78">
                    로그인하면 최근 주문 정보와 고객 정보가 자동으로 채워져 더 빠르게 주문할 수 있어요.
                  </p>
                  <div className="mt-4">
                    <PublicAuthActions className="w-full sm:max-w-sm" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
          <section className="rounded-[32px] border border-black/6 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] md:p-6">
            <div className="flex flex-col gap-4 border-b border-black/6 pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                  Catalog
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground">
                  상품 선택
                </h2>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  상품 이미지를 눌러 크게 보고, 수량을 바로 조절하면서 장바구니에 담을 수 있습니다.
                </p>
              </div>
              <div className="relative w-full md:max-w-[300px]">
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
                  className="input-field h-12 w-full rounded-2xl border-black/8 bg-[#faf8f4] pl-9 shadow-none"
                  aria-label="상품 검색"
                />
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-dashed border-black/10 bg-[#faf8f4] p-10 text-center text-sm text-text-secondary">
                표시할 상품이 없습니다.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
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
                      className="min-w-0 rounded-[28px] border border-black/8 bg-[#fcfbf8] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-black/12 hover:shadow-[0_22px_50px_rgba(15,23,42,0.06)] md:p-5"
                    >
                      <div className="flex items-start gap-4 md:gap-5">
                        <ShopProductImageCarousel
                          product={product}
                          onOpenPreview={openProductPreview}
                        />

                        <div className="flex min-h-28 min-w-0 flex-1 flex-col md:min-h-44">
                          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              {product.categoryName ? (
                                <p className="text-xs font-medium uppercase tracking-[0.14em] text-text-tertiary">
                                  {product.categoryName}
                                </p>
                              ) : null}
                              <h3 className="mt-1 text-lg font-bold leading-snug text-foreground md:text-xl">
                                {product.name}
                              </h3>
                              {hasDiscount && (
                                <div className="mt-3">
                                  <span className="inline-flex items-center rounded-full bg-danger-500 px-3 py-1 text-[11px] font-bold text-white">
                                    긴급 할인{urgentLabel ? ` · ${urgentLabel}` : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="self-start whitespace-nowrap rounded-2xl bg-white px-4 py-3 text-left shadow-sm sm:text-right">
                              {hasDiscount ? (
                                <>
                                  <div className="text-[11px] text-text-tertiary line-through">
                                    {formatWon(product.price)}
                                  </div>
                                  <div className="mt-0.5 text-[11px] font-bold text-danger-500">
                                    {discountRate}% 할인
                                  </div>
                                  <div className="mt-1 text-lg font-extrabold text-danger-500">
                                    {formatWon(product.discountPrice ?? product.price)}
                                  </div>
                                </>
                              ) : (
                                <div className="text-base font-extrabold text-foreground">
                                  {formatWon(product.price)}
                                </div>
                              )}
                            </div>
                          </div>
                          {product.description ? (
                            <p className="mt-3 text-sm leading-6 text-text-secondary line-clamp-3">
                              {product.description}
                            </p>
                          ) : null}

                          <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                            <div className="text-xs text-text-tertiary">
                              {qty > 0
                                ? `선택 수량 ${qty}개`
                                : '상품을 담으면 오른쪽에서 주문 정보를 이어서 작성할 수 있어요.'}
                            </div>
                            {qty === 0 ? (
                              <button
                                type="button"
                                onClick={() => updateQty(product.id, 1)}
                                className="h-11 rounded-2xl bg-foreground px-5 text-sm font-semibold text-background transition-transform duration-200 hover:-translate-y-0.5"
                                aria-label={`${product.name} 장바구니에 담기`}
                              >
                                장바구니에 담기
                              </button>
                            ) : (
                              <div className="flex items-center gap-1 rounded-2xl border border-black/8 bg-white p-1 shadow-sm">
                                <button
                                  type="button"
                                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5f1eb] text-lg font-bold transition-colors hover:bg-[#eee7dc]"
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
                                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5f1eb] text-lg font-bold transition-colors hover:bg-[#eee7dc]"
                                  onClick={() => updateQty(product.id, qty + 1)}
                                  aria-label={`${product.name} 수량 증가`}
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside
            ref={checkoutRef}
            className="rounded-[32px] border border-black/6 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] xl:sticky xl:top-6"
          >
            <div className="rounded-[28px] bg-[#171717] p-5 text-white shadow-[0_18px_50px_rgba(23,23,23,0.18)]">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                Order Desk
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-tight">온라인 주문</h2>
              <p className="mt-2 text-sm leading-6 text-white/78">
                선택한 상품과 배송 정보를 이곳에서 정리하고 바로 주문하세요.
              </p>
              <div className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/88 backdrop-blur">
                {cartSummaryText}
              </div>
            </div>

            {status === 'authenticated' ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void handleLoadLastOrderInfo();
                  }}
                  disabled={loadingLastOrderInfo || loggingOut}
                  className="h-11 rounded-2xl border border-black/8 bg-[#faf8f4] text-xs font-medium transition-colors hover:bg-[#f2ede6] disabled:cursor-not-allowed disabled:opacity-60"
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
                  className="h-11 rounded-2xl border border-black/8 bg-[#faf8f4] text-xs font-medium transition-colors hover:bg-[#f2ede6] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loggingOut ? '로그아웃 중...' : '로그아웃'}
                </button>
              </div>
            ) : null}
            {status === 'authenticated' && authInfoLoaded ? (
              <p className="mt-2 text-xs leading-5 text-text-secondary">
                로그인 정보 기반으로 고객 정보가 자동 입력되었습니다.
              </p>
            ) : null}

            <div className="mt-5 rounded-[28px] border border-black/8 bg-[#faf8f4] overflow-hidden">
              {cartItems.length === 0 ? (
                <div className="p-5 text-center">
                  <p className="text-sm leading-6 text-text-tertiary">
                    상품을 선택하면 여기에 표시됩니다.
                  </p>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto divide-y divide-black/6">
                  {cartItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {item.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-text-tertiary">
                          {formatWon(getEffectivePrice(item))} × {item.qty}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-semibold">
                          {formatWon(getEffectivePrice(item) * item.qty)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {cartItems.length > 0 && (
                <div className="flex items-center justify-between border-t border-black/6 bg-white px-4 py-4">
                  <span className="text-sm font-semibold text-foreground">총 결제 예상 금액</span>
                  <span className="text-lg font-extrabold text-foreground">
                    {formatWon(totalAmount)}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6 space-y-5">
              <section className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                    Recipient
                  </p>
                  <h3 className="mt-2 text-base font-bold text-foreground">받는 분 정보</h3>
                </div>
                <div className="space-y-2.5">
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="input-field h-12 w-full rounded-2xl border-black/8 bg-[#faf8f4]"
                    placeholder="주문자 이름 *"
                    aria-label="주문자 이름"
                  />
                  <input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="input-field h-12 w-full rounded-2xl border-black/8 bg-[#faf8f4]"
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
                    className="input-field min-h-[88px] w-full rounded-2xl border-black/8 bg-[#faf8f4]"
                    placeholder="요청사항 (선택)"
                    aria-label="요청사항"
                  />
                </div>
              </section>

              <section className="space-y-3 border-t border-black/6 pt-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                    Payment
                  </p>
                  <h3 className="mt-2 text-base font-bold text-foreground">결제 방식</h3>
                </div>
                <div className="rounded-[28px] border border-black/8 bg-[#faf8f4] px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {PAYMENT_LABEL[paymentMethod] ?? paymentMethod}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-text-secondary">
                        온라인샵 결제 방식은 브랜드 결제 정책에 따라 자동으로 정해집니다.
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-text-secondary shadow-sm">
                      자동 선택
                    </span>
                  </div>
                </div>
                {paymentMethod === 'CARD' ? (
                  <div className="rounded-[28px] border border-black/8 bg-[#faf8f4] p-4">
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-foreground">토스 결제</p>
                      <p className="mt-1 text-xs text-text-secondary">
                        카드 또는 간편결제를 바로 진행할 수 있어요.
                      </p>
                    </div>
                    {totalAmount > 0 ? (
                      <TossPaymentWidget
                        amount={totalAmount}
                        customerKey={tossCustomerKey}
                        active
                        onReadyChange={handleCardWidgetReadyChange}
                        onErrorChange={setCardWidgetError}
                      />
                    ) : (
                      <div className="rounded-2xl border border-dashed border-black/10 bg-white px-4 py-6 text-sm leading-6 text-text-secondary">
                        상품을 먼저 담으면 여기에서 결제 위젯이 활성화됩니다.
                      </div>
                    )}
                  </div>
                ) : null}
                {paymentMethod === 'TRANSFER' && data.transferAccount ? (
                  <div className="rounded-[28px] border border-warning-200 bg-[#fff8ef] p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🏦</span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">입금 계좌 정보</p>
                        <p className="mt-1 text-xs text-warning-700">
                          계좌이체 후 입금 확인이 완료되면 주문이 처리됩니다.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2 rounded-2xl bg-white px-4 py-4 text-sm shadow-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-text-tertiary">은행명</span>
                        <span className="text-right font-semibold">
                          {data.transferAccount?.bankName?.trim() || '-'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-text-tertiary">계좌번호</span>
                        <span className="text-right font-mono font-semibold">
                          {data.transferAccount?.accountNumber?.trim() || '-'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-text-tertiary">예금주</span>
                        <span className="text-right font-semibold">
                          {data.transferAccount?.accountHolder?.trim() || '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {canRequestReceipt ? (
                  <div className="rounded-[28px] border border-black/8 bg-[#faf8f4] p-4">
                    <label className="flex items-center gap-3 text-sm font-semibold text-foreground">
                      <input
                        type="checkbox"
                        checked={cashReceiptRequested}
                        onChange={(e) =>
                          setCashReceiptRequested(e.target.checked)
                        }
                      />
                      현금영수증 발급 정보 전달
                    </label>
                    <p className="mt-2 text-xs text-text-secondary">
                      판매자가 발급 가능 여부를 확인할 수 있도록 요청 정보를 전달합니다.
                    </p>
                    {cashReceiptRequested ? (
                      <div className="mt-3 space-y-3">
                        <label className="flex items-center gap-2 text-sm text-foreground">
                          <input
                            type="checkbox"
                            checked={cashReceiptUseCustomerPhone}
                            onChange={(e) =>
                              setCashReceiptUseCustomerPhone(e.target.checked)
                            }
                          />
                          연락처와 동일
                        </label>
                        <div className="rounded-2xl border border-black/8 bg-white px-3 py-3 text-sm text-text-secondary">
                          {cashReceiptUseCustomerPhone ? (
                            <>발급 번호: {customerPhone.trim() || '휴대폰 번호를 먼저 입력해 주세요.'}</>
                          ) : (
                            <input
                              type="text"
                              value={cashReceiptPhone}
                              onChange={(e) => setCashReceiptPhone(e.target.value)}
                              className="input-field h-11 w-full rounded-2xl border-black/8 bg-[#faf8f4]"
                              placeholder="현금영수증 요청 휴대폰 번호"
                              inputMode="tel"
                            />
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>

              {submitError ? (
                <p className="rounded-2xl bg-danger-500/8 px-4 py-3 text-sm text-danger-500">
                  {submitError}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  void submitOrder();
                }}
                disabled={
                  submitting ||
                  cartItems.length === 0 ||
                  (paymentMethod === 'CARD' && !cardWidgetReady)
                }
                className="flex w-full items-center justify-center gap-2 rounded-[22px] border-none bg-foreground px-5 py-4 text-base font-bold text-background transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
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
                  `온라인 주문하기${totalAmount > 0 ? ` (${formatWon(totalAmount)})` : ''}`
                )}
              </button>
              <p className="mt-3 text-center text-xs leading-5 text-text-tertiary">
                주문 후 추적 페이지에서 배송 현황과 주문 상태를 확인할 수 있어요.
              </p>
            </div>
          </aside>
        </main>
      </div>

      {totalQty > 0 && (
        <div className="xl:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-black/8 bg-white/92 px-4 pb-4 pt-3 backdrop-blur-md">
          <button
            type="button"
            onClick={() =>
              checkoutRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              })
            }
            className="flex w-full items-center justify-between rounded-[22px] border-none bg-foreground p-4 text-base font-bold text-background shadow-lg"
          >
            <span className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white">
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
