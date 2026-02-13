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
};

export function createOrderExportJob(payload: CreateOrderExportPayload) {
  return apiClient.post<CreateOrderExportResponse>("/exports/orders", payload);
}

