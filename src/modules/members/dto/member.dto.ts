import { IsString, IsOptional, IsEnum } from 'class-validator';

// ============================================================
// Enums
// ============================================================

export enum BrandRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  MEMBER = 'MEMBER',
}

export enum BranchRole {
  BRANCH_OWNER = 'BRANCH_OWNER',
  BRANCH_ADMIN = 'BRANCH_ADMIN',
  STAFF = 'STAFF',
  VIEWER = 'VIEWER',
}

export enum MemberStatus {
  INVITED = 'INVITED',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  LEFT = 'LEFT',
}

// ============================================================
// Response DTOs
// ============================================================

export class BrandMemberResponse {
  id: string;
  brandId: string;
  userId: string;
  email?: string | null;
  displayName?: string | null;
  role: BrandRole;
  status: MemberStatus;
  createdAt: string;
}

export class BranchMemberResponse {
  id: string;
  branchId: string;
  userId: string;
  email?: string | null;
  displayName?: string | null;
  role: BranchRole;
  status: MemberStatus;
  createdAt: string;
}

// ============================================================
// Request DTOs
// ============================================================

export class InviteBrandMemberRequest {
  @IsString()
  brandId: string;

  @IsString()
  email: string;

  @IsEnum(BrandRole)
  @IsOptional()
  role?: BrandRole = BrandRole.MEMBER;
}

export class UpdateBrandMemberRequest {
  @IsEnum(BrandRole)
  @IsOptional()
  role?: BrandRole;

  @IsEnum(MemberStatus)
  @IsOptional()
  status?: MemberStatus;
}

export class AddBranchMemberRequest {
  @IsString()
  branchId: string;

  @IsString()
  userId: string;

  @IsEnum(BranchRole)
  @IsOptional()
  role?: BranchRole = BranchRole.STAFF;
}

export class UpdateBranchMemberRequest {
  @IsEnum(BranchRole)
  @IsOptional()
  role?: BranchRole;

  @IsEnum(MemberStatus)
  @IsOptional()
  status?: MemberStatus;
}
