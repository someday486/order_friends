import { SupabaseService } from '../../infra/supabase/supabase.service';
import type { BrandMembership, BranchMembership } from '../../common/types/auth-request';
export declare class CustomerDashboardService {
    private readonly supabase;
    private readonly logger;
    constructor(supabase: SupabaseService);
    getDashboardStats(userId: string, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<{
        myBrandsCount: number;
        myBranchesCount: number;
        totalOrders: number;
        todayOrders: number;
        pendingOrders: number;
        totalProducts: number;
        brands: {
            id: any;
            name: any;
            created_at: any;
        }[];
        recentOrders: {
            id: any;
            order_no: any;
            status: any;
            total_amount: any;
            customer_name: any;
            created_at: any;
            branch: {
                id: any;
                name: any;
            }[];
        }[];
    }>;
}
