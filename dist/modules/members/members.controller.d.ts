import type { AuthRequest } from '../../common/types/auth-request';
import { MembersService } from './members.service';
import { BrandRole, UpdateBrandMemberRequest, AddBranchMemberRequest, UpdateBranchMemberRequest } from './dto/member.dto';
export declare class MembersController {
    private readonly membersService;
    constructor(membersService: MembersService);
    getBrandMembers(req: AuthRequest, brandId: string): Promise<import("./dto/member.dto").BrandMemberResponse[]>;
    addBrandMember(req: AuthRequest, brandId: string, body: {
        userId: string;
        role?: BrandRole;
    }): Promise<import("./dto/member.dto").BrandMemberResponse>;
    updateBrandMember(req: AuthRequest, brandId: string, userId: string, dto: UpdateBrandMemberRequest): Promise<import("./dto/member.dto").BrandMemberResponse>;
    removeBrandMember(req: AuthRequest, brandId: string, userId: string): Promise<{
        deleted: boolean;
    }>;
    getBranchMembers(req: AuthRequest, branchId: string): Promise<import("./dto/member.dto").BranchMemberResponse[]>;
    addBranchMember(req: AuthRequest, dto: AddBranchMemberRequest): Promise<import("./dto/member.dto").BranchMemberResponse>;
    updateBranchMember(req: AuthRequest, branchId: string, userId: string, dto: UpdateBranchMemberRequest): Promise<import("./dto/member.dto").BranchMemberResponse>;
    removeBranchMember(req: AuthRequest, branchId: string, userId: string): Promise<{
        deleted: boolean;
    }>;
}
