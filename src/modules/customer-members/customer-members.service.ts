import {
  Injectable,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import type {
  BrandMembership,
  BranchMembership,
} from '../../common/types/auth-request';

@Injectable()
export class CustomerMembersService {
  private readonly logger = new Logger(CustomerMembersService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // ─── Authorization helpers ───────────────────────────────────────────────

  private canManageBrand(
    brandId: string,
    brandMemberships: BrandMembership[],
  ): boolean {
    const m = brandMemberships.find((bm) => bm.brand_id === brandId);
    return !!m && (m.role === 'OWNER' || m.role === 'ADMIN');
  }

  private canManageBranch(
    branchId: string,
    branchMemberships: BranchMembership[],
  ): boolean {
    const m = branchMemberships.find((bm) => bm.branch_id === branchId);
    return !!m && (m.role === 'BRANCH_OWNER' || m.role === 'BRANCH_ADMIN');
  }

  // ─── Email + profile resolution ─────────────────────────────────────────

  private async getUserInfo(
    sb: ReturnType<SupabaseService['adminClient']>,
    userIds: string[],
  ): Promise<{
    profileMap: Map<string, string | null>;
    emailMap: Map<string, string | null>;
  }> {
    if (userIds.length === 0) {
      return { profileMap: new Map(), emailMap: new Map() };
    }

    const { data: profiles } = await sb
      .from('profiles')
      .select('id, display_name')
      .in('id', userIds);

    const profileMap = new Map<string, string | null>(
      (profiles ?? []).map((p: { id: string; display_name: string | null }) => [
        p.id,
        p.display_name ?? null,
      ]),
    );

    let emailMap = new Map<string, string | null>();
    try {
      const { data: authData } = await sb.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      const idSet = new Set(userIds);
      emailMap = new Map(
        (authData?.users ?? [])
          .filter((u: { id: string }) => idSet.has(u.id))
          .map((u: { id: string; email?: string }) => [
            u.id,
            u.email ?? null,
          ]),
      );
    } catch (e) {
      this.logger.warn('Failed to fetch auth emails', e);
    }

    return { profileMap, emailMap };
  }

  // ─── Brand members ───────────────────────────────────────────────────────

  async getBrandMembers(
    userId: string,
    brandId: string,
    brandMemberships: BrandMembership[],
  ) {
    if (!this.canManageBrand(brandId, brandMemberships)) {
      throw new ForbiddenException(
        'Only brand OWNER or ADMIN can view brand members',
      );
    }

    const sb = this.supabase.adminClient();

    const { data: members, error } = await sb
      .from('brand_members')
      .select('user_id, role, status, created_at')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(
        `Failed to fetch brand members for brand ${brandId}`,
        error,
      );
      throw new Error('Failed to fetch brand members');
    }

    const rows = members ?? [];
    const userIds = rows.map((m: { user_id: string }) => m.user_id);
    const { profileMap, emailMap } = await this.getUserInfo(sb, userIds);

    this.logger.log(
      `User ${userId} fetched ${rows.length} brand members for brand ${brandId}`,
    );

    return rows.map(
      (m: {
        user_id: string;
        role: string;
        status: string;
        created_at: string;
      }) => ({
        userId: m.user_id,
        displayName: profileMap.get(m.user_id) ?? null,
        email: emailMap.get(m.user_id) ?? null,
        role: m.role,
        status: m.status,
        createdAt: m.created_at,
      }),
    );
  }

  // ─── Branch members ──────────────────────────────────────────────────────

  async getBranchMembers(
    userId: string,
    branchId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    const sb = this.supabase.adminClient();

    // Resolve branch → brand to check brand-level access
    const { data: branch, error: branchError } = await sb
      .from('branches')
      .select('id, brand_id')
      .eq('id', branchId)
      .single();

    if (branchError || !branch) {
      throw new ForbiddenException('Branch not found');
    }

    const hasBrandAccess = this.canManageBrand(
      branch.brand_id,
      brandMemberships,
    );
    const hasBranchAccess = this.canManageBranch(branchId, branchMemberships);

    if (!hasBrandAccess && !hasBranchAccess) {
      throw new ForbiddenException(
        'Insufficient permissions to view branch members',
      );
    }

    const { data: members, error } = await sb
      .from('branch_members')
      .select('user_id, role, status, created_at')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(
        `Failed to fetch branch members for branch ${branchId}`,
        error,
      );
      throw new Error('Failed to fetch branch members');
    }

    const rows = members ?? [];
    const userIds = rows.map((m: { user_id: string }) => m.user_id);
    const { profileMap, emailMap } = await this.getUserInfo(sb, userIds);

    this.logger.log(
      `User ${userId} fetched ${rows.length} branch members for branch ${branchId}`,
    );

    return rows.map(
      (m: {
        user_id: string;
        role: string;
        status: string;
        created_at: string;
      }) => ({
        userId: m.user_id,
        displayName: profileMap.get(m.user_id) ?? null,
        email: emailMap.get(m.user_id) ?? null,
        role: m.role,
        status: m.status,
        createdAt: m.created_at,
        branchId,
      }),
    );
  }
}
