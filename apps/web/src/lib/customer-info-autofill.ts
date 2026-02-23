import { apiClient } from '@/lib/api-client';
import { supabaseBrowser } from '@/lib/supabase/client';

type CustomerInfoFields = {
  customerName: string;
  customerPhone: string;
  customerAddress1: string;
  customerAddress2: string;
  customerMemo: string;
};

type OrderListItem = {
  id: string;
};

type OrderListResponse = {
  data?: OrderListItem[];
  items?: OrderListItem[];
};

type OrderDetailResponse = {
  customer?: {
    name?: string;
    phone?: string;
    address1?: string;
    address2?: string;
    memo?: string;
  };
};

type CustomerInfoPartial = Partial<CustomerInfoFields>;

function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getUserMetadataValue(
  metadata: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const value = toText(metadata[key]);
    if (value) return value;
  }
  return '';
}

function extractFromUserMetadata(userMetadata: unknown): CustomerInfoPartial {
  if (!userMetadata || typeof userMetadata !== 'object') {
    return {};
  }

  const metadata = userMetadata as Record<string, unknown>;
  const customerName = getUserMetadataValue(metadata, [
    'customer_name',
    'display_name',
    'displayName',
    'name',
    'full_name',
    'nickname',
    'user_name',
  ]);
  const customerPhone = getUserMetadataValue(metadata, [
    'customer_phone',
    'phone',
    'phone_number',
  ]);
  const customerAddress1 = getUserMetadataValue(metadata, [
    'customer_address1',
    'address1',
    'customerAddress1',
  ]);
  const customerAddress2 = getUserMetadataValue(metadata, [
    'customer_address2',
    'address2',
    'customerAddress2',
  ]);
  const customerMemo = getUserMetadataValue(metadata, [
    'customer_memo',
    'memo',
    'customerMemo',
  ]);

  return {
    customerName: customerName || undefined,
    customerPhone: customerPhone || undefined,
    customerAddress1: customerAddress1 || undefined,
    customerAddress2: customerAddress2 || undefined,
    customerMemo: customerMemo || undefined,
  };
}

async function extractFromLatestOrder(): Promise<CustomerInfoPartial> {
  try {
    const list = await apiClient.get<OrderListResponse | OrderListItem[]>(
      '/customer/orders?page=1&limit=1',
    );
    const orders = Array.isArray(list) ? list : (list.data ?? list.items ?? []);
    const latestOrderId = orders[0]?.id;
    if (!latestOrderId) return {};

    const detail = await apiClient.get<OrderDetailResponse>(
      `/customer/orders/${encodeURIComponent(latestOrderId)}`,
    );
    const customer = detail.customer ?? {};
    const customerName = toText(customer.name);
    const customerPhone = toText(customer.phone);
    const customerAddress1 = toText(customer.address1);
    const customerAddress2 = toText(customer.address2);
    const customerMemo = toText(customer.memo);

    return {
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      customerAddress1: customerAddress1 || undefined,
      customerAddress2: customerAddress2 || undefined,
      customerMemo: customerMemo || undefined,
    };
  } catch {
    return {};
  }
}

export async function loadCustomerInfoFromLatestOrder(): Promise<CustomerInfoPartial> {
  return extractFromLatestOrder();
}

export async function loadCustomerInfoFromAuthenticatedUser(
  userMetadata: unknown,
): Promise<CustomerInfoPartial> {
  const metadataInfo = extractFromUserMetadata(userMetadata);
  const latestOrderInfo = await extractFromLatestOrder();

  return {
    customerName: metadataInfo.customerName ?? latestOrderInfo.customerName,
    customerPhone: metadataInfo.customerPhone ?? latestOrderInfo.customerPhone,
    customerAddress1:
      metadataInfo.customerAddress1 ?? latestOrderInfo.customerAddress1,
    customerAddress2:
      metadataInfo.customerAddress2 ?? latestOrderInfo.customerAddress2,
    customerMemo: metadataInfo.customerMemo ?? latestOrderInfo.customerMemo,
  };
}

export async function persistCustomerInfoToUserMetadata(input: {
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress1?: string | null;
  customerAddress2?: string | null;
  customerMemo?: string | null;
}): Promise<void> {
  const customerName = toText(input.customerName);
  const customerPhone = toText(input.customerPhone);
  const customerAddress1 = toText(input.customerAddress1);
  const customerAddress2 = toText(input.customerAddress2);
  const customerMemo = toText(input.customerMemo);

  const data: Record<string, string> = {};
  if (customerName) data.customer_name = customerName;
  if (customerPhone) data.customer_phone = customerPhone;
  if (customerAddress1) data.customer_address1 = customerAddress1;
  if (customerAddress2) data.customer_address2 = customerAddress2;
  if (customerMemo) data.customer_memo = customerMemo;

  if (Object.keys(data).length === 0) return;

  try {
    await supabaseBrowser.auth.updateUser({ data });
  } catch {
    // Keep order flow resilient even when metadata persistence fails.
  }
}
