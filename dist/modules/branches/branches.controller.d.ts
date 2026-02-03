import { BranchesService } from './branches.service';
import { CreateBranchRequest, UpdateBranchRequest } from './dto/branch.request';
export declare class BranchesController {
    private readonly branchesService;
    constructor(branchesService: BranchesService);
    getBranches(authHeader: string, brandId: string): Promise<import("./dto/branch.response").BranchListItemResponse[]>;
    getBranch(authHeader: string, branchId: string): Promise<import("./dto/branch.response").BranchDetailResponse>;
    createBranch(authHeader: string, dto: CreateBranchRequest): Promise<import("./dto/branch.response").BranchDetailResponse>;
    updateBranch(authHeader: string, branchId: string, dto: UpdateBranchRequest): Promise<import("./dto/branch.response").BranchDetailResponse>;
    deleteBranch(authHeader: string, branchId: string): Promise<{
        deleted: boolean;
    }>;
}
