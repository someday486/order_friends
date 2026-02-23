import { randomUUID } from 'crypto';

export const ORDER_FULFILLMENT_TYPES = [
  'PICKUP',
  'DELIVERY',
  'DINE_IN',
] as const;
export const ORDER_PAYMENT_METHODS = ['CARD', 'TRANSFER', 'CASH'] as const;

export type OrderFulfillmentType = (typeof ORDER_FULFILLMENT_TYPES)[number];
export type OrderPaymentMethod = (typeof ORDER_PAYMENT_METHODS)[number];

export type TransferAccountInfo = {
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
};

export type BranchOrderConfig = {
  enabledFulfillmentTypes: OrderFulfillmentType[];
  allowedPaymentMethods: OrderPaymentMethod[];
  transferAccount: TransferAccountInfo | null;
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

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeTransferAccount(value: unknown): TransferAccountInfo | null {
  const row = toRecord(value);
  if (!row) return null;

  const bankName = normalizeOptionalString(
    row.bankName ?? row.bank_name ?? row.transfer_bank_name,
  );
  const accountNumber = normalizeOptionalString(
    row.accountNumber ?? row.account_number ?? row.transfer_account_number,
  );
  const accountHolder = normalizeOptionalString(
    row.accountHolder ?? row.account_holder ?? row.transfer_account_holder,
  );

  if (!bankName && !accountNumber && !accountHolder) {
    return null;
  }

  return {
    bankName,
    accountNumber,
    accountHolder,
  };
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

function getTransferAccountFromBranchRow(
  branchRow: Record<string, unknown>,
): TransferAccountInfo | null {
  const direct = normalizeTransferAccount({
    transfer_bank_name: branchRow.transfer_bank_name,
    transfer_account_number: branchRow.transfer_account_number,
    transfer_account_holder: branchRow.transfer_account_holder,
    bank_name: branchRow.bank_name,
    account_number: branchRow.account_number,
    account_holder: branchRow.account_holder,
  });
  if (direct) return direct;

  const objectCandidates = [
    toRecord(branchRow.order_settings),
    toRecord(branchRow.settings),
    toRecord(branchRow.metadata),
  ];

  for (const candidate of objectCandidates) {
    if (!candidate) continue;
    const account = normalizeTransferAccount(
      candidate.transferAccount ??
        candidate.transfer_account ??
        candidate.bankAccount ??
        candidate.bank_account ??
        candidate,
    );
    if (account) return account;
  }

  return null;
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
  const transferAccount = branchRow
    ? getTransferAccountFromBranchRow(branchRow)
    : null;

  return {
    enabledFulfillmentTypes,
    allowedPaymentMethods,
    transferAccount,
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

async function persistTransferAccountToBranch(
  sb: any,
  branchId: string,
  transferAccount: TransferAccountInfo | null,
) {
  const branchRow = await fetchBranchRow(sb, branchId);
  if (!branchRow) return;

  const directPayload: Record<string, unknown> = {};
  if ('transfer_bank_name' in branchRow) {
    directPayload.transfer_bank_name = transferAccount?.bankName ?? null;
  }
  if ('transfer_account_number' in branchRow) {
    directPayload.transfer_account_number =
      transferAccount?.accountNumber ?? null;
  }
  if ('transfer_account_holder' in branchRow) {
    directPayload.transfer_account_holder =
      transferAccount?.accountHolder ?? null;
  }
  if ('bank_name' in branchRow) {
    directPayload.bank_name = transferAccount?.bankName ?? null;
  }
  if ('account_number' in branchRow) {
    directPayload.account_number = transferAccount?.accountNumber ?? null;
  }
  if ('account_holder' in branchRow) {
    directPayload.account_holder = transferAccount?.accountHolder ?? null;
  }

  if (Object.keys(directPayload).length > 0) {
    await sb.from('branches').update(directPayload).eq('id', branchId);
    return;
  }

  const objectColumns = ['order_settings', 'settings', 'metadata'] as const;
  for (const column of objectColumns) {
    if (!(column in branchRow)) continue;

    const current = toRecord(branchRow[column]) ?? {};
    const next = {
      ...current,
      transferAccount: transferAccount
        ? {
            bankName: transferAccount.bankName,
            accountNumber: transferAccount.accountNumber,
            accountHolder: transferAccount.accountHolder,
          }
        : null,
      transfer_account: transferAccount
        ? {
            bank_name: transferAccount.bankName,
            account_number: transferAccount.accountNumber,
            account_holder: transferAccount.accountHolder,
          }
        : null,
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
    transferAccount?: unknown;
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

  if (input.transferAccount !== undefined) {
    const transferAccount = normalizeTransferAccount(input.transferAccount);
    await persistTransferAccountToBranch(sb, branchId, transferAccount);
  }
}
