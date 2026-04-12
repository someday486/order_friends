import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import {
  BillingRecordStatus,
  BillingTier,
  SubscriptionStatus,
} from '../billing.types';

export class IssueBillingKeyRequest {
  @ApiProperty({ description: '브랜드 ID' })
  @IsUUID()
  brandId!: string;

  @ApiProperty({ description: '토스 빌링 인증 키' })
  @IsString()
  authKey!: string;

  @ApiProperty({ description: '토스 고객 키' })
  @IsString()
  customerKey!: string;
}

export class UpdateBillingKeyRequest extends IssueBillingKeyRequest {}

export class DeleteBillingKeyRequest {
  @ApiProperty({ description: '브랜드 ID' })
  @IsUUID()
  brandId!: string;
}

export class RetryBillingRequest {
  @ApiPropertyOptional({ description: '빌링 레코드 ID' })
  @IsOptional()
  @IsUUID()
  billingRecordId?: string;

  @ApiPropertyOptional({ description: '브랜드 ID' })
  @IsOptional()
  @IsUUID()
  brandId?: string;
}

export class BillingKeyResponse {
  @ApiProperty({ enum: BillingTier, enumName: 'BillingTier' })
  billingTier!: BillingTier;

  @ApiProperty({ enum: SubscriptionStatus, enumName: 'SubscriptionStatus' })
  subscriptionStatus!: SubscriptionStatus;

  @ApiProperty({ description: '토스 고객 키' })
  customerKey!: string;

  @ApiPropertyOptional({ description: '카드사 이름' })
  cardCompany?: string | null;

  @ApiPropertyOptional({ description: '마스킹된 카드 번호' })
  cardNumber?: string | null;

  @ApiPropertyOptional({ description: '카드 소유자명' })
  cardOwner?: string | null;

  @ApiPropertyOptional({ description: '빌링키 발급 시각' })
  issuedAt?: string | null;
}

export class BillingRecordQueryDto {
  @ApiProperty({ description: '브랜드 ID' })
  @IsUUID()
  brandId!: string;

  @ApiPropertyOptional({ description: '조회 페이지' })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '페이지 크기' })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

export class AdminBillingRecordQueryDto {
  @ApiPropertyOptional({ description: '브랜드 ID' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({
    enum: BillingRecordStatus,
    enumName: 'BillingRecordStatus',
  })
  @IsOptional()
  @IsEnum(BillingRecordStatus)
  status?: BillingRecordStatus;

  @ApiPropertyOptional({ description: '조회 페이지' })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '페이지 크기' })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

export class BillingRecordResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  brandId!: string;

  @ApiProperty()
  subscriptionId!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty({
    enum: BillingRecordStatus,
    enumName: 'BillingRecordStatus',
  })
  status!: BillingRecordStatus;

  @ApiProperty()
  provider!: string;

  @ApiPropertyOptional()
  providerPaymentKey?: string | null;

  @ApiProperty()
  billingPeriodStart!: string;

  @ApiProperty()
  billingPeriodEnd!: string;

  @ApiPropertyOptional()
  attemptedAt?: string | null;

  @ApiPropertyOptional()
  paidAt?: string | null;

  @ApiPropertyOptional()
  failureReason?: string | null;

  @ApiProperty()
  retryCount!: number;

  @ApiProperty()
  createdAt!: string;
}

export class AdminSubscriptionQueryDto {
  @ApiPropertyOptional({
    enum: SubscriptionStatus,
    enumName: 'SubscriptionStatus',
  })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiPropertyOptional({ description: '조회 페이지' })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '페이지 크기' })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

export class AdminUpdateSubscriptionStatusRequest {
  @ApiProperty({
    enum: SubscriptionStatus,
    enumName: 'SubscriptionStatus',
  })
  @IsEnum(SubscriptionStatus)
  status!: SubscriptionStatus;
}

export class AdminExtendSubscriptionRequest {
  @ApiProperty({ description: '연장 일수' })
  @IsInt()
  @Min(1)
  days!: number;
}
