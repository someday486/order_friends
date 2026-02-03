import { IsString, IsOptional } from 'class-validator';

// Response DTOs
export class BrandListItemResponse {
  id: string;
  name: string;
  bizName?: string | null;
  bizRegNo?: string | null;
  createdAt: string;
}

export class BrandDetailResponse {
  id: string;
  name: string;
  ownerUserId?: string | null;
  bizName?: string | null;
  bizRegNo?: string | null;
  createdAt: string;
}

// Request DTOs
export class CreateBrandRequest {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  bizName?: string;

  @IsString()
  @IsOptional()
  bizRegNo?: string;
}

export class UpdateBrandRequest {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  bizName?: string;

  @IsString()
  @IsOptional()
  bizRegNo?: string;
}
