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

  async getStats(accessToken: string): Promise<DashboardStats> {
    const sb = this.supabase.userClient(accessToken);

    // 오늘 날짜 (UTC 기준)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // 병렬로 여러 쿼리 실행
    const [
      totalOrdersResult,
      pendingOrdersResult,
      todayOrdersResult,
      totalProductsResult,
      totalBranchesResult,
      recentOrdersResult,
    ] = await Promise.all([
      // 전체 주문 수
      sb.from('orders').select('id', { count: 'exact', head: true }),

      // 대기 중인 주문 (CREATED, CONFIRMED, PREPARING)
      sb
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('status', ['CREATED', 'CONFIRMED', 'PREPARING']),

      // 오늘 주문
      sb
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayISO),

      // 전체 상품 수
      sb.from('products').select('id', { count: 'exact', head: true }),

      // 전체 가게 수
      sb.from('branches').select('id', { count: 'exact', head: true }),

      // 최근 주문 5개
      sb
        .from('orders')
        .select('id, order_no, status, total_amount, created_at')
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
