import { SupabaseService } from '../../infra/supabase/supabase.service';
import { SalesAnalyticsResponse, ProductAnalyticsResponse, OrderAnalyticsResponse, CustomerAnalyticsResponse } from './dto/analytics.dto';
export declare class AnalyticsService {
    private readonly supabase;
    private readonly logger;
    constructor(supabase: SupabaseService);
    private getDateRange;
    getSalesAnalytics(accessToken: string, branchId: string, startDate?: string, endDate?: string): Promise<SalesAnalyticsResponse>;
    getProductAnalytics(accessToken: string, branchId: string, startDate?: string, endDate?: string): Promise<ProductAnalyticsResponse>;
    getOrderAnalytics(accessToken: string, branchId: string, startDate?: string, endDate?: string): Promise<OrderAnalyticsResponse>;
    getCustomerAnalytics(accessToken: string, branchId: string, startDate?: string, endDate?: string): Promise<CustomerAnalyticsResponse>;
}
