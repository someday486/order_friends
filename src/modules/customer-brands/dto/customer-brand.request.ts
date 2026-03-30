import {
  ArrayMinSize,
  IsBoolean,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CashReceiptIssueTiming } from '../../cash-receipts/cash-receipt.types';

export enum ShopPaymentMethod {
  CARD = 'CARD',
  TRANSFER = 'TRANSFER',
}

export class CreateCustomerBrandRequest {
  @ApiProperty({ description: 'Brand name' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Brand slug (letters, numbers, hyphen only)',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must contain only lowercase letters, numbers, and hyphen.',
  })
  slug?: string | null;

  @ApiProperty({ description: 'Business name', required: false })
  @IsString()
  @IsOptional()
  biz_name?: string | null;

  @ApiProperty({ description: 'Business registration number', required: false })
  @IsString()
  @IsOptional()
  biz_reg_no?: string | null;

  @ApiProperty({ description: 'Logo URL', required: false })
  @IsString()
  @IsOptional()
  logo_url?: string | null;

  @ApiProperty({ description: 'Cover image URL', required: false })
  @IsString()
  @IsOptional()
  cover_image_url?: string | null;

  @ApiProperty({ description: 'Representative name', required: false })
  @IsString()
  @IsOptional()
  rep_name?: string | null;

  @ApiProperty({ description: 'Business address', required: false })
  @IsString()
  @IsOptional()
  address?: string | null;

  @ApiProperty({
    description: 'Business certificate URL (snake_case)',
    required: false,
  })
  @IsString()
  @IsOptional()
  biz_cert_url?: string | null;

  @ApiProperty({
    description: 'Business certificate URL (camelCase)',
    required: false,
  })
  @IsString()
  @IsOptional()
  bizCertUrl?: string | null;

  @ApiProperty({
    description: 'Online shop payment methods',
    required: false,
    enum: ShopPaymentMethod,
    isArray: true,
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(ShopPaymentMethod, { each: true })
  @IsOptional()
  shop_payment_methods?: ShopPaymentMethod[];

  @ApiProperty({
    description: 'Enable cash receipt automation',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  cash_receipt_enabled?: boolean;

  @ApiProperty({ description: 'Cash receipt provider', required: false })
  @IsString()
  @IsOptional()
  cash_receipt_provider?: string | null;

  @ApiProperty({ description: 'Cash receipt merchant id', required: false })
  @IsString()
  @IsOptional()
  cash_receipt_merchant_id?: string | null;

  @ApiProperty({
    description: 'Cash receipt issue timing',
    required: false,
    enum: CashReceiptIssueTiming,
  })
  @IsEnum(CashReceiptIssueTiming)
  @IsOptional()
  cash_receipt_issue_timing?: CashReceiptIssueTiming;

  @ApiProperty({ description: 'Enable self-issue fallback', required: false })
  @IsBoolean()
  @IsOptional()
  cash_receipt_self_issue_enabled?: boolean;

  @ApiProperty({ description: 'Cash receipt contact name', required: false })
  @IsString()
  @IsOptional()
  cash_receipt_contact_name?: string | null;

  @ApiProperty({ description: 'Cash receipt contact phone', required: false })
  @IsString()
  @IsOptional()
  cash_receipt_contact_phone?: string | null;
}

export class UpdateCustomerBrandRequest {
  @ApiProperty({ description: 'Brand name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Brand slug (letters, numbers, hyphen only)',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must contain only lowercase letters, numbers, and hyphen.',
  })
  slug?: string | null;

  @ApiProperty({ description: 'Business name', required: false })
  @IsString()
  @IsOptional()
  biz_name?: string | null;

  @ApiProperty({ description: 'Business registration number', required: false })
  @IsString()
  @IsOptional()
  biz_reg_no?: string | null;

  @ApiProperty({ description: 'Logo URL', required: false })
  @IsString()
  @IsOptional()
  logo_url?: string | null;

  @ApiProperty({ description: 'Cover image URL', required: false })
  @IsString()
  @IsOptional()
  cover_image_url?: string | null;

  @ApiProperty({ description: 'Representative name', required: false })
  @IsString()
  @IsOptional()
  rep_name?: string | null;

  @ApiProperty({ description: 'Business address', required: false })
  @IsString()
  @IsOptional()
  address?: string | null;

  @ApiProperty({
    description: 'Business certificate URL (snake_case)',
    required: false,
  })
  @IsString()
  @IsOptional()
  biz_cert_url?: string | null;

  @ApiProperty({
    description: 'Business certificate URL (camelCase)',
    required: false,
  })
  @IsString()
  @IsOptional()
  bizCertUrl?: string | null;

  @ApiProperty({
    description: 'Online shop payment methods',
    required: false,
    enum: ShopPaymentMethod,
    isArray: true,
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(ShopPaymentMethod, { each: true })
  @IsOptional()
  shop_payment_methods?: ShopPaymentMethod[];

  @ApiProperty({
    description: 'Enable cash receipt automation',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  cash_receipt_enabled?: boolean;

  @ApiProperty({ description: 'Cash receipt provider', required: false })
  @IsString()
  @IsOptional()
  cash_receipt_provider?: string | null;

  @ApiProperty({ description: 'Cash receipt merchant id', required: false })
  @IsString()
  @IsOptional()
  cash_receipt_merchant_id?: string | null;

  @ApiProperty({
    description: 'Cash receipt issue timing',
    required: false,
    enum: CashReceiptIssueTiming,
  })
  @IsEnum(CashReceiptIssueTiming)
  @IsOptional()
  cash_receipt_issue_timing?: CashReceiptIssueTiming;

  @ApiProperty({ description: 'Enable self-issue fallback', required: false })
  @IsBoolean()
  @IsOptional()
  cash_receipt_self_issue_enabled?: boolean;

  @ApiProperty({ description: 'Cash receipt contact name', required: false })
  @IsString()
  @IsOptional()
  cash_receipt_contact_name?: string | null;

  @ApiProperty({ description: 'Cash receipt contact phone', required: false })
  @IsString()
  @IsOptional()
  cash_receipt_contact_phone?: string | null;
}
