import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import type {
  BrandMembership,
  BranchMembership,
} from '../../common/types/auth-request';
import { BrandRole, BranchRole, MemberStatus } from '../members/dto/member.dto';
import type {
  UpdateBrandMemberRequest,
  UpdateBranchMemberRequest,
} from '../members/dto/member.dto';
import type {
  InviteCustomerBrandMemberRequest,
  InviteCustomerBranchMemberRequest,
} from './dto/customer-member-invite.dto';
import {
  CustomerMemberHistoryAction,
  CustomerMemberHistoryScope,
} from './dto/customer-member-history.dto';

const MEMBER_ACTIVITY_LOGS_TABLE = 'customer_member_activity_logs';

type MemberActivityLogRow = {
  id: string;
  action_type: CustomerMemberHistoryAction;
  scope_type: CustomerMemberHistoryScope;
  brand_id: string;
  branch_id: string | null;
  actor_user_id: string;
  target_user_id: string | null;
  target_email: string | null;
  before_role: string | null;
  after_role: string | null;
  before_status: string | null;
  after_status: string | null;
  created_at: string;
};

@Injectable()
export class CustomerMembersService {
  private readonly logger = new Logger(CustomerMembersService.name);
  private static readonly AUTH_USERS_PAGE_SIZE = 200;
  private static readonly SINGLE_ACTIVE_BRAND_OWNER_CONSTRAINT =
    'brand_members_one_active_owner_per_brand';

  constructor(private readonly supabase: SupabaseService) {}

  private isSingleActiveBrandOwnerViolation(
    error: { message?: string | null } | null | undefined,
  ) {
    return (error?.message ?? '').includes(
      CustomerMembersService.SINGLE_ACTIVE_BRAND_OWNER_CONSTRAINT,
    );
  }

  private throwBrandMemberMutationError(
    error: { message?: string | null } | null | undefined,
    operation:
      | 'customer-members.inviteBrandMember'
      | 'customer-members.updateBrandMember',
  ): never {
    if (this.isSingleActiveBrandOwnerViolation(error)) {
      throw new BadRequestException(
        '브랜드당 활성 오너는 1명만 지정할 수 있습니다. 기존 오너 권한을 먼저 변경해주세요.',
      );
    }

    throw new Error(`[${operation}] ${error?.message ?? 'unknown error'}`);
  }

  private isMissingLogTableError(error: unknown) {
    if (!error || typeof error !== 'object') return false;
    const message =
      'message' in error && typeof error.message === 'string'
        ? error.message
        : '';
    return (
      message.includes(MEMBER_ACTIVITY_LOGS_TABLE) ||
      message.includes('relation') ||
      message.includes('schema cache')
    );
  }

  private async writeMemberActivityLog(
    payload: Omit<MemberActivityLogRow, 'id' | 'created_at'>,
  ) {
    const sb = this.supabase.adminClient();

    try {
      const { error } = await sb
        .from(MEMBER_ACTIVITY_LOGS_TABLE)
        .insert(payload);
      if (error) {
        if (this.isMissingLogTableError(error)) {
          this.logger.warn(
            `${MEMBER_ACTIVITY_LOGS_TABLE} table is unavailable; skipping member activity log write.`,
          );
          return;
        }
        this.logger.warn(
          `[customer-members.writeMemberActivityLog] ${error.message}`,
        );
      }
    } catch (error) {
      if (this.isMissingLogTableError(error)) {
        this.logger.warn(
          `${MEMBER_ACTIVITY_LOGS_TABLE} table is unavailable; skipping member activity log write.`,
        );
        return;
      }
      this.logger.warn(
        '[customer-members.writeMemberActivityLog] Failed to write member activity log',
        error,
      );
    }
  }

  private async getMemberActivityLogs(filters: {
    brandId?: string;
    branchId?: string;
  }): Promise<MemberActivityLogRow[]> {
    const sb = this.supabase.adminClient();

    try {
      let query = sb
        .from(MEMBER_ACTIVITY_LOGS_TABLE)
        .select(
          'id, action_type, scope_type, brand_id, branch_id, actor_user_id, target_user_id, target_email, before_role, after_role, before_status, after_status, created_at',
        )
        .order('created_at', { ascending: false });

      if (filters.branchId) {
        query = query.eq('branch_id', filters.branchId);
      } else if (filters.brandId) {
        query = query.eq('brand_id', filters.brandId);
      }

      const { data, error } = await query.limit(50);
      if (error) {
        if (this.isMissingLogTableError(error)) {
          this.logger.warn(
            `${MEMBER_ACTIVITY_LOGS_TABLE} table is unavailable; returning empty member activity logs.`,
          );
          return [];
        }
        throw new Error(
          `[customer-members.getMemberActivityLogs] ${error.message}`,
        );
      }

      return (data ?? []) as MemberActivityLogRow[];
    } catch (error) {
      if (this.isMissingLogTableError(error)) {
        this.logger.warn(
          `${MEMBER_ACTIVITY_LOGS_TABLE} table is unavailable; returning empty member activity logs.`,
        );
        return [];
      }
      throw error;
    }
  }

  private getMemberHistoryAction(
    beforeRole?: string,
    afterRole?: string,
    beforeStatus?: string,
    afterStatus?: string,
  ) {
    const roleChanged =
      beforeRole !== undefined &&
      afterRole !== undefined &&
      beforeRole !== afterRole;
    const statusChanged =
      beforeStatus !== undefined &&
      afterStatus !== undefined &&
      beforeStatus !== afterStatus;

    if (roleChanged && statusChanged) {
      return CustomerMemberHistoryAction.ROLE_STATUS_CHANGED;
    }
    if (roleChanged) return CustomerMemberHistoryAction.ROLE_CHANGED;
    if (statusChanged) return CustomerMemberHistoryAction.STATUS_CHANGED;
    return null;
  }

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
          .map((u: { id: string; email?: string }) => [u.id, u.email ?? null]),
      );
    } catch (e) {
      this.logger.warn('Failed to fetch auth emails', e);
    }

    return { profileMap, emailMap };
  }

  private async listAllAuthUsers() {
    const admin = this.supabase.adminClient();
    const users: Array<{ id: string; email?: string | null }> = [];
    let page = 1;

    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: CustomerMembersService.AUTH_USERS_PAGE_SIZE,
      });

      if (error) {
        throw new BadRequestException(error.message);
      }

      const pageUsers = data?.users ?? [];
      users.push(...pageUsers);

      if (pageUsers.length < CustomerMembersService.AUTH_USERS_PAGE_SIZE) {
        break;
      }

      page += 1;
    }

    return users;
  }

  private async findOrInviteUserByEmail(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const admin = this.supabase.adminClient();
    const users = await this.listAllAuthUsers();
    const existingUser = users.find(
      (user) => user.email?.toLowerCase() === normalizedEmail,
    );

    if (existingUser) {
      return existingUser;
    }

    const { data, error } =
      await admin.auth.admin.inviteUserByEmail(normalizedEmail);

    if (error || !data.user) {
      throw new BadRequestException(
        error?.message ?? '초대 이메일 발송에 실패했습니다.',
      );
    }

    return {
      id: data.user.id,
      email: data.user.email ?? normalizedEmail,
    };
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

  async getBrandMemberHistory(
    userId: string,
    brandId: string,
    brandMemberships: BrandMembership[],
  ) {
    if (!this.canManageBrand(brandId, brandMemberships)) {
      throw new ForbiddenException(
        'Only brand OWNER or ADMIN can view brand member history',
      );
    }

    const sb = this.supabase.adminClient();
    const rows = await this.getMemberActivityLogs({ brandId });
    const userIds = Array.from(
      new Set(
        rows
          .flatMap((row) => [row.actor_user_id, row.target_user_id])
          .filter((value): value is string => !!value),
      ),
    );
    const { profileMap, emailMap } = await this.getUserInfo(sb, userIds);

    this.logger.log(
      `User ${userId} fetched ${rows.length} brand member history rows for brand ${brandId}`,
    );

    return rows.map((row) => ({
      id: row.id,
      actionType: row.action_type,
      scopeType: row.scope_type,
      brandId: row.brand_id,
      branchId: row.branch_id,
      actorUserId: row.actor_user_id,
      actorDisplayName: profileMap.get(row.actor_user_id) ?? null,
      actorEmail: emailMap.get(row.actor_user_id) ?? null,
      targetUserId: row.target_user_id,
      targetDisplayName: row.target_user_id
        ? (profileMap.get(row.target_user_id) ?? null)
        : null,
      targetEmail:
        row.target_email ??
        (row.target_user_id
          ? (emailMap.get(row.target_user_id) ?? null)
          : null),
      beforeRole: row.before_role,
      afterRole: row.after_role,
      beforeStatus: row.before_status,
      afterStatus: row.after_status,
      createdAt: row.created_at,
    }));
  }

  async inviteBrandMember(
    userId: string,
    brandId: string,
    dto: InviteCustomerBrandMemberRequest,
    brandMemberships: BrandMembership[],
  ) {
    if (!this.canManageBrand(brandId, brandMemberships)) {
      throw new ForbiddenException(
        'Only brand OWNER or ADMIN can invite brand members',
      );
    }

    const sb = this.supabase.adminClient();
    const invitedUser = await this.findOrInviteUserByEmail(dto.email);

    const { data: existing, error: existingError } = await sb
      .from('brand_members')
      .select('user_id')
      .eq('brand_id', brandId)
      .eq('user_id', invitedUser.id)
      .maybeSingle();

    if (existingError) {
      throw new Error(
        `[customer-members.inviteBrandMember] ${existingError.message}`,
      );
    }

    if (existing) {
      throw new BadRequestException('이미 브랜드 멤버로 등록된 사용자입니다.');
    }

    const { data, error } = await sb
      .from('brand_members')
      .insert({
        brand_id: brandId,
        user_id: invitedUser.id,
        role: dto.role ?? BrandRole.MEMBER,
        status: MemberStatus.INVITED,
      })
      .select('user_id, role, status, created_at')
      .single();

    if (error) {
      this.throwBrandMemberMutationError(
        error,
        'customer-members.inviteBrandMember',
      );
    }

    this.logger.log(
      `User ${userId} invited ${invitedUser.email} to brand ${brandId}`,
    );

    await this.writeMemberActivityLog({
      action_type: CustomerMemberHistoryAction.INVITE_SENT,
      scope_type: CustomerMemberHistoryScope.BRAND,
      brand_id: brandId,
      branch_id: null,
      actor_user_id: userId,
      target_user_id: invitedUser.id,
      target_email: invitedUser.email ?? dto.email,
      before_role: null,
      after_role: data.role,
      before_status: null,
      after_status: data.status,
    });

    return {
      userId: data.user_id,
      displayName: null,
      email: invitedUser.email ?? dto.email,
      role: data.role,
      status: data.status,
      createdAt: data.created_at,
    };
  }

  async updateBrandMember(
    userId: string,
    brandId: string,
    targetUserId: string,
    dto: UpdateBrandMemberRequest,
    brandMemberships: BrandMembership[],
  ) {
    if (!this.canManageBrand(brandId, brandMemberships)) {
      throw new ForbiddenException(
        'Only brand OWNER or ADMIN can update brand members',
      );
    }

    const updateData: Record<string, string> = {};
    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.status !== undefined) updateData.status = dto.status;

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('수정할 내용이 없습니다.');
    }

    const sb = this.supabase.adminClient();
    const { data: beforeMember, error: beforeError } = await sb
      .from('brand_members')
      .select('user_id, role, status')
      .eq('brand_id', brandId)
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (beforeError) {
      throw new Error(
        `[customer-members.updateBrandMember.before] ${beforeError.message}`,
      );
    }

    if (!beforeMember) {
      throw new BadRequestException('브랜드 멤버를 찾을 수 없습니다.');
    }

    const { data, error } = await sb
      .from('brand_members')
      .update(updateData)
      .eq('brand_id', brandId)
      .eq('user_id', targetUserId)
      .select('user_id, role, status, created_at')
      .maybeSingle();

    if (error) {
      this.throwBrandMemberMutationError(
        error,
        'customer-members.updateBrandMember',
      );
    }

    if (!data) {
      throw new BadRequestException('브랜드 멤버를 찾을 수 없습니다.');
    }

    this.logger.log(
      `User ${userId} updated brand member ${targetUserId} in brand ${brandId}`,
    );

    const actionType = this.getMemberHistoryAction(
      beforeMember.role,
      data.role,
      beforeMember.status,
      data.status,
    );
    if (actionType) {
      await this.writeMemberActivityLog({
        action_type: actionType,
        scope_type: CustomerMemberHistoryScope.BRAND,
        brand_id: brandId,
        branch_id: null,
        actor_user_id: userId,
        target_user_id: targetUserId,
        target_email: null,
        before_role: beforeMember.role,
        after_role: data.role,
        before_status: beforeMember.status,
        after_status: data.status,
      });
    }

    return {
      userId: data.user_id,
      role: data.role,
      status: data.status,
      createdAt: data.created_at,
    };
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

  async getBranchMemberHistory(
    userId: string,
    branchId: string,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    const sb = this.supabase.adminClient();
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
        'Insufficient permissions to view branch member history',
      );
    }

    const rows = await this.getMemberActivityLogs({ branchId });
    const userIds = Array.from(
      new Set(
        rows
          .flatMap((row) => [row.actor_user_id, row.target_user_id])
          .filter((value): value is string => !!value),
      ),
    );
    const { profileMap, emailMap } = await this.getUserInfo(sb, userIds);

    this.logger.log(
      `User ${userId} fetched ${rows.length} branch member history rows for branch ${branchId}`,
    );

    return rows.map((row) => ({
      id: row.id,
      actionType: row.action_type,
      scopeType: row.scope_type,
      brandId: row.brand_id,
      branchId: row.branch_id,
      actorUserId: row.actor_user_id,
      actorDisplayName: profileMap.get(row.actor_user_id) ?? null,
      actorEmail: emailMap.get(row.actor_user_id) ?? null,
      targetUserId: row.target_user_id,
      targetDisplayName: row.target_user_id
        ? (profileMap.get(row.target_user_id) ?? null)
        : null,
      targetEmail:
        row.target_email ??
        (row.target_user_id
          ? (emailMap.get(row.target_user_id) ?? null)
          : null),
      beforeRole: row.before_role,
      afterRole: row.after_role,
      beforeStatus: row.before_status,
      afterStatus: row.after_status,
      createdAt: row.created_at,
    }));
  }

  async inviteBranchMember(
    userId: string,
    branchId: string,
    dto: InviteCustomerBranchMemberRequest,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    const sb = this.supabase.adminClient();

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
        'Insufficient permissions to invite branch members',
      );
    }

    const invitedUser = await this.findOrInviteUserByEmail(dto.email);

    const { data: existing, error: existingError } = await sb
      .from('branch_members')
      .select('user_id')
      .eq('branch_id', branchId)
      .eq('user_id', invitedUser.id)
      .maybeSingle();

    if (existingError) {
      throw new Error(
        `[customer-members.inviteBranchMember] ${existingError.message}`,
      );
    }

    if (existing) {
      throw new BadRequestException('이미 매장 멤버로 등록된 사용자입니다.');
    }

    const { data, error } = await sb
      .from('branch_members')
      .insert({
        branch_id: branchId,
        user_id: invitedUser.id,
        role: dto.role ?? BranchRole.STAFF,
        status: MemberStatus.INVITED,
      })
      .select('user_id, role, status, created_at')
      .single();

    if (error) {
      throw new Error(`[customer-members.inviteBranchMember] ${error.message}`);
    }

    this.logger.log(
      `User ${userId} invited ${invitedUser.email} to branch ${branchId}`,
    );

    await this.writeMemberActivityLog({
      action_type: CustomerMemberHistoryAction.INVITE_SENT,
      scope_type: CustomerMemberHistoryScope.BRANCH,
      brand_id: branch.brand_id,
      branch_id: branchId,
      actor_user_id: userId,
      target_user_id: invitedUser.id,
      target_email: invitedUser.email ?? dto.email,
      before_role: null,
      after_role: data.role,
      before_status: null,
      after_status: data.status,
    });

    return {
      userId: data.user_id,
      displayName: null,
      email: invitedUser.email ?? dto.email,
      role: data.role,
      status: data.status,
      createdAt: data.created_at,
      branchId,
    };
  }

  async updateBranchMember(
    userId: string,
    branchId: string,
    targetUserId: string,
    dto: UpdateBranchMemberRequest,
    brandMemberships: BrandMembership[],
    branchMemberships: BranchMembership[],
  ) {
    const sb = this.supabase.adminClient();
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
        'Insufficient permissions to update branch members',
      );
    }

    const updateData: Record<string, string> = {};
    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.status !== undefined) updateData.status = dto.status;

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('수정할 내용이 없습니다.');
    }

    const { data: beforeMember, error: beforeError } = await sb
      .from('branch_members')
      .select('user_id, role, status')
      .eq('branch_id', branchId)
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (beforeError) {
      throw new Error(
        `[customer-members.updateBranchMember.before] ${beforeError.message}`,
      );
    }

    if (!beforeMember) {
      throw new BadRequestException('매장 멤버를 찾을 수 없습니다.');
    }

    const { data, error } = await sb
      .from('branch_members')
      .update(updateData)
      .eq('branch_id', branchId)
      .eq('user_id', targetUserId)
      .select('user_id, role, status, created_at')
      .maybeSingle();

    if (error) {
      throw new Error(`[customer-members.updateBranchMember] ${error.message}`);
    }

    if (!data) {
      throw new BadRequestException('매장 멤버를 찾을 수 없습니다.');
    }

    this.logger.log(
      `User ${userId} updated branch member ${targetUserId} in branch ${branchId}`,
    );

    const actionType = this.getMemberHistoryAction(
      beforeMember.role,
      data.role,
      beforeMember.status,
      data.status,
    );
    if (actionType) {
      await this.writeMemberActivityLog({
        action_type: actionType,
        scope_type: CustomerMemberHistoryScope.BRANCH,
        brand_id: branch.brand_id,
        branch_id: branchId,
        actor_user_id: userId,
        target_user_id: targetUserId,
        target_email: null,
        before_role: beforeMember.role,
        after_role: data.role,
        before_status: beforeMember.status,
        after_status: data.status,
      });
    }

    return {
      userId: data.user_id,
      role: data.role,
      status: data.status,
      createdAt: data.created_at,
      branchId,
    };
  }
}
