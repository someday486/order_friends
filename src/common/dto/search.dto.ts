import { IsOptional, IsString, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SearchDto {
  @ApiProperty({ description: '검색어', required: false })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiProperty({ description: '정렬 필드', required: false })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiProperty({
    description: '정렬 방향',
    enum: ['asc', 'desc'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @ApiProperty({ description: '페이지 번호', required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ description: '페이지 크기', required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

export class ProductSearchDto extends SearchDto {
  @ApiProperty({ description: '카테고리 필터', required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: '최소 가격', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minPrice?: number;

  @ApiProperty({ description: '최대 가격', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;

  @ApiProperty({ description: '재고 있는 상품만', required: false })
  @IsOptional()
  inStock?: boolean;

  @ApiProperty({ description: '브랜드 ID', required: false })
  @IsOptional()
  @IsString()
  brandId?: string;
}

export class OrderSearchDto extends SearchDto {
  @ApiProperty({ description: '주문 상태 필터', required: false })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ description: '시작 날짜 (YYYY-MM-DD)', required: false })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiProperty({ description: '종료 날짜 (YYYY-MM-DD)', required: false })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiProperty({ description: '고객명 검색', required: false })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiProperty({ description: '최소 금액', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minAmount?: number;

  @ApiProperty({ description: '최대 금액', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxAmount?: number;
}
