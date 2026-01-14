// src/auth/actions.ts
export type BrandAction =
  | "brand:read"
  | "brand:update"
  | "brand:branch_create"
  | "brand:member_manage";

export type BranchAction =
  | "branch:read"
  | "branch:update"
  | "branch:member_manage"
  | "branch:operate";

export type Action = BrandAction | BranchAction;

export const BRAND_ACTIONS = new Set<BrandAction>([
  "brand:read",
  "brand:update",
  "brand:branch_create",
  "brand:member_manage",
]);

export const BRANCH_ACTIONS = new Set<BranchAction>([
  "branch:read",
  "branch:update",
  "branch:member_manage",
  "branch:operate",
]);
