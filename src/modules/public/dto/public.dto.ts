import {
  IsBoolean,
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  ValidateNested,
  Min,
  IsEnum,
  Matches,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  CashReceiptIdentityType,
  CashReceiptType,
} from '../../cash-receipts/cash-receipt.types';
import {
  formatOrderPhone,
  ORDER_PHONE_REGEX,
} from '../../../common/utils/order-phone.util';

// ============================================================
// Response DTOs
// ============================================================

export class PublicBranchResponse {
  id: string;
  name: string;
  brandName?: string;
}

export class PublicProductOptionResponse {
  id: string;
  name: string;
  priceDelta: number;
}

export class PublicProductResponse {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  options: PublicProductOptionResponse[];
}

export class PublicOrderResponse {
  id: string;
  orderNo: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  items: {
    name: string;
    qty: number;
    unitPrice: number;
  }[];
}

// ============================================================
// Request DTOs
// ============================================================

export class OrderItemOptionDto {
  @IsString()
  optionId: string;
}

export class OrderItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  qty: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => OrderItemOptionDto)
  options?: OrderItemOptionDto[];
}

export class CashReceiptRequestDto {
  @IsBoolean()
  @IsOptional()
  requested?: boolean = false;

  @IsEnum(CashReceiptType)
  @IsOptional()
  type?: CashReceiptType;

  @IsEnum(CashReceiptIdentityType)
  @IsOptional()
  identityType?: CashReceiptIdentityType;

  @IsString()
  @IsOptional()
  identityValue?: string;
}

export class CreatePublicOrderRequest {
  @IsString()
  branchId: string;

  @IsString()
  customerName: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => formatOrderPhone(value))
  @Matches(ORDER_PHONE_REGEX, {
    message:
      '올바른 형식의 연락처가 아닙니다. 010-1234-5678 형식으로 입력해 주세요.',
  })
  customerPhone?: string;

  @IsString()
  @IsOptional()
  customerAddress1?: string;

  @IsString()
  @IsOptional()
  customerAddress2?: string;

  @IsString()
  @IsOptional()
  customerMemo?: string;

  @IsString()
  @IsOptional()
  paymentMethod?: 'CARD' | 'TRANSFER' | 'CASH';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ValidateNested()
  @Type(() => CashReceiptRequestDto)
  @IsOptional()
  cashReceipt?: CashReceiptRequestDto;
}
