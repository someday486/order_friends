// src/auth/authorize.ts
import { BRAND_ACTIONS, BRANCH_ACTIONS, type Action, type BrandAction, type BranchAction } from "./actions";
import { BRAND_POLICY, BRANCH_POLICY } from "./policy";
import { isActive, type BrandRole, type BranchRole, type MemberStatus } from "./roles";

// DB row shapes (Supabase select 결과에 맞춰 최소 필드만)
type BrandMemberRow = {
  role: BrandRole;
  status: MemberStatus;
};

type BranchMemberRow = {
  role: BranchRole;
  status: MemberStatus;
};

type BranchRow = {
  brand_id: string;
};

// Supabase client를 직접 주입받는 형태(Edge Function/서버 어디서든 사용 가능)
export type SupabaseLike = {
  from: (table: string) => {
    select: (cols: string) => any;
    eq: (col: string, value: any) => any;
    maybeSingle: () => Promise<{ data: any; error: any }>;
    single: () => Promise<{ data: any; error: any }>;
  };
};

export type AuthorizeResult =
  | { ok: true; scope: "brand" | "branch"; effectiveRole: BrandRole | BranchRole }
  | { ok: false; reason: "NOT_MEMBER" | "INACTIVE" | "FORBIDDEN" | "NOT_FOUND" | "DB_ERROR" };

function includesRole<T extends string>(allowed: readonly T[], role: T) {
  return allowed.includes(role);
}

// Brand role → Branch effective role 매핑(확정안)
function brandToEffectiveBranchRole(brandRole: BrandRole): BranchRole | null {
  if (brandRole === "OWNER" || brandRole === "ADMIN") return "BRANCH_ADMIN";
  if (brandRole === "MANAGER") return "STAFF";
  return null; // MEMBER는 대체 없음
}

/**
 * Brand 범위 권한 체크
 */
async function authorizeBrand(
  sb: SupabaseLike,
  userId: string,
  brandId: string,
  action: BrandAction
): Promise<AuthorizeResult> {
  const { data, error } = await sb
    .from("brand_members")
    .select("role,status")
    .eq("brand_id", brandId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { ok: false, reason: "DB_ERROR" };
  if (!data) return { ok: false, reason: "NOT_MEMBER" };

  const member = data as BrandMemberRow;
  if (!isActive(member.status)) return { ok: false, reason: "INACTIVE" };

  const allowed = BRAND_POLICY[action];
  if (!includesRole(allowed, member.role)) return { ok: false, reason: "FORBIDDEN" };

  return { ok: true, scope: "brand", effectiveRole: member.role };
}

/**
 * Branch 범위 권한 체크
 * 우선: branch_members(ACTIVE) → 없으면 brand_members(ACTIVE)로 effective role 계산
 */
async function authorizeBranch(
  sb: SupabaseLike,
  userId: string,
  branchId: string,
  action: BranchAction
): Promise<AuthorizeResult> {
  // 1) Branch membership 우선
  const bm = await sb
    .from("branch_members")
    .select("role,status")
    .eq("branch_id", branchId)
    .eq("user_id", userId)
    .maybeSingle();

  if (bm.error) return { ok: false, reason: "DB_ERROR" };

  if (bm.data) {
    const member = bm.data as BranchMemberRow;
    if (!isActive(member.status)) return { ok: false, reason: "INACTIVE" };

    const allowed = BRANCH_POLICY[action];
    if (!includesRole(allowed, member.role)) return { ok: false, reason: "FORBIDDEN" };

    return { ok: true, scope: "branch", effectiveRole: member.role };
  }

  // 2) branch → brand_id 조회
  const br = await sb
    .from("branches")
    .select("brand_id")
    .eq("id", branchId)
    .maybeSingle();

  if (br.error) return { ok: false, reason: "DB_ERROR" };
  if (!br.data) return { ok: false, reason: "NOT_FOUND" };

  const branch = br.data as BranchRow;

  // 3) Brand membership으로 effective role 계산
  const brandMem = await sb
    .from("brand_members")
    .select("role,status")
    .eq("brand_id", branch.brand_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (brandMem.error) return { ok: false, reason: "DB_ERROR" };
  if (!brandMem.data) return { ok: false, reason: "NOT_MEMBER" };

  const m = brandMem.data as BrandMemberRow;
  if (!isActive(m.status)) return { ok: false, reason: "INACTIVE" };

  const effective = brandToEffectiveBranchRole(m.role);
  if (!effective) return { ok: false, reason: "FORBIDDEN" };

  const allowed = BRANCH_POLICY[action];
  if (!includesRole(allowed, effective)) return { ok: false, reason: "FORBIDDEN" };

  return { ok: true, scope: "branch", effectiveRole: effective };
}

/**
 * Unified authorize entrypoint
 */
export async function authorize(
  sb: SupabaseLike,
  input: { userId: string; brandId?: string; branchId?: string; action: Action }
): Promise<AuthorizeResult> {
  const { userId, brandId, branchId, action } = input;

  if (BRAND_ACTIONS.has(action as any)) {
    if (!brandId) return { ok: false, reason: "NOT_FOUND" };
    return authorizeBrand(sb, userId, brandId, action as BrandAction);
  }

  if (BRANCH_ACTIONS.has(action as any)) {
    if (!branchId) return { ok: false, reason: "NOT_FOUND" };
    return authorizeBranch(sb, userId, branchId, action as BranchAction);
  }

  return { ok: false, reason: "FORBIDDEN" };
}
