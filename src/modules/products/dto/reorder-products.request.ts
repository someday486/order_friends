import { IsString, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class ReorderItem {
  @IsString()
  id: string;

  @IsNumber()
  sortOrder: number;
}

export class ReorderProductsRequest {
  @IsString()
  branchId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItem)
  items: ReorderItem[];
}
