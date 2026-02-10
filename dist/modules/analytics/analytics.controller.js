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
exports.AnalyticsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../../common/guards/auth.guard");
const customer_guard_1 = require("../../common/guards/customer.guard");
const analytics_service_1 = require("./analytics.service");
const analytics_dto_1 = require("./dto/analytics.dto");
let AnalyticsController = class AnalyticsController {
    analyticsService;
    constructor(analyticsService) {
        this.analyticsService = analyticsService;
    }
    async getSalesAnalytics(req, branchId, startDate, endDate) {
        if (!req.accessToken) {
            throw new common_1.BadRequestException('Missing access token');
        }
        if (!branchId) {
            throw new common_1.BadRequestException('branchId is required');
        }
        return this.analyticsService.getSalesAnalytics(req.accessToken, branchId, startDate, endDate);
    }
    async getProductAnalytics(req, branchId, startDate, endDate) {
        if (!req.accessToken) {
            throw new common_1.BadRequestException('Missing access token');
        }
        if (!branchId) {
            throw new common_1.BadRequestException('branchId is required');
        }
        return this.analyticsService.getProductAnalytics(req.accessToken, branchId, startDate, endDate);
    }
    async getOrderAnalytics(req, branchId, startDate, endDate) {
        if (!req.accessToken) {
            throw new common_1.BadRequestException('Missing access token');
        }
        if (!branchId) {
            throw new common_1.BadRequestException('branchId is required');
        }
        return this.analyticsService.getOrderAnalytics(req.accessToken, branchId, startDate, endDate);
    }
    async getCustomerAnalytics(req, branchId, startDate, endDate) {
        if (!req.accessToken) {
            throw new common_1.BadRequestException('Missing access token');
        }
        if (!branchId) {
            throw new common_1.BadRequestException('branchId is required');
        }
        return this.analyticsService.getCustomerAnalytics(req.accessToken, branchId, startDate, endDate);
    }
    validateBrandAccess(req, brandId) {
        const memberships = req.brandMemberships || [];
        const hasAccess = memberships.some((m) => m.brand_id === brandId);
        if (!hasAccess) {
            throw new common_1.ForbiddenException('No access to this brand');
        }
    }
    async getBrandSalesAnalytics(req, brandId, startDate, endDate, compare) {
        if (!req.accessToken)
            throw new common_1.BadRequestException('Missing access token');
        if (!brandId)
            throw new common_1.BadRequestException('brandId is required');
        this.validateBrandAccess(req, brandId);
        return this.analyticsService.getBrandSalesAnalytics(req.accessToken, brandId, startDate, endDate, compare === 'true');
    }
    async getBrandProductAnalytics(req, brandId, startDate, endDate, compare) {
        if (!req.accessToken)
            throw new common_1.BadRequestException('Missing access token');
        if (!brandId)
            throw new common_1.BadRequestException('brandId is required');
        this.validateBrandAccess(req, brandId);
        return this.analyticsService.getBrandProductAnalytics(req.accessToken, brandId, startDate, endDate, compare === 'true');
    }
    async getBrandOrderAnalytics(req, brandId, startDate, endDate, compare) {
        if (!req.accessToken)
            throw new common_1.BadRequestException('Missing access token');
        if (!brandId)
            throw new common_1.BadRequestException('brandId is required');
        this.validateBrandAccess(req, brandId);
        return this.analyticsService.getBrandOrderAnalytics(req.accessToken, brandId, startDate, endDate, compare === 'true');
    }
    async getBrandCustomerAnalytics(req, brandId, startDate, endDate, compare) {
        if (!req.accessToken)
            throw new common_1.BadRequestException('Missing access token');
        if (!brandId)
            throw new common_1.BadRequestException('brandId is required');
        this.validateBrandAccess(req, brandId);
        return this.analyticsService.getBrandCustomerAnalytics(req.accessToken, brandId, startDate, endDate, compare === 'true');
    }
};
exports.AnalyticsController = AnalyticsController;
__decorate([
    (0, common_1.Get)('sales'),
    (0, swagger_1.ApiOperation)({
        summary: '매출 분석 조회',
        description: '지정된 기간 동안의 매출 통계와 일별 매출 추이를 조회합니다.',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'branchId',
        description: '지점 ID',
        required: true,
        type: String,
    }),
    (0, swagger_1.ApiQuery)({
        name: 'startDate',
        description: '시작 날짜 (ISO 8601 형식, 예: 2026-01-01)',
        required: false,
        type: String,
    }),
    (0, swagger_1.ApiQuery)({
        name: 'endDate',
        description: '종료 날짜 (ISO 8601 형식, 예: 2026-01-31)',
        required: false,
        type: String,
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '매출 분석 조회 성공',
        type: analytics_dto_1.SalesAnalyticsResponse,
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '잘못된 요청' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: '인증 실패' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('branchId')),
    __param(2, (0, common_1.Query)('startDate')),
    __param(3, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getSalesAnalytics", null);
__decorate([
    (0, common_1.Get)('products'),
    (0, swagger_1.ApiOperation)({
        summary: '상품 분석 조회',
        description: '상품별 판매 실적, 인기 상품, 재고 회전율 등을 조회합니다.',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'branchId',
        description: '지점 ID',
        required: true,
        type: String,
    }),
    (0, swagger_1.ApiQuery)({
        name: 'startDate',
        description: '시작 날짜 (ISO 8601 형식, 예: 2026-01-01)',
        required: false,
        type: String,
    }),
    (0, swagger_1.ApiQuery)({
        name: 'endDate',
        description: '종료 날짜 (ISO 8601 형식, 예: 2026-01-31)',
        required: false,
        type: String,
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '상품 분석 조회 성공',
        type: analytics_dto_1.ProductAnalyticsResponse,
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '잘못된 요청' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: '인증 실패' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('branchId')),
    __param(2, (0, common_1.Query)('startDate')),
    __param(3, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getProductAnalytics", null);
__decorate([
    (0, common_1.Get)('orders'),
    (0, swagger_1.ApiOperation)({
        summary: '주문 통계 조회',
        description: '주문 상태 분포, 일별/시간대별 주문 추이를 조회합니다.',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'branchId',
        description: '지점 ID',
        required: true,
        type: String,
    }),
    (0, swagger_1.ApiQuery)({
        name: 'startDate',
        description: '시작 날짜 (ISO 8601 형식, 예: 2026-01-01)',
        required: false,
        type: String,
    }),
    (0, swagger_1.ApiQuery)({
        name: 'endDate',
        description: '종료 날짜 (ISO 8601 형식, 예: 2026-01-31)',
        required: false,
        type: String,
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '주문 통계 조회 성공',
        type: analytics_dto_1.OrderAnalyticsResponse,
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '잘못된 요청' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: '인증 실패' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('branchId')),
    __param(2, (0, common_1.Query)('startDate')),
    __param(3, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getOrderAnalytics", null);
__decorate([
    (0, common_1.Get)('customers'),
    (0, swagger_1.ApiOperation)({
        summary: '고객 분석 조회',
        description: '신규/재구매 고객 수, 고객 생애 가치(CLV) 등을 조회합니다.',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'branchId',
        description: '지점 ID',
        required: true,
        type: String,
    }),
    (0, swagger_1.ApiQuery)({
        name: 'startDate',
        description: '시작 날짜 (ISO 8601 형식, 예: 2026-01-01) - 신규 고객 집계에 사용',
        required: false,
        type: String,
    }),
    (0, swagger_1.ApiQuery)({
        name: 'endDate',
        description: '종료 날짜 (ISO 8601 형식, 예: 2026-01-31) - 신규 고객 집계에 사용',
        required: false,
        type: String,
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '고객 분석 조회 성공',
        type: analytics_dto_1.CustomerAnalyticsResponse,
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '잘못된 요청' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: '인증 실패' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('branchId')),
    __param(2, (0, common_1.Query)('startDate')),
    __param(3, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getCustomerAnalytics", null);
__decorate([
    (0, common_1.Get)('brand/sales'),
    (0, swagger_1.ApiOperation)({
        summary: '브랜드 전체 매출 분석 조회',
        description: '브랜드 소속 전체 지점의 매출을 집계합니다. 지점별 비교 데이터를 포함합니다.',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'brandId',
        description: '브랜드 ID',
        required: true,
        type: String,
    }),
    (0, swagger_1.ApiQuery)({
        name: 'startDate',
        description: '시작 날짜 (ISO 8601)',
        required: false,
        type: String,
    }),
    (0, swagger_1.ApiQuery)({
        name: 'endDate',
        description: '종료 날짜 (ISO 8601)',
        required: false,
        type: String,
    }),
    (0, swagger_1.ApiQuery)({
        name: 'compare',
        description: '이전 기간 비교',
        required: false,
        type: Boolean,
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '브랜드 매출 분석 조회 성공' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('brandId')),
    __param(2, (0, common_1.Query)('startDate')),
    __param(3, (0, common_1.Query)('endDate')),
    __param(4, (0, common_1.Query)('compare')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getBrandSalesAnalytics", null);
__decorate([
    (0, common_1.Get)('brand/products'),
    (0, swagger_1.ApiOperation)({
        summary: '브랜드 전체 상품 분석 조회',
        description: '브랜드 소속 전체 지점의 상품별 판매 실적을 집계합니다.',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'brandId',
        description: '브랜드 ID',
        required: true,
        type: String,
    }),
    (0, swagger_1.ApiQuery)({
        name: 'startDate',
        description: '시작 날짜 (ISO 8601)',
        required: false,
        type: String,
    }),
    (0, swagger_1.ApiQuery)({
        name: 'endDate',
        description: '종료 날짜 (ISO 8601)',
        required: false,
        type: String,
    }),
    (0, swagger_1.ApiQuery)({
        name: 'compare',
        description: '이전 기간 비교',
        required: false,
        type: Boolean,
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '브랜드 상품 분석 조회 성공' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('brandId')),
    __param(2, (0, common_1.Query)('startDate')),
    __param(3, (0, common_1.Query)('endDate')),
    __param(4, (0, common_1.Query)('compare')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getBrandProductAnalytics", null);
__decorate([
    (0, common_1.Get)('brand/orders'),
    (0, swagger_1.ApiOperation)({
        summary: '브랜드 전체 주문 통계 조회',
        description: '브랜드 소속 전체 지점의 주문 상태 분포, 추이를 집계합니다.',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'brandId',
        description: '브랜드 ID',
        required: true,
        type: String,
    }),
    (0, swagger_1.ApiQuery)({
        name: 'startDate',
        description: '시작 날짜 (ISO 8601)',
        required: false,
        type: String,
    }),
    (0, swagger_1.ApiQuery)({
        name: 'endDate',
        description: '종료 날짜 (ISO 8601)',
        required: false,
        type: String,
    }),
    (0, swagger_1.ApiQuery)({
        name: 'compare',
        description: '이전 기간 비교',
        required: false,
        type: Boolean,
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '브랜드 주문 통계 조회 성공' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('brandId')),
    __param(2, (0, common_1.Query)('startDate')),
    __param(3, (0, common_1.Query)('endDate')),
    __param(4, (0, common_1.Query)('compare')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getBrandOrderAnalytics", null);
__decorate([
    (0, common_1.Get)('brand/customers'),
    (0, swagger_1.ApiOperation)({
        summary: '브랜드 전체 고객 분석 조회',
        description: '브랜드 소속 전체 지점의 고객 분석을 집계합니다.',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'brandId',
        description: '브랜드 ID',
        required: true,
        type: String,
    }),
    (0, swagger_1.ApiQuery)({
        name: 'startDate',
        description: '시작 날짜 (ISO 8601)',
        required: false,
        type: String,
    }),
    (0, swagger_1.ApiQuery)({
        name: 'endDate',
        description: '종료 날짜 (ISO 8601)',
        required: false,
        type: String,
    }),
    (0, swagger_1.ApiQuery)({
        name: 'compare',
        description: '이전 기간 비교',
        required: false,
        type: Boolean,
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '브랜드 고객 분석 조회 성공' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('brandId')),
    __param(2, (0, common_1.Query)('startDate')),
    __param(3, (0, common_1.Query)('endDate')),
    __param(4, (0, common_1.Query)('compare')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getBrandCustomerAnalytics", null);
exports.AnalyticsController = AnalyticsController = __decorate([
    (0, swagger_1.ApiTags)('analytics'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, customer_guard_1.CustomerGuard),
    (0, common_1.Controller)('customer/analytics'),
    __metadata("design:paramtypes", [analytics_service_1.AnalyticsService])
], AnalyticsController);
//# sourceMappingURL=analytics.controller.js.map