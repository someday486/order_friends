import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import {
  BrandMemberResponse,
  BranchMemberResponse,
  BrandRole,
  BranchRole,
  MemberStatus,
  InviteBrandMemberRequest,
  UpdateBrandMemberRequest,
  AddBranchMemberRequest,
  UpdateBranchMemberRequest,
  PendingApprovalUserResponse,
  MemberProfileResponse,
  UpdateMemberProfileRequest,
} from './dto/member.dto';

@Injectable()
export class MembersService {
  private static readonly SINGLE_ACTIVE_BRAND_OWNER_CONSTRAINT =
    'brand_members_one_active_owner_per_brand';

  constructor(private readonly supabase: SupabaseService) {}

  private static readonly AUTH_USERS_PAGE_SIZE = 200;

  private getClient(accessToken: string, isAdmin?: boolean) {
    return isAdmin
      ? this.supabase.adminClient()
      : this.supabase.userClient(accessToken);
  }

  private async listAllAuthUsers(): Promise<User[]> {
    const admin = this.supabase.adminClient();
    const users: User[] = [];
    let page = 1;

    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: MembersService.AUTH_USERS_PAGE_SIZE,
      });

      if (error) {
        throw new Error(`[members.getPendingApprovalUsers] ${error.message}`);
      }

      const pageUsers = data?.users ?? [];
      users.push(...pageUsers);

      if (pageUsers.length < MembersService.AUTH_USERS_PAGE_SIZE) {
        break;
      }

      page += 1;
    }

    return users;
  }

  private async getAuthEmailMap(
    userIds: string[],
  ): Promise<Record<string, string>> {
    if (userIds.length === 0) {
      return {};
    }

    const admin = this.supabase.adminClient();
    if (typeof admin?.auth?.admin?.listUsers !== 'function') {
      return {};
    }

    try {
      const users = await this.listAllAuthUsers();
      return users.reduce<Record<string, string>>((acc, user) => {
        if (userIds.includes(user.id) && user.email) {
          acc[user.id] = user.email;
        }
        return acc;
      }, {});
    } catch {
      return {};
    }
  }

  private async syncAuthDisplayName(
    userId: string,
    displayName: string | null,
  ): Promise<void> {
    const admin = this.supabase.adminClient();
    const { data: userResult, error: getUserError } =
      await admin.auth.admin.getUserById(userId);

    if (getUserError) {
      throw new Error(`[members.syncAuthDisplayName] ${getUserError.message}`);
    }

    const currentMetadata =
      (userResult.user?.user_metadata as Record<string, unknown> | undefined) ??
      {};
    const { error: updateUserError } = await admin.auth.admin.updateUserById(
      userId,
      {
        user_metadata: {
          ...currentMetadata,
          display_name: displayName,
        },
      },
    );

    if (updateUserError) {
      throw new Error(
        `[members.syncAuthDisplayName] ${updateUserError.message}`,
      );
    }
  }

  private resolvePendingUserDisplayName(
    profile: { display_name?: string | null } | null | undefined,
    user: User,
  ): string | null {
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    const candidate =
      profile?.display_name ??
      (typeof metadata.display_name === 'string'
        ? metadata.display_name
        : null) ??
      (typeof metadata.full_name === 'string' ? metadata.full_name : null) ??
      (typeof metadata.name === 'string' ? metadata.name : null);

    return candidate && candidate.trim().length > 0 ? candidate.trim() : null;
  }

  private isSingleActiveBrandOwnerViolation(
    error: { message?: string | null } | null | undefined,
  ): boolean {
    return (error?.message ?? '').includes(
      MembersService.SINGLE_ACTIVE_BRAND_OWNER_CONSTRAINT,
    );
  }

  private throwBrandMemberMutationError(
    error: { message?: string | null } | null | undefined,
    operation: 'members.addBrandMember' | 'members.updateBrandMember',
  ): never {
    if (this.isSingleActiveBrandOwnerViolation(error)) {
      throw new BadRequestException(
        '브랜드당 활성 오너는 1명만 지정할 수 있습니다. 기존 오너 권한을 먼저 변경해주세요.',
      );
    }

    throw new Error(`[${operation}] ${error?.message ?? 'unknown error'}`);
  }

  // ============================================================
  // Brand Members
  // ============================================================

  async getPendingApprovalUsers(
    currentUserId: string,
  ): Promise<PendingApprovalUserResponse[]> {
    const admin = this.supabase.adminClient();

    const [profilesResult, brandMembersResult, branchMembersResult, authUsers] =
      await Promise.all([
        admin
          .from('profiles')
          .select('id, display_name, created_at, is_system_admin'),
        admin.from('brand_members').select('user_id'),
        admin.from('branch_members').select('user_id'),
        this.listAllAuthUsers(),
      ]);

    if (profilesResult.error) {
      throw new Error(
        `[members.getPendingApprovalUsers] ${profilesResult.error.message}`,
      );
    }

    if (brandMembersResult.error) {
      throw new Error(
        `[members.getPendingApprovalUsers] ${brandMembersResult.error.message}`,
      );
    }

    if (branchMembersResult.error) {
      throw new Error(
        `[members.getPendingApprovalUsers] ${branchMembersResult.error.message}`,
      );
    }

    const profiles = profilesResult.data ?? [];
    const profileMap = new Map(
      profiles.map((profile: any) => [profile.id, profile] as const),
    );
    const excludedUserIds = new Set<string>([currentUserId]);

    for (const member of brandMembersResult.data ?? []) {
      if (member?.user_id) excludedUserIds.add(member.user_id);
    }

    for (const member of branchMembersResult.data ?? []) {
      if (member?.user_id) excludedUserIds.add(member.user_id);
    }

    for (const profile of profiles) {
      if (profile?.is_system_admin && profile?.id) {
        excludedUserIds.add(profile.id);
      }
    }

    return authUsers
      .filter((user) => !excludedUserIds.has(user.id))
      .map((user) => {
        const profile = profileMap.get(user.id);
        const emailConfirmedAt =
          (user as any).email_confirmed_at ??
          (user as any).confirmed_at ??
          null;
        const createdAt =
          user.created_at ?? profile?.created_at ?? new Date(0).toISOString();

        return {
          id: user.id,
          email: user.email ?? null,
          displayName: this.resolvePendingUserDisplayName(profile, user),
          createdAt,
          emailConfirmedAt,
          isEmailConfirmed: Boolean(emailConfirmedAt),
        };
      })
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      );
  }

  async updateMemberProfile(
    accessToken: string,
    userId: string,
    dto: UpdateMemberProfileRequest,
    isAdmin?: boolean,
  ): Promise<MemberProfileResponse> {
    const sb = this.getClient(accessToken, isAdmin);
    const displayName = dto.displayName?.trim() ?? '';
    const normalizedDisplayName = displayName.length > 0 ? displayName : null;

    await this.syncAuthDisplayName(userId, normalizedDisplayName);

    const { data, error } = await sb
      .from('profiles')
      .upsert(
        {
          id: userId,
          display_name: normalizedDisplayName,
        },
        { onConflict: 'id' },
      )
      .select('id, display_name')
      .single();

    if (error) {
      throw new Error(`[members.updateMemberProfile] ${error.message}`);
    }

    return {
      id: data.id,
      displayName: data.display_name ?? null,
    };
  }

  /**
   * 브랜드 멤버 목록 조회
   */
  async getBrandMembers(
    accessToken: string,
    brandId: string,
    isAdmin?: boolean,
  ): Promise<BrandMemberResponse[]> {
    const sb = this.getClient(accessToken, isAdmin);

    const { data, error } = await sb
      .from('brand_members')
      .select(
        `
        brand_id,
        user_id,
        role,
        status,
        created_at,
        profiles (
          id,
          display_name
        )
      `,
      )
      .eq('brand_id', brandId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`[members.getBrandMembers] ${error.message}`);
    }

    const userIds = (data ?? [])
      .map((row: any) => row.user_id as string | null | undefined)
      .filter((userId): userId is string => Boolean(userId));
    const emailMap = await this.getAuthEmailMap(userIds);

    return (data ?? []).map((row: any) => ({
      id: `${row.brand_id}-${row.user_id}`,
      brandId: row.brand_id,
      userId: row.user_id,
      email: emailMap[row.user_id] ?? null,
      displayName: row.profiles?.display_name ?? null,
      role: row.role as BrandRole,
      status: row.status as MemberStatus,
      createdAt: row.created_at ?? '',
    }));
  }

  /**
   * 브랜드 멤버 초대 (이메일 기반)
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async inviteBrandMember(
    accessToken: string,
    dto: InviteBrandMemberRequest,
    _isAdmin?: boolean,
  ): Promise<BrandMemberResponse> {
    void accessToken;
    void dto;
    void _isAdmin;

    // 1. 이메일로 사용자를 찾는 초대 플로우는 아직 미구현
    // auth.users 조회 권한/정책 정리 후 구현 예정
    // 현재 버전에서는 userId 직접 추가만 지원

    // profiles 기반 이메일 검색 미구현
    // 현재는 userId를 직접 입력받는 방식으로 우회

    throw new BadRequestException(
      '이메일 초대 기능은 아직 구현되지 않았습니다. 현재는 사용자 ID로 직접 추가해주세요.',
    );
  }

  /**
   * 브랜드 멤버 추가 (userId 직접 입력)
   */
  async addBrandMember(
    accessToken: string,
    brandId: string,
    userId: string,
    role: BrandRole = BrandRole.MEMBER,
    isAdmin?: boolean,
  ): Promise<BrandMemberResponse> {
    const sb = this.getClient(accessToken, isAdmin);

    // 이미 멤버인지 확인
    const { data: existing } = await sb
      .from('brand_members')
      .select('user_id')
      .eq('brand_id', brandId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException('이미 브랜드 멤버입니다.');
    }

    // 멤버 추가
    const { data, error } = await sb
      .from('brand_members')
      .insert({
        brand_id: brandId,
        user_id: userId,
        role,
        status: MemberStatus.ACTIVE,
      })
      .select('brand_id, user_id, role, status, created_at')
      .single();

    if (error) {
      this.throwBrandMemberMutationError(error, 'members.addBrandMember');
    }

    return {
      id: `${data.brand_id}-${data.user_id}`,
      brandId: data.brand_id,
      userId: data.user_id,
      email: null,
      displayName: null,
      role: data.role as BrandRole,
      status: data.status as MemberStatus,
      createdAt: data.created_at ?? '',
    };
  }

  /**
   * 브랜드 멤버 수정 (역할/상태)
   */
  async updateBrandMember(
    accessToken: string,
    brandId: string,
    userId: string,
    dto: UpdateBrandMemberRequest,
    isAdmin?: boolean,
  ): Promise<BrandMemberResponse> {
    const sb = this.getClient(accessToken, isAdmin);

    const updateData: any = {};
    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.status !== undefined) updateData.status = dto.status;

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('수정할 내용이 없습니다.');
    }

    const { data, error } = await sb
      .from('brand_members')
      .update(updateData)
      .eq('brand_id', brandId)
      .eq('user_id', userId)
      .select('brand_id, user_id, role, status, created_at')
      .maybeSingle();

    if (error) {
      this.throwBrandMemberMutationError(error, 'members.updateBrandMember');
    }

    if (!data) {
      throw new NotFoundException('멤버를 찾을 수 없습니다.');
    }

    return {
      id: `${data.brand_id}-${data.user_id}`,
      brandId: data.brand_id,
      userId: data.user_id,
      email: null,
      displayName: null,
      role: data.role as BrandRole,
      status: data.status as MemberStatus,
      createdAt: data.created_at ?? '',
    };
  }

  /**
   * 브랜드 멤버 삭제
   */
  async removeBrandMember(
    accessToken: string,
    brandId: string,
    userId: string,
    isAdmin?: boolean,
  ): Promise<{ deleted: boolean }> {
    const sb = this.getClient(accessToken, isAdmin);

    const { error } = await sb
      .from('brand_members')
      .delete()
      .eq('brand_id', brandId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`[members.removeBrandMember] ${error.message}`);
    }

    return { deleted: true };
  }

  // ============================================================
  // Branch Members
  // ============================================================

  /**
   * 지점 멤버 목록 조회
   */
  async getBranchMembers(
    accessToken: string,
    branchId: string,
    isAdmin?: boolean,
  ): Promise<BranchMemberResponse[]> {
    const sb = this.getClient(accessToken, isAdmin);

    const { data, error } = await sb
      .from('branch_members')
      .select(
        `
        branch_id,
        user_id,
        role,
        status,
        created_at,
        profiles (
          id,
          display_name
        )
      `,
      )
      .eq('branch_id', branchId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`[members.getBranchMembers] ${error.message}`);
    }

    const userIds = (data ?? [])
      .map((row: any) => row.user_id as string | null | undefined)
      .filter((userId): userId is string => Boolean(userId));
    const emailMap = await this.getAuthEmailMap(userIds);

    return (data ?? []).map((row: any) => ({
      id: `${row.branch_id}-${row.user_id}`,
      branchId: row.branch_id,
      userId: row.user_id,
      email: emailMap[row.user_id] ?? null,
      displayName: row.profiles?.display_name ?? null,
      role: row.role as BranchRole,
      status: row.status as MemberStatus,
      createdAt: row.created_at ?? '',
    }));
  }

  /**
   * 지점 멤버 추가
   */
  async addBranchMember(
    accessToken: string,
    dto: AddBranchMemberRequest,
    isAdmin?: boolean,
  ): Promise<BranchMemberResponse> {
    const sb = this.getClient(accessToken, isAdmin);

    // 이미 멤버인지 확인
    const { data: existing } = await sb
      .from('branch_members')
      .select('user_id')
      .eq('branch_id', dto.branchId)
      .eq('user_id', dto.userId)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException('이미 지점 멤버입니다.');
    }

    // 멤버 추가
    const { data, error } = await sb
      .from('branch_members')
      .insert({
        branch_id: dto.branchId,
        user_id: dto.userId,
        role: dto.role ?? BranchRole.STAFF,
        status: MemberStatus.ACTIVE,
      })
      .select('branch_id, user_id, role, status, created_at')
      .single();

    if (error) {
      throw new Error(`[members.addBranchMember] ${error.message}`);
    }

    return {
      id: `${data.branch_id}-${data.user_id}`,
      branchId: data.branch_id,
      userId: data.user_id,
      email: null,
      displayName: null,
      role: data.role as BranchRole,
      status: data.status as MemberStatus,
      createdAt: data.created_at ?? '',
    };
  }

  /**
   * 지점 멤버 수정
   */
  async updateBranchMember(
    accessToken: string,
    branchId: string,
    userId: string,
    dto: UpdateBranchMemberRequest,
    isAdmin?: boolean,
  ): Promise<BranchMemberResponse> {
    const sb = this.getClient(accessToken, isAdmin);

    const updateData: any = {};
    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.status !== undefined) updateData.status = dto.status;

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('수정할 내용이 없습니다.');
    }

    const { data, error } = await sb
      .from('branch_members')
      .update(updateData)
      .eq('branch_id', branchId)
      .eq('user_id', userId)
      .select('branch_id, user_id, role, status, created_at')
      .maybeSingle();

    if (error) {
      throw new Error(`[members.updateBranchMember] ${error.message}`);
    }

    if (!data) {
      throw new NotFoundException('멤버를 찾을 수 없습니다.');
    }

    return {
      id: `${data.branch_id}-${data.user_id}`,
      branchId: data.branch_id,
      userId: data.user_id,
      email: null,
      displayName: null,
      role: data.role as BranchRole,
      status: data.status as MemberStatus,
      createdAt: data.created_at ?? '',
    };
  }

  /**
   * 지점 멤버 삭제
   */
  async removeBranchMember(
    accessToken: string,
    branchId: string,
    userId: string,
    isAdmin?: boolean,
  ): Promise<{ deleted: boolean }> {
    const sb = this.getClient(accessToken, isAdmin);

    const { error } = await sb
      .from('branch_members')
      .delete()
      .eq('branch_id', branchId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`[members.removeBranchMember] ${error.message}`);
    }

    return { deleted: true };
  }
}
