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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
let DashboardService = class DashboardService {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    getClient(accessToken, isAdmin) {
        return isAdmin
            ? this.supabase.adminClient()
            : this.supabase.userClient(accessToken);
    }
    async getStats(accessToken, brandId, isAdmin) {
        const sb = this.getClient(accessToken, isAdmin);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();
        const { data: branchRows, error: branchError } = await sb
            .from('branches')
            .select('id')
            .eq('brand_id', brandId);
        if (branchError) {
            throw new Error(`[dashboard.getStats] ${branchError.message}`);
        }
        const branchIds = (branchRows ?? [])
            .map((row) => row.id)
            .filter(Boolean);
        if (branchIds.length === 0) {
            return {
                totalOrders: 0,
                pendingOrders: 0,
                todayOrders: 0,
                totalProducts: 0,
                totalBranches: 0,
                recentOrders: [],
            };
        }
        const [totalOrdersResult, pendingOrdersResult, todayOrdersResult, totalProductsResult, totalBranchesResult, recentOrdersResult,] = await Promise.all([
            sb
                .from('orders')
                .select('id', { count: 'exact', head: true })
                .in('branch_id', branchIds),
            sb
                .from('orders')
                .select('id', { count: 'exact', head: true })
                .in('status', ['CREATED', 'CONFIRMED', 'PREPARING'])
                .in('branch_id', branchIds),
            sb
                .from('orders')
                .select('id', { count: 'exact', head: true })
                .gte('created_at', todayISO)
                .in('branch_id', branchIds),
            sb
                .from('products')
                .select('id', { count: 'exact', head: true })
                .in('branch_id', branchIds),
            sb
                .from('branches')
                .select('id', { count: 'exact', head: true })
                .eq('brand_id', brandId),
            sb
                .from('orders')
                .select('id, order_no, status, total_amount, created_at')
                .in('branch_id', branchIds)
                .order('created_at', { ascending: false })
                .limit(5),
        ]);
        const recentOrders = (recentOrdersResult.data ?? []).map((row) => ({
            id: row.id,
            orderNo: row.order_no ?? undefined,
            status: row.status,
            totalAmount: row.total_amount ?? 0,
            createdAt: row.created_at ?? '',
        }));
        return {
            totalOrders: totalOrdersResult.count ?? 0,
            pendingOrders: pendingOrdersResult.count ?? 0,
            todayOrders: todayOrdersResult.count ?? 0,
            totalProducts: totalProductsResult.count ?? 0,
            totalBranches: totalBranchesResult.count ?? 0,
            recentOrders,
        };
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map