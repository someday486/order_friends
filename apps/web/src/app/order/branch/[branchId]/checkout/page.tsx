'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { formatWon } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import {
  loadCustomerInfoFromAuthenticatedUser,
  loadCustomerInfoFromLatestOrder,
  persistCustomerInfoToUserMetadata,
} from '@/lib/customer-info-autofill';
import {
  clearCheckoutDraft,
  loadCustomerInfoDraft,
  loadCheckoutDraft,
  saveCustomerInfoDraft,
  saveLastOrderRecord,
} from '@/lib/order-session';
import { supabaseBrowser } from '@/lib/supabase/client';
import { KakaoQuickLoginButton } from '@/components/auth/KakaoQuickLoginButton';
import { PickupDateCalendar } from '@/components/order/PickupDateCalendar';
import { type WeeklyBusinessHours } from '@/lib/business-hours';
import {
  buildPickupDateOptions,
  buildPickupTimeOptions,
  filterPickupTimeOptionsByDate,
  hasPickupTimeConfig,
  type PickupTimeConfig,
} from '@/lib/pickup-time';
import { appendEuroRo } from '@/lib/korean-particles';

type FulfillmentType = 'PICKUP' | 'DELIVERY' | 'DINE_IN';
type PaymentMethod = 'CARD' | 'TRANSFER' | 'CASH';

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
  requestedTime?: string | null;
  items?: unknown[];
  transferAccount?: {
    bankName?: string | null;
    accountNumber?: string | null;
    accountHolder?: string | null;
  } | null;
};

type PublicBranchConfigResponse = {
  enabledFulfillmentTypes?: string[] | null;
  allowedPaymentMethods?: string[] | null;
  pickupTimeConfig?: PickupTimeConfig;
  businessHours?: WeeklyBusinessHours;
  transferAccount?: {
    bankName?: string | null;
    accountNumber?: string | null;
    accountHolder?: string | null;
  } | null;
};

const DEFAULT_FULFILLMENT_TYPES: FulfillmentType[] = ['PICKUP'];
const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = ['CARD', 'TRANSFER', 'CASH'];

function isFulfillmentType(value: unknown): value is FulfillmentType {
  return value === 'PICKUP' || value === 'DELIVERY' || value === 'DINE_IN';
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === 'CARD' || value === 'TRANSFER' || value === 'CASH';
}

function getFulfillmentLabel(type: FulfillmentType) {
  if (type === 'PICKUP') return '포장';
  if (type === 'DELIVERY') return '배달';
  return '매장';
}

function getFulfillmentIcon(type: FulfillmentType) {
  if (type === 'PICKUP') return '🛍️';
  if (type === 'DELIVERY') return '🛵';
  return '🪑';
}

function getPaymentLabel(method: PaymentMethod) {
  if (method === 'CARD') return '카드';
  if (method === 'TRANSFER') return '계좌이체';
  return '현금';
}

function getPaymentIcon(method: PaymentMethod) {
  if (method === 'CARD') return '💳';
  if (method === 'TRANSFER') return '🏦';
  return '💵';
}

// ── Spinner SVG ──
function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
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
  );
}

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const branchId = params?.branchId as string;
  const { status, user } = useAuth();

  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [enabledFulfillmentTypes, setEnabledFulfillmentTypes] = useState<
    FulfillmentType[]
  >(DEFAULT_FULFILLMENT_TYPES);
  const [allowedPaymentMethods, setAllowedPaymentMethods] = useState<
    PaymentMethod[]
  >(DEFAULT_PAYMENT_METHODS);
  const [fulfillmentType, setFulfillmentType] =
    useState<FulfillmentType>('PICKUP');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CARD');
  const [transferAccount, setTransferAccount] = useState<{
    bankName?: string | null;
    accountNumber?: string | null;
    accountHolder?: string | null;
  } | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress1, setCustomerAddress1] = useState('');
  const [customerAddress2, setCustomerAddress2] = useState('');
  const [customerMemo, setCustomerMemo] = useState('');
  const [selectedPickupDate, setSelectedPickupDate] = useState('');
  const [requestedPickupTime, setRequestedPickupTime] = useState('');
  const [pickupTimeConfig, setPickupTimeConfig] =
    useState<PickupTimeConfig>(null);
  const [businessHours, setBusinessHours] = useState<WeeklyBusinessHours>(null);
  const [customerInfoReady, setCustomerInfoReady] = useState(false);
  const authInfoRequestedRef = useRef(false);
  const [loadingLastOrderInfo, setLoadingLastOrderInfo] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const pickupTimeOptions = useMemo(
    () => buildPickupTimeOptions(pickupTimeConfig, businessHours),
    [businessHours, pickupTimeConfig],
  );
  const pickupDateOptions = useMemo(
    () => buildPickupDateOptions(pickupTimeOptions),
    [pickupTimeOptions],
  );
  const pickupTimeOptionsForSelectedDate = useMemo(
    () => filterPickupTimeOptionsByDate(pickupTimeOptions, selectedPickupDate),
    [pickupTimeOptions, selectedPickupDate],
  );
  const hasScheduledPickupConfig = hasPickupTimeConfig(
    pickupTimeConfig,
    businessHours,
  );
  const depositAccountGuide = useMemo(
    () => appendEuroRo(customerName, '주문자명'),
    [customerName],
  );

  useEffect(() => {
    if (!hasScheduledPickupConfig) {
      setSelectedPickupDate('');
      setRequestedPickupTime('');
      return;
    }

    if (pickupDateOptions.length === 0) {
      setSelectedPickupDate('');
      setRequestedPickupTime('');
      return;
    }

    setSelectedPickupDate((current) =>
      pickupDateOptions.some((option) => option.value === current)
        ? current
        : pickupDateOptions[0].value,
    );
  }, [hasScheduledPickupConfig, pickupDateOptions]);

  useEffect(() => {
    if (!hasScheduledPickupConfig) {
      return;
    }

    if (pickupTimeOptionsForSelectedDate.length === 0) {
      setRequestedPickupTime('');
      return;
    }

    setRequestedPickupTime((current) =>
      pickupTimeOptionsForSelectedDate.some(
        (option) => option.value === current,
      )
        ? current
        : pickupTimeOptionsForSelectedDate[0].value,
    );
  }, [hasScheduledPickupConfig, pickupTimeOptionsForSelectedDate]);

  // 저장된 고객 정보 로드
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

  // 고객 정보 자동 저장
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

  useEffect(() => {
    let cancelled = false;

    const initializeCheckout = async () => {
      const recovered = loadCheckoutDraft({ branchId });
      if (!recovered) {
        router.replace(`/order/branch/${branchId}`);
        return;
      }

      const recoveredFulfillmentTypes = Array.isArray(
        recovered.enabledFulfillmentTypes,
      )
        ? recovered.enabledFulfillmentTypes.filter(isFulfillmentType)
        : [];
      const recoveredPaymentMethods = Array.isArray(
        recovered.allowedPaymentMethods,
      )
        ? recovered.allowedPaymentMethods.filter(isPaymentMethod)
        : [];

      let normalizedFulfillmentTypes =
        recoveredFulfillmentTypes.length > 0
          ? recoveredFulfillmentTypes
          : DEFAULT_FULFILLMENT_TYPES;
      let normalizedPaymentMethods =
        recoveredPaymentMethods.length > 0
          ? recoveredPaymentMethods
          : DEFAULT_PAYMENT_METHODS;

      try {
        const latestConfig = await apiClient.get<PublicBranchConfigResponse>(
          `/public/branches/${encodeURIComponent(recovered.branchId)}`,
          { auth: false },
        );

        const latestFulfillmentTypes = Array.isArray(
          latestConfig?.enabledFulfillmentTypes,
        )
          ? latestConfig.enabledFulfillmentTypes.filter(isFulfillmentType)
          : [];
        const latestPaymentMethods = Array.isArray(
          latestConfig?.allowedPaymentMethods,
        )
          ? latestConfig.allowedPaymentMethods.filter(isPaymentMethod)
          : [];

        if (latestFulfillmentTypes.length > 0) {
          normalizedFulfillmentTypes = latestFulfillmentTypes;
        }
        if (latestPaymentMethods.length > 0) {
          normalizedPaymentMethods = latestPaymentMethods;
        }
        setTransferAccount(latestConfig?.transferAccount ?? null);
        setPickupTimeConfig(latestConfig?.pickupTimeConfig ?? null);
        setBusinessHours(latestConfig?.businessHours ?? null);
      } catch {
        setTransferAccount(null);
        setPickupTimeConfig(null);
      }

      const selectedFulfillment = isFulfillmentType(
        recovered.selectedFulfillmentType,
      )
        ? recovered.selectedFulfillmentType
        : normalizedFulfillmentTypes[0];
      const selectedPayment = isPaymentMethod(recovered.selectedPaymentMethod)
        ? recovered.selectedPaymentMethod
        : normalizedPaymentMethods[0];

      if (cancelled) return;

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
  }, [branchId, router]);

  const totalAmount = useMemo(
    () => cart.reduce((sum, item) => sum + item.itemPrice * item.qty, 0),
    [cart],
  );

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      toast.error('이름을 입력해 주세요.');
      return;
    }

    if (!customerPhone.trim()) {
      toast.error('연락처를 입력해 주세요.');
      return;
    }

    if (fulfillmentType === 'DELIVERY' && !customerAddress1.trim()) {
      toast.error('배달 주문은 주소가 필요합니다.');
      return;
    }

    const requestedTime =
      fulfillmentType !== 'PICKUP'
        ? null
        : hasScheduledPickupConfig
          ? requestedPickupTime.trim() || null
          : null;
    if (
      fulfillmentType === 'PICKUP' &&
      hasScheduledPickupConfig &&
      pickupTimeOptions.length === 0
    ) {
      toast.error('선택 가능한 픽업 시간이 없습니다.');
      return;
    }
    if (
      fulfillmentType === 'PICKUP' &&
      hasScheduledPickupConfig &&
      requestedTime &&
      !pickupTimeOptions.some((option) => option.value === requestedTime)
    ) {
      toast.error('픽업 시간을 다시 선택해 주세요.');
      return;
    }
    if (
      fulfillmentType === 'PICKUP' &&
      hasScheduledPickupConfig &&
      !requestedTime
    ) {
      toast.error('픽업 시간을 선택해 주세요.');
      return;
    }
    if (
      requestedTime &&
      new Date(requestedTime).getTime() < Date.now() - 60_000
    ) {
      toast.error('픽업 시간은 현재 이후로 선택해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      saveCustomerInfoDraft({
        customerName,
        customerPhone,
        customerAddress1,
        customerAddress2,
        customerMemo,
      });

      const payload = {
        branchId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress1: customerAddress1 || undefined,
        customerAddress2: customerAddress2 || undefined,
        customerMemo: customerMemo || undefined,
        requestedTime: requestedTime || undefined,
        paymentMethod,
        fulfillmentType,
        items: cart.map((item) => ({
          productId: item.product.id,
          qty: item.qty,
          options: item.selectedOptions.map((opt) => ({ optionId: opt.id })),
        })),
      };

      const result = await apiClient.post<CreateOrderResult>(
        '/public/orders',
        payload,
        {
          auth: false,
        },
      );

      clearCheckoutDraft();
      saveLastOrderRecord({
        order: {
          ...result,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerAddress1: customerAddress1 || null,
          customerAddress2: customerAddress2 || null,
          customerMemo: customerMemo || null,
          requestedTime: result.requestedTime ?? requestedTime ?? null,
          paymentMethod,
          fulfillmentType,
          branchId,
          transferAccount: result.transferAccount ?? transferAccount ?? null,
          cartSnapshot: cart,
        },
        branchId,
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

      const query = result?.id
        ? `?orderId=${encodeURIComponent(result.id)}`
        : '';
      router.push(`/order/branch/${branchId}/complete${query}`);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? '주문 처리 중 오류가 발생했습니다.');
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
        <div className="text-center px-6">
          <div className="text-4xl mb-4">🛒</div>
          <p className="text-text-secondary mb-4">장바구니가 비어 있습니다.</p>
          <Link
            href={`/order/branch/${branchId}`}
            className="text-primary-500 underline text-sm"
          >
            메뉴로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Header ── */}
      <header className="p-4 border-b border-border flex items-center gap-3">
        <Link
          href={`/order/branch/${branchId}`}
          className="text-foreground no-underline hover:text-primary-500 transition-colors flex items-center gap-1"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span className="text-sm">메뉴</span>
        </Link>
        <h1 className="flex-1 text-center text-base font-bold text-foreground">
          주문서 작성
        </h1>
        <div className="w-14" /> {/* spacer */}
      </header>

      {/* ── Sticky 총 결제금액 ── */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-2.5 flex justify-between items-center shadow-sm">
        <span className="text-sm text-text-secondary">총 결제금액</span>
        <span className="text-lg font-extrabold text-foreground">
          {formatWon(totalAmount)}
        </span>
      </div>

      <main className="p-4 pb-8">
        {/* ── 주문 내역 ── */}
        <section className="py-4 border-b border-border">
          <h2 className="text-xs font-bold mb-3 text-text-tertiary uppercase tracking-wide">
            주문 내역
          </h2>
          {cart.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 py-2">
              <div className="flex-1">
                <div className="font-semibold text-foreground text-sm">
                  {item.product.name}
                </div>
                {item.selectedOptions.length > 0 && (
                  <div className="text-xs text-text-tertiary mt-0.5">
                    {item.selectedOptions.map((o) => o.name).join(', ')}
                  </div>
                )}
                <div className="text-xs text-text-secondary mt-1">
                  {formatWon(item.itemPrice)} × {item.qty}
                </div>
              </div>
              <div className="font-bold text-foreground text-sm">
                {formatWon(item.itemPrice * item.qty)}
              </div>
            </div>
          ))}
        </section>

        {/* ── 주문 방식 ── */}
        <section className="py-4 border-b border-border">
          <h2 className="text-xs font-bold mb-3 text-text-tertiary uppercase tracking-wide">
            주문 방식
          </h2>
          <div className="flex gap-2">
            {enabledFulfillmentTypes.map((type) => {
              const isSelected = fulfillmentType === type;
              return (
                <button
                  key={type}
                  data-testid={`fulfillment-${type.toLowerCase()}`}
                  onClick={() => setFulfillmentType(type)}
                  className={`flex-1 p-3 rounded-xl border text-sm font-semibold cursor-pointer transition-all flex flex-col items-center gap-1 ${
                    isSelected
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-transparent border-border text-text-secondary hover:bg-bg-tertiary'
                  }`}
                >
                  <span className="text-lg">{getFulfillmentIcon(type)}</span>
                  <span>{getFulfillmentLabel(type)}</span>
                  {isSelected && (
                    <span className="text-[10px] opacity-70">선택됨</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── 고객 정보 ── */}
        <section className="py-4 border-b border-border">
          <h2 className="text-xs font-bold mb-3 text-text-tertiary uppercase tracking-wide">
            고객 정보
          </h2>

          {/* 카카오 로그인 / 지난 주문 불러오기 */}
          <div className="mb-4">
            <KakaoQuickLoginButton
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
            {status === 'authenticated' && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleLoadLastOrderInfo}
                  disabled={loadingLastOrderInfo || loggingOut}
                  className="h-10 rounded-xl border border-border bg-bg-secondary text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {loadingLastOrderInfo ? (
                    <>
                      <Spinner /> 불러오는 중...
                    </>
                  ) : (
                    '🔄 지난 정보 불러오기'
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut || loadingLastOrderInfo}
                  className="h-10 rounded-xl border border-border bg-bg-secondary text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loggingOut ? '로그아웃 중...' : '로그아웃'}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                이름 <span className="text-danger-500">*</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                data-testid="customer-name-input"
                placeholder="이름을 입력해 주세요"
                className="input-field w-full h-12"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                연락처
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                data-testid="customer-phone-input"
                required
                placeholder="010-1234-5678"
                className="input-field w-full h-12"
              />
            </div>

            {/* 배달일 때만 주소 표시 */}
            {fulfillmentType === 'PICKUP' && (
              <div className="animate-fade-in">
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                  픽업 희망 시간
                </label>
                <div className="mb-2">
                  <label className="block text-[11px] font-semibold text-text-tertiary mb-1.5">
                    1. 날짜 선택
                  </label>
                  <PickupDateCalendar
                    options={pickupDateOptions}
                    selectedDate={
                      hasScheduledPickupConfig ? selectedPickupDate : ''
                    }
                    onSelectDate={setSelectedPickupDate}
                    disabled={
                      !hasScheduledPickupConfig ||
                      pickupDateOptions.length === 0
                    }
                    emptyMessage={
                      !hasScheduledPickupConfig
                        ? '매장에서 픽업 가능 시간을 설정하지 않았습니다.'
                        : '선택 가능한 날짜가 없습니다.'
                    }
                  />
                  <select
                    value={hasScheduledPickupConfig ? selectedPickupDate : ''}
                    onChange={(e) => setSelectedPickupDate(e.target.value)}
                    data-testid="pickup-date-select"
                    className="hidden"
                    disabled={
                      !hasScheduledPickupConfig ||
                      pickupDateOptions.length === 0
                    }
                  >
                    {!hasScheduledPickupConfig ? (
                      <option value="">
                        매장에서 픽업 가능 시간을 설정하지 않았습니다.
                      </option>
                    ) : pickupDateOptions.length === 0 ? (
                      <option value="">선택 가능한 날짜가 없습니다.</option>
                    ) : (
                      pickupDateOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <label className="block text-[11px] font-semibold text-text-tertiary mb-1.5">
                  2. 시간 선택
                </label>
                <select
                  value={hasScheduledPickupConfig ? requestedPickupTime : ''}
                  onChange={(e) => setRequestedPickupTime(e.target.value)}
                  data-testid="pickup-time-input"
                  className="input-field w-full h-12"
                  disabled={
                    !hasScheduledPickupConfig ||
                    !selectedPickupDate ||
                    pickupTimeOptionsForSelectedDate.length === 0
                  }
                >
                  {!hasScheduledPickupConfig ? (
                    <option value="">
                      매장에서 픽업 시간을 설정하지 않았습니다.
                    </option>
                  ) : pickupTimeOptionsForSelectedDate.length === 0 ? (
                    <option value="">선택 가능한 픽업 시간이 없습니다.</option>
                  ) : (
                    pickupTimeOptionsForSelectedDate.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))
                  )}
                </select>
                <p className="mt-2 text-xs text-text-tertiary">
                  {hasScheduledPickupConfig
                    ? '매장에서 설정한 픽업 가능 시간만 30분 단위로 표시됩니다.'
                    : '매장에서 픽업 가능 시간을 설정하면 이곳에서 선택할 수 있습니다.'}
                </p>
              </div>
            )}

            {fulfillmentType === 'DELIVERY' && (
              <div className="animate-fade-in">
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                  배달 주소 <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  value={customerAddress1}
                  onChange={(e) => setCustomerAddress1(e.target.value)}
                  data-testid="customer-address1-input"
                  placeholder="기본 주소"
                  className="input-field w-full h-12"
                />
                <input
                  type="text"
                  value={customerAddress2}
                  onChange={(e) => setCustomerAddress2(e.target.value)}
                  placeholder="상세 주소 (동/호수 등)"
                  className="input-field w-full h-12 mt-2"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                요청사항
              </label>
              <textarea
                value={customerMemo}
                onChange={(e) => setCustomerMemo(e.target.value)}
                placeholder="요청사항을 입력해 주세요 (선택)"
                rows={2}
                className="input-field w-full h-auto py-3 px-3 resize-none"
              />
            </div>
          </div>
        </section>

        {/* ── 결제 수단 ── */}
        <section className="py-4 border-b border-border">
          <h2 className="text-xs font-bold mb-3 text-text-tertiary uppercase tracking-wide">
            결제 수단
          </h2>
          <div className="flex gap-2">
            {allowedPaymentMethods.map((method) => {
              const isSelected = paymentMethod === method;
              return (
                <button
                  key={method}
                  data-testid={`payment-${method.toLowerCase()}`}
                  onClick={() => setPaymentMethod(method)}
                  className={`flex-1 p-3 rounded-xl border text-sm font-semibold cursor-pointer transition-all flex flex-col items-center gap-1 ${
                    isSelected
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-transparent border-border text-text-secondary hover:bg-bg-tertiary'
                  }`}
                >
                  <span className="text-lg">{getPaymentIcon(method)}</span>
                  <span>{getPaymentLabel(method)}</span>
                </button>
              );
            })}
          </div>

          {/* 계좌이체 선택 시 즉시 계좌 정보 표시 */}
          {paymentMethod === 'TRANSFER' && (
            <div className="mt-3 rounded-xl border border-warning-200 bg-warning-50 p-4 animate-fade-in">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">🏦</span>
                <div className="text-sm font-bold text-foreground">
                  입금 계좌 정보
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-tertiary">은행명</span>
                  <span className="font-semibold text-foreground">
                    {transferAccount?.bankName?.trim() || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-tertiary">계좌번호</span>
                  <span className="font-semibold text-foreground font-mono">
                    {transferAccount?.accountNumber?.trim() || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-tertiary">예금주</span>
                  <span className="font-semibold text-foreground">
                    {transferAccount?.accountHolder?.trim() || '-'}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-text-secondary">
                입금자명을 <strong>{depositAccountGuide}</strong> 입력해 주세요.
              </p>
            </div>
          )}
        </section>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-danger-50 border border-danger-200 text-danger-500 text-sm">
            {error}
          </div>
        )}

        {/* ── 주문 버튼 ── */}
        <button
          data-testid="submit-order-button"
          className="w-full p-4 mt-6 rounded-2xl border-none bg-foreground text-background text-base font-bold cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          onClick={handleSubmit}
          disabled={submitting || !customerName.trim() || !customerPhone.trim()}
        >
          {submitting ? (
            <>
              <Spinner />
              <span>주문 처리 중...</span>
            </>
          ) : (
            `${formatWon(totalAmount)} 결제하기`
          )}
        </button>
        <p className="text-center text-xs text-text-tertiary mt-3">
          주문하기를 누르면 주문이 즉시 접수됩니다.
        </p>
      </main>
    </div>
  );
}
