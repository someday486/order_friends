import type { BusinessOrder } from '@/lib/businessMockData';

export type BusinessOrderStatus = BusinessOrder['status'];

export type BusinessOrderWorkflowAction = {
  label: string;
  nextStatus: BusinessOrderStatus;
  tone: 'primary' | 'secondary' | 'success';
};

const STATUS_TONE_BY_STATUS: Record<BusinessOrderStatus, string> = {
  작성중: 'bg-violet-500/15 text-violet-700',
  확인대기: 'bg-amber-500/15 text-amber-700',
  출고준비: 'bg-emerald-500/15 text-emerald-700',
  부분출고: 'bg-sky-500/15 text-sky-700',
  정산대기: 'bg-neutral-500/15 text-text-secondary',
};

const WORKFLOW_ACTIONS_BY_STATUS: Record<
  BusinessOrderStatus,
  BusinessOrderWorkflowAction[]
> = {
  작성중: [{ label: '확인 요청', nextStatus: '확인대기', tone: 'primary' }],
  확인대기: [
    { label: '작성중으로', nextStatus: '작성중', tone: 'secondary' },
    { label: '발주서 발행', nextStatus: '출고준비', tone: 'primary' },
  ],
  출고준비: [{ label: '부분 출고', nextStatus: '부분출고', tone: 'primary' }],
  부분출고: [{ label: '정산 대기', nextStatus: '정산대기', tone: 'success' }],
  정산대기: [],
};

const SUCCESS_MESSAGE_BY_STATUS: Record<BusinessOrderStatus, string> = {
  작성중: '주문서를 작성중 상태로 되돌렸습니다.',
  확인대기: '주문서를 확인대기 상태로 변경했습니다.',
  출고준비: '발주서를 발행하고 출고준비 상태로 변경했습니다.',
  부분출고: '주문서를 부분출고 상태로 변경했습니다.',
  정산대기: '주문서를 정산대기 상태로 변경했습니다.',
};

export function getBusinessOrderStatusTone(status: BusinessOrderStatus) {
  return STATUS_TONE_BY_STATUS[status];
}

export function getBusinessOrderWorkflowActions(
  status: BusinessOrderStatus,
): BusinessOrderWorkflowAction[] {
  return WORKFLOW_ACTIONS_BY_STATUS[status];
}

export function getBusinessOrderStatusSuccessMessage(
  status: BusinessOrderStatus,
) {
  return SUCCESS_MESSAGE_BY_STATUS[status];
}
