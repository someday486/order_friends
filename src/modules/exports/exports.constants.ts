export const ORDER_EXPORT_QUEUE_NAME = 'order-exports';
export const ORDER_EXPORT_JOB_NAME = 'order-export';

export type OrderExportQueuePayload = {
  jobId: string;
  userId: string;
};
