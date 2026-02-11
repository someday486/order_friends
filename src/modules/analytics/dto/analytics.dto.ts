import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Query parameters for analytics endpoints
 */
export class AnalyticsQueryDto {
  @ApiProperty({ description: '지점 ID', required: true })
  @IsUUID()
  branchId: string;

  @ApiPropertyOptional({
    description: '시작 날짜 (ISO 8601)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: '종료 날짜 (ISO 8601)',
    example: '2026-01-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: '이전 기간 비교 활성화',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  compare?: boolean;
}

/**
 * Revenue data point for time-series charts
 */
export class RevenueByDayDto {
  @ApiProperty({ description: '날짜', example: '2026-01-15' })
  date: string;

  @ApiProperty({ description: '해당 날짜의 총 매출', example: 150000 })
  revenue: number;

  @ApiProperty({ description: '해당 날짜의 주문 수', example: 12 })
  orderCount: number;
}

/**
 * Sales analytics response
 */
export class SalesAnalyticsResponse {
  @ApiProperty({ description: '총 매출액 (원)', example: 4500000 })
  totalRevenue: number;

  @ApiProperty({ description: '총 주문 수', example: 150 })
  orderCount: number;

  @ApiProperty({ description: '평균 주문 금액 (원)', example: 30000 })
  avgOrderValue: number;

  @ApiProperty({ description: '일별 매출 데이터', type: [RevenueByDayDto] })
  revenueByDay: RevenueByDayDto[];
}

/**
 * Top product data
 */
export class TopProductDto {
  @ApiProperty({
    description: '상품 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  productId: string;

  @ApiProperty({ description: '상품명', example: '아메리카노' })
  productName: string;

  @ApiProperty({ description: '판매 수량', example: 120 })
  soldQuantity: number;

  @ApiProperty({ description: '총 매출액 (원)', example: 480000 })
  totalRevenue: number;
}

/**
 * Sales by product data
 */
export class SalesByProductDto {
  @ApiProperty({
    description: '상품 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  productId: string;

  @ApiProperty({ description: '상품명', example: '카페라떼' })
  productName: string;

  @ApiProperty({ description: '판매 수량', example: 80 })
  quantity: number;

  @ApiProperty({ description: '총 매출액 (원)', example: 400000 })
  revenue: number;

  @ApiProperty({ description: '전체 매출 대비 비율 (%)', example: 8.89 })
  revenuePercentage: number;
}

/**
 * Inventory turnover rate
 */
export class InventoryTurnoverDto {
  @ApiProperty({ description: '평균 재고 회전율', example: 5.2 })
  averageTurnoverRate: number;

  @ApiProperty({ description: '기간 (일)', example: 30 })
  periodDays: number;
}

/**
 * Product analytics response
 */
export class ProductAnalyticsResponse {
  @ApiProperty({
    description: '상위 판매 상품 (Top 10)',
    type: [TopProductDto],
  })
  topProducts: TopProductDto[];

  @ApiProperty({ description: '상품별 판매 현황', type: [SalesByProductDto] })
  salesByProduct: SalesByProductDto[];

  @ApiProperty({ description: '재고 회전율', type: InventoryTurnoverDto })
  inventoryTurnover: InventoryTurnoverDto;
}

/**
 * Order status distribution
 */
export class OrderStatusDistributionDto {
  @ApiProperty({ description: '주문 상태', example: 'COMPLETED' })
  status: string;

  @ApiProperty({ description: '해당 상태의 주문 수', example: 85 })
  count: number;

  @ApiProperty({ description: '전체 주문 대비 비율 (%)', example: 56.67 })
  percentage: number;
}

/**
 * Orders by day data
 */
export class OrdersByDayDto {
  @ApiProperty({ description: '날짜', example: '2026-01-15' })
  date: string;

  @ApiProperty({ description: '해당 날짜의 주문 수', example: 15 })
  orderCount: number;

  @ApiProperty({ description: '완료된 주문 수', example: 12 })
  completedCount: number;

  @ApiProperty({ description: '취소된 주문 수', example: 1 })
  cancelledCount: number;
}

/**
 * Peak hours data
 */
export class PeakHoursDto {
  @ApiProperty({ description: '시간대 (0-23)', example: 14 })
  hour: number;

  @ApiProperty({ description: '해당 시간대의 주문 수', example: 25 })
  orderCount: number;
}

/**
 * Order analytics response
 */
export class OrderAnalyticsResponse {
  @ApiProperty({
    description: '주문 상태별 분포',
    type: [OrderStatusDistributionDto],
  })
  statusDistribution: OrderStatusDistributionDto[];

  @ApiProperty({ description: '일별 주문 추이', type: [OrdersByDayDto] })
  ordersByDay: OrdersByDayDto[];

  @ApiProperty({ description: '시간대별 주문 현황', type: [PeakHoursDto] })
  peakHours: PeakHoursDto[];
}

/**
 * Customer analytics response
 */
export class CustomerAnalyticsResponse {
  @ApiProperty({ description: '총 고객 수', example: 450 })
  totalCustomers: number;

  @ApiProperty({ description: '신규 고객 수 (기간 내)', example: 45 })
  newCustomers: number;

  @ApiProperty({ description: '재구매 고객 수', example: 120 })
  returningCustomers: number;

  @ApiProperty({ description: '고객 생애 가치 (평균, 원)', example: 150000 })
  clv: number;

  @ApiProperty({ description: '재구매율 (%)', example: 26.67 })
  repeatCustomerRate: number;

  @ApiProperty({ description: '평균 고객당 주문 수', example: 2.8 })
  avgOrdersPerCustomer: number;
}

// ============================================================
// Brand-level analytics DTOs
// ============================================================

/**
 * Query parameters for brand-level analytics endpoints
 */
export class BrandAnalyticsQueryDto {
  @ApiProperty({ description: '브랜드 ID', required: true })
  @IsUUID()
  brandId: string;

  @ApiPropertyOptional({
    description: '시작 날짜 (ISO 8601)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: '종료 날짜 (ISO 8601)',
    example: '2026-01-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: '이전 기간 비교 활성화',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  compare?: boolean;
}

/**
 * Period comparison wrapper
 */
export class PeriodComparisonDto<T> {
  @ApiProperty({ description: '현재 기간 데이터' })
  current: T;

  @ApiPropertyOptional({ description: '이전 기간 데이터' })
  previous?: T;

  @ApiPropertyOptional({
    description: '주요 지표별 변화율 (%)',
    example: { totalRevenue: 12.5, orderCount: -3.2 },
  })
  changes?: Record<string, number>;
}

/**
 * Branch breakdown for brand-level analytics
 */
export class BranchBreakdownDto {
  @ApiProperty({ description: '지점 ID' })
  branchId: string;

  @ApiProperty({ description: '지점명' })
  branchName: string;

  @ApiProperty({ description: '매출액' })
  revenue: number;

  @ApiProperty({ description: '주문 수' })
  orderCount: number;
}

/**
 * Brand-level sales analytics response
 */
export class BrandSalesAnalyticsResponse extends SalesAnalyticsResponse {
  @ApiProperty({
    description: '지점별 매출 분포',
    type: [BranchBreakdownDto],
  })
  byBranch: BranchBreakdownDto[];
}

// ============================================================
// 심화 분석 DTOs
// ============================================================

/**
 * ABC 분석 항목
 */
export class AbcAnalysisItemDto {
  @ApiProperty({ description: '상품 ID' })
  productId: string;

  @ApiProperty({ description: '상품명' })
  productName: string;

  @ApiProperty({ description: '매출액' })
  revenue: number;

  @ApiProperty({ description: '매출 비율 (%)' })
  revenuePercentage: number;

  @ApiProperty({ description: '누적 매출 비율 (%)' })
  cumulativePercentage: number;

  @ApiProperty({ description: 'ABC 등급', enum: ['A', 'B', 'C'] })
  grade: 'A' | 'B' | 'C';
}

export class AbcGradeSummaryDto {
  @ApiProperty({ description: '상품 수' })
  count: number;

  @ApiProperty({ description: '매출 비율 (%)' })
  revenuePercentage: number;
}

export class AbcAnalysisResponse {
  @ApiProperty({ description: 'ABC 분석 항목', type: [AbcAnalysisItemDto] })
  items: AbcAnalysisItemDto[];

  @ApiProperty({ description: '등급별 요약' })
  summary: {
    gradeA: AbcGradeSummaryDto;
    gradeB: AbcGradeSummaryDto;
    gradeC: AbcGradeSummaryDto;
  };
}

/**
 * 시간대별 인기 상품
 */
export class HourlyTopProductDto {
  @ApiProperty({ description: '상품 ID' })
  productId: string;

  @ApiProperty({ description: '상품명' })
  productName: string;

  @ApiProperty({ description: '판매 수량' })
  quantity: number;

  @ApiProperty({ description: '매출액' })
  revenue: number;
}

export class HourlyProductDto {
  @ApiProperty({ description: '시간대 (0-23)' })
  hour: number;

  @ApiProperty({
    description: '해당 시간대 인기 상품 (Top 5)',
    type: [HourlyTopProductDto],
  })
  topProducts: HourlyTopProductDto[];

  @ApiProperty({ description: '해당 시간대 총 주문 수' })
  totalOrders: number;
}

export class HourlyProductAnalysisResponse {
  @ApiProperty({ description: '시간대별 데이터', type: [HourlyProductDto] })
  hourlyData: HourlyProductDto[];
}

/**
 * 조합 분석
 */
export class CombinationProductDto {
  @ApiProperty({ description: '상품 ID' })
  productId: string;

  @ApiProperty({ description: '상품명' })
  productName: string;
}

export class ProductCombinationDto {
  @ApiProperty({
    description: '함께 주문된 상품 쌍',
    type: [CombinationProductDto],
  })
  products: CombinationProductDto[];

  @ApiProperty({ description: '함께 주문된 횟수' })
  coOrderCount: number;

  @ApiProperty({ description: '전체 주문 대비 비율 (%)' })
  supportRate: number;
}

export class CombinationAnalysisResponse {
  @ApiProperty({ description: '상품 조합 목록', type: [ProductCombinationDto] })
  combinations: ProductCombinationDto[];

  @ApiProperty({ description: '분석 대상 주문 수' })
  totalOrdersAnalyzed: number;
}

/**
 * 코호트 분석
 */
export class CohortRetentionDto {
  @ApiProperty({ description: '경과 기간 (0 = 첫 주문 기간)' })
  period: number;

  @ApiProperty({ description: '해당 기간에 주문한 고객 수' })
  activeCustomers: number;

  @ApiProperty({ description: '잔존율 (%)' })
  retentionRate: number;
}

export class CohortRowDto {
  @ApiProperty({ description: '코호트 (예: 2026-01)', example: '2026-01' })
  cohort: string;

  @ApiProperty({ description: '코호트 내 고객 수' })
  cohortSize: number;

  @ApiProperty({
    description: '기간별 잔존 데이터',
    type: [CohortRetentionDto],
  })
  retention: CohortRetentionDto[];
}

export class CohortAnalysisResponse {
  @ApiProperty({ description: '코호트 데이터', type: [CohortRowDto] })
  cohorts: CohortRowDto[];

  @ApiProperty({ description: '집계 단위', enum: ['WEEK', 'MONTH'] })
  granularity: 'WEEK' | 'MONTH';
}

/**
 * RFM 분석
 */
export class RfmCustomerDto {
  @ApiProperty({ description: '고객 전화번호' })
  customerPhone: string;

  @ApiProperty({ description: '마지막 주문 이후 일수' })
  recency: number;

  @ApiProperty({ description: '주문 횟수' })
  frequency: number;

  @ApiProperty({ description: '총 결제 금액' })
  monetary: number;

  @ApiProperty({ description: 'RFM 점수 (예: 5-4-5)', example: '5-4-5' })
  rfmScore: string;

  @ApiProperty({
    description: '고객 세그먼트',
    example: 'Champions',
    enum: ['Champions', 'Loyal', 'Potential', 'New', 'At Risk', 'Lost'],
  })
  segment: string;
}

export class RfmSegmentSummaryDto {
  @ApiProperty({ description: '세그먼트명' })
  segment: string;

  @ApiProperty({ description: '고객 수' })
  customerCount: number;

  @ApiProperty({ description: '평균 Recency (일)' })
  avgRecency: number;

  @ApiProperty({ description: '평균 Frequency (횟수)' })
  avgFrequency: number;

  @ApiProperty({ description: '평균 Monetary (원)' })
  avgMonetary: number;
}

export class RfmAnalysisResponse {
  @ApiProperty({ description: '고객별 RFM 데이터', type: [RfmCustomerDto] })
  customers: RfmCustomerDto[];

  @ApiProperty({ description: '세그먼트별 요약', type: [RfmSegmentSummaryDto] })
  summary: RfmSegmentSummaryDto[];
}
