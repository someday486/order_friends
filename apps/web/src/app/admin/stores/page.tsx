"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

// ============================================================
// Types
// ============================================================

type Branch = {
  id: string;
  brandId: string;
  name: string;
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
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string>("");

  // 새 가게 추가 폼
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [adding, setAdding] = useState(false);

  // 가게 목록 조회
  const fetchBranches = async (bid: string) => {
    if (!bid) return;

    try {
      setLoading(true);
      setError(null);

      const token = await getAccessToken();

      const res = await fetch(`${API_BASE}/admin/branches?brandId=${encodeURIComponent(bid)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

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

  // 가게 추가
  const handleAdd = async () => {
    if (!newStoreName.trim() || !brandId) return;

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
          name: newStoreName,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`추가 실패: ${res.status} ${text}`);
      }

      const data = (await res.json()) as Branch;
      setBranches((prev) => [data, ...prev]);
      setNewStoreName("");
      setShowAddForm(false);
    } catch (e: unknown) {
      const err = e as Error;
      alert(err?.message ?? "추가 실패");
    } finally {
      setAdding(false);
    }
  };

  // 가게 삭제
  const handleDelete = async (branchId: string, branchName: string) => {
    if (!confirm(`"${branchName}" 가게를 삭제하시겠습니까?\n관련 상품과 주문 데이터가 모두 삭제됩니다.`)) return;

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

  useEffect(() => {
    if (brandId) {
      fetchBranches(brandId);
    }
  }, [brandId]);

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

        <button
          style={btnPrimary}
          onClick={() => setShowAddForm(true)}
          disabled={!brandId}
        >
          + 가게 추가
        </button>
      </div>

      {/* Brand 선택 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ color: "#aaa", fontSize: 13, marginRight: 8 }}>브랜드 ID:</label>
        <input
          type="text"
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
          placeholder="Brand UUID 입력"
          style={input}
        />
        <button
          style={{ ...btnGhost, marginLeft: 8 }}
          onClick={() => fetchBranches(brandId)}
          disabled={!brandId || loading}
        >
          조회
        </button>
      </div>

      {/* 추가 폼 */}
      {showAddForm && (
        <div style={addFormCard}>
          <input
            type="text"
            value={newStoreName}
            onChange={(e) => setNewStoreName(e.target.value)}
            placeholder="새 가게 이름"
            style={{ ...input, flex: 1 }}
          />
          <button style={btnPrimary} onClick={handleAdd} disabled={adding || !newStoreName.trim()}>
            {adding ? "추가 중..." : "추가"}
          </button>
          <button style={btnGhost} onClick={() => setShowAddForm(false)}>
            취소
          </button>
        </div>
      )}

      {/* Error */}
      {error && <p style={{ color: "#ff8a8a", marginBottom: 16 }}>{error}</p>}

      {/* Table */}
      <div
        style={{
          border: "1px solid #222",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#0f0f0f" }}>
            <tr>
              <th style={th}>가게명</th>
              <th style={th}>생성일</th>
              <th style={{ ...th, textAlign: "center" }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={3} style={{ ...td, textAlign: "center", color: "#666" }}>
                  불러오는 중...
                </td>
              </tr>
            )}

            {!loading && !brandId && (
              <tr>
                <td colSpan={3} style={{ ...td, textAlign: "center", color: "#666" }}>
                  브랜드 ID를 입력하고 조회하세요.
                </td>
              </tr>
            )}

            {!loading && brandId && branches.length === 0 && (
              <tr>
                <td colSpan={3} style={{ ...td, textAlign: "center", color: "#666" }}>
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

const input: React.CSSProperties = {
  height: 36,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "#0a0a0a",
  color: "white",
  fontSize: 13,
  width: 280,
};

const addFormCard: React.CSSProperties = {
  display: "flex",
  gap: 8,
  padding: 16,
  marginBottom: 16,
  border: "1px solid #333",
  borderRadius: 12,
  background: "#0a0a0a",
};
