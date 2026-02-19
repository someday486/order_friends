import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { OrderStatus } from '../../orders/order-status.enum';

export class BulkUpdateOrderStatusRequest {
  @ApiProperty({
    description: '상태를 변경할 주문 ID 목록',
    type: [String],
    maxItems: 200,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  orderIds: string[];

  @ApiProperty({
    description: '변경할 주문 상태',
    enum: OrderStatus,
  })
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
