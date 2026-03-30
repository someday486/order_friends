import { apiClient } from '@/lib/api-client';

type CreateOrderExportPayload = {
  format: 'csv' | 'xlsx';
  scope?: 'detail';
  filters?: {
    branchId?: string;
    status?: string;
    fulfillmentType?: 'PICKUP' | 'DELIVERY' | 'DINE_IN' | 'SHIPPING';
    dateStart?: string;
    dateEnd?: string;
  };
};

type CreateOrderExportResponse = {
  jobId: string;
  id?: string;
};

export type OrderExportJobStatusResponse = {
  jobId: string;
  status: string;
  downloadUrl?: string | null;
  error?: string | null;
};

function toSafeString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function pickStatus(data: unknown): string {
  const source = (data ?? {}) as Record<string, unknown>;
  return toSafeString(source.status ?? source.job_status ?? source.state ?? '');
}

function pickDownloadUrl(data: unknown): string {
  const source = (data ?? {}) as Record<string, unknown>;
  return toSafeString(
    source.downloadUrl ??
      source.download_url ??
      source.signedUrl ??
      source.signed_url ??
      source.url ??
      '',
  );
}

function isDone(status: string): boolean {
  const normalizedStatus = status.toUpperCase();
  return ['DONE', 'COMPLETED', 'SUCCESS', 'SUCCEEDED', 'FINISHED'].includes(
    normalizedStatus,
  );
}

export async function createOrderExportJob(payload: CreateOrderExportPayload) {
  const created = await apiClient.post<CreateOrderExportResponse>(
    '/exports/orders',
    payload,
  );

  const jobId = created?.jobId ?? created?.id;
  if (!jobId) throw new Error('Export jobId가 없습니다.');

  const startedAt = Date.now();
  while (Date.now() - startedAt < 45_000) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const job = await apiClient.get<
      OrderExportJobStatusResponse & Record<string, unknown>
    >(`/exports/orders/${jobId}`);

    const status = pickStatus(job);
    const url = pickDownloadUrl(job);

    if (isDone(status) && url) {
      return { ...job, downloadUrl: url };
    }
    if (status.toUpperCase() === 'FAILED') {
      throw new Error(job?.error ?? 'Export 실패');
    }
  }

  throw new Error('아직 처리중입니다. 잠시 후 Export 목록에서 다운로드하세요.');
}

export function getOrderExportJobStatus(jobId: string) {
  return apiClient.get<OrderExportJobStatusResponse>(
    `/exports/orders/${jobId}`,
  );
}
