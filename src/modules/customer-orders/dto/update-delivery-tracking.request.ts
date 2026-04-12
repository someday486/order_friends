import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import type { DeliveryTrackingStatus } from '../../orders/dto/order-detail.response';

export class UpdateDeliveryTrackingRequest {
  @ApiProperty({
    description: '변경할 배송 상태',
    enum: [
      'PENDING',
      'PREPARING_SHIPMENT',
      'IN_TRANSIT',
      'DELIVERED',
      'DELIVERY_FAILED',
    ],
  })
  @IsEnum([
    'PENDING',
    'PREPARING_SHIPMENT',
    'IN_TRANSIT',
    'DELIVERED',
    'DELIVERY_FAILED',
  ])
  deliveryStatus: DeliveryTrackingStatus;

  @ApiProperty({
    description: '택배사 또는 배송사 이름',
    required: false,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deliveryCarrier?: string;

  @ApiProperty({
    description: '송장 번호 또는 배송 추적 번호',
    required: false,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deliveryTrackingNumber?: string;
}
