import {
  IsString,
  IsOptional,
  Matches,
  IsArray,
  IsEnum,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum BranchFulfillmentType {
  PICKUP = 'PICKUP',
  DELIVERY = 'DELIVERY',
  DINE_IN = 'DINE_IN',
  SHIPPING = 'SHIPPING',
}

export enum BranchPaymentMethod {
  CARD = 'CARD',
  TRANSFER = 'TRANSFER',
  CASH = 'CASH',
}

export class TransferAccountRequest {
  @IsString()
  @IsOptional()
  bankName?: string;

  @IsString()
  @IsOptional()
  accountNumber?: string;

  @IsString()
  @IsOptional()
  accountHolder?: string;
}

export class PickupTimeConfigRequest {
  @IsString()
  @Matches(/^([01]\d|2[0-3]):(00|30)$/)
  @IsOptional()
  startTime?: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):(00|30)$/)
  @IsOptional()
  endTime?: string;
}

export class BusinessHourDayRequest {
  @IsBoolean()
  @IsOptional()
  isOpen?: boolean;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):(00|30)$/)
  @IsOptional()
  openTime?: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):(00|30)$/)
  @IsOptional()
  closeTime?: string;
}

export class WeeklyBusinessHoursRequest {
  @ValidateNested()
  @Type(() => BusinessHourDayRequest)
  @IsOptional()
  monday?: BusinessHourDayRequest;

  @ValidateNested()
  @Type(() => BusinessHourDayRequest)
  @IsOptional()
  tuesday?: BusinessHourDayRequest;

  @ValidateNested()
  @Type(() => BusinessHourDayRequest)
  @IsOptional()
  wednesday?: BusinessHourDayRequest;

  @ValidateNested()
  @Type(() => BusinessHourDayRequest)
  @IsOptional()
  thursday?: BusinessHourDayRequest;

  @ValidateNested()
  @Type(() => BusinessHourDayRequest)
  @IsOptional()
  friday?: BusinessHourDayRequest;

  @ValidateNested()
  @Type(() => BusinessHourDayRequest)
  @IsOptional()
  saturday?: BusinessHourDayRequest;

  @ValidateNested()
  @Type(() => BusinessHourDayRequest)
  @IsOptional()
  sunday?: BusinessHourDayRequest;
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

  @ValidateNested()
  @Type(() => TransferAccountRequest)
  @IsOptional()
  transferAccount?: TransferAccountRequest;

  @ValidateNested()
  @Type(() => PickupTimeConfigRequest)
  @IsOptional()
  pickupTimeConfig?: PickupTimeConfigRequest;

  @ValidateNested()
  @Type(() => WeeklyBusinessHoursRequest)
  @IsOptional()
  businessHours?: WeeklyBusinessHoursRequest;

  @IsString()
  @IsOptional()
  orderNotice?: string;
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

  @ValidateNested()
  @Type(() => TransferAccountRequest)
  @IsOptional()
  transferAccount?: TransferAccountRequest;

  @ValidateNested()
  @Type(() => PickupTimeConfigRequest)
  @IsOptional()
  pickupTimeConfig?: PickupTimeConfigRequest;

  @ValidateNested()
  @Type(() => WeeklyBusinessHoursRequest)
  @IsOptional()
  businessHours?: WeeklyBusinessHoursRequest;

  @IsString()
  @IsOptional()
  orderNotice?: string;
}
