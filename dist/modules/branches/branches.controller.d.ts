import { BranchesService } from './branches.service';
import { CreateBranchRequest, UpdateBranchRequest } from './dto/branch.request';
import type { AuthRequest } from '../../common/types/auth-request';
export declare class BranchesController {
    private readonly branchesService;
    constructor(branchesService: BranchesService);
    getBranches(req: AuthRequest, brandId: string): Promise<import("./dto/branch.response").BranchListItemResponse[]>;
    getBranch(req: AuthRequest, branchId: string): Promise<import("./dto/branch.response").BranchDetailResponse>;
    createBranch(dto: CreateBranchRequest, req: AuthRequest): Promise<import("./dto/branch.response").BranchDetailResponse>;
    updateBranch(req: AuthRequest, branchId: string, dto: UpdateBranchRequest): Promise<import("./dto/branch.response").BranchDetailResponse>;
    deleteBranch(req: AuthRequest, branchId: string): Promise<{
        deleted: boolean;
    }>;
}
