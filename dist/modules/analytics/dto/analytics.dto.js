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
exports.RfmAnalysisResponse = exports.RfmSegmentSummaryDto = exports.RfmCustomerDto = exports.CohortAnalysisResponse = exports.CohortRowDto = exports.CohortRetentionDto = exports.CombinationAnalysisResponse = exports.ProductCombinationDto = exports.CombinationProductDto = exports.HourlyProductAnalysisResponse = exports.HourlyProductDto = exports.HourlyTopProductDto = exports.AbcAnalysisResponse = exports.AbcGradeSummaryDto = exports.AbcAnalysisItemDto = exports.BrandSalesAnalyticsResponse = exports.BranchBreakdownDto = exports.PeriodComparisonDto = exports.BrandAnalyticsQueryDto = exports.CustomerAnalyticsResponse = exports.OrderAnalyticsResponse = exports.PeakHoursDto = exports.OrdersByDayDto = exports.OrderStatusDistributionDto = exports.ProductAnalyticsResponse = exports.InventoryTurnoverDto = exports.SalesByProductDto = exports.TopProductDto = exports.SalesAnalyticsResponse = exports.RevenueByDayDto = exports.AnalyticsQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class AnalyticsQueryDto {
    branchId;
    startDate;
    endDate;
    compare;
}
exports.AnalyticsQueryDto = AnalyticsQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '지점 ID', required: true }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AnalyticsQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: '시작 날짜 (ISO 8601)',
        example: '2026-01-01',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AnalyticsQueryDto.prototype, "startDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: '종료 날짜 (ISO 8601)',
        example: '2026-01-31',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AnalyticsQueryDto.prototype, "endDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: '이전 기간 비교 활성화',
        example: true,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => value === 'true' || value === true),
    __metadata("design:type", Boolean)
], AnalyticsQueryDto.prototype, "compare", void 0);
class RevenueByDayDto {
    date;
    revenue;
    orderCount;
}
exports.RevenueByDayDto = RevenueByDayDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '날짜', example: '2026-01-15' }),
    __metadata("design:type", String)
], RevenueByDayDto.prototype, "date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '해당 날짜의 총 매출', example: 150000 }),
    __metadata("design:type", Number)
], RevenueByDayDto.prototype, "revenue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '해당 날짜의 주문 수', example: 12 }),
    __metadata("design:type", Number)
], RevenueByDayDto.prototype, "orderCount", void 0);
class SalesAnalyticsResponse {
    totalRevenue;
    orderCount;
    avgOrderValue;
    revenueByDay;
}
exports.SalesAnalyticsResponse = SalesAnalyticsResponse;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '총 매출액 (원)', example: 4500000 }),
    __metadata("design:type", Number)
], SalesAnalyticsResponse.prototype, "totalRevenue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '총 주문 수', example: 150 }),
    __metadata("design:type", Number)
], SalesAnalyticsResponse.prototype, "orderCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '평균 주문 금액 (원)', example: 30000 }),
    __metadata("design:type", Number)
], SalesAnalyticsResponse.prototype, "avgOrderValue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '일별 매출 데이터', type: [RevenueByDayDto] }),
    __metadata("design:type", Array)
], SalesAnalyticsResponse.prototype, "revenueByDay", void 0);
class TopProductDto {
    productId;
    productName;
    soldQuantity;
    totalRevenue;
}
exports.TopProductDto = TopProductDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '상품 ID',
        example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    __metadata("design:type", String)
], TopProductDto.prototype, "productId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '상품명', example: '아메리카노' }),
    __metadata("design:type", String)
], TopProductDto.prototype, "productName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '판매 수량', example: 120 }),
    __metadata("design:type", Number)
], TopProductDto.prototype, "soldQuantity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '총 매출액 (원)', example: 480000 }),
    __metadata("design:type", Number)
], TopProductDto.prototype, "totalRevenue", void 0);
class SalesByProductDto {
    productId;
    productName;
    quantity;
    revenue;
    revenuePercentage;
}
exports.SalesByProductDto = SalesByProductDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '상품 ID',
        example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    __metadata("design:type", String)
], SalesByProductDto.prototype, "productId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '상품명', example: '카페라떼' }),
    __metadata("design:type", String)
], SalesByProductDto.prototype, "productName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '판매 수량', example: 80 }),
    __metadata("design:type", Number)
], SalesByProductDto.prototype, "quantity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '총 매출액 (원)', example: 400000 }),
    __metadata("design:type", Number)
], SalesByProductDto.prototype, "revenue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '전체 매출 대비 비율 (%)', example: 8.89 }),
    __metadata("design:type", Number)
], SalesByProductDto.prototype, "revenuePercentage", void 0);
class InventoryTurnoverDto {
    averageTurnoverRate;
    periodDays;
}
exports.InventoryTurnoverDto = InventoryTurnoverDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '평균 재고 회전율', example: 5.2 }),
    __metadata("design:type", Number)
], InventoryTurnoverDto.prototype, "averageTurnoverRate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '기간 (일)', example: 30 }),
    __metadata("design:type", Number)
], InventoryTurnoverDto.prototype, "periodDays", void 0);
class ProductAnalyticsResponse {
    topProducts;
    salesByProduct;
    inventoryTurnover;
}
exports.ProductAnalyticsResponse = ProductAnalyticsResponse;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '상위 판매 상품 (Top 10)',
        type: [TopProductDto],
    }),
    __metadata("design:type", Array)
], ProductAnalyticsResponse.prototype, "topProducts", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '상품별 판매 현황', type: [SalesByProductDto] }),
    __metadata("design:type", Array)
], ProductAnalyticsResponse.prototype, "salesByProduct", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '재고 회전율', type: InventoryTurnoverDto }),
    __metadata("design:type", InventoryTurnoverDto)
], ProductAnalyticsResponse.prototype, "inventoryTurnover", void 0);
class OrderStatusDistributionDto {
    status;
    count;
    percentage;
}
exports.OrderStatusDistributionDto = OrderStatusDistributionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '주문 상태', example: 'COMPLETED' }),
    __metadata("design:type", String)
], OrderStatusDistributionDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '해당 상태의 주문 수', example: 85 }),
    __metadata("design:type", Number)
], OrderStatusDistributionDto.prototype, "count", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '전체 주문 대비 비율 (%)', example: 56.67 }),
    __metadata("design:type", Number)
], OrderStatusDistributionDto.prototype, "percentage", void 0);
class OrdersByDayDto {
    date;
    orderCount;
    completedCount;
    cancelledCount;
}
exports.OrdersByDayDto = OrdersByDayDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '날짜', example: '2026-01-15' }),
    __metadata("design:type", String)
], OrdersByDayDto.prototype, "date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '해당 날짜의 주문 수', example: 15 }),
    __metadata("design:type", Number)
], OrdersByDayDto.prototype, "orderCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '완료된 주문 수', example: 12 }),
    __metadata("design:type", Number)
], OrdersByDayDto.prototype, "completedCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '취소된 주문 수', example: 1 }),
    __metadata("design:type", Number)
], OrdersByDayDto.prototype, "cancelledCount", void 0);
class PeakHoursDto {
    hour;
    orderCount;
}
exports.PeakHoursDto = PeakHoursDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '시간대 (0-23)', example: 14 }),
    __metadata("design:type", Number)
], PeakHoursDto.prototype, "hour", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '해당 시간대의 주문 수', example: 25 }),
    __metadata("design:type", Number)
], PeakHoursDto.prototype, "orderCount", void 0);
class OrderAnalyticsResponse {
    statusDistribution;
    ordersByDay;
    peakHours;
}
exports.OrderAnalyticsResponse = OrderAnalyticsResponse;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '주문 상태별 분포',
        type: [OrderStatusDistributionDto],
    }),
    __metadata("design:type", Array)
], OrderAnalyticsResponse.prototype, "statusDistribution", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '일별 주문 추이', type: [OrdersByDayDto] }),
    __metadata("design:type", Array)
], OrderAnalyticsResponse.prototype, "ordersByDay", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '시간대별 주문 현황', type: [PeakHoursDto] }),
    __metadata("design:type", Array)
], OrderAnalyticsResponse.prototype, "peakHours", void 0);
class CustomerAnalyticsResponse {
    totalCustomers;
    newCustomers;
    returningCustomers;
    clv;
    repeatCustomerRate;
    avgOrdersPerCustomer;
}
exports.CustomerAnalyticsResponse = CustomerAnalyticsResponse;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '총 고객 수', example: 450 }),
    __metadata("design:type", Number)
], CustomerAnalyticsResponse.prototype, "totalCustomers", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '신규 고객 수 (기간 내)', example: 45 }),
    __metadata("design:type", Number)
], CustomerAnalyticsResponse.prototype, "newCustomers", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '재구매 고객 수', example: 120 }),
    __metadata("design:type", Number)
], CustomerAnalyticsResponse.prototype, "returningCustomers", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '고객 생애 가치 (평균, 원)', example: 150000 }),
    __metadata("design:type", Number)
], CustomerAnalyticsResponse.prototype, "clv", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '재구매율 (%)', example: 26.67 }),
    __metadata("design:type", Number)
], CustomerAnalyticsResponse.prototype, "repeatCustomerRate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '평균 고객당 주문 수', example: 2.8 }),
    __metadata("design:type", Number)
], CustomerAnalyticsResponse.prototype, "avgOrdersPerCustomer", void 0);
class BrandAnalyticsQueryDto {
    brandId;
    startDate;
    endDate;
    compare;
}
exports.BrandAnalyticsQueryDto = BrandAnalyticsQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '브랜드 ID', required: true }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], BrandAnalyticsQueryDto.prototype, "brandId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: '시작 날짜 (ISO 8601)',
        example: '2026-01-01',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], BrandAnalyticsQueryDto.prototype, "startDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: '종료 날짜 (ISO 8601)',
        example: '2026-01-31',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], BrandAnalyticsQueryDto.prototype, "endDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: '이전 기간 비교 활성화',
        example: true,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => value === 'true' || value === true),
    __metadata("design:type", Boolean)
], BrandAnalyticsQueryDto.prototype, "compare", void 0);
class PeriodComparisonDto {
    current;
    previous;
    changes;
}
exports.PeriodComparisonDto = PeriodComparisonDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '현재 기간 데이터' }),
    __metadata("design:type", Object)
], PeriodComparisonDto.prototype, "current", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '이전 기간 데이터' }),
    __metadata("design:type", Object)
], PeriodComparisonDto.prototype, "previous", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: '주요 지표별 변화율 (%)',
        example: { totalRevenue: 12.5, orderCount: -3.2 },
    }),
    __metadata("design:type", Object)
], PeriodComparisonDto.prototype, "changes", void 0);
class BranchBreakdownDto {
    branchId;
    branchName;
    revenue;
    orderCount;
}
exports.BranchBreakdownDto = BranchBreakdownDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '지점 ID' }),
    __metadata("design:type", String)
], BranchBreakdownDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '지점명' }),
    __metadata("design:type", String)
], BranchBreakdownDto.prototype, "branchName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '매출액' }),
    __metadata("design:type", Number)
], BranchBreakdownDto.prototype, "revenue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '주문 수' }),
    __metadata("design:type", Number)
], BranchBreakdownDto.prototype, "orderCount", void 0);
class BrandSalesAnalyticsResponse extends SalesAnalyticsResponse {
    byBranch;
}
exports.BrandSalesAnalyticsResponse = BrandSalesAnalyticsResponse;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '지점별 매출 분포',
        type: [BranchBreakdownDto],
    }),
    __metadata("design:type", Array)
], BrandSalesAnalyticsResponse.prototype, "byBranch", void 0);
class AbcAnalysisItemDto {
    productId;
    productName;
    revenue;
    revenuePercentage;
    cumulativePercentage;
    grade;
}
exports.AbcAnalysisItemDto = AbcAnalysisItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '상품 ID' }),
    __metadata("design:type", String)
], AbcAnalysisItemDto.prototype, "productId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '상품명' }),
    __metadata("design:type", String)
], AbcAnalysisItemDto.prototype, "productName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '매출액' }),
    __metadata("design:type", Number)
], AbcAnalysisItemDto.prototype, "revenue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '매출 비율 (%)' }),
    __metadata("design:type", Number)
], AbcAnalysisItemDto.prototype, "revenuePercentage", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '누적 매출 비율 (%)' }),
    __metadata("design:type", Number)
], AbcAnalysisItemDto.prototype, "cumulativePercentage", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ABC 등급', enum: ['A', 'B', 'C'] }),
    __metadata("design:type", String)
], AbcAnalysisItemDto.prototype, "grade", void 0);
class AbcGradeSummaryDto {
    count;
    revenuePercentage;
}
exports.AbcGradeSummaryDto = AbcGradeSummaryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '상품 수' }),
    __metadata("design:type", Number)
], AbcGradeSummaryDto.prototype, "count", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '매출 비율 (%)' }),
    __metadata("design:type", Number)
], AbcGradeSummaryDto.prototype, "revenuePercentage", void 0);
class AbcAnalysisResponse {
    items;
    summary;
}
exports.AbcAnalysisResponse = AbcAnalysisResponse;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ABC 분석 항목', type: [AbcAnalysisItemDto] }),
    __metadata("design:type", Array)
], AbcAnalysisResponse.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '등급별 요약' }),
    __metadata("design:type", Object)
], AbcAnalysisResponse.prototype, "summary", void 0);
class HourlyTopProductDto {
    productId;
    productName;
    quantity;
    revenue;
}
exports.HourlyTopProductDto = HourlyTopProductDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '상품 ID' }),
    __metadata("design:type", String)
], HourlyTopProductDto.prototype, "productId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '상품명' }),
    __metadata("design:type", String)
], HourlyTopProductDto.prototype, "productName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '판매 수량' }),
    __metadata("design:type", Number)
], HourlyTopProductDto.prototype, "quantity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '매출액' }),
    __metadata("design:type", Number)
], HourlyTopProductDto.prototype, "revenue", void 0);
class HourlyProductDto {
    hour;
    topProducts;
    totalOrders;
}
exports.HourlyProductDto = HourlyProductDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '시간대 (0-23)' }),
    __metadata("design:type", Number)
], HourlyProductDto.prototype, "hour", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '해당 시간대 인기 상품 (Top 5)',
        type: [HourlyTopProductDto],
    }),
    __metadata("design:type", Array)
], HourlyProductDto.prototype, "topProducts", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '해당 시간대 총 주문 수' }),
    __metadata("design:type", Number)
], HourlyProductDto.prototype, "totalOrders", void 0);
class HourlyProductAnalysisResponse {
    hourlyData;
}
exports.HourlyProductAnalysisResponse = HourlyProductAnalysisResponse;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '시간대별 데이터', type: [HourlyProductDto] }),
    __metadata("design:type", Array)
], HourlyProductAnalysisResponse.prototype, "hourlyData", void 0);
class CombinationProductDto {
    productId;
    productName;
}
exports.CombinationProductDto = CombinationProductDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '상품 ID' }),
    __metadata("design:type", String)
], CombinationProductDto.prototype, "productId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '상품명' }),
    __metadata("design:type", String)
], CombinationProductDto.prototype, "productName", void 0);
class ProductCombinationDto {
    products;
    coOrderCount;
    supportRate;
}
exports.ProductCombinationDto = ProductCombinationDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '함께 주문된 상품 쌍',
        type: [CombinationProductDto],
    }),
    __metadata("design:type", Array)
], ProductCombinationDto.prototype, "products", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '함께 주문된 횟수' }),
    __metadata("design:type", Number)
], ProductCombinationDto.prototype, "coOrderCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '전체 주문 대비 비율 (%)' }),
    __metadata("design:type", Number)
], ProductCombinationDto.prototype, "supportRate", void 0);
class CombinationAnalysisResponse {
    combinations;
    totalOrdersAnalyzed;
}
exports.CombinationAnalysisResponse = CombinationAnalysisResponse;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '상품 조합 목록', type: [ProductCombinationDto] }),
    __metadata("design:type", Array)
], CombinationAnalysisResponse.prototype, "combinations", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '분석 대상 주문 수' }),
    __metadata("design:type", Number)
], CombinationAnalysisResponse.prototype, "totalOrdersAnalyzed", void 0);
class CohortRetentionDto {
    period;
    activeCustomers;
    retentionRate;
}
exports.CohortRetentionDto = CohortRetentionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '경과 기간 (0 = 첫 주문 기간)' }),
    __metadata("design:type", Number)
], CohortRetentionDto.prototype, "period", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '해당 기간에 주문한 고객 수' }),
    __metadata("design:type", Number)
], CohortRetentionDto.prototype, "activeCustomers", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '잔존율 (%)' }),
    __metadata("design:type", Number)
], CohortRetentionDto.prototype, "retentionRate", void 0);
class CohortRowDto {
    cohort;
    cohortSize;
    retention;
}
exports.CohortRowDto = CohortRowDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '코호트 (예: 2026-01)', example: '2026-01' }),
    __metadata("design:type", String)
], CohortRowDto.prototype, "cohort", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '코호트 내 고객 수' }),
    __metadata("design:type", Number)
], CohortRowDto.prototype, "cohortSize", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '기간별 잔존 데이터',
        type: [CohortRetentionDto],
    }),
    __metadata("design:type", Array)
], CohortRowDto.prototype, "retention", void 0);
class CohortAnalysisResponse {
    cohorts;
    granularity;
}
exports.CohortAnalysisResponse = CohortAnalysisResponse;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '코호트 데이터', type: [CohortRowDto] }),
    __metadata("design:type", Array)
], CohortAnalysisResponse.prototype, "cohorts", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '집계 단위', enum: ['WEEK', 'MONTH'] }),
    __metadata("design:type", String)
], CohortAnalysisResponse.prototype, "granularity", void 0);
class RfmCustomerDto {
    customerPhone;
    recency;
    frequency;
    monetary;
    rfmScore;
    segment;
}
exports.RfmCustomerDto = RfmCustomerDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '고객 전화번호' }),
    __metadata("design:type", String)
], RfmCustomerDto.prototype, "customerPhone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '마지막 주문 이후 일수' }),
    __metadata("design:type", Number)
], RfmCustomerDto.prototype, "recency", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '주문 횟수' }),
    __metadata("design:type", Number)
], RfmCustomerDto.prototype, "frequency", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '총 결제 금액' }),
    __metadata("design:type", Number)
], RfmCustomerDto.prototype, "monetary", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'RFM 점수 (예: 5-4-5)', example: '5-4-5' }),
    __metadata("design:type", String)
], RfmCustomerDto.prototype, "rfmScore", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '고객 세그먼트',
        example: 'Champions',
        enum: ['Champions', 'Loyal', 'Potential', 'New', 'At Risk', 'Lost'],
    }),
    __metadata("design:type", String)
], RfmCustomerDto.prototype, "segment", void 0);
class RfmSegmentSummaryDto {
    segment;
    customerCount;
    avgRecency;
    avgFrequency;
    avgMonetary;
}
exports.RfmSegmentSummaryDto = RfmSegmentSummaryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '세그먼트명' }),
    __metadata("design:type", String)
], RfmSegmentSummaryDto.prototype, "segment", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '고객 수' }),
    __metadata("design:type", Number)
], RfmSegmentSummaryDto.prototype, "customerCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '평균 Recency (일)' }),
    __metadata("design:type", Number)
], RfmSegmentSummaryDto.prototype, "avgRecency", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '평균 Frequency (횟수)' }),
    __metadata("design:type", Number)
], RfmSegmentSummaryDto.prototype, "avgFrequency", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '평균 Monetary (원)' }),
    __metadata("design:type", Number)
], RfmSegmentSummaryDto.prototype, "avgMonetary", void 0);
class RfmAnalysisResponse {
    customers;
    summary;
}
exports.RfmAnalysisResponse = RfmAnalysisResponse;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '고객별 RFM 데이터', type: [RfmCustomerDto] }),
    __metadata("design:type", Array)
], RfmAnalysisResponse.prototype, "customers", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '세그먼트별 요약', type: [RfmSegmentSummaryDto] }),
    __metadata("design:type", Array)
], RfmAnalysisResponse.prototype, "summary", void 0);
//# sourceMappingURL=analytics.dto.js.map