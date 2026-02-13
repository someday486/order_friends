import { apiClient } from "@/lib/api-client";

type CreateOrderExportPayload = {
  format: "csv" | "xlsx";
  scope?: "detail";
  filters?: {
    branchId?: string;
    status?: string;
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

export function createOrderExportJob(payload: CreateOrderExportPayload) {
  return apiClient.post<CreateOrderExportResponse>("/exports/orders", payload);
}

export function getOrderExportJobStatus(jobId: string) {
  return apiClient.get<OrderExportJobStatusResponse>(`/exports/orders/${jobId}`);
}
