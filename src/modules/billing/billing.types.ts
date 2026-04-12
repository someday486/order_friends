export enum BillingTier {
  PG = 'PG',
  NON_PG = 'NON_PG',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELLED = 'CANCELLED',
  TRIAL = 'TRIAL',
}

export enum BillingRecordStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum SettlementStatus {
  PENDING = 'PENDING',
  CALCULATED = 'CALCULATED',
  SETTLED = 'SETTLED',
}
