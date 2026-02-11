export declare class AnalyticsQueryDto {
    branchId: string;
    startDate?: string;
    endDate?: string;
    compare?: boolean;
}
export declare class RevenueByDayDto {
    date: string;
    revenue: number;
    orderCount: number;
}
export declare class SalesAnalyticsResponse {
    totalRevenue: number;
    orderCount: number;
    avgOrderValue: number;
    revenueByDay: RevenueByDayDto[];
}
export declare class TopProductDto {
    productId: string;
    productName: string;
    soldQuantity: number;
    totalRevenue: number;
}
export declare class SalesByProductDto {
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
    revenuePercentage: number;
}
export declare class InventoryTurnoverDto {
    averageTurnoverRate: number;
    periodDays: number;
}
export declare class ProductAnalyticsResponse {
    topProducts: TopProductDto[];
    salesByProduct: SalesByProductDto[];
    inventoryTurnover: InventoryTurnoverDto;
}
export declare class OrderStatusDistributionDto {
    status: string;
    count: number;
    percentage: number;
}
export declare class OrdersByDayDto {
    date: string;
    orderCount: number;
    completedCount: number;
    cancelledCount: number;
}
export declare class PeakHoursDto {
    hour: number;
    orderCount: number;
}
export declare class OrderAnalyticsResponse {
    statusDistribution: OrderStatusDistributionDto[];
    ordersByDay: OrdersByDayDto[];
    peakHours: PeakHoursDto[];
}
export declare class CustomerAnalyticsResponse {
    totalCustomers: number;
    newCustomers: number;
    returningCustomers: number;
    clv: number;
    repeatCustomerRate: number;
    avgOrdersPerCustomer: number;
}
export declare class BrandAnalyticsQueryDto {
    brandId: string;
    startDate?: string;
    endDate?: string;
    compare?: boolean;
}
export declare class PeriodComparisonDto<T> {
    current: T;
    previous?: T;
    changes?: Record<string, number>;
}
export declare class BranchBreakdownDto {
    branchId: string;
    branchName: string;
    revenue: number;
    orderCount: number;
}
export declare class BrandSalesAnalyticsResponse extends SalesAnalyticsResponse {
    byBranch: BranchBreakdownDto[];
}
export declare class AbcAnalysisItemDto {
    productId: string;
    productName: string;
    revenue: number;
    revenuePercentage: number;
    cumulativePercentage: number;
    grade: 'A' | 'B' | 'C';
}
export declare class AbcGradeSummaryDto {
    count: number;
    revenuePercentage: number;
}
export declare class AbcAnalysisResponse {
    items: AbcAnalysisItemDto[];
    summary: {
        gradeA: AbcGradeSummaryDto;
        gradeB: AbcGradeSummaryDto;
        gradeC: AbcGradeSummaryDto;
    };
}
export declare class HourlyTopProductDto {
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
}
export declare class HourlyProductDto {
    hour: number;
    topProducts: HourlyTopProductDto[];
    totalOrders: number;
}
export declare class HourlyProductAnalysisResponse {
    hourlyData: HourlyProductDto[];
}
export declare class CombinationProductDto {
    productId: string;
    productName: string;
}
export declare class ProductCombinationDto {
    products: CombinationProductDto[];
    coOrderCount: number;
    supportRate: number;
}
export declare class CombinationAnalysisResponse {
    combinations: ProductCombinationDto[];
    totalOrdersAnalyzed: number;
}
export declare class CohortRetentionDto {
    period: number;
    activeCustomers: number;
    retentionRate: number;
}
export declare class CohortRowDto {
    cohort: string;
    cohortSize: number;
    retention: CohortRetentionDto[];
}
export declare class CohortAnalysisResponse {
    cohorts: CohortRowDto[];
    granularity: 'WEEK' | 'MONTH';
}
export declare class RfmCustomerDto {
    customerPhone: string;
    recency: number;
    frequency: number;
    monetary: number;
    rfmScore: string;
    segment: string;
}
export declare class RfmSegmentSummaryDto {
    segment: string;
    customerCount: number;
    avgRecency: number;
    avgFrequency: number;
    avgMonetary: number;
}
export declare class RfmAnalysisResponse {
    customers: RfmCustomerDto[];
    summary: RfmSegmentSummaryDto[];
}
