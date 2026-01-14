// src/auth/roles.ts
export type BrandRole = "OWNER" | "ADMIN" | "MANAGER" | "MEMBER";
export type BranchRole = "BRANCH_OWNER" | "BRANCH_ADMIN" | "STAFF" | "VIEWER";
export type MemberStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "LEFT";

export const isActive = (status: MemberStatus | null | undefined) =>
  status === "ACTIVE";
