import { IsString, IsOptional, Matches } from 'class-validator';

export class CreateBranchRequest {
  @IsString()
  brandId: string;

  @IsString()
  name: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug는 소문자 영문, 숫자, 하이픈(-)만 허용됩니다.',
  })
  slug: string;
}

export class UpdateBranchRequest {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug는 소문자, 숫자, 하이픈(-)만 허용합니다.',
  })
  slug?: string;
}
