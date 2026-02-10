import type { AuthRequest } from '../../common/types/auth-request';
import { AnalyticsService } from './analytics.service';
import { SalesAnalyticsResponse, ProductAnalyticsResponse, OrderAnalyticsResponse, CustomerAnalyticsResponse, PeriodComparisonDto, BrandSalesAnalyticsResponse } from './dto/analytics.dto';
export declare class AnalyticsController {
    private readonly analyticsService;
    constructor(analyticsService: AnalyticsService);
    getSalesAnalytics(req: AuthRequest, branchId: string, startDate?: string, endDate?: string): Promise<SalesAnalyticsResponse>;
    getProductAnalytics(req: AuthRequest, branchId: string, startDate?: string, endDate?: string): Promise<ProductAnalyticsResponse>;
    getOrderAnalytics(req: AuthRequest, branchId: string, startDate?: string, endDate?: string): Promise<OrderAnalyticsResponse>;
    getCustomerAnalytics(req: AuthRequest, branchId: string, startDate?: string, endDate?: string): Promise<CustomerAnalyticsResponse>;
    private validateBrandAccess;
    getBrandSalesAnalytics(req: AuthRequest, brandId: string, startDate?: string, endDate?: string, compare?: string): Promise<PeriodComparisonDto<BrandSalesAnalyticsResponse>>;
    getBrandProductAnalytics(req: AuthRequest, brandId: string, startDate?: string, endDate?: string, compare?: string): Promise<PeriodComparisonDto<ProductAnalyticsResponse>>;
    getBrandOrderAnalytics(req: AuthRequest, brandId: string, startDate?: string, endDate?: string, compare?: string): Promise<PeriodComparisonDto<OrderAnalyticsResponse>>;
    getBrandCustomerAnalytics(req: AuthRequest, brandId: string, startDate?: string, endDate?: string, compare?: string): Promise<PeriodComparisonDto<CustomerAnalyticsResponse>>;
}
