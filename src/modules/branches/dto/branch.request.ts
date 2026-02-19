import {
  IsString,
  IsOptional,
  Matches,
  IsArray,
  IsEnum,
} from 'class-validator';

export enum BranchFulfillmentType {
  PICKUP = 'PICKUP',
  DELIVERY = 'DELIVERY',
  DINE_IN = 'DINE_IN',
}

export enum BranchPaymentMethod {
  CARD = 'CARD',
  TRANSFER = 'TRANSFER',
  CASH = 'CASH',
}

export class CreateBranchRequest {
  @IsString()
  brandId: string;

  @IsString()
  name: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug는 소문자 영문, 숫자, 하이픈(-)만 허용됩니다.',
  })
  slug: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  coverImageUrl?: string;

  @IsString()
  @IsOptional()
  thumbnailUrl?: string;

  @IsArray()
  @IsEnum(BranchFulfillmentType, { each: true })
  @IsOptional()
  enabledFulfillmentTypes?: BranchFulfillmentType[];

  @IsArray()
  @IsEnum(BranchPaymentMethod, { each: true })
  @IsOptional()
  allowedPaymentMethods?: BranchPaymentMethod[];
}

export class UpdateBranchRequest {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug는 소문자, 숫자, 하이픈(-)만 허용합니다.',
  })
  slug?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  coverImageUrl?: string;

  @IsString()
  @IsOptional()
  thumbnailUrl?: string;

  @IsArray()
  @IsEnum(BranchFulfillmentType, { each: true })
  @IsOptional()
  enabledFulfillmentTypes?: BranchFulfillmentType[];

  @IsArray()
  @IsEnum(BranchPaymentMethod, { each: true })
  @IsOptional()
  allowedPaymentMethods?: BranchPaymentMethod[];
}
