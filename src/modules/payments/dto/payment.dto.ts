import { IsString, IsNumber, IsOptional, Min, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Payment Status Enum
export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
  PARTIAL_REFUNDED = 'PARTIAL_REFUNDED',
}

// Payment Provider Enum
export enum PaymentProvider {
  TOSS = 'TOSS',
  STRIPE = 'STRIPE',
  MANUAL = 'MANUAL',
}

// Payment Method Enum
export enum PaymentMethod {
  CARD = 'CARD',
  VIRTUAL_ACCOUNT = 'VIRTUAL_ACCOUNT',
  TRANSFER = 'TRANSFER',
  MOBILE = 'MOBILE',
}

// ============================================================
// Request DTOs
// ============================================================

export class PreparePaymentRequest {
  @ApiProperty({
    description: '주문 ID (UUID 또는 order_no)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  orderId: string;

  @ApiProperty({ description: '결제 금액', example: 50000, minimum: 1 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    description: '결제 수단',
    enum: PaymentMethod,
    example: PaymentMethod.CARD,
  })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}

export class ConfirmPaymentRequest {
  @ApiProperty({
    description: '주문 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  orderId: string;

  @ApiPropertyOptional({
    description: '결제 idempotency 키 (재시도 방지용)',
    example: 'payment-idem-20260210-001',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiProperty({
    description: 'Toss Payments 결제 키',
    example: 'tgen_payment_key_123456',
  })
  @IsString()
  paymentKey: string;

  @ApiProperty({
    description: '결제 금액 (검증용)',
    example: 50000,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  amount: number;
}

export class RefundPaymentRequest {
  @ApiProperty({ description: '환불 사유', example: '고객 요청으로 인한 환불' })
  @IsString()
  reason: string;

  @ApiPropertyOptional({
    description: '환불 금액 (미입력 시 전액 환불)',
    example: 25000,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;
}

// ============================================================
// Response DTOs
// ============================================================

export class PreparePaymentResponse {
  @ApiProperty({
    description: '주문 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  orderId: string;

  @ApiProperty({ description: '주문 번호', example: 'ORD-20260206-001' })
  orderNo: string | null;

  @ApiProperty({ description: '결제 금액', example: 50000 })
  amount: number;

  @ApiProperty({
    description: '주문명 (결제창 표시용)',
    example: '커피 외 2건',
  })
  orderName: string;

  @ApiProperty({ description: '고객 이름', example: '홍길동' })
  customerName: string;

  @ApiProperty({ description: '고객 전화번호', example: '010-1234-5678' })
  customerPhone: string;
}

export class ConfirmPaymentResponse {
  @ApiProperty({
    description: '결제 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  paymentId: string;

  @ApiProperty({
    description: '주문 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  orderId: string;

  @ApiProperty({
    description: '결제 상태',
    enum: PaymentStatus,
    example: PaymentStatus.SUCCESS,
  })
  status: PaymentStatus;

  @ApiProperty({ description: '결제 금액', example: 50000 })
  amount: number;

  @ApiProperty({
    description: '결제 완료 시각',
    example: '2026-02-06T10:30:00Z',
  })
  paidAt: string;
}

export class PaymentStatusResponse {
  @ApiProperty({
    description: '결제 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: '주문 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  orderId: string;

  @ApiProperty({
    description: '결제 상태',
    enum: PaymentStatus,
    example: PaymentStatus.SUCCESS,
  })
  status: PaymentStatus;

  @ApiProperty({ description: '결제 금액', example: 50000 })
  amount: number;

  @ApiProperty({
    description: '결제 완료 시각',
    example: '2026-02-06T10:30:00Z',
    required: false,
  })
  paidAt?: string;

  @ApiProperty({ description: '실패 사유', required: false })
  failureReason?: string;
}

export class PaymentListItemResponse {
  @ApiProperty({
    description: '결제 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: '주문 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  orderId: string;

  @ApiProperty({ description: '주문 번호', example: 'ORD-20260206-001' })
  orderNo: string | null;

  @ApiProperty({ description: '결제 금액', example: 50000 })
  amount: number;

  @ApiProperty({
    description: '결제 상태',
    enum: PaymentStatus,
    example: PaymentStatus.SUCCESS,
  })
  status: PaymentStatus;

  @ApiProperty({
    description: '결제 제공자',
    enum: PaymentProvider,
    example: PaymentProvider.TOSS,
  })
  provider: PaymentProvider;

  @ApiProperty({
    description: '결제 수단',
    enum: PaymentMethod,
    example: PaymentMethod.CARD,
  })
  paymentMethod?: PaymentMethod;

  @ApiProperty({
    description: '결제 완료 시각',
    example: '2026-02-06T10:30:00Z',
    required: false,
  })
  paidAt?: string;

  @ApiProperty({ description: '생성 시각', example: '2026-02-06T10:25:00Z' })
  createdAt: string;
}

export class PaymentDetailResponse {
  @ApiProperty({
    description: '결제 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: '주문 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  orderId: string;

  @ApiProperty({ description: '주문 번호', example: 'ORD-20260206-001' })
  orderNo: string | null;

  @ApiProperty({ description: '결제 금액', example: 50000 })
  amount: number;

  @ApiProperty({ description: '통화 코드', example: 'KRW' })
  currency: string;

  @ApiProperty({
    description: '결제 제공자',
    enum: PaymentProvider,
    example: PaymentProvider.TOSS,
  })
  provider: PaymentProvider;

  @ApiProperty({
    description: '결제 상태',
    enum: PaymentStatus,
    example: PaymentStatus.SUCCESS,
  })
  status: PaymentStatus;

  @ApiProperty({
    description: '결제 수단',
    enum: PaymentMethod,
    example: PaymentMethod.CARD,
  })
  paymentMethod?: PaymentMethod;

  @ApiProperty({ description: '결제 수단 상세 정보 (JSON)', required: false })
  paymentMethodDetail?: any;

  @ApiProperty({
    description: '제공자 결제 ID',
    example: 'tgen_20260206_123456',
    required: false,
  })
  providerPaymentId?: string;

  @ApiProperty({
    description: '제공자 결제 키',
    example: 'tgen_payment_key_123456',
    required: false,
  })
  providerPaymentKey?: string;

  @ApiProperty({
    description: '결제 완료 시각',
    example: '2026-02-06T10:30:00Z',
    required: false,
  })
  paidAt?: string;

  @ApiProperty({
    description: '결제 실패 시각',
    example: '2026-02-06T10:30:00Z',
    required: false,
  })
  failedAt?: string;

  @ApiProperty({
    description: '결제 취소 시각',
    example: '2026-02-06T10:30:00Z',
    required: false,
  })
  cancelledAt?: string;

  @ApiProperty({
    description: '환불 완료 시각',
    example: '2026-02-06T10:30:00Z',
    required: false,
  })
  refundedAt?: string;

  @ApiProperty({ description: '실패 사유', required: false })
  failureReason?: string;

  @ApiProperty({ description: '취소 사유', required: false })
  cancellationReason?: string;

  @ApiProperty({ description: '환불 금액', example: 0 })
  refundAmount: number;

  @ApiProperty({ description: '환불 사유', required: false })
  refundReason?: string;

  @ApiProperty({ description: '메타데이터 (JSON)', required: false })
  metadata?: any;

  @ApiProperty({ description: '생성 시각', example: '2026-02-06T10:25:00Z' })
  createdAt: string;

  @ApiProperty({ description: '수정 시각', example: '2026-02-06T10:30:00Z' })
  updatedAt: string;
}

export class RefundPaymentResponse {
  @ApiProperty({
    description: '결제 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  paymentId: string;

  @ApiProperty({
    description: '결제 상태',
    enum: PaymentStatus,
    example: PaymentStatus.REFUNDED,
  })
  status: PaymentStatus;

  @ApiProperty({ description: '환불 금액', example: 50000 })
  refundAmount: number;

  @ApiProperty({
    description: '환불 완료 시각',
    example: '2026-02-06T11:00:00Z',
  })
  refundedAt: string;
}

// ============================================================
// Webhook DTO
// ============================================================

export class TossWebhookRequest {
  @ApiProperty({ description: '이벤트 타입', example: 'PAYMENT_CONFIRMED' })
  eventType: string;

  @ApiProperty({
    description: '생성 시각',
    example: '2026-02-06T10:30:00+09:00',
  })
  createdAt: string;

  @ApiProperty({ description: '결제 데이터' })
  data: {
    orderId: string;
    paymentKey: string;
    status: string;
    amount: number;
    [key: string]: any;
  };
}
