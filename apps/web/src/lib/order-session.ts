const CHECKOUT_DRAFT_KEY = 'order:checkout-draft:v1';
const LAST_ORDER_KEY = 'order:last-order:v1';
const LEGACY_CART_KEY = 'orderCart';
const LEGACY_BRANCH_ID_KEY = 'orderBranchId';
const LEGACY_BRAND_SLUG_KEY = 'orderBrandSlug';
const LEGACY_BRANCH_SLUG_KEY = 'orderBranchSlug';
const LEGACY_LAST_ORDER_KEY = 'lastOrder';
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000;

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
  savedAt: number;
};

function now() {
  return Date.now();
}

function isExpired(savedAt?: number) {
  if (!savedAt) return true;
  return now() - savedAt > STORAGE_TTL_MS;
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
  return 'order' in value;
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
}) {
  if (typeof window === 'undefined') return;

  const record: LastOrderRecord = {
    order: input.order,
    branchId: input.branchId ?? null,
    brandSlug: input.brandSlug ?? null,
    branchSlug: input.branchSlug ?? null,
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
      return stored.order;
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
