import { NotFoundException } from '@nestjs/common';
import { BillingTier } from '../billing/billing.types';

export type BranchBillingPaymentMethod = 'CARD' | 'TRANSFER';

type BrandBillingRow = {
  billing_tier?: unknown;
  shop_payment_methods?: unknown;
};

function normalizeShopPaymentMethods(
  value: unknown,
): BranchBillingPaymentMethod[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set<BranchBillingPaymentMethod>();
  for (const item of value) {
    if (item === 'CARD' || item === 'TRANSFER') {
      unique.add(item);
    }
  }

  return [...unique];
}

function isMissingColumnError(error: any): boolean {
  const message =
    typeof error?.message === 'string' ? error.message : String(error ?? '');

  return (
    error?.code === '42703' ||
    /column .* does not exist/i.test(message) ||
    /schema cache/i.test(message)
  );
}

export function inferBillingTierFromBrandRow(
  brand: BrandBillingRow | null | undefined,
): BillingTier {
  if (brand?.billing_tier === BillingTier.NON_PG) {
    return BillingTier.NON_PG;
  }

  const paymentMethods = normalizeShopPaymentMethods(
    brand?.shop_payment_methods,
  );
  return paymentMethods.length === 1 && paymentMethods[0] === 'TRANSFER'
    ? BillingTier.NON_PG
    : BillingTier.PG;
}

export function getAllowedPaymentMethodsForBillingTier(
  billingTier: BillingTier,
): BranchBillingPaymentMethod[] {
  return billingTier === BillingTier.NON_PG ? ['TRANSFER'] : ['CARD'];
}

export async function loadBrandBillingConfig(
  sb: any,
  brandId: string,
): Promise<{
  billingTier: BillingTier;
  allowedPaymentMethods: BranchBillingPaymentMethod[];
}> {
  let result = await sb
    .from('brands')
    .select('id, billing_tier, shop_payment_methods')
    .eq('id', brandId)
    .single();

  if (!result) {
    return {
      billingTier: BillingTier.PG,
      allowedPaymentMethods: getAllowedPaymentMethodsForBillingTier(
        BillingTier.PG,
      ),
    };
  }

  if (result.error && isMissingColumnError(result.error)) {
    result = await sb
      .from('brands')
      .select('id, shop_payment_methods')
      .eq('id', brandId)
      .single();

    if (!result) {
      return {
        billingTier: BillingTier.PG,
        allowedPaymentMethods: getAllowedPaymentMethodsForBillingTier(
          BillingTier.PG,
        ),
      };
    }
  }

  if (result.error || !result.data) {
    throw new NotFoundException('Brand not found');
  }

  const billingTier = inferBillingTierFromBrandRow(result.data);
  return {
    billingTier,
    allowedPaymentMethods: getAllowedPaymentMethodsForBillingTier(billingTier),
  };
}
