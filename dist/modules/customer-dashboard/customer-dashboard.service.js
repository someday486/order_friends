"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var CustomerDashboardService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerDashboardService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
let CustomerDashboardService = CustomerDashboardService_1 = class CustomerDashboardService {
    supabase;
    logger = new common_1.Logger(CustomerDashboardService_1.name);
    constructor(supabase) {
        this.supabase = supabase;
    }
    async getDashboardStats(userId, brandMemberships, branchMemberships) {
        this.logger.log(`Fetching dashboard stats for user: ${userId}`);
        const sb = this.supabase.adminClient();
        const brandIds = brandMemberships.map((m) => m.brand_id);
        const branchIds = branchMemberships.map((m) => m.branch_id);
        let allBranchIds = [...branchIds];
        if (brandIds.length > 0) {
            const { data: brandBranches } = await sb
                .from('branches')
                .select('id')
                .in('brand_id', brandIds);
            if (brandBranches) {
                allBranchIds = [...allBranchIds, ...brandBranches.map((b) => b.id)];
            }
        }
        allBranchIds = [...new Set(allBranchIds)];
        const myBrandsCount = brandIds.length;
        const myBranchesCount = allBranchIds.length;
        const { count: totalOrders } = await sb
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .in('branch_id', allBranchIds);
        const today = new Date().toISOString().split('T')[0];
        const { count: todayOrders } = await sb
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .in('branch_id', allBranchIds)
            .gte('created_at', `${today}T00:00:00`);
        const { count: pendingOrders } = await sb
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .in('branch_id', allBranchIds)
            .in('status', ['CREATED', 'CONFIRMED', 'PREPARING']);
        const { count: totalProducts } = await sb
            .from('products')
            .select('*', { count: 'exact', head: true })
            .in('branch_id', allBranchIds)
            .eq('is_active', true);
        const { data: brands } = await sb
            .from('brands')
            .select('id, name, created_at')
            .in('id', brandIds)
            .order('created_at', { ascending: false });
        const { data: recentOrders } = await sb
            .from('orders')
            .select(`
        id,
        order_no,
        status,
        total_amount,
        customer_name,
        created_at,
        branch:branches(id, name)
      `)
            .in('branch_id', allBranchIds)
            .order('created_at', { ascending: false })
            .limit(5);
        this.logger.log(`Dashboard stats fetched for user: ${userId}`);
        return {
            myBrandsCount,
            myBranchesCount,
            totalOrders: totalOrders || 0,
            todayOrders: todayOrders || 0,
            pendingOrders: pendingOrders || 0,
            totalProducts: totalProducts || 0,
            brands: brands || [],
            recentOrders: recentOrders || [],
        };
    }
};
exports.CustomerDashboardService = CustomerDashboardService;
exports.CustomerDashboardService = CustomerDashboardService = CustomerDashboardService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], CustomerDashboardService);
//# sourceMappingURL=customer-dashboard.service.js.map