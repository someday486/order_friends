import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  Matches,
  IsIn,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { OrderStatus } from '../../orders/order-status.enum';

export class GetCustomerOrdersQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: '조회 시작일 (YYYY-MM-DD)',
    example: '2026-02-17',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateStart must be in YYYY-MM-DD format',
  })
  dateStart?: string;

  @ApiPropertyOptional({
    description: '조회 종료일 (YYYY-MM-DD)',
    example: '2026-02-18',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateEnd must be in YYYY-MM-DD format',
  })
  dateEnd?: string;

  @ApiPropertyOptional({ description: '지점 ID' })
  @IsOptional()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
    message: 'branchId must be a UUID',
  })
  branchId?: string;

  @ApiPropertyOptional({ description: '주문 상태' })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    description: '주문 방식',
    enum: ['PICKUP', 'DELIVERY', 'DINE_IN', 'SHIPPING'],
  })
  @IsOptional()
  @IsIn(['PICKUP', 'DELIVERY', 'DINE_IN', 'SHIPPING'])
  fulfillmentType?: 'PICKUP' | 'DELIVERY' | 'DINE_IN' | 'SHIPPING';
  @ApiPropertyOptional({
    description: '입금 상태 필터',
    enum: ['PENDING', 'AUTO_MATCHED'],
  })
  @IsOptional()
  @IsIn(['PENDING', 'AUTO_MATCHED'])
  depositStatus?: 'PENDING' | 'AUTO_MATCHED';
  @ApiPropertyOptional({
    description: '주문번호, 고객명, 상품명 검색어',
    example: '김한나',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
