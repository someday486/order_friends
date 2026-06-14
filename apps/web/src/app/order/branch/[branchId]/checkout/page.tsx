'use client';

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import {
  formatOrderPhoneInput,
  formatWon,
  isValidOrderPhone,
} from '@/lib/format';
import {
  getAllowedPaymentMethodsForBillingTier,
  resolveBillingTier,
} from '@/lib/billing-tier';
import { KakaoQuickLoginButton } from '@/components/auth/KakaoQuickLoginButton';
import { useAuth } from '@/hooks/useAuth';
import { getVerifiedUser } from '@/lib/auth/client';
import {
  loadCustomerInfoFromAuthenticatedUser,
  loadCustomerInfoFromLatestOrder,
  persistCustomerInfoToUserMetadata,
} from '@/lib/customer-info-autofill';
import {
  clearCheckoutDraft,
  clearPendingPaymentRecord,
  loadCustomerInfoDraft,
  loadCheckoutDraft,
  saveCustomerInfoDraft,
  saveLastOrderRecord,
  savePendingPaymentRecord,
} from '@/lib/order-session';
import { supabaseBrowser } from '@/lib/supabase/client';
import { AddressSearchFields } from '@/components/order/AddressSearchFields';
import { PickupDateCalendar } from '@/components/order/PickupDateCalendar';
import { TossPaymentWidget } from '@/components/order/TossPaymentWidget';
import { type WeeklyBusinessHours } from '@/lib/business-hours';
import {
  buildPickupDateOptions,
  buildPickupTimeOptions,
  filterPickupTimeOptionsByDate,
  hasPickupTimeConfig,
  type PickupTimeConfig,
} from '@/lib/pickup-time';
import { appendEuroRo } from '@/lib/korean-particles';
import {
  getOrCreateTossCustomerKey,
  getTossRedirectUrls,
  normalizeMobilePhone,
} from '@/lib/toss-payment';
import {
  type BillingTier,
  type FulfillmentType,
  type StorePaymentMethod as PaymentMethod,
} from '@/types/common';

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

type PublicBranchConfigResponse = {
  billingTier?: BillingTier | null;
  cashReceiptEnabled?: boolean | null;
  enabledFulfillmentTypes?: string[] | null;
  allowedPaymentMethods?: string[] | null;
  contactPhone?: string | null;
  kakaoChannelUrl?: string | null;
  pickupTimeConfig?: PickupTimeConfig;
  businessHours?: WeeklyBusinessHours;
  transferAccount?: {
    bankName?: string | null;
    accountNumber?: string | null;
    accountHolder?: string | null;
  } | null;
};

const DEFAULT_FULFILLMENT_TYPES: FulfillmentType[] = ['PICKUP'];
const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = ['CARD', 'TRANSFER'];
const REQUIRE_LOGIN_BEFORE_ORDER = true;

function isFulfillmentType(value: unknown): value is FulfillmentType {
  return (
    value === 'PICKUP' ||
    value === 'DELIVERY' ||
    value === 'DINE_IN' ||
    value === 'SHIPPING'
  );
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === 'CARD' || value === 'TRANSFER';
}

function normalizeBillingTier(value: unknown): BillingTier | null {
  return value === 'PG' || value === 'NON_PG' ? value : null;
}

function getFulfillmentLabel(type: FulfillmentType) {
  if (type === 'PICKUP') return '포장';
  if (type === 'DELIVERY') return '배달';
  if (type === 'SHIPPING') return '택배';
  return '직접 수령';
}

function getFulfillmentIcon(type: FulfillmentType) {
  if (type === 'PICKUP') return '🛍️';
  if (type === 'DELIVERY') return '🛵';
  if (type === 'SHIPPING') return '📦';
  return '🪑';
}

function getPaymentLabel(method: PaymentMethod) {
  if (method === 'CARD') return '카드';
  if (method === 'TRANSFER') return '계좌이체';
  return '현금';
}

function normalizePhoneNumber(value: string) {
  return value.replace(/[^\d]/g, '');
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
  const [billingTier, setBillingTier] = useState<BillingTier | null>(null);
  const [fulfillmentType, setFulfillmentType] =
    useState<FulfillmentType>('PICKUP');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CARD');
  const [transferAccount, setTransferAccount] = useState<{
    bankName?: string | null;
    accountNumber?: string | null;
    accountHolder?: string | null;
  } | null>(null);
  const [branchContactPhone, setBranchContactPhone] = useState<string | null>(
    null,
  );
  const [branchKakaoChannelUrl, setBranchKakaoChannelUrl] = useState<
    string | null
  >(null);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress1, setCustomerAddress1] = useState('');
  const [customerAddress2, setCustomerAddress2] = useState('');
  const [customerMemo, setCustomerMemo] = useState('');
  const [cashReceiptEnabled, setCashReceiptEnabled] = useState(false);
  const [cashReceiptRequested, setCashReceiptRequested] = useState(false);
  const [cashReceiptUseCustomerPhone, setCashReceiptUseCustomerPhone] =
    useState(true);
  const [cashReceiptPhone, setCashReceiptPhone] = useState('');
  const [selectedPickupDate, setSelectedPickupDate] = useState('');
  const [requestedPickupTime, setRequestedPickupTime] = useState('');
  const [pickupTimeConfig, setPickupTimeConfig] =
    useState<PickupTimeConfig>(null);
  const [businessHours, setBusinessHours] = useState<WeeklyBusinessHours>(null);
  const [customerInfoReady, setCustomerInfoReady] = useState(false);
  const authInfoRequestedRef = useRef(false);
  const [loadingLastOrderInfo, setLoadingLastOrderInfo] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [tossCustomerKey, setTossCustomerKey] = useState<string | null>(null);
  const [cardWidgetReady, setCardWidgetReady] = useState(false);
  const [cardWidgetError, setCardWidgetError] = useState<string | null>(null);
  const cardWidgetControllerRef = useRef<CardWidgetController | null>(null);
  const handleCardWidgetReadyChange = useCallback(
    (controller: CardWidgetController | null) => {
      cardWidgetControllerRef.current = controller;
      setCardWidgetReady(Boolean(controller));
    },
    [],
  );
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
  const isCustomerPhoneValid = useMemo(
    () => isValidOrderPhone(customerPhone),
    [customerPhone],
  );
  const effectiveBillingTier = useMemo(
    () => resolveBillingTier(billingTier, allowedPaymentMethods),
    [allowedPaymentMethods, billingTier],
  );
  const isPgCheckout = effectiveBillingTier === 'PG';
  const supportsReceiptRequest = paymentMethod === 'TRANSFER';
  const canRequestReceipt = cashReceiptEnabled && supportsReceiptRequest;
  const completePagePath = `/order/branch/${branchId}/complete`;

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

  useEffect(() => {
    if (canRequestReceipt) return;
    setCashReceiptRequested(false);
    setCashReceiptUseCustomerPhone(true);
    setCashReceiptPhone('');
  }, [canRequestReceipt]);

  // 저장된 고객 정보 로드
  useEffect(() => {
    const saved = loadCustomerInfoDraft();
    if (saved) {
      setCustomerName(saved.customerName);
      setCustomerPhone(formatOrderPhoneInput(saved.customerPhone));
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
    if (!branchId) return;

    void router.prefetch(completePagePath);
    void router.prefetch('/order/payment/success');
    void router.prefetch('/order/payment/fail');
  }, [branchId, completePagePath, router]);

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
      setCustomerPhone((prev) =>
        formatOrderPhoneInput(prev || next.customerPhone || ''),
      );
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
      customerPhone: formatOrderPhoneInput(
        next.customerPhone || draft?.customerPhone || '',
      ),
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
    setCustomerPhone((prev) =>
      formatOrderPhoneInput(merged.customerPhone || prev),
    );
    setCustomerAddress1((prev) => merged.customerAddress1 || prev);
    setCustomerAddress2((prev) => merged.customerAddress2 || prev);
    setCustomerMemo((prev) => merged.customerMemo || prev);
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

  useEffect(() => {
    let cancelled = false;

    const initializeCheckout = async () => {
      const recovered = loadCheckoutDraft({ branchId });
      if (!recovered) {
        router.replace(`/order/branch/${branchId}`);
        return;
      }

      let latestBillingTier: BillingTier | null = null;

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
        latestBillingTier = resolveBillingTier(
          normalizeBillingTier(latestConfig?.billingTier),
          latestPaymentMethods,
        );

        if (latestFulfillmentTypes.length > 0) {
          normalizedFulfillmentTypes = latestFulfillmentTypes;
        }
        if (latestPaymentMethods.length > 0) {
          normalizedPaymentMethods = latestPaymentMethods;
        }
        normalizedPaymentMethods = getAllowedPaymentMethodsForBillingTier(
          latestBillingTier,
        );
        setBillingTier(latestBillingTier);
        setCashReceiptEnabled(latestConfig?.cashReceiptEnabled === true);
        setBranchContactPhone(latestConfig?.contactPhone?.trim() || null);
        setBranchKakaoChannelUrl(latestConfig?.kakaoChannelUrl?.trim() || null);
        setTransferAccount(
          latestBillingTier === 'PG'
            ? null
            : (latestConfig?.transferAccount ?? null),
        );
        setPickupTimeConfig(latestConfig?.pickupTimeConfig ?? null);
        setBusinessHours(latestConfig?.businessHours ?? null);
      } catch {
        setBillingTier(null);
        setCashReceiptEnabled(false);
        setBranchContactPhone(null);
        setBranchKakaoChannelUrl(null);
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
      const resolvedBillingTier = resolveBillingTier(
        latestBillingTier,
        normalizedPaymentMethods,
      );
      const effectivePaymentMethods = getAllowedPaymentMethodsForBillingTier(
        resolvedBillingTier,
      );

      if (cancelled) return;

      setCart(recovered.cart as CartItem[]);
      setEnabledFulfillmentTypes(normalizedFulfillmentTypes);
      setAllowedPaymentMethods(effectivePaymentMethods);
      setBillingTier(resolvedBillingTier);
      setFulfillmentType(
        normalizedFulfillmentTypes.includes(selectedFulfillment)
          ? selectedFulfillment
          : normalizedFulfillmentTypes[0],
      );
      setPaymentMethod(
        effectivePaymentMethods.includes(selectedPayment)
          ? selectedPayment
          : effectivePaymentMethods[0],
      );
      setReady(true);
    };

    void initializeCheckout();
    return () => {
      cancelled = true;
    };
  }, [branchId, router]);

  const totalAmount = useMemo(
    () => cart.reduce((sum, item) => sum + item.itemPrice * item.qty, 0),
    [cart],
  );

  const handleSubmit = async () => {
    if (REQUIRE_LOGIN_BEFORE_ORDER && status !== 'authenticated') {
      toast('간편로그인 후 주문할 수 있어요.');
      const next = `${window.location.pathname}${window.location.search}`;
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    if (!customerName.trim()) {
      toast.error('이름을 입력해 주세요.');
      return;
    }

    if (!customerPhone.trim()) {
      toast.error('연락처를 입력해 주세요.');
      return;
    }

    if (!isCustomerPhoneValid) {
      toast.error('연락처는 000-0000-0000 형식으로 입력해 주세요.');
      return;
    }

    if (
      canRequestReceipt &&
      cashReceiptRequested &&
      ![10, 11].includes(normalizedCashReceiptPhone.length)
    ) {
      toast.error('현금영수증 발급을 위해 휴대폰 번호를 정확히 입력해 주세요.');
      return;
    }

    if (
      (fulfillmentType === 'DELIVERY' || fulfillmentType === 'SHIPPING') &&
      !customerAddress1.trim()
    ) {
      toast.error('배송 주문은 주소가 필요합니다.');
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

    if (paymentMethod === 'CARD' && !cardWidgetControllerRef.current) {
      toast.error(cardWidgetError || '결제 위젯을 준비하는 중입니다.');
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
        cashReceipt:
          canRequestReceipt && cashReceiptRequested
            ? {
                requested: true,
                type: 'INCOME_DEDUCTION',
                identityType: 'PHONE',
                identityValue: normalizedCashReceiptPhone,
              }
            : undefined,
      };

      const verifiedUser =
        user ?? (status !== 'authenticated' ? await getVerifiedUser() : null);
      const shouldCreateAuthenticatedOrder = Boolean(
        verifiedUser?.id || status === 'authenticated',
      );
      const orderPath = shouldCreateAuthenticatedOrder
        ? '/me/orders'
        : '/public/orders';
      const result = await apiClient.post<CreateOrderResult>(
        orderPath,
        payload,
        {
          auth: shouldCreateAuthenticatedOrder,
        },
      );

      if (shouldCreateAuthenticatedOrder) {
        void persistCustomerInfoToUserMetadata({
          customerName,
          customerPhone,
          customerAddress1,
          customerAddress2,
          customerMemo,
        });
      }

      if (paymentMethod === 'CARD') {
        const preparePayment = await apiClient.post<PreparePaymentResult>(
          '/payments/prepare',
          {
            orderId: result.id,
            amount: result.totalAmount ?? totalAmount,
            paymentMethod: 'CARD',
          },
          { auth: false },
        );
        const redirectUrls = getTossRedirectUrls();
        savePendingPaymentRecord({
          orderId: preparePayment.orderId,
          branchId,
          checkoutPath: `/order/branch/${branchId}/checkout`,
          completePath: completePagePath,
          cartSnapshot: cart,
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
          branchContactPhone,
          branchKakaoChannelUrl,
          transferAccount: result.transferAccount ?? transferAccount ?? null,
          cartSnapshot: cart,
        },
        branchId,
      });

      const query = result?.id
        ? `?orderId=${encodeURIComponent(result.id)}`
        : '';
      startTransition(() => {
        router.push(`${completePagePath}${query}`);
      });
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
      <div className="mx-auto max-w-lg lg:max-w-[760px]">
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

        <main className="p-4 pb-8 lg:px-6 lg:pb-10">
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
            <div className="grid grid-cols-2 gap-2 lg:max-w-[420px]">
              {enabledFulfillmentTypes.map((type) => {
                const isSelected = fulfillmentType === type;
                return (
                  <button
                    key={type}
                    data-testid={`fulfillment-${type.toLowerCase()}`}
                    onClick={() => setFulfillmentType(type)}
                    className={`min-h-[76px] rounded-xl border p-3 text-sm font-semibold cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${
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
              {status === 'authenticated' ? (
                <div className="mt-2 grid grid-cols-2 gap-2 lg:max-w-[420px]">
                  <button
                    type="button"
                    onClick={() => void handleLoadLastOrderInfo()}
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
                    onClick={() => void handleLogout()}
                    disabled={loggingOut || loadingLastOrderInfo}
                    className="h-10 rounded-xl border border-border bg-bg-secondary text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loggingOut ? '로그아웃 중...' : '로그아웃'}
                  </button>
                </div>
              ) : (
                <div className="lg:max-w-[420px]">
                  <KakaoQuickLoginButton
                    beforeLogin={handleBeforeLogin}
                    className="w-full"
                  />
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
                  onChange={(e) =>
                    setCustomerPhone(formatOrderPhoneInput(e.target.value))
                  }
                  data-testid="customer-phone-input"
                  required
                  placeholder="010-1234-5678"
                  className="input-field w-full h-12"
                />
                {customerPhone.trim() && !isCustomerPhoneValid && (
                  <p className="mt-1 text-xs text-danger-500">
                    연락처는 000-0000-0000 형식으로 입력해 주세요.
                  </p>
                )}
              </div>

              {/* 배달일 때만 주소 표시 */}
              {fulfillmentType === 'PICKUP' && hasScheduledPickupConfig && (
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
                          ? '스토어에서 픽업 가능 시간을 설정하지 않았습니다.'
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
                          스토어에서 픽업 가능 시간을 설정하지 않았습니다.
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
                        스토어에서 픽업 시간을 설정하지 않았습니다.
                      </option>
                    ) : pickupTimeOptionsForSelectedDate.length === 0 ? (
                      <option value="">
                        선택 가능한 픽업 시간이 없습니다.
                      </option>
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
                      ? '스토어에서 설정한 픽업 가능 시간만 30분 단위로 표시됩니다.'
                      : '스토어에서 픽업 가능 시간을 설정하면 이곳에서 선택할 수 있습니다.'}
                  </p>
                </div>
              )}

              {(fulfillmentType === 'DELIVERY' ||
                fulfillmentType === 'SHIPPING') && (
                <div className="animate-fade-in">
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                    {fulfillmentType === 'SHIPPING' ? '배송 주소' : '배달 주소'}{' '}
                    <span className="text-danger-500">*</span>
                  </label>
                  <AddressSearchFields
                    showLabel={false}
                    addressLabel={
                      fulfillmentType === 'SHIPPING' ? '배송 주소' : '배달 주소'
                    }
                    address1={customerAddress1}
                    address2={customerAddress2}
                    onAddress1Change={setCustomerAddress1}
                    onAddress2Change={setCustomerAddress2}
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
              결제 방식
            </h2>
            <div className="rounded-xl border border-border bg-bg-secondary p-4 text-sm text-text-secondary lg:max-w-[420px]">
              <p className="font-semibold text-foreground">
                {isPgCheckout
                  ? '이 브랜드는 토스페이먼츠 결제로만 주문할 수 있어요.'
                  : '이 브랜드는 계좌이체로만 주문할 수 있어요.'}
              </p>
              <p className="mt-1">
                현재 결제 방식: {getPaymentLabel(paymentMethod)}
              </p>
              <p className="mt-2 text-xs text-text-tertiary">
                결제 방식은 브랜드 정책에 따라 자동으로 정해지며 이 화면에서 직접 바꿀 수 없습니다.
              </p>
            </div>

            {paymentMethod === 'CARD' && (
              <TossPaymentWidget
                amount={totalAmount}
                customerKey={tossCustomerKey}
                active
                onReadyChange={handleCardWidgetReadyChange}
                onErrorChange={setCardWidgetError}
              />
            )}

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
                  입금자명을 <strong>{depositAccountGuide}</strong> 입력해
                  주세요.
                </p>
              </div>
            )}
            {canRequestReceipt && (
              <div className="mt-3 rounded-xl border border-border bg-bg-secondary p-4 animate-fade-in">
                <label className="flex items-center gap-3 text-sm font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={cashReceiptRequested}
                    onChange={(e) => setCashReceiptRequested(e.target.checked)}
                  />
                  현금영수증 발급 정보 전달
                </label>
                <p className="mt-2 text-xs text-text-secondary">
                  판매자가 발급 가능 여부를 확인할 수 있도록 요청 정보를 전달합니다.
                </p>
                {cashReceiptRequested && (
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
                    <div className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-text-secondary">
                      {cashReceiptUseCustomerPhone ? (
                        <>
                          발급 번호:{' '}
                          {customerPhone.trim() ||
                            '휴대폰 번호를 먼저 입력해 주세요.'}
                        </>
                      ) : (
                        <input
                          type="text"
                          value={cashReceiptPhone}
                          onChange={(e) => setCashReceiptPhone(e.target.value)}
                          inputMode="tel"
                          placeholder="현금영수증 요청 휴대폰 번호"
                          className="input-field h-12 w-full"
                        />
                      )}
                    </div>
                  </div>
                )}
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
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border-none bg-foreground p-4 text-base font-bold text-background cursor-pointer transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 lg:mx-auto lg:max-w-[420px]"
            onClick={() => void handleSubmit()}
            disabled={
              submitting ||
              !customerName.trim() ||
              !customerPhone.trim() ||
              !isCustomerPhoneValid ||
              (paymentMethod === 'CARD' && !cardWidgetReady)
            }
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
    </div>
  );
}
