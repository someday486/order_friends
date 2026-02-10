import { SupabaseService } from '../../infra/supabase/supabase.service';
import { SalesAnalyticsResponse, ProductAnalyticsResponse, OrderAnalyticsResponse, CustomerAnalyticsResponse, PeriodComparisonDto, BrandSalesAnalyticsResponse } from './dto/analytics.dto';
export declare class AnalyticsService {
    private readonly supabase;
    private readonly logger;
    constructor(supabase: SupabaseService);
    private getDateRange;
    private getPreviousPeriod;
    private calcChange;
    private withComparison;
    getSalesAnalytics(accessToken: string, branchId: string, startDate?: string, endDate?: string): Promise<SalesAnalyticsResponse>;
    getProductAnalytics(accessToken: string, branchId: string, startDate?: string, endDate?: string): Promise<ProductAnalyticsResponse>;
    getOrderAnalytics(accessToken: string, branchId: string, startDate?: string, endDate?: string): Promise<OrderAnalyticsResponse>;
    getCustomerAnalytics(accessToken: string, branchId: string, startDate?: string, endDate?: string): Promise<CustomerAnalyticsResponse>;
    getBrandSalesAnalytics(accessToken: string, brandId: string, startDate?: string, endDate?: string, compare?: boolean): Promise<PeriodComparisonDto<BrandSalesAnalyticsResponse>>;
    getBrandProductAnalytics(accessToken: string, brandId: string, startDate?: string, endDate?: string, compare?: boolean): Promise<PeriodComparisonDto<ProductAnalyticsResponse>>;
    getBrandOrderAnalytics(accessToken: string, brandId: string, startDate?: string, endDate?: string, compare?: boolean): Promise<PeriodComparisonDto<OrderAnalyticsResponse>>;
    getBrandCustomerAnalytics(accessToken: string, brandId: string, startDate?: string, endDate?: string, compare?: boolean): Promise<PeriodComparisonDto<CustomerAnalyticsResponse>>;
}
