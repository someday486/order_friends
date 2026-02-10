"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
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

// ============================================================
// Helpers
// ============================================================

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

      const data = await apiClient.get<Branch[]>(`/admin/branches?brandId=${encodeURIComponent(bid)}`);
      setBranches(data);
    } catch (e: unknown) {
      const err = e as Error;
      setError(err?.message ?? "?? ??");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (branchId: string, branchName: string) => {
    if (
      !confirm(
        `"${branchName}" ??? ?????????\n?? ??? ?? ???? ?? ?????.`
      )
    )
      return;

    try {
      await apiClient.delete("/admin/branches/" + branchId);
      setBranches((prev) => prev.filter((b) => b.id !== branchId));
    } catch (e: unknown) {
      const err = e as Error;
      alert(err?.message ?? "?? ??");
    }
  };

  useEffect(() => {
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

            const data = await apiClient.post<Branch>("/admin/branches", {
              brandId,
              name,
              slug,
            });
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
