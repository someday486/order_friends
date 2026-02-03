"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

export default function BranchSelector({
  label = "가게 선택",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  const { brandId, ready } = useSelectedBrand();
  const { branchId, selectBranch } = useSelectedBranch();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => branchId ?? "", [branchId]);

  useEffect(() => {
    if (!ready) return;
    if (!brandId) return;

    const fetchBranches = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = await getAccessToken();

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}/admin/branches?brandId=${encodeURIComponent(
            brandId
          )}`,
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

    fetchBranches();
  }, [ready, brandId]);

  if (!ready) return null;

  if (!brandId) {
    return (
      <div style={infoBox}>
        <div style={{ fontSize: 12, color: "#aaa" }}>브랜드가 선택되어 있지 않습니다.</div>
        <Link href="/admin/brand" style={{ color: "white", fontSize: 13 }}>
          브랜드 선택하러 가기
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <label style={{ color: "#aaa", fontSize: 12 }}>{label}:</label>
      <select
        value={selected}
        onChange={(e) => selectBranch(e.target.value)}
        style={compact ? selectSmall : select}
      >
        <option value="">가게를 선택하세요</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      <Link href="/admin/stores" style={{ color: "#aaa", fontSize: 12 }}>
        가게 관리
      </Link>

      {loading && <span style={{ color: "#666", fontSize: 12 }}>불러오는 중...</span>}
      {error && <span style={{ color: "#ff8a8a", fontSize: 12 }}>{error}</span>}
    </div>
  );
}

// ============================================================
// Styles
// ============================================================

const infoBox: React.CSSProperties = {
  padding: 10,
  border: "1px solid #222",
  borderRadius: 8,
  background: "#0a0a0a",
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const select: React.CSSProperties = {
  height: 34,
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "#0a0a0a",
  color: "white",
  fontSize: 12,
  minWidth: 200,
};

const selectSmall: React.CSSProperties = {
  height: 30,
  padding: "0 8px",
  borderRadius: 6,
  border: "1px solid #333",
  background: "#0a0a0a",
  color: "white",
  fontSize: 12,
};
