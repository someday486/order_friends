import { SupabaseService } from '../../infra/supabase/supabase.service';
export interface DashboardStats {
    totalOrders: number;
    pendingOrders: number;
    todayOrders: number;
    totalProducts: number;
    totalBranches: number;
    recentOrders: {
        id: string;
        orderNo?: string;
        status: string;
        totalAmount: number;
        createdAt: string;
    }[];
}
export declare class DashboardService {
    private readonly supabase;
    constructor(supabase: SupabaseService);
    private getClient;
    getStats(accessToken: string, brandId: string, isAdmin?: boolean): Promise<DashboardStats>;
}
