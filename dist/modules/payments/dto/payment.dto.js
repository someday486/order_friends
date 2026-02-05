"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TossWebhookRequest = exports.RefundPaymentResponse = exports.PaymentDetailResponse = exports.PaymentListItemResponse = exports.PaymentStatusResponse = exports.ConfirmPaymentResponse = exports.PreparePaymentResponse = exports.RefundPaymentRequest = exports.ConfirmPaymentRequest = exports.PreparePaymentRequest = exports.PaymentMethod = exports.PaymentProvider = exports.PaymentStatus = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["PENDING"] = "PENDING";
    PaymentStatus["SUCCESS"] = "SUCCESS";
    PaymentStatus["FAILED"] = "FAILED";
    PaymentStatus["CANCELLED"] = "CANCELLED";
    PaymentStatus["REFUNDED"] = "REFUNDED";
    PaymentStatus["PARTIAL_REFUNDED"] = "PARTIAL_REFUNDED";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
var PaymentProvider;
(function (PaymentProvider) {
    PaymentProvider["TOSS"] = "TOSS";
    PaymentProvider["STRIPE"] = "STRIPE";
    PaymentProvider["MANUAL"] = "MANUAL";
})(PaymentProvider || (exports.PaymentProvider = PaymentProvider = {}));
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["CARD"] = "CARD";
    PaymentMethod["VIRTUAL_ACCOUNT"] = "VIRTUAL_ACCOUNT";
    PaymentMethod["TRANSFER"] = "TRANSFER";
    PaymentMethod["MOBILE"] = "MOBILE";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
class PreparePaymentRequest {
    orderId;
    amount;
    paymentMethod;
}
exports.PreparePaymentRequest = PreparePaymentRequest;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '주문 ID (UUID or order_no)',
        example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PreparePaymentRequest.prototype, "orderId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '결제 금액', example: 50000, minimum: 1 }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], PreparePaymentRequest.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '결제 수단',
        enum: PaymentMethod,
        example: PaymentMethod.CARD,
    }),
    (0, class_validator_1.IsEnum)(PaymentMethod),
    __metadata("design:type", String)
], PreparePaymentRequest.prototype, "paymentMethod", void 0);
class ConfirmPaymentRequest {
    orderId;
    paymentKey;
    amount;
}
exports.ConfirmPaymentRequest = ConfirmPaymentRequest;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '주문 ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConfirmPaymentRequest.prototype, "orderId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Toss Payments의 paymentKey',
        example: 'tgen_payment_key_123456',
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConfirmPaymentRequest.prototype, "paymentKey", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '결제 금액 (재검증용)',
        example: 50000,
        minimum: 1,
    }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ConfirmPaymentRequest.prototype, "amount", void 0);
class RefundPaymentRequest {
    reason;
    amount;
}
exports.RefundPaymentRequest = RefundPaymentRequest;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '환불 사유', example: '고객 요청에 의한 환불' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RefundPaymentRequest.prototype, "reason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: '환불 금액 (미입력시 전액 환불)',
        example: 25000,
        minimum: 1,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], RefundPaymentRequest.prototype, "amount", void 0);
class PreparePaymentResponse {
    orderId;
    orderNo;
    amount;
    orderName;
    customerName;
    customerPhone;
}
exports.PreparePaymentResponse = PreparePaymentResponse;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '주문 ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    __metadata("design:type", String)
], PreparePaymentResponse.prototype, "orderId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '주문 번호', example: 'ORD-20260206-001' }),
    __metadata("design:type", Object)
], PreparePaymentResponse.prototype, "orderNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '결제 금액', example: 50000 }),
    __metadata("design:type", Number)
], PreparePaymentResponse.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '주문명 (결제창에 표시)',
        example: '커피 외 2건',
    }),
    __metadata("design:type", String)
], PreparePaymentResponse.prototype, "orderName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '고객 이름', example: '홍길동' }),
    __metadata("design:type", String)
], PreparePaymentResponse.prototype, "customerName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '고객 전화번호', example: '010-1234-5678' }),
    __metadata("design:type", String)
], PreparePaymentResponse.prototype, "customerPhone", void 0);
class ConfirmPaymentResponse {
    paymentId;
    orderId;
    status;
    amount;
    paidAt;
}
exports.ConfirmPaymentResponse = ConfirmPaymentResponse;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '결제 ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    __metadata("design:type", String)
], ConfirmPaymentResponse.prototype, "paymentId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '주문 ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    __metadata("design:type", String)
], ConfirmPaymentResponse.prototype, "orderId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '결제 상태',
        enum: PaymentStatus,
        example: PaymentStatus.SUCCESS,
    }),
    __metadata("design:type", String)
], ConfirmPaymentResponse.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '결제 금액', example: 50000 }),
    __metadata("design:type", Number)
], ConfirmPaymentResponse.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '결제 완료 시각',
        example: '2026-02-06T10:30:00Z',
    }),
    __metadata("design:type", String)
], ConfirmPaymentResponse.prototype, "paidAt", void 0);
class PaymentStatusResponse {
    id;
    orderId;
    status;
    amount;
    paidAt;
    failureReason;
}
exports.PaymentStatusResponse = PaymentStatusResponse;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '결제 ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    __metadata("design:type", String)
], PaymentStatusResponse.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '주문 ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    __metadata("design:type", String)
], PaymentStatusResponse.prototype, "orderId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '결제 상태',
        enum: PaymentStatus,
        example: PaymentStatus.SUCCESS,
    }),
    __metadata("design:type", String)
], PaymentStatusResponse.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '결제 금액', example: 50000 }),
    __metadata("design:type", Number)
], PaymentStatusResponse.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '결제 완료 시각',
        example: '2026-02-06T10:30:00Z',
        required: false,
    }),
    __metadata("design:type", String)
], PaymentStatusResponse.prototype, "paidAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '실패 사유', required: false }),
    __metadata("design:type", String)
], PaymentStatusResponse.prototype, "failureReason", void 0);
class PaymentListItemResponse {
    id;
    orderId;
    orderNo;
    amount;
    status;
    provider;
    paymentMethod;
    paidAt;
    createdAt;
}
exports.PaymentListItemResponse = PaymentListItemResponse;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '결제 ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    __metadata("design:type", String)
], PaymentListItemResponse.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '주문 ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    __metadata("design:type", String)
], PaymentListItemResponse.prototype, "orderId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '주문 번호', example: 'ORD-20260206-001' }),
    __metadata("design:type", Object)
], PaymentListItemResponse.prototype, "orderNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '결제 금액', example: 50000 }),
    __metadata("design:type", Number)
], PaymentListItemResponse.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '결제 상태',
        enum: PaymentStatus,
        example: PaymentStatus.SUCCESS,
    }),
    __metadata("design:type", String)
], PaymentListItemResponse.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '결제 제공자',
        enum: PaymentProvider,
        example: PaymentProvider.TOSS,
    }),
    __metadata("design:type", String)
], PaymentListItemResponse.prototype, "provider", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '결제 수단',
        enum: PaymentMethod,
        example: PaymentMethod.CARD,
    }),
    __metadata("design:type", String)
], PaymentListItemResponse.prototype, "paymentMethod", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '결제 완료 시각',
        example: '2026-02-06T10:30:00Z',
        required: false,
    }),
    __metadata("design:type", String)
], PaymentListItemResponse.prototype, "paidAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '생성 시각', example: '2026-02-06T10:25:00Z' }),
    __metadata("design:type", String)
], PaymentListItemResponse.prototype, "createdAt", void 0);
class PaymentDetailResponse {
    id;
    orderId;
    orderNo;
    amount;
    currency;
    provider;
    status;
    paymentMethod;
    paymentMethodDetail;
    providerPaymentId;
    providerPaymentKey;
    paidAt;
    failedAt;
    cancelledAt;
    refundedAt;
    failureReason;
    cancellationReason;
    refundAmount;
    refundReason;
    metadata;
    createdAt;
    updatedAt;
}
exports.PaymentDetailResponse = PaymentDetailResponse;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '결제 ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    __metadata("design:type", String)
], PaymentDetailResponse.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '주문 ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    __metadata("design:type", String)
], PaymentDetailResponse.prototype, "orderId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '주문 번호', example: 'ORD-20260206-001' }),
    __metadata("design:type", Object)
], PaymentDetailResponse.prototype, "orderNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '결제 금액', example: 50000 }),
    __metadata("design:type", Number)
], PaymentDetailResponse.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '통화 코드', example: 'KRW' }),
    __metadata("design:type", String)
], PaymentDetailResponse.prototype, "currency", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '결제 제공자',
        enum: PaymentProvider,
        example: PaymentProvider.TOSS,
    }),
    __metadata("design:type", String)
], PaymentDetailResponse.prototype, "provider", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '결제 상태',
        enum: PaymentStatus,
        example: PaymentStatus.SUCCESS,
    }),
    __metadata("design:type", String)
], PaymentDetailResponse.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '결제 수단',
        enum: PaymentMethod,
        example: PaymentMethod.CARD,
    }),
    __metadata("design:type", String)
], PaymentDetailResponse.prototype, "paymentMethod", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '결제 수단 상세 정보 (JSON)', required: false }),
    __metadata("design:type", Object)
], PaymentDetailResponse.prototype, "paymentMethodDetail", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '제공자 결제 ID',
        example: 'tgen_20260206_123456',
        required: false,
    }),
    __metadata("design:type", String)
], PaymentDetailResponse.prototype, "providerPaymentId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '제공자 결제 키',
        example: 'tgen_payment_key_123456',
        required: false,
    }),
    __metadata("design:type", String)
], PaymentDetailResponse.prototype, "providerPaymentKey", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '결제 완료 시각',
        example: '2026-02-06T10:30:00Z',
        required: false,
    }),
    __metadata("design:type", String)
], PaymentDetailResponse.prototype, "paidAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '결제 실패 시각',
        example: '2026-02-06T10:30:00Z',
        required: false,
    }),
    __metadata("design:type", String)
], PaymentDetailResponse.prototype, "failedAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '결제 취소 시각',
        example: '2026-02-06T10:30:00Z',
        required: false,
    }),
    __metadata("design:type", String)
], PaymentDetailResponse.prototype, "cancelledAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '환불 완료 시각',
        example: '2026-02-06T10:30:00Z',
        required: false,
    }),
    __metadata("design:type", String)
], PaymentDetailResponse.prototype, "refundedAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '실패 사유', required: false }),
    __metadata("design:type", String)
], PaymentDetailResponse.prototype, "failureReason", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '취소 사유', required: false }),
    __metadata("design:type", String)
], PaymentDetailResponse.prototype, "cancellationReason", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '환불 금액', example: 0 }),
    __metadata("design:type", Number)
], PaymentDetailResponse.prototype, "refundAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '환불 사유', required: false }),
    __metadata("design:type", String)
], PaymentDetailResponse.prototype, "refundReason", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '메타데이터 (JSON)', required: false }),
    __metadata("design:type", Object)
], PaymentDetailResponse.prototype, "metadata", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '생성 시각', example: '2026-02-06T10:25:00Z' }),
    __metadata("design:type", String)
], PaymentDetailResponse.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '수정 시각', example: '2026-02-06T10:30:00Z' }),
    __metadata("design:type", String)
], PaymentDetailResponse.prototype, "updatedAt", void 0);
class RefundPaymentResponse {
    paymentId;
    status;
    refundAmount;
    refundedAt;
}
exports.RefundPaymentResponse = RefundPaymentResponse;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '결제 ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    __metadata("design:type", String)
], RefundPaymentResponse.prototype, "paymentId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '결제 상태',
        enum: PaymentStatus,
        example: PaymentStatus.REFUNDED,
    }),
    __metadata("design:type", String)
], RefundPaymentResponse.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '환불 금액', example: 50000 }),
    __metadata("design:type", Number)
], RefundPaymentResponse.prototype, "refundAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '환불 완료 시각',
        example: '2026-02-06T11:00:00Z',
    }),
    __metadata("design:type", String)
], RefundPaymentResponse.prototype, "refundedAt", void 0);
class TossWebhookRequest {
    eventType;
    createdAt;
    data;
}
exports.TossWebhookRequest = TossWebhookRequest;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '이벤트 타입', example: 'PAYMENT_CONFIRMED' }),
    __metadata("design:type", String)
], TossWebhookRequest.prototype, "eventType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '생성 시각',
        example: '2026-02-06T10:30:00+09:00',
    }),
    __metadata("design:type", String)
], TossWebhookRequest.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '결제 데이터' }),
    __metadata("design:type", Object)
], TossWebhookRequest.prototype, "data", void 0);
//# sourceMappingURL=payment.dto.js.map