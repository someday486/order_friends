"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

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

async function getAccessToken() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) throw new Error("No access_token (로그인 필요)");
  return token;
}

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

      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/admin/members/brand/${brandId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`조회 실패: ${res.status}`);

      const data = (await res.json()) as BrandMember[];
      setBrandMembers(data);
    } catch (e: unknown) {
      setBrandError((e as Error)?.message ?? "조회 실패");
    } finally {
      setBrandLoading(false);
    }
  };

  const addBrandMember = async () => {
    if (!brandId || !newUserId) return;

    try {
      setAdding(true);

      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/admin/members/brand/${brandId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: newUserId,
          role: newRole || "MEMBER",
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`추가 실패: ${res.status} ${text}`);
      }

      await fetchBrandMembers();
      setNewUserId("");
      setNewRole("");
    } catch (e: unknown) {
      alert((e as Error)?.message ?? "추가 실패");
    } finally {
      setAdding(false);
    }
  };

  const updateBrandMemberRole = async (userId: string, role: BrandRole) => {
    try {
      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/admin/members/brand/${brandId}/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role }),
      });

      if (!res.ok) throw new Error("수정 실패");

      setBrandMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, role } : m))
      );
    } catch (e: unknown) {
      alert((e as Error)?.message ?? "수정 실패");
    }
  };

  const removeBrandMember = async (userId: string) => {
    if (!confirm("정말 이 멤버를 삭제하시겠습니까?")) return;

    try {
      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/admin/members/brand/${brandId}/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("삭제 실패");

      setBrandMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch (e: unknown) {
      alert((e as Error)?.message ?? "삭제 실패");
    }
  };

  // ============================================================
  // Branch Members
  // ============================================================

  const fetchBranchMembers = async () => {
    if (!branchId) return;

    try {
      setBranchLoading(true);
      setBranchError(null);

      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/admin/members/branch/${branchId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`조회 실패: ${res.status}`);

      const data = (await res.json()) as BranchMember[];
      setBranchMembers(data);
    } catch (e: unknown) {
      setBranchError((e as Error)?.message ?? "조회 실패");
    } finally {
      setBranchLoading(false);
    }
  };

  const addBranchMember = async () => {
    if (!branchId || !newUserId) return;

    try {
      setAdding(true);

      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/admin/members/branch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          branchId,
          userId: newUserId,
          role: newRole || "STAFF",
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`추가 실패: ${res.status} ${text}`);
      }

      await fetchBranchMembers();
      setNewUserId("");
      setNewRole("");
    } catch (e: unknown) {
      alert((e as Error)?.message ?? "추가 실패");
    } finally {
      setAdding(false);
    }
  };

  const updateBranchMemberRole = async (userId: string, role: BranchRole) => {
    try {
      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/admin/members/branch/${branchId}/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role }),
      });

      if (!res.ok) throw new Error("수정 실패");

      setBranchMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, role } : m))
      );
    } catch (e: unknown) {
      alert((e as Error)?.message ?? "수정 실패");
    }
  };

  const removeBranchMember = async (userId: string) => {
    if (!confirm("정말 이 멤버를 삭제하시겠습니까?")) return;

    try {
      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/admin/members/branch/${branchId}/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("삭제 실패");

      setBranchMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch (e: unknown) {
      alert((e as Error)?.message ?? "삭제 실패");
    }
  };

  // ============================================================
  // Render
  // ============================================================

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px 0" }}>권한 관리</h1>
      <p style={{ color: "#aaa", margin: "0 0 24px 0", fontSize: 13 }}>
        브랜드 및 가게 멤버를 관리합니다.
      </p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <button
          onClick={() => setTab("brand")}
          style={{
            ...tabBtn,
            background: tab === "brand" ? "#222" : "transparent",
            borderColor: tab === "brand" ? "#444" : "#333",
          }}
        >
          브랜드 멤버
        </button>
        <button
          onClick={() => setTab("branch")}
          style={{
            ...tabBtn,
            background: tab === "branch" ? "#222" : "transparent",
            borderColor: tab === "branch" ? "#444" : "#333",
          }}
        >
          가게 멤버
        </button>
      </div>

      {/* Brand Members Tab */}
      {tab === "brand" && (
        <div>
          {!brandReady || !brandId ? (
            <div style={infoBox}>
              <div style={{ fontSize: 12, color: "#aaa" }}>브랜드가 선택되어 있지 않습니다.</div>
              <Link href="/admin/brand" style={{ color: "white", fontSize: 13 }}>
                브랜드 선택하러 가기
              </Link>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <button
                  onClick={fetchBrandMembers}
                  disabled={!brandId || brandLoading}
                  style={btnPrimary}
                >
                  {brandLoading ? "로딩..." : "조회"}
                </button>
              </div>

              {/* 멤버 추가 */}
              <div style={{ ...card, marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 12 }}>멤버 추가</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    type="text"
                    value={newUserId}
                    onChange={(e) => setNewUserId(e.target.value)}
                    placeholder="User UUID"
                    style={{ ...input, width: 280 }}
                  />
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    style={select}
                  >
                    <option value="">역할 선택</option>
                    {BRAND_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <button onClick={addBrandMember} disabled={adding || !newUserId} style={btnPrimary}>
                    {adding ? "추가 중..." : "추가"}
                  </button>
                </div>
              </div>

              {/* 에러 */}
              {brandError && <p style={{ color: "#ff8a8a", marginBottom: 16 }}>{brandError}</p>}

              {/* 멤버 목록 */}
              <div style={tableWrapper}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ background: "#0f0f0f" }}>
                    <tr>
                      <th style={th}>사용자</th>
                      <th style={th}>역할</th>
                      <th style={th}>상태</th>
                      <th style={{ ...th, textAlign: "center" }}>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brandMembers.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ ...td, textAlign: "center", color: "#666" }}>
                          멤버가 없습니다.
                        </td>
                      </tr>
                    )}
                    {brandMembers.map((m) => (
                      <tr key={m.id} style={{ borderTop: "1px solid #222" }}>
                        <td style={td}>
                          <div>{m.displayName || "-"}</div>
                          <div style={{ fontSize: 11, color: "#666", fontFamily: "monospace" }}>
                            {m.userId.slice(0, 8)}...
                          </div>
                        </td>
                        <td style={td}>
                          <select
                            value={m.role}
                            onChange={(e) => updateBrandMemberRole(m.userId, e.target.value as BrandRole)}
                            style={selectSmall}
                            disabled={m.role === "OWNER"}
                          >
                            {BRAND_ROLES.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={td}>
                          <span style={statusBadge}>{STATUS_LABELS[m.status]}</span>
                        </td>
                        <td style={{ ...td, textAlign: "center" }}>
                          <button
                            onClick={() => removeBrandMember(m.userId)}
                            style={{ ...btnSmall, color: "#ef4444" }}
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
          <div style={{ marginBottom: 16 }}>
            <BranchSelector />
            <div style={{ marginTop: 8 }}>
              <button
                onClick={fetchBranchMembers}
                disabled={!branchId || branchLoading}
                style={btnPrimary}
              >
                {branchLoading ? "로딩..." : "조회"}
              </button>
            </div>
          </div>

          {/* 멤버 추가 */}
          {branchId && (
            <div style={{ ...card, marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>멤버 추가</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  type="text"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  placeholder="User UUID"
                  style={{ ...input, width: 280 }}
                />
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  style={select}
                >
                  <option value="">역할 선택</option>
                  {BRANCH_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <button onClick={addBranchMember} disabled={adding || !newUserId} style={btnPrimary}>
                  {adding ? "추가 중..." : "추가"}
                </button>
              </div>
            </div>
          )}

          {/* 에러 */}
          {branchError && <p style={{ color: "#ff8a8a", marginBottom: 16 }}>{branchError}</p>}

          {/* 멤버 목록 */}
          <div style={tableWrapper}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#0f0f0f" }}>
                <tr>
                  <th style={th}>사용자</th>
                  <th style={th}>역할</th>
                  <th style={th}>상태</th>
                  <th style={{ ...th, textAlign: "center" }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {branchMembers.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ ...td, textAlign: "center", color: "#666" }}>
                      {branchId ? "멤버가 없습니다." : "가게를 선택하세요."}
                    </td>
                  </tr>
                )}
                {branchMembers.map((m) => (
                  <tr key={m.id} style={{ borderTop: "1px solid #222" }}>
                    <td style={td}>
                      <div>{m.displayName || "-"}</div>
                      <div style={{ fontSize: 11, color: "#666", fontFamily: "monospace" }}>
                        {m.userId.slice(0, 8)}...
                      </div>
                    </td>
                    <td style={td}>
                      <select
                        value={m.role}
                        onChange={(e) => updateBranchMemberRole(m.userId, e.target.value as BranchRole)}
                        style={selectSmall}
                      >
                        {BRANCH_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={td}>
                      <span style={statusBadge}>{STATUS_LABELS[m.status]}</span>
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <button
                        onClick={() => removeBranchMember(m.userId)}
                        style={{ ...btnSmall, color: "#ef4444" }}
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

// ============================================================
// Styles
// ============================================================

const tabBtn: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "transparent",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 13,
};

const card: React.CSSProperties = {
  padding: 16,
  border: "1px solid #222",
  borderRadius: 12,
  background: "#0a0a0a",
};

const tableWrapper: React.CSSProperties = {
  border: "1px solid #222",
  borderRadius: 12,
  overflow: "hidden",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  fontSize: 12,
  fontWeight: 700,
  color: "#aaa",
};

const td: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: 13,
  color: "white",
};

const input: React.CSSProperties = {
  height: 36,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "#0a0a0a",
  color: "white",
  fontSize: 13,
  width: 200,
};

const select: React.CSSProperties = {
  height: 36,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "#0a0a0a",
  color: "white",
  fontSize: 13,
};

const selectSmall: React.CSSProperties = {
  height: 28,
  padding: "0 8px",
  borderRadius: 6,
  border: "1px solid #333",
  background: "#0a0a0a",
  color: "white",
  fontSize: 12,
};

const btnPrimary: React.CSSProperties = {
  height: 36,
  padding: "0 16px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "white",
  color: "#000",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 13,
};

const btnSmall: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 6,
  border: "1px solid #333",
  background: "transparent",
  color: "white",
  fontWeight: 500,
  cursor: "pointer",
  fontSize: 12,
};

const statusBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 22,
  padding: "0 8px",
  borderRadius: 999,
  background: "#10b98120",
  color: "#10b981",
  fontSize: 11,
  fontWeight: 600,
};

const infoBox: React.CSSProperties = {
  padding: 10,
  border: "1px solid #222",
  borderRadius: 8,
  background: "#0a0a0a",
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginBottom: 16,
};

export default function MembersPage() {
  return (
    <Suspense fallback={<div className="text-muted">로딩 중...</div>}>
      <MembersPageContent />
    </Suspense>
  );
}
