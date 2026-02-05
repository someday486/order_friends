"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

// ============================================================
// Types
// ============================================================

type Brand = {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  myRole: string;
  created_at: string;
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

// ============================================================
// Component
// ============================================================

export default function CustomerBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBrands = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = await getAccessToken();

        const res = await fetch(`${API_BASE}/customer/brands`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`브랜드 목록 조회 실패: ${res.status}`);
        }

        const data = await res.json();
        setBrands(data);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "브랜드 목록 조회 중 오류 발생");
      } finally {
        setLoading(false);
      }
    };

    loadBrands();
  }, []);

  if (loading) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 32 }}>브랜드 관리</h1>
        <div>로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>브랜드 관리</h1>
        <div style={errorBox}>{error}</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>브랜드 관리</h1>
      </div>

      {brands.length === 0 ? (
        <div style={emptyBox}>
          <div style={{ fontSize: 16, marginBottom: 8 }}>등록된 브랜드가 없습니다</div>
          <div style={{ fontSize: 13, color: "#666" }}>관리자에게 브랜드 멤버십을 요청하세요</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {brands.map((brand) => (
            <BrandCard key={brand.id} brand={brand} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Sub Components
// ============================================================

function BrandCard({ brand }: { brand: Brand }) {
  return (
    <Link href={`/customer/brands/${brand.id}`} style={brandCardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        {brand.logo_url ? (
          <img
            src={brand.logo_url}
            alt={brand.name}
            style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 8,
              background: "#222",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
            }}
          >
            🏢
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{brand.name}</div>
          <div style={{ fontSize: 12, color: "#aaa" }}>역할: {brand.myRole}</div>
        </div>
      </div>
      {brand.description && (
        <div style={{ fontSize: 13, color: "#999", marginBottom: 8, lineHeight: 1.5 }}>{brand.description}</div>
      )}
      <div style={{ fontSize: 11, color: "#666" }}>
        등록일: {new Date(brand.created_at).toLocaleDateString()}
      </div>
    </Link>
  );
}

// ============================================================
// Styles
// ============================================================

const brandCardStyle: React.CSSProperties = {
  display: "block",
  padding: 16,
  borderRadius: 12,
  border: "1px solid #222",
  background: "#0f0f0f",
  color: "white",
  textDecoration: "none",
  transition: "all 0.15s",
};

const emptyBox: React.CSSProperties = {
  border: "1px solid #222",
  borderRadius: 12,
  padding: 48,
  background: "#0a0a0a",
  color: "#666",
  textAlign: "center",
};

const errorBox: React.CSSProperties = {
  border: "1px solid #ff4444",
  borderRadius: 12,
  padding: 16,
  background: "#1a0000",
  color: "#ff8888",
};
