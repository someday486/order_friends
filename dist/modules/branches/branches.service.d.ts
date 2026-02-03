import { SupabaseService } from '../../infra/supabase/supabase.service';
import { BranchListItemResponse, BranchDetailResponse } from './dto/branch.response';
import { CreateBranchRequest, UpdateBranchRequest } from './dto/branch.request';
export declare class BranchesService {
    private readonly supabase;
    constructor(supabase: SupabaseService);
    getBranches(accessToken: string, brandId: string): Promise<BranchListItemResponse[]>;
    getBranch(accessToken: string, branchId: string): Promise<BranchDetailResponse>;
    createBranch(accessToken: string, dto: CreateBranchRequest): Promise<BranchDetailResponse>;
    updateBranch(accessToken: string, branchId: string, dto: UpdateBranchRequest): Promise<BranchDetailResponse>;
    deleteBranch(accessToken: string, branchId: string): Promise<{
        deleted: boolean;
    }>;
}
