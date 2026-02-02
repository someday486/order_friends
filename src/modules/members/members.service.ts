import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
} from './dto/member.dto';

@Injectable()
export class MembersService {
  constructor(private readonly supabase: SupabaseService) {}

  // ============================================================
  // Brand Members
  // ============================================================

  /**
   * 브랜드 멤버 목록 조회
   */
  async getBrandMembers(accessToken: string, brandId: string): Promise<BrandMemberResponse[]> {
    const sb = this.supabase.userClient(accessToken);

    const { data, error } = await sb
      .from('brand_members')
      .select(`
        brand_id,
        user_id,
        role,
        status,
        created_at,
        profiles (
          id,
          display_name
        )
      `)
      .eq('brand_id', brandId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`[members.getBrandMembers] ${error.message}`);
    }

    // 이메일 조회를 위해 user_id 목록 수집
    const userIds = (data ?? []).map((row: any) => row.user_id);
    
    // auth.users에서 이메일 조회 (service role 필요, 없으면 스킵)
    const emailMap: Record<string, string> = {};

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
   * 브랜드 멤버 초대 (이메일로)
   */
  async inviteBrandMember(
    accessToken: string,
    dto: InviteBrandMemberRequest,
  ): Promise<BrandMemberResponse> {
    const sb = this.supabase.userClient(accessToken);

    // 1. 이메일로 사용자 찾기 (profiles 테이블에 없으면 초대 불가)
    // 실제로는 auth.users를 조회해야 하지만 RLS 제한으로 profiles 기준
    // 또는 초대 이메일 발송 로직 필요 - 여기서는 간단히 처리
    
    // profiles에서 이메일로 사용자 찾기 (phone 필드를 임시로 사용하거나 별도 로직 필요)
    // 현재는 userId를 직접 입력받는 방식으로 우회

    throw new BadRequestException(
      '이메일 초대 기능은 추후 구현 예정입니다. 현재는 사용자 ID로 직접 추가해주세요.',
    );
  }

  /**
   * 브랜드 멤버 추가 (userId로 직접)
   */
  async addBrandMember(
    accessToken: string,
    brandId: string,
    userId: string,
    role: BrandRole = BrandRole.MEMBER,
  ): Promise<BrandMemberResponse> {
    const sb = this.supabase.userClient(accessToken);

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
      throw new Error(`[members.addBrandMember] ${error.message}`);
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
  ): Promise<BrandMemberResponse> {
    const sb = this.supabase.userClient(accessToken);

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
      throw new Error(`[members.updateBrandMember] ${error.message}`);
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
  ): Promise<{ deleted: boolean }> {
    const sb = this.supabase.userClient(accessToken);

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
   * 가게 멤버 목록 조회
   */
  async getBranchMembers(accessToken: string, branchId: string): Promise<BranchMemberResponse[]> {
    const sb = this.supabase.userClient(accessToken);

    const { data, error } = await sb
      .from('branch_members')
      .select(`
        branch_id,
        user_id,
        role,
        status,
        created_at,
        profiles (
          id,
          display_name
        )
      `)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`[members.getBranchMembers] ${error.message}`);
    }

    return (data ?? []).map((row: any) => ({
      id: `${row.branch_id}-${row.user_id}`,
      branchId: row.branch_id,
      userId: row.user_id,
      email: null,
      displayName: row.profiles?.display_name ?? null,
      role: row.role as BranchRole,
      status: row.status as MemberStatus,
      createdAt: row.created_at ?? '',
    }));
  }

  /**
   * 가게 멤버 추가
   */
  async addBranchMember(
    accessToken: string,
    dto: AddBranchMemberRequest,
  ): Promise<BranchMemberResponse> {
    const sb = this.supabase.userClient(accessToken);

    // 이미 멤버인지 확인
    const { data: existing } = await sb
      .from('branch_members')
      .select('user_id')
      .eq('branch_id', dto.branchId)
      .eq('user_id', dto.userId)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException('이미 가게 멤버입니다.');
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
   * 가게 멤버 수정
   */
  async updateBranchMember(
    accessToken: string,
    branchId: string,
    userId: string,
    dto: UpdateBranchMemberRequest,
  ): Promise<BranchMemberResponse> {
    const sb = this.supabase.userClient(accessToken);

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
   * 가게 멤버 삭제
   */
  async removeBranchMember(
    accessToken: string,
    branchId: string,
    userId: string,
  ): Promise<{ deleted: boolean }> {
    const sb = this.supabase.userClient(accessToken);

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
