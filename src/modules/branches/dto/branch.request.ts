import { IsString, IsOptional } from 'class-validator';

export class CreateBranchRequest {
  @IsString()
  brandId: string;

  @IsString()
  name: string;
}

export class UpdateBranchRequest {
  @IsString()
  @IsOptional()
  name?: string;
}
