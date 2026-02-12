import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCategoryRequest {
  @IsString()
  branchId: string;

  @IsString()
  name: string;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateCategoryRequest {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ReorderCategoryItem {
  @IsString()
  id: string;

  @IsNumber()
  sortOrder: number;
}

export class ReorderCategoriesRequest {
  @IsString()
  branchId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderCategoryItem)
  items: ReorderCategoryItem[];
}
