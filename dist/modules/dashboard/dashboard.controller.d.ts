import type { AuthRequest } from '../../common/types/auth-request';
import { DashboardService } from './dashboard.service';
export declare class DashboardController {
    private readonly dashboardService;
    constructor(dashboardService: DashboardService);
    getStats(req: AuthRequest, brandId: string): Promise<import("./dashboard.service").DashboardStats>;
}
