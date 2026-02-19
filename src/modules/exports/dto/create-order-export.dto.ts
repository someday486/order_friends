import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional } from 'class-validator';

export class CreateOrderExportDto {
  @ApiProperty({
    enum: ['csv', 'xlsx'],
    description: 'Export file format (lowercase)',
  })
  @IsIn(['csv', 'xlsx'])
  format: 'csv' | 'xlsx';

  @ApiPropertyOptional({
    enum: ['detail'],
    description: 'Export scope (lowercase)',
  })
  @IsOptional()
  @IsIn(['detail'])
  scope?: 'detail';

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  filters?: Record<string, any>;
}
