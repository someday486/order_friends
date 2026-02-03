"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { useSelectedBrand } from "@/hooks/useSelectedBrand";
import { useSelectedBranch } from "@/hooks/useSelectedBranch";

// ============================================================
// Types
// ============================================================

type Branch = {
  id: string;
  brandId: string;
  name: string;
  slug?: string;
  createdAt: string;
};

type BranchMember = {
  id: string;
  branchId: string;
  userId: string;
  email?: string | null;
  displayName?: string | null;
  role: string;
  status: string;
  createdAt: string;
};

// ============================================================
// Constants
// ============================================================

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

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

function formatDate(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR");
}

function isValidSlug(value: string) {
  return /^[a-z0-9-]+$/.test(value);
}

// ============================================================
// Component
// ============================================================

export default function StoreDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { brandId, ready } = useSelectedBrand();
  const { selectBranch } = useSelectedBranch();
  const storeId = (params?.storeId as string) ?? "";

  const [branch, setBranch] = useState<Branch | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<BranchMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const isDirty = useMemo(() => {
    if (!branch) return false;
    return name.trim() !== branch.name || slug.trim() !== (branch.slug ?? "");
  }, [branch, name, slug]);

  const fetchMembers = async (branchId: string) => {
    try {
      setMembersLoading(true);
      setMembersError(null);

      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/admin/members/branch/${branchId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`가게 멤버 조회 실패: ${res.status} ${text}`);
      }

      const data = (await res.json()) as BranchMember[];
      setMembers(data);
    } catch (e: unknown) {
      const err = e as Error;
      setMembersError(err?.message ?? "조회 실패");
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    if (!ready) return;
    if (!brandId) {
      router.replace("/admin/brand");
      return;
    }

    const fetchBranch = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = await getAccessToken();

        const res = await fetch(`${API_BASE}/admin/branches/${storeId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`가게 정보 조회 실패: ${res.status} ${text}`);
        }

        const data = (await res.json()) as Branch;
        setBranch(data);
        setName(data.name ?? "");
        setSlug(data.slug ?? "");
        selectBranch(data.id);
        fetchMembers(data.id);
      } catch (e: unknown) {
        const err = e as Error;
        setError(err?.message ?? "조회 실패");
      } finally {
        setLoading(false);
      }
    };

    if (storeId) fetchBranch();
  }, [ready, brandId, storeId, router, selectBranch]);

  const handleSave = async () => {
    if (!branch) return;
    if (!name.trim()) {
      alert("가게명을 입력하세요.");
      return;
    }
    if (!slug.trim()) {
      alert("가게 URL을 입력하세요.");
      return;
    }
    if (!isValidSlug(slug.trim())) {
      alert("가게 URL은 영문/숫자/하이픈(-)만 가능합니다.");
      return;
    }

    try {
      setSaving(true);
      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/admin/branches/${branch.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`가게 수정 실패: ${res.status} ${text}`);
      }

      const data = (await res.json()) as Branch;
      setBranch(data);
      setName(data.name ?? "");
      setSlug(data.slug ?? "");
    } catch (e: unknown) {
      const err = e as Error;
      alert(err?.message ?? "수정 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!branch) return;

    if (
      !confirm(
        `"${branch.name}" 가게를 삭제하시겠습니까?\n관련 상품과 주문 데이터가 모두 삭제됩니다.`
      )
    ) {
      return;
    }

    try {
      setDeleting(true);
      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/admin/branches/${branch.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`가게 삭제 실패: ${res.status} ${text}`);
      }

      router.replace("/admin/stores");
    } catch (e: unknown) {
      const err = e as Error;
      alert(err?.message ?? "삭제 실패");
    } finally {
      setDeleting(false);
    }
  };

  if (!ready) return null;
  if (!brandId) return null;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <Link href="/admin/stores" style={{ color: "#aaa", fontSize: 12 }}>
          ← 가게 관리로 돌아가기
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "8px 0 0 0" }}>
          {branch?.name ?? "가게 상세"}
        </h1>
        <p style={{ color: "#aaa", margin: "4px 0 0 0", fontSize: 13 }}>
          {branch?.slug ? `openoda.com/store/${branch.slug}` : "-"}
        </p>
      </div>

      {loading && <p style={{ color: "#666" }}>불러오는 중...</p>}
      {error && <p style={{ color: "#ff8a8a" }}>{error}</p>}

      {!loading && branch && (
        <div style={{ display: "grid", gap: 12 }}>
          {/* Info + Edit */}
          <div style={card}>
            <div style={{ fontSize: 12, color: "#aaa" }}>가게 정보</div>
            <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
              <div>
                <label style={label}>가게 ID</label>
                <div style={valueText}>{branch.id}</div>
              </div>

              <div>
                <label style={label}>가게명</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={inputStyle}
                  placeholder="가게명을 입력하세요"
                />
              </div>

              <div>
                <label style={label}>가게 URL</label>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  style={inputStyle}
                  placeholder="예: my-store-01"
                />
                <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                  영문/숫자/하이픈(-)만 가능합니다.
                </div>
              </div>

              <div>
                <label style={label}>생성일</label>
                <div style={valueText}>{formatDate(branch.createdAt)}</div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button
                  style={btnPrimary}
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                >
                  {saving ? "저장 중..." : "저장"}
                </button>
                <button
                  style={btnDanger}
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "삭제 중..." : "가게 삭제"}
                </button>
              </div>
            </div>
          </div>

          {/* Members */}
          <div style={card}>
            <div style={{ fontSize: 12, color: "#aaa" }}>가게 멤버</div>
            {membersLoading && <p style={{ color: "#666" }}>불러오는 중...</p>}
            {membersError && <p style={{ color: "#ff8a8a" }}>{membersError}</p>}
            {!membersLoading && members.length === 0 && (
              <p style={{ color: "#666" }}>등록된 멤버가 없습니다.</p>
            )}
            {!membersLoading && members.length > 0 && (
              <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                {members.map((m) => (
                  <div key={m.id} style={memberRow}>
                    <div>
                      <div style={{ fontSize: 13 }}>
                        {m.displayName ?? m.email ?? m.userId}
                      </div>
                      <div style={{ fontSize: 12, color: "#888" }}>{m.userId}</div>
                    </div>
                    <div style={{ fontSize: 12, color: "#aaa" }}>
                      {m.role} · {m.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Next steps */}
          <div style={card}>
            <div style={{ fontSize: 12, color: "#aaa" }}>다음 단계</div>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href={`/admin/products?branchId=${branch.id}`}>
                <button style={btnPrimary}>상품 관리</button>
              </Link>
              <Link href={`/admin/orders?branchId=${branch.id}`}>
                <button style={btnPrimary}>주문 관리</button>
              </Link>
              <Link href={`/admin/members?tab=branch&branchId=${branch.id}`}>
                <button style={btnGhost}>가게 멤버</button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Styles
// ============================================================

const card: React.CSSProperties = {
  border: "1px solid #222",
  borderRadius: 12,
  padding: 16,
  background: "#0f0f0f",
};

const label: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontSize: 12,
  color: "#aaa",
};

const valueText: React.CSSProperties = {
  fontSize: 13,
  color: "white",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 36,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "transparent",
  color: "white",
  fontSize: 13,
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

const btnGhost: React.CSSProperties = {
  height: 36,
  padding: "0 16px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "transparent",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 13,
};

const btnDanger: React.CSSProperties = {
  height: 36,
  padding: "0 16px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "transparent",
  color: "#ef4444",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 13,
};

const memberRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 12px",
  border: "1px solid #222",
  borderRadius: 8,
  background: "#0b0b0b",
};
