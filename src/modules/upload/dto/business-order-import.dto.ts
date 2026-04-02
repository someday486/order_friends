import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const BUSINESS_ORDER_IMPORT_STATUSES = [
  '작성중',
  '확인대기',
  '출고준비',
  '부분출고',
  '정산대기',
] as const;

export class CreateBusinessOrderImportRowDto {
  @ApiProperty({ description: '거래처 기준 주문번호' })
  @IsString()
  merchantOrderNo: string;

  @ApiProperty({ description: '품목명' })
  @IsString()
  productName: string;

  @ApiProperty({ description: '수량', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: '받는분 성명' })
  @IsString()
  recipientName: string;

  @ApiProperty({ description: '받는분 전화번호' })
  @IsString()
  recipientPhone: string;

  @ApiProperty({ description: '받는분 주소' })
  @IsString()
  recipientAddress: string;

  @ApiPropertyOptional({
    description: '받는분 우편번호',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  recipientZipCode?: string | null;

  @ApiPropertyOptional({
    description: '배송 메시지',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  deliveryMessage?: string | null;

  @ApiPropertyOptional({
    description: '거래처 상품 코드',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  productCode?: string | null;

  @ApiPropertyOptional({
    description: '고객 주문번호',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  customerOrderNo?: string | null;

  @ApiPropertyOptional({
    description: '공급가',
    nullable: true,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number | null;

  @ApiPropertyOptional({
    description: '라인 합계',
    nullable: true,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lineAmount?: number | null;
}

export class CreateBusinessOrderImportBatchDto {
  @ApiPropertyOptional({ description: '브랜드 ID', nullable: true })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiProperty({ description: '공급처 ID 또는 임시 코드' })
  @IsString()
  supplierId: string;

  @ApiProperty({ description: '공급처명' })
  @IsString()
  supplierName: string;

  @ApiProperty({ description: '발주일자', example: '2026-03-31' })
  @IsString()
  orderDate: string;

  @ApiProperty({ description: '업로드한 파일명' })
  @IsString()
  fileName: string;

  @ApiProperty({ description: '선택한 헤더 행 번호(0-based)', minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  headerRowIndex: number;

  @ApiPropertyOptional({
    type: [String],
    description: '업로드 파일 헤더 목록',
  })
  @IsOptional()
  @IsArray()
  sourceHeaders?: string[];

  @ApiProperty({
    type: [CreateBusinessOrderImportRowDto],
    description: '검증 완료된 주문 행 목록',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateBusinessOrderImportRowDto)
  rows: CreateBusinessOrderImportRowDto[];
}

export class UpdateBusinessOrderImportBatchStatusDto {
  @ApiProperty({
    enum: BUSINESS_ORDER_IMPORT_STATUSES,
    description: '업로드 배치 상태',
  })
  @IsString()
  @IsIn(BUSINESS_ORDER_IMPORT_STATUSES)
  status: (typeof BUSINESS_ORDER_IMPORT_STATUSES)[number];
}
