type BillingTier = 'PG' | 'NON_PG';
type StorePaymentMethod = 'CARD' | 'TRANSFER';

const PG_PAYMENT_METHODS: StorePaymentMethod[] = ['CARD'];
const NON_PG_PAYMENT_METHODS: StorePaymentMethod[] = ['TRANSFER'];

export function inferBillingTierFromAllowedPaymentMethods(
  methods: readonly unknown[] | null | undefined,
): BillingTier | null {
  if (!Array.isArray(methods) || methods.length === 0) {
    return null;
  }

  const normalized = methods.filter(
    (value): value is StorePaymentMethod =>
      value === 'CARD' || value === 'TRANSFER',
  );

  if (normalized.length === 1 && normalized[0] === 'TRANSFER') {
    return 'NON_PG';
  }

  if (normalized.includes('CARD')) {
    return 'PG';
  }

  return null;
}

export function resolveBillingTier(
  billingTier: BillingTier | null | undefined,
  methods?: readonly unknown[] | null,
): BillingTier {
  return (
    billingTier ?? inferBillingTierFromAllowedPaymentMethods(methods) ?? 'PG'
  );
}

export function getAllowedPaymentMethodsForBillingTier(
  billingTier: BillingTier | null | undefined,
): StorePaymentMethod[] {
  return billingTier === 'NON_PG'
    ? [...NON_PG_PAYMENT_METHODS]
    : [...PG_PAYMENT_METHODS];
}

export function isManualTransferTier(
  billingTier: BillingTier | null | undefined,
): boolean {
  return resolveBillingTier(billingTier) === 'NON_PG';
}

export function getBillingTierLabel(
  billingTier: BillingTier | null | undefined,
): string {
  return resolveBillingTier(billingTier) === 'NON_PG'
    ? '무통장 전용'
    : 'PG 이용';
}

export function getBillingTierCheckoutDescription(
  billingTier: BillingTier | null | undefined,
): string {
  return resolveBillingTier(billingTier) === 'NON_PG'
    ? '이 브랜드는 계좌이체로만 주문을 받을 수 있어요.'
    : '이 브랜드는 토스페이먼츠 결제로만 주문을 받을 수 있어요.';
}
