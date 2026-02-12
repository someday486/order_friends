import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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

  private getClient(accessToken: string, isAdmin?: boolean) {
    return isAdmin
      ? this.supabase.adminClient()
      : this.supabase.userClient(accessToken);
  }

  // ============================================================
  // Brand Members
  // ============================================================

  /**
   * 釉뚮옖??硫ㅻ쾭 紐⑸줉 議고쉶
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

    // ?대찓??議고쉶瑜??꾪빐 user_id 紐⑸줉 ?섏쭛

    // auth.users?먯꽌 ?대찓??議고쉶 (service role ?꾩슂, ?놁쑝硫??ㅽ궢)
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
   * 釉뚮옖??硫ㅻ쾭 珥덈? (?대찓?쇰줈)
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

    // 1. ?대찓?쇰줈 ?ъ슜??李얘린 (profiles ?뚯씠釉붿뿉 ?놁쑝硫?珥덈? 遺덇?)
    // ?ㅼ젣濡쒕뒗 auth.users瑜?議고쉶?댁빞 ?섏?留?RLS ?쒗븳?쇰줈 profiles 湲곗?
    // ?먮뒗 珥덈? ?대찓??諛쒖넚 濡쒖쭅 ?꾩슂 - ?ш린?쒕뒗 媛꾨떒??泥섎━

    // profiles?먯꽌 ?대찓?쇰줈 ?ъ슜??李얘린 (phone ?꾨뱶瑜??꾩떆濡??ъ슜?섍굅??蹂꾨룄 濡쒖쭅 ?꾩슂)
    // ?꾩옱??userId瑜?吏곸젒 ?낅젰諛쏅뒗 諛⑹떇?쇰줈 ?고쉶

    throw new BadRequestException(
      '?대찓??珥덈? 湲곕뒫? 異뷀썑 援ы쁽 ?덉젙?낅땲?? ?꾩옱???ъ슜??ID濡?吏곸젒 異붽??댁＜?몄슂.',
    );
  }

  /**
   * 釉뚮옖??硫ㅻ쾭 異붽? (userId濡?吏곸젒)
   */
  async addBrandMember(
    accessToken: string,
    brandId: string,
    userId: string,
    role: BrandRole = BrandRole.MEMBER,
    isAdmin?: boolean,
  ): Promise<BrandMemberResponse> {
    const sb = this.getClient(accessToken, isAdmin);

    // ?대? 硫ㅻ쾭?몄? ?뺤씤
    const { data: existing } = await sb
      .from('brand_members')
      .select('user_id')
      .eq('brand_id', brandId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException('?대? 釉뚮옖??硫ㅻ쾭?낅땲??');
    }

    // 硫ㅻ쾭 異붽?
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
   * 釉뚮옖??硫ㅻ쾭 ?섏젙 (??븷/?곹깭)
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
      throw new BadRequestException('?섏젙???댁슜???놁뒿?덈떎.');
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
      throw new NotFoundException('硫ㅻ쾭瑜?李얠쓣 ???놁뒿?덈떎.');
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
   * 釉뚮옖??硫ㅻ쾭 ??젣
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
   * 媛寃?硫ㅻ쾭 紐⑸줉 議고쉶
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
   * 媛寃?硫ㅻ쾭 異붽?
   */
  async addBranchMember(
    accessToken: string,
    dto: AddBranchMemberRequest,
    isAdmin?: boolean,
  ): Promise<BranchMemberResponse> {
    const sb = this.getClient(accessToken, isAdmin);

    // ?대? 硫ㅻ쾭?몄? ?뺤씤
    const { data: existing } = await sb
      .from('branch_members')
      .select('user_id')
      .eq('branch_id', dto.branchId)
      .eq('user_id', dto.userId)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException('?대? 媛寃?硫ㅻ쾭?낅땲??');
    }

    // 硫ㅻ쾭 異붽?
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
   * 媛寃?硫ㅻ쾭 ?섏젙
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
      throw new BadRequestException('?섏젙???댁슜???놁뒿?덈떎.');
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
      throw new NotFoundException('硫ㅻ쾭瑜?李얠쓣 ???놁뒿?덈떎.');
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
   * 媛寃?硫ㅻ쾭 ??젣
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
