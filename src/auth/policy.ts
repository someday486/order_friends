// src/auth/policy.ts
import type { BrandRole, BranchRole } from "./roles";
import type { BrandAction, BranchAction } from "./actions";

// Brand action → 허용 role
export const BRAND_POLICY: Record<BrandAction, BrandRole[]> = {
  "brand:read": ["OWNER", "ADMIN", "MANAGER", "MEMBER"],
  "brand:update": ["OWNER", "ADMIN"],
  "brand:branch_create": ["OWNER", "ADMIN"],
  "brand:member_manage": ["OWNER", "ADMIN"],
};

// Branch action → 허용 role
export const BRANCH_POLICY: Record<BranchAction, BranchRole[]> = {
  "branch:read": ["BRANCH_OWNER", "BRANCH_ADMIN", "STAFF", "VIEWER"],
  "branch:update": ["BRANCH_OWNER", "BRANCH_ADMIN"],
  "branch:member_manage": ["BRANCH_OWNER", "BRANCH_ADMIN"],
  "branch:operate": ["BRANCH_OWNER", "BRANCH_ADMIN", "STAFF"],
};
