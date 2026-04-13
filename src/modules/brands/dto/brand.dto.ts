import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { CashReceiptIssueTiming } from '../../cash-receipts/cash-receipt.types';
import { BillingTier } from '../../billing/billing.types';

// Response DTOs
export class BrandListItemResponse {
  id: string;
  name: string;
  isActive: boolean;
  billingTier?: BillingTier | null;
  slug?: string | null;
  bizName?: string | null;
  bizRegNo?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  createdAt: string;
}

export class BrandDetailResponse {
  id: string;
  name: string;
  isActive: boolean;
  billingTier?: BillingTier | null;
  slug?: string | null;
  ownerUserId?: string | null;
  bizName?: string | null;
  bizRegNo?: string | null;
  repName?: string | null;
  address?: string | null;
  bizCertUrl?: string | null;
  cashReceiptEnabled?: boolean;
  cashReceiptProvider?: string | null;
  cashReceiptMerchantId?: string | null;
  cashReceiptIssueTiming?: string | null;
  cashReceiptSelfIssueEnabled?: boolean;
  cashReceiptContactName?: string | null;
  cashReceiptContactPhone?: string | null;
  cashReceiptOnboardingMessage?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  createdAt: string;
}

// Request DTOs
export class CreateBrandRequest {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  bizName?: string;

  @IsString()
  @IsOptional()
  bizRegNo?: string;

  @IsString()
  @IsOptional()
  repName?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  bizCertUrl?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  coverImageUrl?: string;

  @IsBoolean()
  @IsOptional()
  cashReceiptEnabled?: boolean;

  @IsString()
  @IsOptional()
  cashReceiptProvider?: string;

  @IsString()
  @IsOptional()
  cashReceiptMerchantId?: string;

  @IsEnum(CashReceiptIssueTiming)
  @IsOptional()
  cashReceiptIssueTiming?: CashReceiptIssueTiming;

  @IsBoolean()
  @IsOptional()
  cashReceiptSelfIssueEnabled?: boolean;

  @IsString()
  @IsOptional()
  cashReceiptContactName?: string;

  @IsString()
  @IsOptional()
  cashReceiptContactPhone?: string;
}

export class UpdateBrandRequest {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  bizName?: string;

  @IsString()
  @IsOptional()
  bizRegNo?: string;

  @IsString()
  @IsOptional()
  repName?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  bizCertUrl?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  coverImageUrl?: string;

  @IsBoolean()
  @IsOptional()
  cashReceiptEnabled?: boolean;

  @IsString()
  @IsOptional()
  cashReceiptProvider?: string;

  @IsString()
  @IsOptional()
  cashReceiptMerchantId?: string;

  @IsEnum(CashReceiptIssueTiming)
  @IsOptional()
  cashReceiptIssueTiming?: CashReceiptIssueTiming;

  @IsBoolean()
  @IsOptional()
  cashReceiptSelfIssueEnabled?: boolean;

  @IsString()
  @IsOptional()
  cashReceiptContactName?: string;

  @IsString()
  @IsOptional()
  cashReceiptContactPhone?: string;
}
