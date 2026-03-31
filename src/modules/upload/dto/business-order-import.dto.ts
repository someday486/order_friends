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
  '승인대기',
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

  @ApiProperty({ description: '수령인 이름' })
  @IsString()
  recipientName: string;

  @ApiProperty({ description: '수령인 연락처' })
  @IsString()
  recipientPhone: string;

  @ApiProperty({ description: '수령인 주소' })
  @IsString()
  recipientAddress: string;

  @ApiPropertyOptional({
    description: '단가',
    nullable: true,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number | null;

  @ApiPropertyOptional({
    description: '행 합계',
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
  @ApiProperty({ description: '공급처 ID' })
  @IsString()
  supplierId: string;

  @ApiProperty({ description: '공급처명' })
  @IsString()
  supplierName: string;

  @ApiProperty({ description: '발주일', example: '2026-03-31' })
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
