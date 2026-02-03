import { DashboardService } from './dashboard.service';
export declare class DashboardController {
    private readonly dashboardService;
    constructor(dashboardService: DashboardService);
    getStats(authHeader: string): Promise<import("./dashboard.service").DashboardStats>;
}
