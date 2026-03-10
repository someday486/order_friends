import { IsString, IsOptional, IsEnum } from 'class-validator';

// ============================================================
// Enums
// ============================================================

export enum BrandRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
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

export enum MemberScope {
  BRAND = 'brand',
  BRANCH = 'branch',
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

export class PendingApprovalUserResponse {
  id: string;
  email?: string | null;
  displayName?: string | null;
  createdAt: string;
  emailConfirmedAt?: string | null;
  isEmailConfirmed: boolean;
}

export class MemberProfileResponse {
  id: string;
  displayName?: string | null;
}

export class TransferMemberResponse {
  transferred: boolean;
  userId: string;
  sourceType: MemberScope;
  sourceId: string;
  targetType: MemberScope;
  targetId: string;
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

export class AddBrandMemberRequest {
  @IsString()
  userId: string;

  @IsEnum(BrandRole)
  @IsOptional()
  role?: BrandRole = BrandRole.MEMBER;
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

export class UpdateMemberProfileRequest {
  @IsString()
  @IsOptional()
  displayName?: string;
}

export class TransferMemberRequest {
  @IsString()
  userId: string;

  @IsEnum(MemberScope)
  sourceType: MemberScope;

  @IsString()
  sourceId: string;

  @IsEnum(MemberScope)
  targetType: MemberScope;

  @IsString()
  targetId: string;

  @IsEnum(BrandRole)
  @IsOptional()
  brandRole?: BrandRole = BrandRole.MEMBER;

  @IsEnum(BranchRole)
  @IsOptional()
  branchRole?: BranchRole = BranchRole.STAFF;
}
