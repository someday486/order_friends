import { IsString, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCustomerBrandRequest {
  @ApiProperty({ description: 'Brand name' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Brand slug (letters, numbers, hyphen only)',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must contain only lowercase letters, numbers, and hyphen.',
  })
  slug?: string | null;

  @ApiProperty({ description: 'Business name', required: false })
  @IsString()
  @IsOptional()
  biz_name?: string | null;

  @ApiProperty({ description: 'Business registration number', required: false })
  @IsString()
  @IsOptional()
  biz_reg_no?: string | null;

  @ApiProperty({ description: 'Logo URL', required: false })
  @IsString()
  @IsOptional()
  logo_url?: string | null;

  @ApiProperty({ description: 'Cover image URL', required: false })
  @IsString()
  @IsOptional()
  cover_image_url?: string | null;
}

export class UpdateCustomerBrandRequest {
  @ApiProperty({ description: 'Brand name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Brand slug (letters, numbers, hyphen only)',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must contain only lowercase letters, numbers, and hyphen.',
  })
  slug?: string | null;

  @ApiProperty({ description: 'Business name', required: false })
  @IsString()
  @IsOptional()
  biz_name?: string | null;

  @ApiProperty({ description: 'Business registration number', required: false })
  @IsString()
  @IsOptional()
  biz_reg_no?: string | null;

  @ApiProperty({ description: 'Logo URL', required: false })
  @IsString()
  @IsOptional()
  logo_url?: string | null;

  @ApiProperty({ description: 'Cover image URL', required: false })
  @IsString()
  @IsOptional()
  cover_image_url?: string | null;
}
