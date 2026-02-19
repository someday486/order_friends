import { randomUUID } from 'crypto';

export const ORDER_FULFILLMENT_TYPES = [
  'PICKUP',
  'DELIVERY',
  'DINE_IN',
] as const;
export const ORDER_PAYMENT_METHODS = ['CARD', 'TRANSFER', 'CASH'] as const;

export type OrderFulfillmentType = (typeof ORDER_FULFILLMENT_TYPES)[number];
export type OrderPaymentMethod = (typeof ORDER_PAYMENT_METHODS)[number];

export type BranchOrderConfig = {
  enabledFulfillmentTypes: OrderFulfillmentType[];
  allowedPaymentMethods: OrderPaymentMethod[];
  channelByType: Partial<Record<OrderFulfillmentType, string>>;
};

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

export function normalizeFulfillmentTypes(
  value: unknown,
): OrderFulfillmentType[] {
  const set = new Set<OrderFulfillmentType>();
  const raw = normalizeStringArray(value);

  for (const item of raw) {
    const upper = item.toUpperCase();
    if ((ORDER_FULFILLMENT_TYPES as readonly string[]).includes(upper)) {
      set.add(upper as OrderFulfillmentType);
    }
  }

  if (set.size === 0) {
    return [...ORDER_FULFILLMENT_TYPES];
  }

  return [...set];
}

export function normalizePaymentMethods(value: unknown): OrderPaymentMethod[] {
  const set = new Set<OrderPaymentMethod>();
  const raw = normalizeStringArray(value);

  for (const item of raw) {
    const upper = item.toUpperCase();
    if ((ORDER_PAYMENT_METHODS as readonly string[]).includes(upper)) {
      set.add(upper as OrderPaymentMethod);
    }
  }

  if (set.size === 0) {
    return [...ORDER_PAYMENT_METHODS];
  }

  return [...set];
}

function getPaymentMethodsFromBranchRow(
  branchRow: Record<string, unknown>,
): OrderPaymentMethod[] {
  const directCandidates = [
    branchRow.allowed_payment_methods,
    branchRow.payment_methods,
    branchRow.available_payment_methods,
  ];

  for (const candidate of directCandidates) {
    const methods = normalizePaymentMethods(candidate);
    if (methods.length > 0) {
      return methods;
    }
  }

  const objectCandidates = [
    toRecord(branchRow.order_settings),
    toRecord(branchRow.settings),
    toRecord(branchRow.metadata),
  ];

  for (const candidate of objectCandidates) {
    if (!candidate) continue;
    const methods = normalizePaymentMethods(
      candidate.allowedPaymentMethods ??
        candidate.allowed_payment_methods ??
        candidate.paymentMethods ??
        candidate.payment_methods,
    );
    if (methods.length > 0) {
      return methods;
    }
  }

  return [...ORDER_PAYMENT_METHODS];
}

async function fetchBranchRow(
  sb: any,
  branchId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const { data, error } = await sb
      .from('branches')
      .select('*')
      .eq('id', branchId)
      .maybeSingle();
    if (error || !data) return null;
    return toRecord(data);
  } catch {
    return null;
  }
}

export async function getBranchOrderConfig(
  sb: any,
  branchId: string,
): Promise<BranchOrderConfig> {
  const channelByType: Partial<Record<OrderFulfillmentType, string>> = {};
  let enabledFulfillmentTypes: OrderFulfillmentType[] = [
    ...ORDER_FULFILLMENT_TYPES,
  ];

  try {
    const { data, error } = await sb
      .from('order_channels')
      .select('id, type, is_active')
      .eq('branch_id', branchId)
      .eq('is_active', true);

    if (!error && Array.isArray(data) && data.length > 0) {
      const types: OrderFulfillmentType[] = [];
      for (const row of data) {
        const type =
          typeof row?.type === 'string' ? row.type.toUpperCase() : '';
        if (!(ORDER_FULFILLMENT_TYPES as readonly string[]).includes(type)) {
          continue;
        }

        const castedType = type as OrderFulfillmentType;
        types.push(castedType);
        if (typeof row?.id === 'string') {
          channelByType[castedType] = row.id;
        }
      }

      if (types.length > 0) {
        enabledFulfillmentTypes = [...new Set(types)];
      }
    }
  } catch {
    // Ignore schema/runtime differences across environments.
  }

  const branchRow = await fetchBranchRow(sb, branchId);
  const allowedPaymentMethods = branchRow
    ? getPaymentMethodsFromBranchRow(branchRow)
    : [...ORDER_PAYMENT_METHODS];

  return {
    enabledFulfillmentTypes,
    allowedPaymentMethods,
    channelByType,
  };
}

async function applyFulfillmentTypesToChannels(
  sb: any,
  branchId: string,
  enabledFulfillmentTypes: OrderFulfillmentType[],
) {
  try {
    const { data, error } = await sb
      .from('order_channels')
      .select('id, type, is_active')
      .eq('branch_id', branchId);

    if (error || !Array.isArray(data)) return;

    const enabledSet = new Set(enabledFulfillmentTypes);
    const existingTypeSet = new Set<OrderFulfillmentType>();

    for (const row of data) {
      const type =
        typeof row?.type === 'string' ? row.type.toUpperCase() : undefined;
      if (!type) continue;
      if (!(ORDER_FULFILLMENT_TYPES as readonly string[]).includes(type)) {
        continue;
      }

      const castedType = type as OrderFulfillmentType;
      existingTypeSet.add(castedType);
      const shouldActive = enabledSet.has(castedType);
      const isActive = row?.is_active === true;
      if (shouldActive === isActive) continue;
      if (typeof row?.id !== 'string') continue;

      await sb
        .from('order_channels')
        .update({ is_active: shouldActive })
        .eq('id', row.id);
    }

    const missingTypes = enabledFulfillmentTypes.filter(
      (type) => !existingTypeSet.has(type),
    );

    for (const type of missingTypes) {
      const typeSlug = type.toLowerCase().replace(/_/g, '-');
      const fallbackSlug = `${branchId}-${typeSlug}`;
      const id = randomUUID();

      const { error: insertWithSlugError } = await sb
        .from('order_channels')
        .insert({
          id,
          branch_id: branchId,
          type,
          slug: fallbackSlug,
          is_active: true,
        });

      if (!insertWithSlugError) continue;

      await sb.from('order_channels').insert({
        id,
        branch_id: branchId,
        type,
        is_active: true,
      });
    }
  } catch {
    // Ignore schema/runtime differences across environments.
  }
}

async function persistPaymentMethodsToBranch(
  sb: any,
  branchId: string,
  methods: OrderPaymentMethod[],
) {
  const branchRow = await fetchBranchRow(sb, branchId);
  if (!branchRow) return;

  if ('allowed_payment_methods' in branchRow) {
    await sb
      .from('branches')
      .update({ allowed_payment_methods: methods })
      .eq('id', branchId);
    return;
  }

  if ('payment_methods' in branchRow) {
    await sb
      .from('branches')
      .update({ payment_methods: methods })
      .eq('id', branchId);
    return;
  }

  const objectColumns = ['order_settings', 'settings', 'metadata'] as const;
  for (const column of objectColumns) {
    if (!(column in branchRow)) continue;

    const current = toRecord(branchRow[column]) ?? {};
    const next = {
      ...current,
      allowedPaymentMethods: methods,
      allowed_payment_methods: methods,
    };

    await sb
      .from('branches')
      .update({ [column]: next })
      .eq('id', branchId);
    return;
  }
}

export async function saveBranchOrderConfig(
  sb: any,
  branchId: string,
  input: {
    enabledFulfillmentTypes?: unknown;
    allowedPaymentMethods?: unknown;
  },
) {
  if (input.enabledFulfillmentTypes !== undefined) {
    const enabled = normalizeFulfillmentTypes(input.enabledFulfillmentTypes);
    await applyFulfillmentTypesToChannels(sb, branchId, enabled);
  }

  if (input.allowedPaymentMethods !== undefined) {
    const methods = normalizePaymentMethods(input.allowedPaymentMethods);
    await persistPaymentMethodsToBranch(sb, branchId, methods);
  }
}
