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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsCustomerController = exports.PaymentsPublicController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const payments_service_1 = require("./payments.service");
const customer_guard_1 = require("../../common/guards/customer.guard");
const require_permissions_decorator_1 = require("../../common/decorators/require-permissions.decorator");
const permissions_1 = require("../../modules/auth/authorization/permissions");
const payment_dto_1 = require("./dto/payment.dto");
const pagination_dto_1 = require("../../common/dto/pagination.dto");
let PaymentsPublicController = class PaymentsPublicController {
    paymentsService;
    constructor(paymentsService) {
        this.paymentsService = paymentsService;
    }
    async preparePayment(dto) {
        return this.paymentsService.preparePayment(dto);
    }
    async confirmPayment(dto) {
        return this.paymentsService.confirmPayment(dto);
    }
    async getPaymentStatus(orderId) {
        return this.paymentsService.getPaymentStatus(orderId);
    }
    async handleTossWebhook(webhookData, headers, req) {
        await this.paymentsService.handleTossWebhook(webhookData, headers, req?.rawBody);
        return { success: true };
    }
};
exports.PaymentsPublicController = PaymentsPublicController;
__decorate([
    (0, common_1.Post)('prepare'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: '결제 준비',
        description: '주문 검증 및 결제 정보를 반환합니다. (인증 불필요)',
    }),
    (0, swagger_1.ApiBody)({ type: payment_dto_1.PreparePaymentRequest }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '결제 준비 성공',
        type: payment_dto_1.PreparePaymentResponse,
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '잘못된 요청' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '주문을 찾을 수 없음' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: '이미 결제된 주문' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [payment_dto_1.PreparePaymentRequest]),
    __metadata("design:returntype", Promise)
], PaymentsPublicController.prototype, "preparePayment", null);
__decorate([
    (0, common_1.Post)('confirm'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: '결제 확정',
        description: 'Toss Payments 승인 및 결제 완료 처리 (인증 불필요)',
    }),
    (0, swagger_1.ApiBody)({ type: payment_dto_1.ConfirmPaymentRequest }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '결제 확정 성공',
        type: payment_dto_1.ConfirmPaymentResponse,
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '잘못된 요청' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '주문을 찾을 수 없음' }),
    (0, swagger_1.ApiResponse)({ status: 502, description: '결제 승인 실패' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [payment_dto_1.ConfirmPaymentRequest]),
    __metadata("design:returntype", Promise)
], PaymentsPublicController.prototype, "confirmPayment", null);
__decorate([
    (0, common_1.Get)(':orderId/status'),
    (0, swagger_1.ApiOperation)({
        summary: '결제 상태 조회',
        description: '주문 결제 상태를 조회합니다. (인증 불필요)',
    }),
    (0, swagger_1.ApiParam)({ name: 'orderId', description: '주문 ID 또는 주문 번호' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '결제 상태 조회 성공',
        type: payment_dto_1.PaymentStatusResponse,
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '결제 정보를 찾을 수 없음' }),
    __param(0, (0, common_1.Param)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PaymentsPublicController.prototype, "getPaymentStatus", null);
__decorate([
    (0, common_1.Post)('webhook/toss'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Toss Payments 웹훅',
        description: 'Toss Payments 웹훅 이벤트를 처리합니다.',
    }),
    (0, swagger_1.ApiBody)({ type: payment_dto_1.TossWebhookRequest }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '웹훅 처리 성공' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: '서명 검증 실패' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [payment_dto_1.TossWebhookRequest, Object, Object]),
    __metadata("design:returntype", Promise)
], PaymentsPublicController.prototype, "handleTossWebhook", null);
exports.PaymentsPublicController = PaymentsPublicController = __decorate([
    (0, swagger_1.ApiTags)('payments-public'),
    (0, common_1.Controller)('payments'),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService])
], PaymentsPublicController);
let PaymentsCustomerController = class PaymentsCustomerController {
    paymentsService;
    constructor(paymentsService) {
        this.paymentsService = paymentsService;
    }
    async getPayments(branchId, paginationDto) {
        return this.paymentsService.getPayments(branchId, paginationDto);
    }
    async getPaymentDetail(paymentId, branchId) {
        return this.paymentsService.getPaymentDetail(paymentId, branchId);
    }
    async refundPayment(paymentId, branchId, dto, req) {
        return this.paymentsService.refundPayment(paymentId, branchId, dto);
    }
};
exports.PaymentsCustomerController = PaymentsCustomerController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: '결제 목록 조회',
        description: '지점의 결제 목록을 조회합니다. (인증 필요)',
    }),
    (0, swagger_1.ApiQuery)({ name: 'branchId', description: '지점 ID', required: true }),
    (0, swagger_1.ApiQuery)({ name: 'page', description: '페이지 번호', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'limit', description: '페이지 크기', required: false }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '결제 목록 조회 성공',
        type: payment_dto_1.PaymentListItemResponse,
        isArray: true,
    }),
    (0, swagger_1.ApiResponse)({ status: 401, description: '인증 필요' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음' }),
    __param(0, (0, common_1.Query)('branchId')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, pagination_dto_1.PaginationDto]),
    __metadata("design:returntype", Promise)
], PaymentsCustomerController.prototype, "getPayments", null);
__decorate([
    (0, common_1.Get)(':paymentId'),
    (0, swagger_1.ApiOperation)({
        summary: '결제 상세 조회',
        description: '특정 결제의 상세 정보를 조회합니다. (인증 필요)',
    }),
    (0, swagger_1.ApiParam)({ name: 'paymentId', description: '결제 ID' }),
    (0, swagger_1.ApiQuery)({ name: 'branchId', description: '지점 ID', required: true }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '결제 상세 조회 성공',
        type: payment_dto_1.PaymentDetailResponse,
    }),
    (0, swagger_1.ApiResponse)({ status: 401, description: '인증 필요' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '결제 정보를 찾을 수 없음' }),
    __param(0, (0, common_1.Param)('paymentId')),
    __param(1, (0, common_1.Query)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PaymentsCustomerController.prototype, "getPaymentDetail", null);
__decorate([
    (0, common_1.Post)(':paymentId/refund'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, require_permissions_decorator_1.RequirePermissions)(permissions_1.Permission.ORDER_UPDATE_STATUS),
    (0, swagger_1.ApiOperation)({
        summary: '결제 환불',
        description: '결제 환불 처리 (OWNER/ADMIN만 가능)',
    }),
    (0, swagger_1.ApiParam)({ name: 'paymentId', description: '결제 ID' }),
    (0, swagger_1.ApiQuery)({ name: 'branchId', description: '지점 ID', required: true }),
    (0, swagger_1.ApiBody)({ type: payment_dto_1.RefundPaymentRequest }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '환불 처리 성공',
        type: payment_dto_1.RefundPaymentResponse,
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '잘못된 요청' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: '인증 필요' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음 - OWNER/ADMIN만 가능' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '결제 정보를 찾을 수 없음' }),
    __param(0, (0, common_1.Param)('paymentId')),
    __param(1, (0, common_1.Query)('branchId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, payment_dto_1.RefundPaymentRequest, Object]),
    __metadata("design:returntype", Promise)
], PaymentsCustomerController.prototype, "refundPayment", null);
exports.PaymentsCustomerController = PaymentsCustomerController = __decorate([
    (0, swagger_1.ApiTags)('payments-customer'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(customer_guard_1.CustomerGuard),
    (0, common_1.Controller)('customer/payments'),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService])
], PaymentsCustomerController);
//# sourceMappingURL=payments.controller.js.map