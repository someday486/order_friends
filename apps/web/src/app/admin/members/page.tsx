"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api-client";
import { useSelectedBrand } from "@/hooks/useSelectedBrand";
import { useSelectedBranch } from "@/hooks/useSelectedBranch";
import BranchSelector from "@/components/admin/BranchSelector";
import Link from "next/link";

// ============================================================
// Types
// ============================================================

type BrandRole = "OWNER" | "ADMIN" | "MANAGER" | "MEMBER";
type BranchRole = "BRANCH_OWNER" | "BRANCH_ADMIN" | "STAFF" | "VIEWER";
type MemberStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "LEFT";

type BrandMember = {
  id: string;
  brandId: string;
  userId: string;
  email?: string | null;
  displayName?: string | null;
  role: BrandRole;
  status: MemberStatus;
  createdAt: string;
};

type BranchMember = {
  id: string;
  branchId: string;
  userId: string;
  email?: string | null;
  displayName?: string | null;
  role: BranchRole;
  status: MemberStatus;
  createdAt: string;
};

// ============================================================
// Constants
// ============================================================

const BRAND_ROLES: { value: BrandRole; label: string }[] = [
  { value: "OWNER", label: "오너" },
  { value: "ADMIN", label: "관리자" },
  { value: "MANAGER", label: "매니저" },
  { value: "MEMBER", label: "멤버" },
];

const BRANCH_ROLES: { value: BranchRole; label: string }[] = [
  { value: "BRANCH_OWNER", label: "점장" },
  { value: "BRANCH_ADMIN", label: "부점장" },
  { value: "STAFF", label: "스태프" },
  { value: "VIEWER", label: "뷰어" },
];

const STATUS_LABELS: Record<MemberStatus, string> = {
  INVITED: "초대중",
  ACTIVE: "활성",
  SUSPENDED: "정지",
  LEFT: "탈퇴",
};

// ============================================================
// Helpers
// ============================================================

// ============================================================
// Component
// ============================================================

function MembersPageContent() {
  const searchParams = useSearchParams();
  const initialTab = useMemo(() => searchParams?.get("tab") ?? "", [searchParams]);
  const initialBranchId = useMemo(() => searchParams?.get("branchId") ?? "", [searchParams]);

  const { brandId, ready: brandReady } = useSelectedBrand();
  const { branchId, selectBranch } = useSelectedBranch();
  const [tab, setTab] = useState<"brand" | "branch">("brand");

  useEffect(() => {
    if (initialTab === "branch" || initialTab === "brand") {
      setTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (initialBranchId) selectBranch(initialBranchId);
  }, [initialBranchId, selectBranch]);

  // Brand members
  const [brandMembers, setBrandMembers] = useState<BrandMember[]>([]);
  const [brandLoading, setBrandLoading] = useState(false);
  const [brandError, setBrandError] = useState<string | null>(null);

  // Branch members
  const [branchMembers, setBranchMembers] = useState<BranchMember[]>([]);
  const [branchLoading, setBranchLoading] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);

  // Add member form
  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState<string>("");
  const [adding, setAdding] = useState(false);

  // ============================================================
  // Brand Members
  // ============================================================

  const fetchBrandMembers = async () => {
    if (!brandId) return;

    try {
      setBrandLoading(true);
      setBrandError(null);

      const data = await apiClient.get<BrandMember[]>("/admin/members/brand/" + brandId);
      setBrandMembers(data);
    } catch (e: unknown) {
      setBrandError((e as Error)?.message ?? "브랜드 멤버 조회에 실패했습니다.");
    } finally {
      setBrandLoading(false);
    }
  };

  const addBrandMember = async () => {
    if (!brandId || !newUserId) return;

    try {
      setAdding(true);

      await apiClient.post("/admin/members/brand/" + brandId, {
        userId: newUserId,
        role: newRole || "MEMBER",
      });

      await fetchBrandMembers();
      setNewUserId("");
      setNewRole("");
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "멤버 추가에 실패했습니다.");
    } finally {
      setAdding(false);
    }
  };

  const updateBrandMemberRole = async (userId: string, role: BrandRole) => {
    try {
      await apiClient.patch("/admin/members/brand/" + brandId + "/" + userId, { role });

      setBrandMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, role } : m))
      );
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "권한 변경에 실패했습니다.");
    }
  };

  const removeBrandMember = async (userId: string) => {
    if (!confirm("해당 멤버를 삭제하시겠습니까?")) return;

    try {
      await apiClient.delete("/admin/members/brand/" + brandId + "/" + userId);
      setBrandMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "멤버 삭제에 실패했습니다.");
    }
  };

  // ============================================================
  // Branch Members
// ============================================================
  // Branch Members
  // ============================================================

  const fetchBranchMembers = async () => {
    if (!branchId) return;

    try {
      setBranchLoading(true);
      setBranchError(null);

      const data = await apiClient.get<BranchMember[]>("/admin/members/branch/" + branchId);
      setBranchMembers(data);
    } catch (e: unknown) {
      setBranchError((e as Error)?.message ?? "매장 멤버 조회에 실패했습니다.");
    } finally {
      setBranchLoading(false);
    }
  };

  const addBranchMember = async () => {
    if (!branchId || !newUserId) return;

    try {
      setAdding(true);

      await apiClient.post("/admin/members/branch", {
        branchId,
        userId: newUserId,
        role: newRole || "STAFF",
      });

      await fetchBranchMembers();
      setNewUserId("");
      setNewRole("");
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "멤버 추가에 실패했습니다.");
    } finally {
      setAdding(false);
    }
  };

  const updateBranchMemberRole = async (userId: string, role: BranchRole) => {
    try {
      await apiClient.patch("/admin/members/branch/" + branchId + "/" + userId, { role });

      setBranchMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, role } : m))
      );
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "권한 변경에 실패했습니다.");
    }
  };

  const removeBranchMember = async (userId: string) => {
    if (!confirm("해당 멤버를 삭제하시겠습니까?")) return;

    try {
      await apiClient.delete("/admin/members/branch/" + branchId + "/" + userId);
      setBranchMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "멤버 삭제에 실패했습니다.");
    }
  };

  // ============================================================
  // Render
// ============================================================
  // Render
  // ============================================================

  return (
    <div>
      <h1 className="text-[22px] font-extrabold mb-2 text-foreground">권한 관리</h1>
      <p className="text-text-secondary mb-6 text-[13px]">
        브랜드 및 가게 멤버를 관리합니다.
      </p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("brand")}
          className={`py-2 px-4 rounded-lg border font-semibold cursor-pointer text-[13px] transition-colors ${
            tab === "brand"
              ? "bg-bg-tertiary border-border text-foreground"
              : "bg-transparent border-border text-text-secondary hover:bg-bg-tertiary"
          }`}
        >
          브랜드 멤버
        </button>
        <button
          onClick={() => setTab("branch")}
          className={`py-2 px-4 rounded-lg border font-semibold cursor-pointer text-[13px] transition-colors ${
            tab === "branch"
              ? "bg-bg-tertiary border-border text-foreground"
              : "bg-transparent border-border text-text-secondary hover:bg-bg-tertiary"
          }`}
        >
          가게 멤버
        </button>
      </div>

      {/* Brand Members Tab */}
      {tab === "brand" && (
        <div>
          {!brandReady || !brandId ? (
            <div className="card p-2.5 flex items-center gap-3 mb-4">
              <div className="text-xs text-text-secondary">브랜드가 선택되어 있지 않습니다.</div>
              <Link href="/admin/brand" className="text-foreground text-[13px]">
                브랜드 선택하러 가기
              </Link>
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={fetchBrandMembers}
                  disabled={!brandId || brandLoading}
                  className="btn-primary h-9 px-4 text-[13px]"
                >
                  {brandLoading ? "로딩..." : "조회"}
                </button>
              </div>

              {/* 멤버 추가 */}
              <div className="card p-4 mb-4">
                <div className="font-semibold mb-3 text-foreground">멤버 추가</div>
                <div className="flex gap-2 flex-wrap">
                  <input
                    type="text"
                    value={newUserId}
                    onChange={(e) => setNewUserId(e.target.value)}
                    placeholder="User UUID"
                    className="input-field w-[280px]"
                  />
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-border bg-bg-secondary text-foreground text-[13px]"
                  >
                    <option value="">역할 선택</option>
                    {BRAND_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <button onClick={addBrandMember} disabled={adding || !newUserId} className="btn-primary h-9 px-4 text-[13px]">
                    {adding ? "추가 중..." : "추가"}
                  </button>
                </div>
              </div>

              {/* 에러 */}
              {brandError && <p className="text-danger-500 mb-4">{brandError}</p>}

              {/* 멤버 목록 */}
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full border-collapse">
                  <thead className="bg-bg-tertiary">
                    <tr>
                      <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">사용자</th>
                      <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">역할</th>
                      <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">상태</th>
                      <th className="text-center py-3 px-3.5 text-xs font-bold text-text-secondary">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brandMembers.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-3 px-3.5 text-[13px] text-center text-text-tertiary">
                          멤버가 없습니다.
                        </td>
                      </tr>
                    )}
                    {brandMembers.map((m) => (
                      <tr key={m.id} className="border-t border-border">
                        <td className="py-3 px-3.5 text-[13px] text-foreground">
                          <div>{m.displayName || "-"}</div>
                          <div className="text-[11px] text-text-tertiary font-mono">
                            {m.userId.slice(0, 8)}...
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-[13px] text-foreground">
                          <select
                            value={m.role}
                            onChange={(e) => updateBrandMemberRole(m.userId, e.target.value as BrandRole)}
                            className="h-7 px-2 rounded-md border border-border bg-bg-secondary text-foreground text-xs"
                            disabled={m.role === "OWNER"}
                          >
                            {BRAND_ROLES.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-3.5 text-[13px]">
                          <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-success/20 text-success text-[11px] font-semibold">
                            {STATUS_LABELS[m.status]}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-[13px] text-center">
                          <button
                            onClick={() => removeBrandMember(m.userId)}
                            className="py-1 px-2.5 rounded-md border border-border bg-transparent text-danger-500 font-medium cursor-pointer text-xs hover:bg-bg-tertiary transition-colors"
                            disabled={m.role === "OWNER"}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Branch Members Tab */}
      {tab === "branch" && (
        <div>
          {/* Branch 선택 */}
          <div className="mb-4">
            <BranchSelector />
            <div className="mt-2">
              <button
                onClick={fetchBranchMembers}
                disabled={!branchId || branchLoading}
                className="btn-primary h-9 px-4 text-[13px]"
              >
                {branchLoading ? "로딩..." : "조회"}
              </button>
            </div>
          </div>

          {/* 멤버 추가 */}
          {branchId && (
            <div className="card p-4 mb-4">
              <div className="font-semibold mb-3 text-foreground">멤버 추가</div>
              <div className="flex gap-2 flex-wrap">
                <input
                  type="text"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  placeholder="User UUID"
                  className="input-field w-[280px]"
                />
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-border bg-bg-secondary text-foreground text-[13px]"
                >
                  <option value="">역할 선택</option>
                  {BRANCH_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <button onClick={addBranchMember} disabled={adding || !newUserId} className="btn-primary h-9 px-4 text-[13px]">
                  {adding ? "추가 중..." : "추가"}
                </button>
              </div>
            </div>
          )}

          {/* 에러 */}
          {branchError && <p className="text-danger-500 mb-4">{branchError}</p>}

          {/* 멤버 목록 */}
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead className="bg-bg-tertiary">
                <tr>
                  <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">사용자</th>
                  <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">역할</th>
                  <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">상태</th>
                  <th className="text-center py-3 px-3.5 text-xs font-bold text-text-secondary">관리</th>
                </tr>
              </thead>
              <tbody>
                {branchMembers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-3 px-3.5 text-[13px] text-center text-text-tertiary">
                      {branchId ? "멤버가 없습니다." : "가게를 선택하세요."}
                    </td>
                  </tr>
                )}
                {branchMembers.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="py-3 px-3.5 text-[13px] text-foreground">
                      <div>{m.displayName || "-"}</div>
                      <div className="text-[11px] text-text-tertiary font-mono">
                        {m.userId.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="py-3 px-3.5 text-[13px] text-foreground">
                      <select
                        value={m.role}
                        onChange={(e) => updateBranchMemberRole(m.userId, e.target.value as BranchRole)}
                        className="h-7 px-2 rounded-md border border-border bg-bg-secondary text-foreground text-xs"
                      >
                        {BRANCH_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-3.5 text-[13px]">
                      <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-success/20 text-success text-[11px] font-semibold">
                        {STATUS_LABELS[m.status]}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-[13px] text-center">
                      <button
                        onClick={() => removeBranchMember(m.userId)}
                        className="py-1 px-2.5 rounded-md border border-border bg-transparent text-danger-500 font-medium cursor-pointer text-xs hover:bg-bg-tertiary transition-colors"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MembersPage() {
  return (
    <Suspense fallback={<div className="text-muted">로딩 중...</div>}>
      <MembersPageContent />
    </Suspense>
  );
}
