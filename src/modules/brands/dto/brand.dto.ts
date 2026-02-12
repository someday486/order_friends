import { IsString, IsOptional } from 'class-validator';

// Response DTOs
export class BrandListItemResponse {
  id: string;
  name: string;
  slug?: string | null;
  bizName?: string | null;
  bizRegNo?: string | null;
  logoUrl?: string | null;
  createdAt: string;
}

export class BrandDetailResponse {
  id: string;
  name: string;
  slug?: string | null;
  ownerUserId?: string | null;
  bizName?: string | null;
  bizRegNo?: string | null;
  repName?: string | null;
  address?: string | null;
  bizCertUrl?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
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
  repName?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  bizCertUrl?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  coverImageUrl?: string;
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
  repName?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  bizCertUrl?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  coverImageUrl?: string;
}
