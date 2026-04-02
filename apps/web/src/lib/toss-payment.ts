const GUEST_CUSTOMER_KEY = 'order:toss-guest-customer-key:v1';

function normalizeKey(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function trimToMaxLength(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export function getTossWidgetClientKey() {
  return (
    normalizeKey(process.env.NEXT_PUBLIC_TOSS_WIDGET_CLIENT_KEY) ??
    normalizeKey(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY) ??
    null
  );
}

export function getTossWidgetVariantKeys() {
  return {
    paymentMethod: normalizeKey(
      process.env.NEXT_PUBLIC_TOSS_WIDGET_PAYMENT_METHOD_VARIANT_KEY,
    ),
    agreement: normalizeKey(
      process.env.NEXT_PUBLIC_TOSS_WIDGET_AGREEMENT_VARIANT_KEY,
    ),
  };
}

export function getOrCreateTossCustomerKey(userId?: string | null) {
  if (typeof window === 'undefined') {
    return normalizeKey(userId);
  }

  const normalizedUserId = normalizeKey(userId);
  if (normalizedUserId) {
    return trimToMaxLength(normalizedUserId, 50);
  }

  const stored = normalizeKey(localStorage.getItem(GUEST_CUSTOMER_KEY));
  if (stored) {
    return trimToMaxLength(stored, 50);
  }

  const generated = trimToMaxLength(`guest_${crypto.randomUUID()}`, 50);
  localStorage.setItem(GUEST_CUSTOMER_KEY, generated);
  return generated;
}

export function getTossRedirectUrls() {
  if (typeof window === 'undefined') {
    return {
      successUrl: '/order/payment/success',
      failUrl: '/order/payment/fail',
    };
  }

  const origin = window.location.origin;
  return {
    successUrl: `${origin}/order/payment/success`,
    failUrl: `${origin}/order/payment/fail`,
  };
}

export function normalizeMobilePhone(value?: string | null) {
  return (value ?? '').replace(/[^\d]/g, '');
}
