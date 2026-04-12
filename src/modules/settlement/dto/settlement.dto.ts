import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { SettlementStatus } from '../../billing/billing.types';

export class SettlementPeriodsQueryDto {
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

export class SettlementSummaryQueryDto {
  @ApiProperty({ description: '브랜드 ID' })
  @IsUUID()
  brandId!: string;

  @ApiPropertyOptional({ description: '조회할 최근 개월 수' })
  @IsOptional()
  @IsInt()
  @Min(1)
  months?: number;
}

export class SettlementPeriodResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  brandId!: string;

  @ApiProperty()
  periodStart!: string;

  @ApiProperty()
  periodEnd!: string;

  @ApiProperty()
  totalSales!: number;

  @ApiProperty()
  totalRefunds!: number;

  @ApiProperty()
  commissionRate!: number;

  @ApiProperty()
  commissionAmount!: number;

  @ApiProperty()
  netSettlement!: number;

  @ApiProperty({ enum: SettlementStatus, enumName: 'SettlementStatus' })
  status!: SettlementStatus;

  @ApiPropertyOptional()
  settledAt?: string | null;
}

export class SettlementLineItemResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  paymentId!: string;

  @ApiProperty()
  orderId!: string;

  @ApiProperty()
  saleAmount!: number;

  @ApiProperty()
  commissionAmount!: number;

  @ApiProperty()
  netAmount!: number;

  @ApiProperty()
  createdAt!: string;
}

export class SettlementPeriodDetailResponse extends SettlementPeriodResponse {
  @ApiProperty({ type: SettlementLineItemResponse, isArray: true })
  lineItems!: SettlementLineItemResponse[];
}

export class AdminSettlementPeriodsQueryDto {
  @ApiPropertyOptional({ description: '브랜드 ID' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ enum: SettlementStatus, enumName: 'SettlementStatus' })
  @IsOptional()
  @IsEnum(SettlementStatus)
  status?: SettlementStatus;
}

export class SettleSettlementPeriodRequest {
  @ApiPropertyOptional({ description: '정산 메모' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CalculateSettlementRequest {
  @ApiPropertyOptional({ description: '기준일 ISO 문자열' })
  @IsOptional()
  @IsString()
  targetDate?: string;
}

export class CommissionTierDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  minMonthlySales!: number;

  @ApiPropertyOptional()
  maxMonthlySales?: number | null;

  @ApiProperty()
  commissionRate!: number;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty()
  isActive!: boolean;
}

export class UpsertCommissionTierRequest {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  minMonthlySales!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxMonthlySales?: number | null;

  @ApiProperty()
  commissionRate!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  isActive?: boolean;
}

export class SettlementSummaryResponse {
  @ApiProperty()
  totalSales!: number;

  @ApiProperty()
  totalRefunds!: number;

  @ApiProperty()
  totalCommission!: number;

  @ApiProperty()
  totalNetSettlement!: number;
}
