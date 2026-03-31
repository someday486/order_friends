import { apiClient } from '@/lib/api-client';
import type { BusinessOrder } from '@/lib/businessMockData';

export type BusinessImportedOrderRow = {
  merchantOrderNo: string;
  productName: string;
  quantity: number;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  unitPrice: number | null;
  lineAmount: number | null;
};

export type BusinessImportedOrderBatch = {
  id: string;
  createdByUserId: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  fileName: string;
  headerRowIndex: number;
  uploadedAt: string;
  rowCount: number;
  totalQty: number;
  totalAmount: number;
  itemSummary: string;
  rows: BusinessImportedOrderRow[];
  status: BusinessOrder['status'];
  paymentStatus: BusinessOrder['paymentStatus'];
};

export type CreateBusinessImportedOrderBatchPayload = {
  supplierId: string;
  supplierName: string;
  orderDate: string;
  fileName: string;
  headerRowIndex: number;
  rows: BusinessImportedOrderRow[];
  id?: string;
  uploadedAt?: string;
  rowCount?: number;
  totalQty?: number;
  totalAmount?: number;
  itemSummary?: string;
  status?: BusinessOrder['status'];
  paymentStatus?: BusinessOrder['paymentStatus'];
  createdByUserId?: string;
};

function normalizeBusinessImportError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error('요청 처리 중 오류가 발생했습니다.');
  }

  const raw = error.message;
  const jsonStart = raw.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart)) as {
        message?: string | string[];
      };
      if (Array.isArray(parsed.message) && parsed.message.length > 0) {
        return new Error(parsed.message.join(', '));
      }
      if (typeof parsed.message === 'string' && parsed.message.trim()) {
        return new Error(parsed.message);
      }
    } catch {
      return error;
    }
  }

  return error;
}

export function getBusinessOrderImportBatches() {
  return apiClient
    .get<BusinessImportedOrderBatch[]>('/upload/business-order-imports')
    .catch((error) => {
      throw normalizeBusinessImportError(error);
    });
}

export function getBusinessOrderImportBatchById(id: string) {
  return apiClient
    .get<BusinessImportedOrderBatch>(
      `/upload/business-order-imports/${encodeURIComponent(id)}`,
    )
    .catch((error) => {
      throw normalizeBusinessImportError(error);
    });
}

export function saveBusinessOrderImportBatch(
  batch: CreateBusinessImportedOrderBatchPayload,
) {
  return apiClient
    .post<BusinessImportedOrderBatch>('/upload/business-order-imports', batch)
    .catch((error) => {
      throw normalizeBusinessImportError(error);
    });
}

export function updateBusinessOrderImportBatch(
  id: string,
  status: BusinessOrder['status'],
) {
  return apiClient
    .patch<BusinessImportedOrderBatch>(
      `/upload/business-order-imports/${encodeURIComponent(id)}/status`,
      { status },
    )
    .catch((error) => {
      throw normalizeBusinessImportError(error);
    });
}

export function deleteBusinessOrderImportBatch(id: string) {
  return apiClient
    .delete<{
      message: string;
    }>(`/upload/business-order-imports/${encodeURIComponent(id)}`)
    .catch((error) => {
      throw normalizeBusinessImportError(error);
    });
}

export function mapImportedBatchToBusinessOrder(
  batch: BusinessImportedOrderBatch,
): BusinessOrder {
  return {
    id: batch.id,
    merchant: '직접 업로드',
    supplier: batch.supplierName,
    itemSummary: batch.itemSummary,
    qty: batch.totalQty,
    amount: batch.totalAmount,
    orderedAt: batch.uploadedAt,
    deliveryDate: batch.orderDate,
    status: batch.status,
    paymentStatus: batch.paymentStatus,
  };
}
