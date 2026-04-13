import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { BillingTier, SubscriptionStatus } from '../billing.types';

export class SubscriptionQueryDto {
  @ApiProperty({ description: '브랜드 ID' })
  @IsUUID()
  brandId!: string;
}

export class CancelSubscriptionRequest {
  @ApiProperty({ description: '브랜드 ID' })
  @IsUUID()
  brandId!: string;
}

export class ChangePlanRequest {
  @ApiProperty({ description: '브랜드 ID' })
  @IsUUID()
  brandId!: string;

  @ApiProperty({ description: '변경할 플랜 ID' })
  @IsUUID()
  planId!: string;
}

export class SubscriptionPlanOptionResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  price!: number;

  @ApiPropertyOptional()
  maxMonthlyOrders!: number | null;

  @ApiProperty()
  isCurrent!: boolean;
}

export class ChangePlanResponse {
  @ApiProperty({ description: '적용 시각' })
  effectiveDate!: string;

  @ApiPropertyOptional({ description: '즉시 업그레이드 시 일할 청구 금액' })
  proratedAmount?: number;

  @ApiProperty({ type: SubscriptionPlanOptionResponse })
  newPlan!: SubscriptionPlanOptionResponse;
}

export class SubscriptionResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  brandId!: string;

  @ApiProperty()
  planId!: string;

  @ApiProperty({
    enum: SubscriptionStatus,
    enumName: 'SubscriptionStatus',
  })
  status!: SubscriptionStatus;

  @ApiProperty({
    enum: BillingTier,
    enumName: 'BillingTier',
  })
  billingTier!: BillingTier;

  @ApiProperty()
  currentPeriodStart!: string;

  @ApiProperty()
  currentPeriodEnd!: string;

  @ApiProperty()
  nextBillingAt!: string;

  @ApiPropertyOptional()
  cancelledAt?: string | null;

  @ApiProperty()
  planName!: string;

  @ApiProperty()
  planPrice!: number;

  @ApiPropertyOptional()
  planMaxMonthlyOrders!: number | null;

  @ApiProperty()
  hasPaymentMethod!: boolean;

  @ApiProperty()
  currentOrderCount!: number;

  @ApiProperty()
  hasExceededLimit!: boolean;

  @ApiProperty({ type: SubscriptionPlanOptionResponse, isArray: true })
  availablePlans!: SubscriptionPlanOptionResponse[];

  @ApiPropertyOptional()
  scheduledPlanId?: string | null;

  @ApiPropertyOptional()
  scheduledPlanName?: string | null;

  @ApiPropertyOptional()
  scheduledPlanPrice?: number | null;

  @ApiPropertyOptional()
  scheduledPlanMaxMonthlyOrders?: number | null;

  @ApiPropertyOptional()
  scheduledPlanEffectiveAt?: string | null;

  @ApiPropertyOptional()
  cardCompany?: string | null;

  @ApiPropertyOptional()
  cardNumber?: string | null;

  @ApiPropertyOptional()
  cardOwner?: string | null;
}

export class BillingSummaryQueryDto {
  @ApiProperty({ description: '브랜드 ID' })
  @IsUUID()
  brandId!: string;

  @ApiPropertyOptional({ description: '조회할 최근 개월 수', example: 6 })
  @IsOptional()
  @IsInt()
  @Min(1)
  months?: number;
}

export class BillingSummaryResponse {
  @ApiProperty()
  totalSuccessAmount!: number;

  @ApiProperty()
  totalFailedCount!: number;

  @ApiPropertyOptional()
  lastPaidAt?: string | null;

  @ApiPropertyOptional()
  nextBillingAt?: string | null;
}
