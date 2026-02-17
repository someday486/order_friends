import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { OrderStatus } from '../order-status.enum';

export class GetOrdersQueryDto extends PaginationDto {
  @ApiProperty({ description: '지점 ID', required: true })
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @ApiPropertyOptional({ description: '주문 상태 필터' })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    description: '주문 방식 필터',
    enum: ['PICKUP', 'DELIVERY', 'DINE_IN'],
  })
  @IsOptional()
  @IsIn(['PICKUP', 'DELIVERY', 'DINE_IN'])
  fulfillmentType?: 'PICKUP' | 'DELIVERY' | 'DINE_IN';
}
