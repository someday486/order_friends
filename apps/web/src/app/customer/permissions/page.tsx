"use client";

import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { Search, X, UserPlus, Clock } from "lucide-react";
import { apiClient } from "@/lib/api-client";

// ─── API Response Types ───────────────────────────────────────────────────────

type Brand = { id: string; name: string; myRole?: string | null };
type Branch = { id: string; name: string; brandId: string; myRole?: string | null };

type BrandMemberApiResponse = {
  userId: string;
  email: string | null;
  displayName: string | null;
  /** OWNER | ADMIN | MEMBER */
  role: string;
  /** ACTIVE | INVITED | SUSPENDED | LEFT */
  status: string;
  createdAt: string;
};

type BranchMemberApiResponse = {
  userId: string;
  email: string | null;
  displayName: string | null;
  /** BRANCH_OWNER | BRANCH_ADMIN | STAFF | VIEWER */
  role: string;
  /** ACTIVE | INVITED | SUSPENDED | LEFT */
  status: string;
  createdAt: string;
  branchId: string;
};

// ─── Domain Types ─────────────────────────────────────────────────────────────

type Role = "BRAND_OWNER" | "MANAGER" | "STAFF";
type Status = "ACTIVE" | "INVITED" | "INACTIVE";

type PermissionMemberRow = {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  brandId: string;
  brandName: string;
  branchId: string | null;
  branchName: string | null;
  role: Role;
  status: Status;
  joinedAt?: string;
};

// ─── Mapping helpers ──────────────────────────────────────────────────────────

function mapBrandRole(raw: string): Role {
  if (raw === "OWNER") return "BRAND_OWNER";
  if (raw === "ADMIN") return "MANAGER";
  return "STAFF";
}

function mapBranchRole(raw: string): Role {
  if (raw === "BRANCH_OWNER" || raw === "BRANCH_ADMIN") return "MANAGER";
  return "STAFF";
}

function mapStatus(raw: string): Status {
  if (raw === "ACTIVE") return "ACTIVE";
  if (raw === "INVITED") return "INVITED";
  return "INACTIVE"; // SUSPENDED | LEFT → INACTIVE
}

function displayName(m: { displayName: string | null; email: string | null; userId: string }): string {
  return m.displayName || m.email?.split("@")[0] || m.userId.slice(0, 8);
}

// ─── Display helpers ──────────────────────────────────────────────────────────

const ROLE_LABEL: Record<Role, string> = {
  BRAND_OWNER: "브랜드 오너",
  MANAGER: "매니저",
  STAFF: "직원",
};

const ROLE_BADGE: Record<Role, string> = {
  BRAND_OWNER: "bg-primary-500/15 text-primary-500",
  MANAGER: "bg-success/15 text-success",
  STAFF: "bg-neutral-500/15 text-text-secondary",
};

const STATUS_LABEL: Record<Status, string> = {
  ACTIVE: "활성",
  INVITED: "초대대기",
  INACTIVE: "비활성",
};

const STATUS_BADGE: Record<Status, string> = {
  ACTIVE: "bg-success/15 text-success",
  INVITED: "bg-warning-500/15 text-warning-500",
  INACTIVE: "bg-neutral-500/15 text-text-tertiary",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function PermissionsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [members, setMembers] = useState<PermissionMemberRow[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "">("");
  const [searchInput, setSearchInput] = useState("");

  // Ref for brands so the load effect doesn't need brands as a dep
  const brandsRef = useRef<Brand[]>([]);
  useEffect(() => {
    brandsRef.current = brands;
  }, [brands]);

  // ── Load brands on mount ────────────────────────────────────────────────
  useEffect(() => {
    apiClient
      .get<Brand[]>("/customer/brands")
      .then((data) => {
        setBrands(data);
        if (data.length > 0) setSelectedBrandId(data[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "브랜드 목록을 불러올 수 없습니다"));
  }, []);

  // ── Load branches + members when brand changes ──────────────────────────
  const loadBrandData = useCallback(async (brandId: string) => {
    const brandName =
      brandsRef.current.find((b) => b.id === brandId)?.name ?? brandId;

    setLoading(true);
    setError(null);
    setMembers([]);
    setBranches([]);
    setSelectedBranchId("");

    try {
      // 1. Load branches
      const branchData = await apiClient.get<Branch[]>(
        `/customer/branches?brandId=${encodeURIComponent(brandId)}`,
      );
      setBranches(branchData);

      // 2. Load brand members + all branch members in parallel
      const [brandMembersRaw, ...branchMembersRaw] = await Promise.all([
        apiClient
          .get<BrandMemberApiResponse[]>(`/customer/members/brand/${brandId}`)
          .catch(() => [] as BrandMemberApiResponse[]),
        ...branchData.map((branch) =>
          apiClient
            .get<BranchMemberApiResponse[]>(
              `/customer/members/branch/${branch.id}`,
            )
            .then((data) =>
              data.map((m) => ({
                ...m,
                _branchId: branch.id,
                _branchName: branch.name,
              })),
            )
            .catch(() => [] as (BranchMemberApiResponse & { _branchId: string; _branchName: string })[]),
        ),
      ]);

      // 3. Map to PermissionMemberRow
      const brandRows: PermissionMemberRow[] = (brandMembersRaw as BrandMemberApiResponse[]).map(
        (m) => ({
          id: `brand-${brandId}-${m.userId}`,
          userId: m.userId,
          name: displayName(m),
          email: m.email,
          brandId,
          brandName,
          branchId: null,
          branchName: null,
          role: mapBrandRole(m.role),
          status: mapStatus(m.status),
          joinedAt: m.createdAt,
        }),
      );

      const branchRows: PermissionMemberRow[] = (
        branchMembersRaw as (BranchMemberApiResponse & {
          _branchId: string;
          _branchName: string;
        })[][]
      )
        .flat()
        .map((m) => ({
          id: `branch-${m._branchId}-${m.userId}`,
          userId: m.userId,
          name: displayName(m),
          email: m.email,
          brandId,
          brandName,
          branchId: m._branchId,
          branchName: m._branchName,
          role: mapBranchRole(m.role),
          status: mapStatus(m.status),
          joinedAt: m.createdAt,
        }));

      setMembers([...brandRows, ...branchRows]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "멤버 목록을 불러올 수 없습니다");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedBrandId) return;
    loadBrandData(selectedBrandId);
  }, [selectedBrandId, loadBrandData]);

  // ── Filtered members ────────────────────────────────────────────────────
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (selectedBranchId) {
        // "브랜드 전체" 멤버 (branchId === null)는 특정 매장 필터에서 제외
        if (m.branchId !== selectedBranchId) return false;
      }
      if (roleFilter && m.role !== roleFilter) return false;
      if (searchInput.trim()) {
        const q = searchInput.toLowerCase();
        if (
          !m.name.toLowerCase().includes(q) &&
          !(m.email ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [members, selectedBranchId, roleFilter, searchInput]);

  const handleReset = () => {
    setSelectedBranchId("");
    setRoleFilter("");
    setSearchInput("");
  };

  // ── KPI (always from full member list) ─────────────────────────────────
  const totalMembers = useMemo(
    () => new Set(members.map((m) => m.userId)).size,
    [members],
  );
  const totalManagers = useMemo(
    () => new Set(members.filter((m) => m.role === "MANAGER").map((m) => m.userId)).size,
    [members],
  );
  const totalBranches = branches.length;

  // ── Available branches for filter ──────────────────────────────────────
  const availableBranches = branches;

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground m-0">권한관리</h1>
          <p className="mt-1 text-sm text-text-secondary">
            브랜드 및 매장의 멤버와 역할을 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg border border-border bg-bg-secondary text-sm font-semibold text-foreground hover:bg-bg-tertiary transition-colors cursor-pointer"
          >
            <Clock className="w-4 h-4 text-text-secondary" />
            변경 이력
          </button>
          <button
            type="button"
            className="btn-primary flex items-center gap-1.5 h-9 px-4 text-sm"
          >
            <UserPlus className="w-4 h-4" />
            멤버 초대
          </button>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <div className="text-xs text-text-secondary font-semibold mb-1.5">전체 멤버</div>
          <div className="text-3xl font-extrabold text-foreground">
            {loading ? "-" : totalMembers}
          </div>
          <div className="text-xs text-text-tertiary mt-1">등록된 전체 구성원</div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-text-secondary font-semibold mb-1.5">매니저</div>
          <div className="text-3xl font-extrabold text-foreground">
            {loading ? "-" : totalManagers}
          </div>
          <div className="text-xs text-text-tertiary mt-1">매장 담당 매니저</div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-text-secondary font-semibold mb-1.5">운영 매장</div>
          <div className="text-3xl font-extrabold text-foreground">
            {loading ? "-" : totalBranches}
          </div>
          <div className="text-xs text-text-tertiary mt-1">현재 운영 중인 매장</div>
        </div>
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        {/* 브랜드 */}
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs text-text-secondary mb-1.5 font-semibold">브랜드</label>
          <select
            value={selectedBrandId}
            onChange={(e) => {
              setSelectedBrandId(e.target.value);
            }}
            className="input-field h-9 text-sm w-full"
          >
            {brands.length === 0 && <option value="">브랜드 없음</option>}
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* 매장 */}
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs text-text-secondary mb-1.5 font-semibold">매장</label>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="input-field h-9 text-sm w-full"
            disabled={availableBranches.length === 0}
          >
            <option value="">전체 매장</option>
            {availableBranches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* 역할 */}
        <div className="flex-1 min-w-[130px]">
          <label className="block text-xs text-text-secondary mb-1.5 font-semibold">역할</label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as Role | "")}
            className="input-field h-9 text-sm w-full"
          >
            <option value="">전체 역할</option>
            <option value="BRAND_OWNER">브랜드 오너</option>
            <option value="MANAGER">매니저</option>
            <option value="STAFF">직원</option>
          </select>
        </div>

        {/* 검색 */}
        <div className="w-52">
          <label className="block text-xs text-text-secondary mb-1.5 font-semibold">검색</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="이름, 이메일 검색"
              className="input-field h-9 text-sm w-full pl-9 pr-8"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={handleReset}
            className="h-9 px-4 rounded-lg border border-border bg-bg-secondary text-sm font-semibold text-text-secondary hover:bg-bg-tertiary transition-colors cursor-pointer"
          >
            초기화
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-danger-500 rounded-xl p-4 bg-danger-500/10 text-danger-500 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* ── Main Content ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_252px] gap-5">

        {/* Member Table */}
        <div>
          {loading ? (
            <div className="border border-border rounded-xl p-12 bg-bg-secondary text-center">
              <div className="text-sm text-text-secondary">불러오는 중...</div>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="border border-border rounded-xl p-12 bg-bg-secondary text-center">
              <div className="text-base text-text-secondary mb-1">
                {members.length === 0 ? "등록된 멤버가 없습니다" : "조건에 맞는 멤버가 없습니다"}
              </div>
              {members.length > 0 && (
                <div className="text-sm text-text-tertiary">
                  필터 조건을 변경하거나 초기화해주세요
                </div>
              )}
            </div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full border-collapse min-w-[680px]">
                <thead className="bg-bg-tertiary">
                  <tr>
                    <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">이름</th>
                    <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">이메일</th>
                    <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">소속 브랜드</th>
                    <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">소속 매장</th>
                    <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">역할</th>
                    <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">상태</th>
                    <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => (
                    <tr
                      key={member.id}
                      className="border-t border-border hover:bg-bg-tertiary transition-colors"
                    >
                      <td className="py-3 px-3.5">
                        <span className="text-sm font-semibold text-foreground">
                          {member.name}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="text-sm text-text-secondary">
                          {member.email ?? "-"}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="text-sm text-foreground">{member.brandName}</span>
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="text-sm text-foreground">
                          {member.branchName ?? "-"}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        <span
                          className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold ${ROLE_BADGE[member.role]}`}
                        >
                          {ROLE_LABEL[member.role]}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        <span
                          className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold ${STATUS_BADGE[member.status]}`}
                        >
                          {STATUS_LABEL[member.status]}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="h-7 px-2.5 rounded border border-border bg-bg-secondary text-xs font-semibold text-foreground hover:bg-bg-tertiary transition-colors cursor-pointer"
                          >
                            권한변경
                          </button>
                          <button
                            type="button"
                            className="h-7 px-2.5 rounded border border-border bg-bg-secondary text-xs font-semibold text-text-secondary hover:bg-bg-tertiary transition-colors cursor-pointer"
                          >
                            {member.status === "ACTIVE" ? "비활성화" : "활성화"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && (
            <div className="mt-2 text-xs text-text-tertiary">
              총 {filteredMembers.length}명 표시 중
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="flex flex-col gap-4">

          {/* Role guide */}
          <div className="rounded-xl border border-border bg-bg-secondary p-4">
            <div className="text-sm font-bold text-foreground mb-3">역할 안내</div>
            <div className="space-y-3">
              <div>
                <span className={`inline-flex items-center h-5 px-2 rounded-full text-[11px] font-semibold mb-1.5 ${ROLE_BADGE.BRAND_OWNER}`}>
                  브랜드 오너
                </span>
                <p className="text-xs text-text-secondary leading-relaxed">
                  브랜드와 모든 매장을 관리하고 멤버 초대 및 권한 변경이 가능합니다.
                </p>
              </div>
              <div className="border-t border-border pt-3">
                <span className={`inline-flex items-center h-5 px-2 rounded-full text-[11px] font-semibold mb-1.5 ${ROLE_BADGE.MANAGER}`}>
                  매니저
                </span>
                <p className="text-xs text-text-secondary leading-relaxed">
                  담당 매장의 주문, 상품, 재고 관리가 가능합니다.
                </p>
              </div>
              <div className="border-t border-border pt-3">
                <span className={`inline-flex items-center h-5 px-2 rounded-full text-[11px] font-semibold mb-1.5 ${ROLE_BADGE.STAFF}`}>
                  직원
                </span>
                <p className="text-xs text-text-secondary leading-relaxed">
                  주문 조회 및 기본 운영 업무를 담당합니다.
                </p>
              </div>
            </div>
          </div>

          {/* Invite guide */}
          <div className="rounded-xl border border-border bg-bg-secondary p-4">
            <div className="text-sm font-bold text-foreground mb-2">초대 안내</div>
            <p className="text-xs text-text-secondary leading-relaxed">
              멤버 초대 시 등록된 이메일로 초대 링크가 발송됩니다. 수락 전까지{" "}
              <span className="font-semibold text-warning-500">초대대기</span>{" "}
              상태로 표시됩니다.
            </p>
          </div>

          {/* Status legend */}
          <div className="rounded-xl border border-border bg-bg-secondary p-4">
            <div className="text-sm font-bold text-foreground mb-3">상태 안내</div>
            <div className="flex flex-col gap-2">
              {(["ACTIVE", "INVITED", "INACTIVE"] as Status[]).map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <span className={`inline-flex items-center h-5 px-2 rounded-full text-[11px] font-semibold ${STATUS_BADGE[s]}`}>
                    {STATUS_LABEL[s]}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {s === "ACTIVE" && "정상 접근 가능"}
                    {s === "INVITED" && "초대 수락 대기 중"}
                    {s === "INACTIVE" && "접근 제한됨"}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
