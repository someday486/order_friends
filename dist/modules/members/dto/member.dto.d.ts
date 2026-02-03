export declare enum BrandRole {
    OWNER = "OWNER",
    ADMIN = "ADMIN",
    MANAGER = "MANAGER",
    MEMBER = "MEMBER"
}
export declare enum BranchRole {
    BRANCH_OWNER = "BRANCH_OWNER",
    BRANCH_ADMIN = "BRANCH_ADMIN",
    STAFF = "STAFF",
    VIEWER = "VIEWER"
}
export declare enum MemberStatus {
    INVITED = "INVITED",
    ACTIVE = "ACTIVE",
    SUSPENDED = "SUSPENDED",
    LEFT = "LEFT"
}
export declare class BrandMemberResponse {
    id: string;
    brandId: string;
    userId: string;
    email?: string | null;
    displayName?: string | null;
    role: BrandRole;
    status: MemberStatus;
    createdAt: string;
}
export declare class BranchMemberResponse {
    id: string;
    branchId: string;
    userId: string;
    email?: string | null;
    displayName?: string | null;
    role: BranchRole;
    status: MemberStatus;
    createdAt: string;
}
export declare class InviteBrandMemberRequest {
    brandId: string;
    email: string;
    role?: BrandRole;
}
export declare class UpdateBrandMemberRequest {
    role?: BrandRole;
    status?: MemberStatus;
}
export declare class AddBranchMemberRequest {
    branchId: string;
    userId: string;
    role?: BranchRole;
}
export declare class UpdateBranchMemberRequest {
    role?: BranchRole;
    status?: MemberStatus;
}
