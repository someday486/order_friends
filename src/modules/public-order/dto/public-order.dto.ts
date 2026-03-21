import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  ValidateNested,
  Min,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ============================================================
// Response DTOs
// ============================================================

export class PublicBranchResponse {
  id: string;
  name: string;
  brandName?: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  enabledFulfillmentTypes?: string[];
  allowedPaymentMethods?: string[];
  orderNotice?: string | null;
  transferAccount?: {
    bankName?: string | null;
    accountNumber?: string | null;
    accountHolder?: string | null;
  } | null;
  pickupTimeConfig?: {
    startTime?: string | null;
    endTime?: string | null;
  } | null;
  businessHours?: {
    monday?: {
      isOpen?: boolean;
      openTime?: string | null;
      closeTime?: string | null;
    } | null;
    tuesday?: {
      isOpen?: boolean;
      openTime?: string | null;
      closeTime?: string | null;
    } | null;
    wednesday?: {
      isOpen?: boolean;
      openTime?: string | null;
      closeTime?: string | null;
    } | null;
    thursday?: {
      isOpen?: boolean;
      openTime?: string | null;
      closeTime?: string | null;
    } | null;
    friday?: {
      isOpen?: boolean;
      openTime?: string | null;
      closeTime?: string | null;
    } | null;
    saturday?: {
      isOpen?: boolean;
      openTime?: string | null;
      closeTime?: string | null;
    } | null;
    sunday?: {
      isOpen?: boolean;
      openTime?: string | null;
      closeTime?: string | null;
    } | null;
  } | null;
}

export class PublicBrandBranchResponse {
  id: string;
  name: string;
  slug?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
}

export class PublicBrandBranchesResponse {
  brandSlug: string;
  brandName?: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  branches: PublicBrandBranchResponse[];
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
  discountPrice?: number;
  urgentDiscountEndAt?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[];
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
  requestedTime?: string | null;
  paymentMethod?: string | null;
  fulfillmentType?: string | null;
  transferAccount?: {
    bankName?: string | null;
    accountNumber?: string | null;
    accountHolder?: string | null;
  } | null;
  customer?: {
    name?: string | null;
    phone?: string | null;
    address1?: string | null;
    address2?: string | null;
    memo?: string | null;
  };
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
  @ApiProperty({
    description: '옵션 ID',
    example: 'a4a8c9ec-12b4-4d76-8d39-5fb95d7eaf11',
  })
  @IsString()
  optionId: string;
}

export class OrderItemDto {
  @ApiProperty({
    description: '상품 ID',
    example: 'b9a1ce0f-3a8b-4ac3-9151-8f10f8cf9f9a',
  })
  @IsString()
  productId: string;

  @ApiProperty({ description: '수량', example: 2, minimum: 1 })
  @IsNumber()
  @Min(1)
  qty: number;

  @ApiPropertyOptional({
    description: '선택 옵션 목록',
    type: [OrderItemOptionDto],
  })
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

export enum FulfillmentType {
  PICKUP = 'PICKUP',
  DELIVERY = 'DELIVERY',
  DINE_IN = 'DINE_IN',
}

export class CreatePublicOrderRequest {
  @ApiProperty({
    description: '지점 ID',
    example: '4f295e9b-6139-44f0-a8dc-cf52bb2e82f5',
  })
  @IsString()
  branchId: string;

  @ApiPropertyOptional({
    description: '중복 요청 방지 키',
    example: 'public-order-20260216-001',
  })
  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @ApiProperty({ description: '고객 이름', example: '홍길동' })
  @IsString()
  customerName: string;

  @ApiPropertyOptional({
    description: '고객 연락처',
    example: '010-1234-5678',
  })
  @IsString()
  @IsOptional()
  customerPhone?: string;

  @ApiPropertyOptional({
    description: '기본 주소',
    example: '서울시 강남구 테헤란로 123',
  })
  @IsString()
  @IsOptional()
  customerAddress1?: string;

  @ApiPropertyOptional({
    description: '상세 주소',
    example: '201호',
  })
  @IsString()
  @IsOptional()
  customerAddress2?: string;

  @ApiPropertyOptional({
    description: '요청사항',
    example: '문 앞에 놓아주세요.',
  })
  @IsString()
  @IsOptional()
  customerMemo?: string;

  @ApiPropertyOptional({
    description: '결제수단',
    enum: PaymentMethod,
    default: PaymentMethod.CARD,
  })
  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod = PaymentMethod.CARD;

  @ApiPropertyOptional({
    description: '주문 방식',
    enum: FulfillmentType,
    default: FulfillmentType.PICKUP,
  })
  @IsEnum(FulfillmentType)
  @IsOptional()
  fulfillmentType?: FulfillmentType = FulfillmentType.PICKUP;

  @ApiPropertyOptional({
    description: '픽업 희망 시간 (ISO 8601)',
    example: '2026-03-15T06:30:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  requestedTime?: string;

  @ApiProperty({
    description: '주문 상품 목록',
    type: [OrderItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
