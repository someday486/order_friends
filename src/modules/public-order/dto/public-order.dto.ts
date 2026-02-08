import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  ValidateNested,
  Min,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============================================================
// Response DTOs
// ============================================================

export class PublicBranchResponse {
  id: string;
  name: string;
  brandName?: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
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
  imageUrl?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  sortOrder?: number;
  options: PublicProductOptionResponse[];
}

export class PublicCategoryResponse {
  id: string;
  name: string;
  sortOrder: number;
}

export class PublicOrderResponse {
  id: string;
  orderNo: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  items: {
    productName: string;
    qty: number;
    unitPrice: number;
    options: string[];
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

export enum PaymentMethod {
  CARD = 'CARD',
  TRANSFER = 'TRANSFER',
  CASH = 'CASH',
}

export class CreatePublicOrderRequest {
  @IsString()
  branchId: string;

  @IsString()
  customerName: string;

  @IsString()
  @IsOptional()
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

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod = PaymentMethod.CARD;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
