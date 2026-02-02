import { MembersService } from './members.service';
import { BrandRole, UpdateBrandMemberRequest, AddBranchMemberRequest, UpdateBranchMemberRequest } from './dto/member.dto';
export declare class MembersController {
    private readonly membersService;
    constructor(membersService: MembersService);
    getBrandMembers(authHeader: string, brandId: string): Promise<import("./dto/member.dto").BrandMemberResponse[]>;
    addBrandMember(authHeader: string, brandId: string, body: {
        userId: string;
        role?: BrandRole;
    }): Promise<import("./dto/member.dto").BrandMemberResponse>;
    updateBrandMember(authHeader: string, brandId: string, userId: string, dto: UpdateBrandMemberRequest): Promise<import("./dto/member.dto").BrandMemberResponse>;
    removeBrandMember(authHeader: string, brandId: string, userId: string): Promise<{
        deleted: boolean;
    }>;
    getBranchMembers(authHeader: string, branchId: string): Promise<import("./dto/member.dto").BranchMemberResponse[]>;
    addBranchMember(authHeader: string, dto: AddBranchMemberRequest): Promise<import("./dto/member.dto").BranchMemberResponse>;
    updateBranchMember(authHeader: string, branchId: string, userId: string, dto: UpdateBranchMemberRequest): Promise<import("./dto/member.dto").BranchMemberResponse>;
    removeBranchMember(authHeader: string, branchId: string, userId: string): Promise<{
        deleted: boolean;
    }>;
}
