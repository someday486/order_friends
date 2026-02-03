import { SupabaseService } from '../../infra/supabase/supabase.service';
import { BranchListItemResponse, BranchDetailResponse } from './dto/branch.response';
import { CreateBranchRequest, UpdateBranchRequest } from './dto/branch.request';
export declare class BranchesService {
    private readonly supabase;
    constructor(supabase: SupabaseService);
    private getClient;
    getBranches(accessToken: string, brandId: string, isAdmin?: boolean): Promise<BranchListItemResponse[]>;
    getBranch(accessToken: string, branchId: string, isAdmin?: boolean): Promise<BranchDetailResponse>;
    createBranch(accessToken: string, dto: CreateBranchRequest, isAdmin?: boolean): Promise<BranchDetailResponse>;
    updateBranch(accessToken: string, branchId: string, dto: UpdateBranchRequest, isAdmin?: boolean): Promise<BranchDetailResponse>;
    deleteBranch(accessToken: string, branchId: string, isAdmin?: boolean): Promise<{
        deleted: boolean;
    }>;
}
