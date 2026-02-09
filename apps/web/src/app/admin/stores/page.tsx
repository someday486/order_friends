"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import AddStoreModal from "./AddStoreModal";
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

// ============================================================
// Component
// ============================================================

export default function StoresPage() {
  const router = useRouter();
  const { brandId, ready, clearBrand } = useSelectedBrand();
  const { selectBranch } = useSelectedBranch();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 신규 가게 등록 모달
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);

  // brandId 없으면 brand 선택 페이지로
  useEffect(() => {
    if (!ready) return;
    if (!brandId) router.replace("/admin/brand");
  }, [ready, brandId, router]);

  // 가게 목록 조회
  const fetchBranches = async (bid: string) => {
    if (!bid) return;

    try {
      setLoading(true);
      setError(null);

      const token = await getAccessToken();

      const res = await fetch(
        `${API_BASE}/admin/branches?brandId=${encodeURIComponent(bid)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`가게 목록 조회 실패: ${res.status} ${text}`);
      }

      const data = (await res.json()) as Branch[];
      setBranches(data);
    } catch (e: unknown) {
      const err = e as Error;
      setError(err?.message ?? "조회 실패");
    } finally {
      setLoading(false);
    }
  };

  // 가게 삭제
  const handleDelete = async (branchId: string, branchName: string) => {
    if (
      !confirm(
        `"${branchName}" 가게를 삭제하시겠습니까?\n관련 상품과 주문 데이터가 모두 삭제됩니다.`
      )
    )
      return;

    try {
      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/admin/branches/${branchId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`삭제 실패: ${res.status} ${text}`);
      }

      setBranches((prev) => prev.filter((b) => b.id !== branchId));
    } catch (e: unknown) {
      const err = e as Error;
      alert(err?.message ?? "삭제 실패");
    }
  };

  // brandId 준비되면 목록 조회
  useEffect(() => {
    if (!ready) return;
    if (brandId) fetchBranches(brandId);
  }, [ready, brandId]);

  // 초기 로딩/리다이렉트 처리
  if (!ready) return null;
  if (!brandId) return null; // redirect 중

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[22px] font-extrabold m-0 text-foreground">가게 관리</h1>
          <p className="text-text-secondary mt-1 text-[13px]">
            총 {branches.length}개
          </p>
        </div>

        <div className="flex gap-2">
          <button
            className="h-9 px-4 rounded-lg border border-border bg-transparent text-foreground font-semibold cursor-pointer text-[13px] hover:bg-bg-tertiary transition-colors"
            onClick={() => { clearBrand(); router.push("/admin/brand"); }}
          >
            브랜드 다시 선택
          </button>
          <button className="btn-primary h-9 px-4 text-[13px]" onClick={() => setShowAddForm(true)}>
            + 가게 추가
          </button>
        </div>
      </div>

      {/* 신규 가게 등록 모달 */}
      <AddStoreModal
        open={showAddForm}
        brandId={brandId}
        adding={adding}
        onClose={() => setShowAddForm(false)}
        onSubmit={async ({ name, slug }) => {
          if (!name.trim() || !slug.trim() || !brandId) return;

          try {
            setAdding(true);
            const token = await getAccessToken();

            const res = await fetch(`${API_BASE}/admin/branches`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                brandId,
                name,
                slug,
              }),
            });

            if (!res.ok) {
              const text = await res.text().catch(() => "");
              throw new Error(`추가 실패: ${res.status} ${text}`);
            }

            const data = (await res.json()) as Branch;
            setBranches((prev) => [data, ...prev]);
            setShowAddForm(false);
          } catch (e: unknown) {
            const err = e as Error;
            alert(err?.message ?? "추가 실패");
          } finally {
            setAdding(false);
          }
        }}
      />

      {/* Error */}
      {error && <p className="text-danger-500 mb-4">{error}</p>}

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="bg-bg-tertiary">
            <tr>
              <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">가게명</th>
              <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">가게 URL</th>
              <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">생성일</th>
              <th className="text-center py-3 px-3.5 text-xs font-bold text-text-secondary">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="py-3 px-3.5 text-[13px] text-center text-text-tertiary">
                  불러오는 중...
                </td>
              </tr>
            )}

            {!loading && branches.length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 px-3.5 text-[13px] text-center text-text-tertiary">
                  가게가 없습니다.
                </td>
              </tr>
            )}

            {!loading &&
              branches.map((branch) => (
                <tr key={branch.id} className="border-t border-border">
                  <td className="py-3 px-3.5 text-[13px] text-foreground">
                    <Link
                      href={`/admin/stores/${branch.id}`}
                      className="text-foreground no-underline hover:text-primary-500 transition-colors"
                      onClick={() => selectBranch(branch.id)}
                    >
                      {branch.name}
                    </Link>
                  </td>
                  <td className="py-3 px-3.5 text-xs text-text-secondary">
                    {branch.slug ? `openoda.com/store/${branch.slug}` : "-"}
                  </td>
                  <td className="py-3 px-3.5 text-[13px] text-text-secondary">{formatDate(branch.createdAt)}</td>
                  <td className="py-3 px-3.5 text-[13px] text-center">
                    <Link href={`/admin/stores/${branch.id}`} onClick={() => selectBranch(branch.id)}>
                      <button className="py-1 px-2.5 rounded-md border border-border bg-transparent text-foreground font-medium cursor-pointer text-xs hover:bg-bg-tertiary transition-colors">
                        수정
                      </button>
                    </Link>
                    <button
                      className="py-1 px-2.5 rounded-md border border-border bg-transparent text-danger-500 font-medium cursor-pointer text-xs ml-1.5 hover:bg-bg-tertiary transition-colors"
                      onClick={() => handleDelete(branch.id, branch.name)}
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
  );
}
