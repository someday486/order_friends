import { IsString, IsNumber, IsArray, IsOptional, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

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

  @IsString()
  @IsOptional()
  paymentMethod?: 'CARD' | 'TRANSFER' | 'CASH';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
