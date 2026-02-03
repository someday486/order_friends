"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import AddStoreModal from "./AddStoreModal";
import { useSelectedBrand } from "@/hooks/useSelectedBrand";

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

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 신규 가게 등록 모달
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);

  // ✅ brandId 없으면 brand 선택 페이지로 보내기
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

  // ✅ brandId가 준비되면 자동으로 목록 조회
  useEffect(() => {
    if (!ready) return;
    if (brandId) fetchBranches(brandId);
  }, [ready, brandId]);

  // ✅ 초기 로딩/리다이렉트 처리
  if (!ready) return null;
  if (!brandId) return null; // redirect 중

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>가게 관리</h1>
          <p style={{ color: "#aaa", margin: "4px 0 0 0", fontSize: 13 }}>
            총 {branches.length}개
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button style={btnGhost} onClick={() => { clearBrand(); router.push("/admin/brand"); }}>
            브랜드 다시 선택
          </button>
          <button style={btnPrimary} onClick={() => setShowAddForm(true)}>
            + 가게추가
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
      {error && <p style={{ color: "#ff8a8a", marginBottom: 16 }}>{error}</p>}

      {/* Table */}
      <div style={{ border: "1px solid #222", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#0f0f0f" }}>
            <tr>
              <th style={th}>가게명</th>
              <th style={th}>가게 URL</th>
              <th style={th}>생성일</th>
              <th style={{ ...th, textAlign: "center" }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} style={{ ...td, textAlign: "center", color: "#666" }}>
                  불러오는 중...
                </td>
              </tr>
            )}

            {!loading && branches.length === 0 && (
              <tr>
                <td colSpan={4} style={{ ...td, textAlign: "center", color: "#666" }}>
                  가게가 없습니다.
                </td>
              </tr>
            )}

            {!loading &&
              branches.map((branch) => (
                <tr key={branch.id} style={{ borderTop: "1px solid #222" }}>
                  <td style={td}>
                    <Link
                      href={`/admin/stores/${branch.id}`}
                      style={{ color: "white", textDecoration: "none" }}
                    >
                      {branch.name}
                    </Link>
                  </td>
                  <td style={{ ...td, color: "#aaa", fontSize: 12 }}>
                    {branch.slug ? `openoda.com/store/${branch.slug}` : "-"}
                  </td>
                  <td style={{ ...td, color: "#aaa" }}>{formatDate(branch.createdAt)}</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <Link href={`/admin/stores/${branch.id}`}>
                      <button style={btnSmall}>수정</button>
                    </Link>
                    <button
                      style={{ ...btnSmall, color: "#ef4444", marginLeft: 6 }}
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

// ============================================================
// Styles
// ============================================================

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
