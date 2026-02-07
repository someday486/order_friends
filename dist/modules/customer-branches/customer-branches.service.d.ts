import { SupabaseService } from '../../infra/supabase/supabase.service';
import type { BrandMembership, BranchMembership } from '../../common/types/auth-request';
import { CreateBranchRequest, UpdateBranchRequest } from '../../modules/branches/dto/branch.request';
export declare class CustomerBranchesService {
    private readonly supabase;
    private readonly logger;
    constructor(supabase: SupabaseService);
    private checkBrandAccess;
    private checkBranchAccess;
    private checkModificationPermission;
    getMyBranches(userId: string, brandId: string, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<{
        id: any;
        brandId: any;
        name: any;
        slug: any;
        logoUrl: any;
        thumbnailUrl: any;
        createdAt: any;
        myRole: string | null;
    }[]>;
    getMyBranch(userId: string, branchId: string, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<{
        id: any;
        brandId: any;
        name: any;
        slug: any;
        logoUrl: any;
        coverImageUrl: any;
        thumbnailUrl: any;
        createdAt: any;
        myRole: string | undefined;
    }>;
    createMyBranch(userId: string, dto: CreateBranchRequest, brandMemberships: BrandMembership[]): Promise<{
        id: any;
        brandId: any;
        name: any;
        slug: any;
        logoUrl: any;
        coverImageUrl: any;
        thumbnailUrl: any;
        createdAt: any;
        myRole: string;
    }>;
    updateMyBranch(userId: string, branchId: string, dto: UpdateBranchRequest, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<{
        id: any;
        brandId: any;
        name: any;
        slug: any;
        logoUrl: any;
        coverImageUrl: any;
        thumbnailUrl: any;
        createdAt: any;
        myRole: string | undefined;
    }>;
    deleteMyBranch(userId: string, branchId: string, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<{
        deleted: boolean;
    }>;
}
