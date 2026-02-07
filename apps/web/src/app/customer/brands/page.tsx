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
        <h1 className="text-2xl font-extrabold mb-8 text-foreground">브랜드 관리</h1>
        <div className="text-text-secondary">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold mb-4 text-foreground">브랜드 관리</h1>
        <div className="border border-danger-500 rounded-md p-4 bg-danger-500/10 text-danger-500">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-extrabold m-0 text-foreground">브랜드 관리</h1>
      </div>

      {brands.length === 0 ? (
        <div className="card p-12 text-center text-text-tertiary">
          <div className="text-base mb-2">등록된 브랜드가 없습니다</div>
          <div className="text-sm">관리자에게 브랜드 멤버십을 요청하세요</div>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
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
    <Link
      href={`/customer/brands/${brand.id}`}
      className="block p-4 rounded-md border border-border bg-bg-secondary text-foreground no-underline transition-colors hover:bg-bg-tertiary"
    >
      <div className="flex items-center gap-3 mb-3">
        {brand.logo_url ? (
          <img
            src={brand.logo_url}
            alt={brand.name}
            className="w-12 h-12 rounded object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded bg-bg-tertiary flex items-center justify-center text-2xl">
            🏢
          </div>
        )}
        <div className="flex-1">
          <div className="font-bold text-base mb-1">{brand.name}</div>
          <div className="text-xs text-text-secondary">역할: {brand.myRole}</div>
        </div>
      </div>
      {brand.description && (
        <div className="text-sm text-text-secondary mb-2 leading-relaxed">{brand.description}</div>
      )}
      <div className="text-2xs text-text-tertiary">
        등록일: {new Date(brand.created_at).toLocaleDateString()}
      </div>
    </Link>
  );
}
