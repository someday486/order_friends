export enum CashReceiptIssueTiming {
  ORDER_COMPLETED = 'ORDER_COMPLETED',
}

export enum CashReceiptStatus {
  REQUESTED = 'REQUESTED',
  ISSUED = 'ISSUED',
  CANCEL_REQUESTED = 'CANCEL_REQUESTED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

export enum CashReceiptType {
  INCOME_DEDUCTION = 'INCOME_DEDUCTION',
  EXPENSE_PROOF = 'EXPENSE_PROOF',
}

export enum CashReceiptIdentityType {
  PHONE = 'PHONE',
  BUSINESS_NUMBER = 'BUSINESS_NUMBER',
  CARD_NUMBER = 'CARD_NUMBER',
  SELF_ISSUE = 'SELF_ISSUE',
}

export enum CashReceiptProvider {
  POPBILL = 'POPBILL',
}

export const CASH_RECEIPT_SELF_ISSUE_NUMBER = '01000001234';
