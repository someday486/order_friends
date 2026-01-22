import { IsEnum } from 'class-validator';
import { OrderStatus } from '../order-status.enum';

export class UpdateOrderStatusRequest {
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
