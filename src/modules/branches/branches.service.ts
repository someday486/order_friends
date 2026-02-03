import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { BranchListItemResponse, BranchDetailResponse } from './dto/branch.response';
import { CreateBranchRequest, UpdateBranchRequest } from './dto/branch.request';

@Injectable()
export class BranchesService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * 가게 목록 조회 (브랜드 기준)
   */
  async getBranches(accessToken: string, brandId: string): Promise<BranchListItemResponse[]> {
    const sb = this.supabase.userClient(accessToken);

    const { data, error } = await sb
      .from('branches')
      .select('id, brand_id, name, slug, created_at')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`[branches.getBranches] ${error.message}`);
    }

    return (data ?? []).map((row: any) => ({
      id: row.id,
      brandId: row.brand_id,
      name: row.name,
      slug: row.slug ?? '',
      createdAt: row.created_at ?? '',
    }));
  }

  /**
   * 가게 상세 조회
   */
  async getBranch(accessToken: string, branchId: string): Promise<BranchDetailResponse> {
    const sb = this.supabase.userClient(accessToken);

    const { data, error } = await sb
      .from('branches')
      .select('id, brand_id, name, slug, created_at')
      .eq('id', branchId)
      .single();

    if (error) {
      throw new NotFoundException(`[branches.getBranch] ${error.message}`);
    }

    if (!data) {
      throw new NotFoundException('가게를 찾을 수 없습니다.');
    }

    return {
      id: data.id,
      brandId: data.brand_id,
      name: data.name,
      slug: data.slug ?? '',
      createdAt: data.created_at ?? '',
    };
  }

  /**
   * 가게 생성
   */
  async createBranch(accessToken: string, dto: CreateBranchRequest): Promise<BranchDetailResponse> {
    const sb = this.supabase.userClient(accessToken);

    const { data, error } = await sb
      .from('branches')
      .insert({
        brand_id: dto.brandId,
        name: dto.name,
        slug: dto.slug,
      })
      .select('id, brand_id, name, slug, created_at')
      .single();

    if (error) {
      // (brand_id, slug) 유니크 인덱스 충돌
      if ((error as any).code === '23505') {
        throw new ConflictException('이미 사용 중인 가게 URL(slug)입니다.');
      }
      throw new Error(`[branches.createBranch] ${error.message}`);
    }


    return {
      id: data.id,
      brandId: data.brand_id,
      name: data.name,
      slug: data.slug ?? '',
      createdAt: data.created_at ?? '',
    };
  }

  /**
   * 가게 수정
   */
  async updateBranch(
    accessToken: string,
    branchId: string,
    dto: UpdateBranchRequest,
  ): Promise<BranchDetailResponse> {
    const sb = this.supabase.userClient(accessToken);

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;

    if (Object.keys(updateData).length === 0) {
      return this.getBranch(accessToken, branchId);
    }

    const { data, error } = await sb
      .from('branches')
      .update(updateData)
      .eq('id', branchId)
      .select('id, brand_id, name, slug, created_at')
      .maybeSingle();

    if (error) {
      throw new Error(`[branches.updateBranch] ${error.message}`);
    }

    if (!data) {
      throw new NotFoundException('가게를 찾을 수 없거나 권한이 없습니다.');
    }

    return {
      id: data.id,
      brandId: data.brand_id,
      name: data.name,
      slug: data.slug ?? '',
      createdAt: data.created_at ?? '',
    };
  }

  /**
   * 가게 삭제
   */
  async deleteBranch(accessToken: string, branchId: string): Promise<{ deleted: boolean }> {
    const sb = this.supabase.userClient(accessToken);

    const { error } = await sb
      .from('branches')
      .delete()
      .eq('id', branchId);

    if (error) {
      throw new Error(`[branches.deleteBranch] ${error.message}`);
    }

    return { deleted: true };
  }
}
