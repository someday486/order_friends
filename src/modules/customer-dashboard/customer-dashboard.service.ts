import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import type {
  BrandMembership,
  BranchMembership,
} from '../../common/types/auth-request';

@Injectable()
export class CustomerDashboardService {
  private readonly logger = new Logger(CustomerDashboardService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async getDashboardStats(
    userId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    this.logger.log(`Fetching dashboard stats for user: ${userId}`);

    const sb = this.supabase.adminClient();

    // 사용자의 브랜드 및 브랜치 ID 추출
    const brandIds = brandMemberships.map((m) => m.brand_id);
    const branchIds = branchMemberships.map((m) => m.branch_id);

    // 브랜드 소유 브랜치도 포함
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

    // 중복 제거
    allBranchIds = [...new Set(allBranchIds)];

    // 1. 내 브랜드 수
    const myBrandsCount = brandIds.length;

    // 2. 내 매장 수
    const myBranchesCount = allBranchIds.length;

    // 3. 총 주문 수
    const { count: totalOrders } = await sb
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('branch_id', allBranchIds);

    // 4. 오늘 주문 수
    const today = new Date().toISOString().split('T')[0];
    const { count: todayOrders } = await sb
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('branch_id', allBranchIds)
      .gte('created_at', `${today}T00:00:00`);

    // 5. 대기 중인 주문
    const { count: pendingOrders } = await sb
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('branch_id', allBranchIds)
      .in('status', ['CREATED', 'CONFIRMED', 'PREPARING']);

    // 6. 총 상품 수
    const { count: totalProducts } = await sb
      .from('products')
      .select('*', { count: 'exact', head: true })
      .in('branch_id', allBranchIds)
      .eq('is_active', true);

    // 7. 브랜드 목록 (간단 정보)
    const { data: brands } = await sb
      .from('brands')
      .select('id, name, created_at')
      .in('id', brandIds)
      .order('created_at', { ascending: false });

    // 8. 최근 주문 5개
    const { data: recentOrders } = await sb
      .from('orders')
      .select(
        `
        id,
        order_no,
        status,
        total_amount,
        customer_name,
        created_at,
        branch:branches(id, name)
      `,
      )
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
}
