const CHECKOUT_DRAFT_KEY = 'order:checkout-draft:v1';
const LAST_ORDER_KEY = 'order:last-order:v1';
const CUSTOMER_INFO_KEY = 'order:customer-info:v1';
const LEGACY_CART_KEY = 'orderCart';
const LEGACY_BRANCH_ID_KEY = 'orderBranchId';
const LEGACY_BRAND_SLUG_KEY = 'orderBrandSlug';
const LEGACY_BRANCH_SLUG_KEY = 'orderBranchSlug';
const LEGACY_LAST_ORDER_KEY = 'lastOrder';
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000;
const CUSTOMER_INFO_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type CheckoutDraft = {
  cart: unknown[];
  branchId: string;
  brandSlug?: string | null;
  branchSlug?: string | null;
  enabledFulfillmentTypes?: string[] | null;
  allowedPaymentMethods?: string[] | null;
  selectedFulfillmentType?: string | null;
  selectedPaymentMethod?: string | null;
  savedAt: number;
};

type LastOrderRecord = {
  order: unknown;
  branchId?: string | null;
  brandSlug?: string | null;
  branchSlug?: string | null;
  cartSnapshot?: unknown[] | null;
  savedAt: number;
};

type CustomerInfoDraft = {
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress1?: string | null;
  customerAddress2?: string | null;
  customerMemo?: string | null;
  savedAt: number;
};

function now() {
  return Date.now();
}

function isExpired(savedAt?: number, ttlMs = STORAGE_TTL_MS) {
  if (!savedAt) return true;
  return now() - savedAt > ttlMs;
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCheckoutDraft(value: unknown): value is CheckoutDraft {
  if (!isObject(value)) return false;
  return Array.isArray(value.cart) && typeof value.branchId === 'string';
}

function isLastOrderRecord(value: unknown): value is LastOrderRecord {
  if (!isObject(value)) return false;
  if (!('order' in value)) return false;
  if ('cartSnapshot' in value && value.cartSnapshot !== null && value.cartSnapshot !== undefined) {
    if (!Array.isArray(value.cartSnapshot)) return false;
  }
  return true;
}

function isStringOrNullOrUndefined(value: unknown) {
  return value === undefined || value === null || typeof value === 'string';
}

function isCustomerInfoDraft(value: unknown): value is CustomerInfoDraft {
  if (!isObject(value)) return false;
  return (
    typeof value.savedAt === 'number' &&
    isStringOrNullOrUndefined(value.customerName) &&
    isStringOrNullOrUndefined(value.customerPhone) &&
    isStringOrNullOrUndefined(value.customerAddress1) &&
    isStringOrNullOrUndefined(value.customerAddress2) &&
    isStringOrNullOrUndefined(value.customerMemo)
  );
}

function normalizeText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function saveLegacyCheckoutKeys(draft: CheckoutDraft) {
  sessionStorage.setItem(LEGACY_CART_KEY, JSON.stringify(draft.cart));
  sessionStorage.setItem(LEGACY_BRANCH_ID_KEY, draft.branchId);
  if (draft.brandSlug) {
    sessionStorage.setItem(LEGACY_BRAND_SLUG_KEY, draft.brandSlug);
  } else {
    sessionStorage.removeItem(LEGACY_BRAND_SLUG_KEY);
  }
  if (draft.branchSlug) {
    sessionStorage.setItem(LEGACY_BRANCH_SLUG_KEY, draft.branchSlug);
  } else {
    sessionStorage.removeItem(LEGACY_BRANCH_SLUG_KEY);
  }
}

export function saveCheckoutDraft(input: {
  cart: unknown[];
  branchId: string;
  brandSlug?: string | null;
  branchSlug?: string | null;
  enabledFulfillmentTypes?: string[] | null;
  allowedPaymentMethods?: string[] | null;
  selectedFulfillmentType?: string | null;
  selectedPaymentMethod?: string | null;
}) {
  if (typeof window === 'undefined') return;

  const draft: CheckoutDraft = {
    cart: input.cart,
    branchId: input.branchId,
    brandSlug: input.brandSlug ?? null,
    branchSlug: input.branchSlug ?? null,
    enabledFulfillmentTypes: input.enabledFulfillmentTypes ?? null,
    allowedPaymentMethods: input.allowedPaymentMethods ?? null,
    selectedFulfillmentType: input.selectedFulfillmentType ?? null,
    selectedPaymentMethod: input.selectedPaymentMethod ?? null,
    savedAt: now(),
  };

  saveLegacyCheckoutKeys(draft);
  localStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(draft));
}

function readLegacyCheckoutDraft(): CheckoutDraft | null {
  if (typeof window === 'undefined') return null;

  const cart = safeJsonParse<unknown[]>(
    sessionStorage.getItem(LEGACY_CART_KEY),
  );
  const branchId = sessionStorage.getItem(LEGACY_BRANCH_ID_KEY);

  if (!cart || !branchId) return null;

  return {
    cart,
    branchId,
    brandSlug: sessionStorage.getItem(LEGACY_BRAND_SLUG_KEY),
    branchSlug: sessionStorage.getItem(LEGACY_BRANCH_SLUG_KEY),
    savedAt: now(),
  };
}

function readStoredCheckoutDraft(): CheckoutDraft | null {
  if (typeof window === 'undefined') return null;
  const parsed = safeJsonParse<unknown>(
    localStorage.getItem(CHECKOUT_DRAFT_KEY),
  );
  if (!isCheckoutDraft(parsed)) return null;
  if (isExpired(parsed.savedAt)) return null;
  return parsed;
}

function matchesCheckoutContext(
  draft: CheckoutDraft,
  context: {
    branchId?: string;
    brandSlug?: string;
    branchSlug?: string;
  },
) {
  if (context.branchId && draft.branchId !== context.branchId) return false;
  if (context.brandSlug && draft.brandSlug !== context.brandSlug) return false;
  if (context.branchSlug && draft.branchSlug !== context.branchSlug)
    return false;
  return true;
}

export function loadCheckoutDraft(context: {
  branchId?: string;
  brandSlug?: string;
  branchSlug?: string;
}) {
  if (typeof window === 'undefined') return null;

  const stored = readStoredCheckoutDraft();
  if (stored && matchesCheckoutContext(stored, context)) {
    saveLegacyCheckoutKeys(stored);
    return stored;
  }

  const legacy = readLegacyCheckoutDraft();
  if (legacy && matchesCheckoutContext(legacy, context)) {
    localStorage.setItem(
      CHECKOUT_DRAFT_KEY,
      JSON.stringify({ ...legacy, savedAt: now() }),
    );
    return legacy;
  }

  return null;
}

export function clearCheckoutDraft() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(LEGACY_CART_KEY);
  sessionStorage.removeItem(LEGACY_BRANCH_ID_KEY);
  sessionStorage.removeItem(LEGACY_BRAND_SLUG_KEY);
  sessionStorage.removeItem(LEGACY_BRANCH_SLUG_KEY);
  localStorage.removeItem(CHECKOUT_DRAFT_KEY);
}

export function saveLastOrderRecord(input: {
  order: unknown;
  branchId?: string | null;
  brandSlug?: string | null;
  branchSlug?: string | null;
  cartSnapshot?: unknown[] | null;
}) {
  if (typeof window === 'undefined') return;

  const record: LastOrderRecord = {
    order: input.order,
    branchId: input.branchId ?? null,
    brandSlug: input.brandSlug ?? null,
    branchSlug: input.branchSlug ?? null,
    cartSnapshot: input.cartSnapshot ?? null,
    savedAt: now(),
  };

  sessionStorage.setItem(LEGACY_LAST_ORDER_KEY, JSON.stringify(input.order));
  localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(record));
}

function matchesLastOrderContext(
  record: LastOrderRecord,
  context: {
    branchId?: string;
    brandSlug?: string;
    branchSlug?: string;
  },
) {
  if (context.branchId && record.branchId !== context.branchId) return false;
  if (context.brandSlug && record.brandSlug !== context.brandSlug) return false;
  if (context.branchSlug && record.branchSlug !== context.branchSlug)
    return false;
  return true;
}

export function loadLastOrderRecord(context: {
  branchId?: string;
  brandSlug?: string;
  branchSlug?: string;
}) {
  if (typeof window === 'undefined') return null;

  const stored = safeJsonParse<unknown>(localStorage.getItem(LAST_ORDER_KEY));
  if (isLastOrderRecord(stored) && !isExpired(stored.savedAt)) {
    if (matchesLastOrderContext(stored, context)) {
      // cartSnapshot을 order 객체에 병합해서 반환
      const order = stored.order;
      if (stored.cartSnapshot && isObject(order)) {
        return { ...order, cartSnapshot: stored.cartSnapshot };
      }
      return order;
    }
  }

  const legacyOrder = safeJsonParse<unknown>(
    sessionStorage.getItem(LEGACY_LAST_ORDER_KEY),
  );
  if (legacyOrder) {
    return legacyOrder;
  }

  return null;
}

export function saveCustomerInfoDraft(input: {
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress1?: string | null;
  customerAddress2?: string | null;
  customerMemo?: string | null;
}) {
  if (typeof window === 'undefined') return;

  const draft: CustomerInfoDraft = {
    customerName: normalizeText(input.customerName),
    customerPhone: normalizeText(input.customerPhone),
    customerAddress1: normalizeText(input.customerAddress1),
    customerAddress2: normalizeText(input.customerAddress2),
    customerMemo: normalizeText(input.customerMemo),
    savedAt: now(),
  };

  if (
    !draft.customerName &&
    !draft.customerPhone &&
    !draft.customerAddress1 &&
    !draft.customerAddress2 &&
    !draft.customerMemo
  ) {
    localStorage.removeItem(CUSTOMER_INFO_KEY);
    return;
  }

  localStorage.setItem(CUSTOMER_INFO_KEY, JSON.stringify(draft));
}

export function loadCustomerInfoDraft() {
  if (typeof window === 'undefined') return null;

  const parsed = safeJsonParse<unknown>(
    localStorage.getItem(CUSTOMER_INFO_KEY),
  );
  if (!isCustomerInfoDraft(parsed)) return null;
  if (isExpired(parsed.savedAt, CUSTOMER_INFO_TTL_MS)) return null;

  return {
    customerName: parsed.customerName ?? '',
    customerPhone: parsed.customerPhone ?? '',
    customerAddress1: parsed.customerAddress1 ?? '',
    customerAddress2: parsed.customerAddress2 ?? '',
    customerMemo: parsed.customerMemo ?? '',
  };
}
