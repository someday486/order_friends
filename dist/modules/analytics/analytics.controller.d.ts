import type { AuthRequest } from '../../common/types/auth-request';
import { AnalyticsService } from './analytics.service';
import { SalesAnalyticsResponse, ProductAnalyticsResponse, OrderAnalyticsResponse, CustomerAnalyticsResponse } from './dto/analytics.dto';
export declare class AnalyticsController {
    private readonly analyticsService;
    constructor(analyticsService: AnalyticsService);
    getSalesAnalytics(req: AuthRequest, branchId: string, startDate?: string, endDate?: string): Promise<SalesAnalyticsResponse>;
    getProductAnalytics(req: AuthRequest, branchId: string, startDate?: string, endDate?: string): Promise<ProductAnalyticsResponse>;
    getOrderAnalytics(req: AuthRequest, branchId: string, startDate?: string, endDate?: string): Promise<OrderAnalyticsResponse>;
    getCustomerAnalytics(req: AuthRequest, branchId: string, startDate?: string, endDate?: string): Promise<CustomerAnalyticsResponse>;
}
