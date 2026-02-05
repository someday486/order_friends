import type { AuthRequest } from '../../common/types/auth-request';
import { CustomerBranchesService } from './customer-branches.service';
import { CreateBranchRequest, UpdateBranchRequest } from '../../modules/branches/dto/branch.request';
export declare class CustomerBranchesController {
    private readonly branchesService;
    private readonly logger;
    constructor(branchesService: CustomerBranchesService);
    getBranches(req: AuthRequest, brandId: string): Promise<{
        id: any;
        brandId: any;
        name: any;
        slug: any;
        createdAt: any;
        myRole: string | null;
    }[]>;
    getBranch(req: AuthRequest, branchId: string): Promise<{
        id: any;
        brandId: any;
        name: any;
        slug: any;
        createdAt: any;
        myRole: string | undefined;
    }>;
    createBranch(req: AuthRequest, dto: CreateBranchRequest): Promise<{
        id: any;
        brandId: any;
        name: any;
        slug: any;
        createdAt: any;
        myRole: string;
    }>;
    updateBranch(req: AuthRequest, branchId: string, dto: UpdateBranchRequest): Promise<{
        id: any;
        brandId: any;
        name: any;
        slug: any;
        createdAt: any;
        myRole: string | undefined;
    }>;
    deleteBranch(req: AuthRequest, branchId: string): Promise<{
        deleted: boolean;
    }>;
}
