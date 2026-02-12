import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import type {
  AuthRequest,
  BrandMembership,
  BranchMembership,
} from '../types/auth-request';
import { SupabaseService } from '../../infra/supabase/supabase.service';

const MEMBERSHIP_CACHE_TTL_MS = 30 * 1000; // 30 seconds

type CachedMembership = {
  brandMemberships: BrandMembership[];
  branchMemberships: BranchMembership[];
  expiresAt: number;
};

/**
 * CustomerGuard
 * - 인증된 사용자인지 확인
 * - 최소 하나 이상의 브랜드 또는 브랜치 멤버십이 있는지 확인
 * - Admin은 고객 영역에 접근할 수 없음 (분리)
 * - 멤버십 결과를 30초간 캐싱하여 DB 쿼리 절감
 */
@Injectable()
export class CustomerGuard implements CanActivate {
  private readonly logger = new Logger(CustomerGuard.name);
  private readonly membershipCache = new Map<string, CachedMembership>();

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
      this.logger.warn(
        `CustomerGuard: Admin user ${user.id} attempted to access customer area`,
      );
      throw new UnauthorizedException(
        'Admin users cannot access customer area',
      );
    }

    // 3. 캐시 확인
    const now = Date.now();
    const cached = this.membershipCache.get(user.id);
    if (cached && now < cached.expiresAt) {
      request.brandMemberships = cached.brandMemberships;
      request.branchMemberships = cached.branchMemberships;
      return true;
    }

    // 4. 멤버십 조회 (3개 쿼리 병렬 실행)
    const sb = this.supabase.adminClient();

    const [brandResult, ownedResult, branchResult] = await Promise.all([
      sb
        .from('brand_members')
        .select('brand_id, role, status')
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE'),
      sb.from('brands').select('id').eq('owner_user_id', user.id),
      sb
        .from('branch_members')
        .select('branch_id, role, status')
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE'),
    ]);

    if (brandResult.error) {
      this.logger.error(
        `CustomerGuard: Failed to check brand memberships for user ${user.id}`,
        brandResult.error,
      );
      throw new UnauthorizedException('Failed to verify memberships');
    }

    if (branchResult.error) {
      this.logger.error(
        `CustomerGuard: Failed to check branch memberships for user ${user.id}`,
        branchResult.error,
      );
      throw new UnauthorizedException('Failed to verify memberships');
    }

    if (ownedResult.error) {
      this.logger.error(
        `CustomerGuard: Failed to check owned brands for user ${user.id}`,
        ownedResult.error,
      );
    }

    // brand_members에 없지만 owner_user_id로 소유한 브랜드를 멤버십에 합산
    const allBrandMemberships: BrandMembership[] = [
      ...(brandResult.data || []),
    ];
    if (ownedResult.data && ownedResult.data.length > 0) {
      const memberBrandIds = new Set(
        allBrandMemberships.map((m) => m.brand_id),
      );
      for (const brand of ownedResult.data) {
        if (!memberBrandIds.has(brand.id)) {
          allBrandMemberships.push({
            brand_id: brand.id,
            role: 'OWNER',
            status: 'ACTIVE',
          });
        }
      }
    }

    const allBranchMemberships: BranchMembership[] =
      branchResult.data || [];

    // 5. 최소 하나 이상의 멤버십 필요
    if (
      allBrandMemberships.length === 0 &&
      allBranchMemberships.length === 0
    ) {
      this.logger.warn(
        `CustomerGuard: User ${user.id} has no active memberships`,
      );
      throw new UnauthorizedException(
        'No active brand or branch memberships found',
      );
    }

    // 6. 캐시 저장
    this.evictExpired(now);
    this.membershipCache.set(user.id, {
      brandMemberships: allBrandMemberships,
      branchMemberships: allBranchMemberships,
      expiresAt: now + MEMBERSHIP_CACHE_TTL_MS,
    });

    // 7. Request에 멤버십 정보 첨부
    request.brandMemberships = allBrandMemberships;
    request.branchMemberships = allBranchMemberships;

    this.logger.log(
      `CustomerGuard: User ${user.id} authorized with ${allBrandMemberships.length} brand(s) and ${allBranchMemberships.length} branch(es)`,
    );

    return true;
  }

  private evictExpired(now: number): void {
    if (this.membershipCache.size < 200) return;
    for (const [key, entry] of this.membershipCache) {
      if (now >= entry.expiresAt) {
        this.membershipCache.delete(key);
      }
    }
  }
}
