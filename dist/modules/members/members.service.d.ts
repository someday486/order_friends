import { SupabaseService } from '../../infra/supabase/supabase.service';
import { BrandMemberResponse, BranchMemberResponse, BrandRole, InviteBrandMemberRequest, UpdateBrandMemberRequest, AddBranchMemberRequest, UpdateBranchMemberRequest } from './dto/member.dto';
export declare class MembersService {
    private readonly supabase;
    constructor(supabase: SupabaseService);
    getBrandMembers(accessToken: string, brandId: string): Promise<BrandMemberResponse[]>;
    inviteBrandMember(accessToken: string, dto: InviteBrandMemberRequest): Promise<BrandMemberResponse>;
    addBrandMember(accessToken: string, brandId: string, userId: string, role?: BrandRole): Promise<BrandMemberResponse>;
    updateBrandMember(accessToken: string, brandId: string, userId: string, dto: UpdateBrandMemberRequest): Promise<BrandMemberResponse>;
    removeBrandMember(accessToken: string, brandId: string, userId: string): Promise<{
        deleted: boolean;
    }>;
    getBranchMembers(accessToken: string, branchId: string): Promise<BranchMemberResponse[]>;
    addBranchMember(accessToken: string, dto: AddBranchMemberRequest): Promise<BranchMemberResponse>;
    updateBranchMember(accessToken: string, branchId: string, userId: string, dto: UpdateBranchMemberRequest): Promise<BranchMemberResponse>;
    removeBranchMember(accessToken: string, branchId: string, userId: string): Promise<{
        deleted: boolean;
    }>;
}
