import { SupabaseService } from '../../infra/supabase/supabase.service';
import { BrandMemberResponse, BranchMemberResponse, BrandRole, InviteBrandMemberRequest, UpdateBrandMemberRequest, AddBranchMemberRequest, UpdateBranchMemberRequest } from './dto/member.dto';
export declare class MembersService {
    private readonly supabase;
    constructor(supabase: SupabaseService);
    private getClient;
    getBrandMembers(accessToken: string, brandId: string, isAdmin?: boolean): Promise<BrandMemberResponse[]>;
    inviteBrandMember(accessToken: string, dto: InviteBrandMemberRequest, _isAdmin?: boolean): Promise<BrandMemberResponse>;
    addBrandMember(accessToken: string, brandId: string, userId: string, role?: BrandRole, isAdmin?: boolean): Promise<BrandMemberResponse>;
    updateBrandMember(accessToken: string, brandId: string, userId: string, dto: UpdateBrandMemberRequest, isAdmin?: boolean): Promise<BrandMemberResponse>;
    removeBrandMember(accessToken: string, brandId: string, userId: string, isAdmin?: boolean): Promise<{
        deleted: boolean;
    }>;
    getBranchMembers(accessToken: string, branchId: string, isAdmin?: boolean): Promise<BranchMemberResponse[]>;
    addBranchMember(accessToken: string, dto: AddBranchMemberRequest, isAdmin?: boolean): Promise<BranchMemberResponse>;
    updateBranchMember(accessToken: string, branchId: string, userId: string, dto: UpdateBranchMemberRequest, isAdmin?: boolean): Promise<BranchMemberResponse>;
    removeBranchMember(accessToken: string, branchId: string, userId: string, isAdmin?: boolean): Promise<{
        deleted: boolean;
    }>;
}
