import { IsString, IsOptional } from 'class-validator';

// Response DTOs
export class BrandListItemResponse {
  id: string;
  name: string;
  slug?: string | null;
  bizName?: string | null;
  bizRegNo?: string | null;
  logoUrl?: string | null;
  thumbnailUrl?: string | null;
  createdAt: string;
}

export class BrandDetailResponse {
  id: string;
  name: string;
  slug?: string | null;
  ownerUserId?: string | null;
  bizName?: string | null;
  bizRegNo?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  thumbnailUrl?: string | null;
  createdAt: string;
}

// Request DTOs
export class CreateBrandRequest {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  bizName?: string;

  @IsString()
  @IsOptional()
  bizRegNo?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  coverImageUrl?: string;

  @IsString()
  @IsOptional()
  thumbnailUrl?: string;
}

export class UpdateBrandRequest {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  bizName?: string;

  @IsString()
  @IsOptional()
  bizRegNo?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  coverImageUrl?: string;

  @IsString()
  @IsOptional()
  thumbnailUrl?: string;
}
