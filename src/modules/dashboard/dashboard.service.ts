import { Injectable } from '@nestjs/common';
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

@Injectable()
export class DashboardService {
  constructor(private readonly supabase: SupabaseService) {}

  private getClient(accessToken: string, isAdmin?: boolean) {
    return isAdmin
      ? this.supabase.adminClient()
      : this.supabase.userClient(accessToken);
  }

  async getStats(
    accessToken: string,
    brandId: string,
    isAdmin?: boolean,
  ): Promise<DashboardStats> {
    const sb = this.getClient(accessToken, isAdmin);

    // Start of today (UTC)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Branches within the brand
    const { data: branchRows, error: branchError } = await sb
      .from('branches')
      .select('id')
      .eq('brand_id', brandId);

    if (branchError) {
      throw new Error(`[dashboard.getStats] ${branchError.message}`);
    }

    const branchIds = (branchRows ?? [])
      .map((row: any) => row.id)
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

    const [
      totalOrdersResult,
      pendingOrdersResult,
      todayOrdersResult,
      totalProductsResult,
      totalBranchesResult,
      recentOrdersResult,
    ] = await Promise.all([
      // Total orders
      sb
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('branch_id', branchIds),

      // Pending orders
      sb
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('status', ['CREATED', 'CONFIRMED', 'PREPARING'])
        .in('branch_id', branchIds),

      // Orders created today
      sb
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayISO)
        .in('branch_id', branchIds),

      // Total products
      sb
        .from('products')
        .select('id', { count: 'exact', head: true })
        .in('branch_id', branchIds),

      // Total branches
      sb
        .from('branches')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId),

      // Recent orders
      sb
        .from('orders')
        .select('id, order_no, status, total_amount, created_at')
        .in('branch_id', branchIds)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    const recentOrders = (recentOrdersResult.data ?? []).map((row: any) => ({
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
}
