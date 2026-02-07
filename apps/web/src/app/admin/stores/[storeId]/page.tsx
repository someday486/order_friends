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
      <div className="mb-4">
        <Link href="/admin/stores" className="text-text-secondary text-xs hover:text-foreground transition-colors">
          ← 가게 관리로 돌아가기
        </Link>
        <h1 className="text-[22px] font-extrabold mt-2 text-foreground">
          {branch?.name ?? "가게 상세"}
        </h1>
        <p className="text-text-secondary mt-1 text-[13px]">
          {branch?.slug ? `openoda.com/store/${branch.slug}` : "-"}
        </p>
      </div>

      {loading && <p className="text-text-tertiary">불러오는 중...</p>}
      {error && <p className="text-danger-500">{error}</p>}

      {!loading && branch && (
        <div className="grid gap-3">
          {/* Info + Edit */}
          <div className="card p-4">
            <div className="text-xs text-text-secondary">가게 정보</div>
            <div className="mt-2 grid gap-2.5">
              <div>
                <label className="block mb-1.5 text-xs text-text-secondary">가게 ID</label>
                <div className="text-[13px] text-foreground">{branch.id}</div>
              </div>

              <div>
                <label className="block mb-1.5 text-xs text-text-secondary">가게명</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field w-full"
                  placeholder="가게명을 입력하세요"
                />
              </div>

              <div>
                <label className="block mb-1.5 text-xs text-text-secondary">가게 URL</label>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="input-field w-full"
                  placeholder="예: my-store-01"
                />
                <div className="text-xs text-text-tertiary mt-1.5">
                  영문/숫자/하이픈(-)만 가능합니다.
                </div>
              </div>

              <div>
                <label className="block mb-1.5 text-xs text-text-secondary">생성일</label>
                <div className="text-[13px] text-foreground">{formatDate(branch.createdAt)}</div>
              </div>

              <div className="flex gap-2 mt-1.5">
                <button
                  className="btn-primary h-9 px-4 text-[13px]"
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                >
                  {saving ? "저장 중..." : "저장"}
                </button>
                <button
                  className="h-9 px-4 rounded-lg border border-border bg-transparent text-danger-500 font-bold cursor-pointer text-[13px] hover:bg-bg-tertiary transition-colors"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "삭제 중..." : "가게 삭제"}
                </button>
              </div>
            </div>
          </div>

          {/* Members */}
          <div className="card p-4">
            <div className="text-xs text-text-secondary">가게 멤버</div>
            {membersLoading && <p className="text-text-tertiary">불러오는 중...</p>}
            {membersError && <p className="text-danger-500">{membersError}</p>}
            {!membersLoading && members.length === 0 && (
              <p className="text-text-tertiary">등록된 멤버가 없습니다.</p>
            )}
            {!membersLoading && members.length > 0 && (
              <div className="mt-2 grid gap-1.5">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-2.5 px-3 border border-border rounded-lg bg-bg-secondary">
                    <div>
                      <div className="text-[13px] text-foreground">
                        {m.displayName ?? m.email ?? m.userId}
                      </div>
                      <div className="text-xs text-text-tertiary">{m.userId}</div>
                    </div>
                    <div className="text-xs text-text-secondary">
                      {m.role} · {m.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Next steps */}
          <div className="card p-4">
            <div className="text-xs text-text-secondary">다음 단계</div>
            <div className="mt-2.5 flex gap-2 flex-wrap">
              <Link href={`/admin/products?branchId=${branch.id}`}>
                <button className="btn-primary h-9 px-4 text-[13px]">상품 관리</button>
              </Link>
              <Link href={`/admin/orders?branchId=${branch.id}`}>
                <button className="btn-primary h-9 px-4 text-[13px]">주문 관리</button>
              </Link>
              <Link href={`/admin/members?tab=branch&branchId=${branch.id}`}>
                <button className="h-9 px-4 rounded-lg border border-border bg-transparent text-foreground font-semibold cursor-pointer text-[13px] hover:bg-bg-tertiary transition-colors">
                  가게 멤버
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
