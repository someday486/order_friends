import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from './public-order.dto';

export class PublicShopBrandProductResponse {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  sortOrder?: number;
}

export class PublicShopBrandResponse {
  brandId: string;
  brandSlug: string;
  brandName: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  fulfillmentType: 'DELIVERY';
  paymentMethods: string[];
  products: PublicShopBrandProductResponse[];
}

export class ShopOrderItemDto {
  @ApiProperty({
    description: '브랜드 상품 ID',
    example: 'b9a1ce0f-3a8b-4ac3-9151-8f10f8cf9f9a',
  })
  @IsString()
  productId: string;

  @ApiProperty({ description: '수량', example: 2, minimum: 1 })
  @IsNumber()
  @Min(1)
  qty: number;
}

export class CreatePublicShopOrderRequest {
  @ApiPropertyOptional({
    description: '중복 주문 방지 키',
    example: 'shop-order-20260217-001',
  })
  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @ApiProperty({ description: '주문자 이름', example: '홍길동' })
  @IsString()
  customerName: string;

  @ApiProperty({ description: '주문자 연락처', example: '010-1234-5678' })
  @IsString()
  customerPhone: string;

  @ApiProperty({
    description: '배송 기본 주소',
    example: '서울특별시 강남구 테헤란로 123',
  })
  @IsString()
  customerAddress1: string;

  @ApiPropertyOptional({
    description: '배송 상세 주소',
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
    description: '결제 수단',
    enum: PaymentMethod,
    default: PaymentMethod.CARD,
  })
  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod = PaymentMethod.CARD;

  @ApiProperty({
    description: '주문 상품 목록',
    type: [ShopOrderItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShopOrderItemDto)
  items: ShopOrderItemDto[];
}
