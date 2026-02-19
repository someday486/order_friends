import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ShopPaymentMethod {
  CARD = 'CARD',
  TRANSFER = 'TRANSFER',
  CASH = 'CASH',
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
}
