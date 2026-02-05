import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import type { AuthRequest } from '../types/auth-request';
import { SupabaseService } from '../../infra/supabase/supabase.service';

/**
 * CustomerGuard
 * - 인증된 사용자인지 확인
 * - 최소 하나 이상의 브랜드 또는 브랜치 멤버십이 있는지 확인
 * - Admin은 고객 영역에 접근할 수 없음 (분리)
 */
@Injectable()
export class CustomerGuard implements CanActivate {
  private readonly logger = new Logger(CustomerGuard.name);

  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const { user, accessToken } = request;

    // 1. 인증 확인
    if (!user || !accessToken) {
      this.logger.warn('CustomerGuard: No user or access token');
      throw new UnauthorizedException('Authentication required');
    }

    // 2. Admin 사용자는 고객 영역 접근 불가 (역할 분리)
    if (request.isAdmin) {
      this.logger.warn(`CustomerGuard: Admin user ${user.id} attempted to access customer area`);
      throw new UnauthorizedException('Admin users cannot access customer area');
    }

    // 3. 브랜드 멤버십 확인
    const sb = this.supabase.adminClient();

    const { data: brandMemberships, error: brandError } = await sb
      .from('brand_members')
      .select('brand_id, role, status')
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE');

    if (brandError) {
      this.logger.error(`CustomerGuard: Failed to check brand memberships for user ${user.id}`, brandError);
      throw new UnauthorizedException('Failed to verify memberships');
    }

    // 4. 브랜치 멤버십 확인
    const { data: branchMemberships, error: branchError } = await sb
      .from('branch_members')
      .select('branch_id, role, status')
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE');

    if (branchError) {
      this.logger.error(`CustomerGuard: Failed to check branch memberships for user ${user.id}`, branchError);
      throw new UnauthorizedException('Failed to verify memberships');
    }

    // 5. 최소 하나 이상의 멤버십 필요
    const hasBrandMembership = brandMemberships && brandMemberships.length > 0;
    const hasBranchMembership = branchMemberships && branchMemberships.length > 0;

    if (!hasBrandMembership && !hasBranchMembership) {
      this.logger.warn(`CustomerGuard: User ${user.id} has no active memberships`);
      throw new UnauthorizedException('No active brand or branch memberships found');
    }

    // 6. Request에 멤버십 정보 첨부
    request.brandMemberships = brandMemberships || [];
    request.branchMemberships = branchMemberships || [];

    this.logger.log(`CustomerGuard: User ${user.id} authorized with ${brandMemberships?.length || 0} brand(s) and ${branchMemberships?.length || 0} branch(es)`);

    return true;
  }
}
