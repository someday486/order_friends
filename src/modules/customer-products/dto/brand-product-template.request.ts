import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BranchCategoryAssignmentRequest {
  @ApiProperty({ description: '매장 ID' })
  @IsString()
  branchId: string;

  @ApiPropertyOptional({
    description:
      '해당 매장에 적용할 카테고리 ID. null/미전달이면 카테고리 없음으로 반영됩니다.',
  })
  @IsString()
  @IsOptional()
  categoryId?: string | null;
}

export class CreateBrandProductTemplateRequest {
  @ApiProperty({ description: '브랜드 ID' })
  @IsString()
  brandId: string;

  @ApiProperty({ description: '브랜드 메뉴명' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '설명' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: '기본 가격', minimum: 0 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ description: '대표 이미지 URL' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ description: '정렬 순서', default: 0 })
  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ description: '템플릿 활성 여부', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: '온라인샵 노출 여부',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isOnlineShopVisible?: boolean;

  @ApiPropertyOptional({
    description:
      '재고 관리 방식. PRODUCT는 메뉴 재고를 관리하고, NONE은 재고를 관리하지 않습니다.',
    enum: ['PRODUCT', 'NONE'],
    default: 'PRODUCT',
  })
  @IsString()
  @IsIn(['PRODUCT', 'NONE'])
  @IsOptional()
  inventoryMode?: 'PRODUCT' | 'NONE';

  @ApiPropertyOptional({
    description:
      '적용할 매장 ID 목록. 전달하지 않으면 브랜드 전체 매장에 기본 적용됩니다.',
    type: [String],
  })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsOptional()
  branchIds?: string[];

  @ApiPropertyOptional({
    description: '매장별 카테고리 지정 목록',
    type: [BranchCategoryAssignmentRequest],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchCategoryAssignmentRequest)
  @IsOptional()
  branchCategoryAssignments?: BranchCategoryAssignmentRequest[];
}

export class UpdateBrandProductTemplateRequest {
  @ApiPropertyOptional({ description: '브랜드 메뉴명' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '설명' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '기본 가격', minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({ description: '대표 이미지 URL' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ description: '정렬 순서' })
  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ description: '템플릿 활성 여부' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: '온라인샵 노출 여부' })
  @IsBoolean()
  @IsOptional()
  isOnlineShopVisible?: boolean;

  @ApiPropertyOptional({
    description:
      '재고 관리 방식. PRODUCT는 메뉴 재고를 관리하고, NONE은 재고를 관리하지 않습니다.',
    enum: ['PRODUCT', 'NONE'],
  })
  @IsString()
  @IsIn(['PRODUCT', 'NONE'])
  @IsOptional()
  inventoryMode?: 'PRODUCT' | 'NONE';

  @ApiPropertyOptional({
    description:
      '적용할 매장 ID 목록. 전달 시 체크 상태 기준으로 매장 반영을 동기화합니다.',
    type: [String],
  })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsOptional()
  branchIds?: string[];

  @ApiPropertyOptional({
    description:
      '매장별 카테고리 지정 목록. 전달 시 해당 매장들의 카테고리를 함께 반영합니다.',
    type: [BranchCategoryAssignmentRequest],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchCategoryAssignmentRequest)
  @IsOptional()
  branchCategoryAssignments?: BranchCategoryAssignmentRequest[];
}

export class ApplyBrandProductTemplateRequest {
  @ApiProperty({ description: '적용 대상 매장 ID' })
  @IsString()
  branchId: string;
}

export class BulkUpdateBrandProductTemplateRequest {
  @ApiProperty({ description: '브랜드 ID' })
  @IsString()
  brandId: string;

  @ApiProperty({
    description: '일괄 수정할 브랜드 메뉴 템플릿 ID 목록',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  templateIds: string[];

  @ApiPropertyOptional({
    description:
      '일괄 적용할 매장 ID 목록. 전달 시 선택한 템플릿의 매장 체크 상태를 동기화합니다.',
    type: [String],
  })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsOptional()
  branchIds?: string[];

  @ApiPropertyOptional({
    description: '일괄 활성/비활성 상태. 전달하지 않으면 상태는 유지됩니다.',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: '일괄 온라인샵 노출 여부. 전달하지 않으면 상태는 유지됩니다.',
  })
  @IsBoolean()
  @IsOptional()
  isOnlineShopVisible?: boolean;

  @ApiPropertyOptional({
    description:
      '일괄 재고 관리 방식. PRODUCT는 재고 관리 사용, NONE은 재고 관리 미사용입니다.',
    enum: ['PRODUCT', 'NONE'],
  })
  @IsString()
  @IsIn(['PRODUCT', 'NONE'])
  @IsOptional()
  inventoryMode?: 'PRODUCT' | 'NONE';
}
