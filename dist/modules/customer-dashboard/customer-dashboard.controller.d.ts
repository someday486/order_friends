import type { AuthRequest } from '../../common/types/auth-request';
import { CustomerDashboardService } from './customer-dashboard.service';
export declare class CustomerDashboardController {
    private readonly dashboardService;
    constructor(dashboardService: CustomerDashboardService);
    getDashboardStats(req: AuthRequest): Promise<{
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
