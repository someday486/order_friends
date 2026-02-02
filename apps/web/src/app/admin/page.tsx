"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";

// ============================================================
// Types
// ============================================================

type DashboardStats = {
  totalOrders: number;
  pendingOrders: number;
  todayOrders: number;
  totalProducts: number;
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
  if (!token) throw new Error("No access_token");
  return token;
}

// ============================================================
// Component
// ============================================================

export default function AdminHomePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        const token = await getAccessToken();
        
        const res = await fetch(`${API_BASE}/admin/dashboard/stats`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`통계 조회 실패: ${res.status}`);
        }

        const data = await res.json();
        setStats({
          totalOrders: data.totalOrders ?? 0,
          pendingOrders: data.pendingOrders ?? 0,
          todayOrders: data.todayOrders ?? 0,
          totalProducts: data.totalProducts ?? 0,
        });
      } catch (e) {
        console.error(e);
        // 에러 시 기본값
        setStats({
          totalOrders: 0,
          pendingOrders: 0,
          todayOrders: 0,
          totalProducts: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  return (
    <div>
      {/* Welcome */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>
          안녕하세요{user?.email ? `, ${user.email.split("@")[0]}님` : ""}! 👋
        </h1>
        <p style={{ color: "#aaa", margin: "8px 0 0 0", fontSize: 14 }}>
          오더프렌즈 관리자 대시보드입니다.
        </p>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <StatCard
          title="전체 주문"
          value={stats?.totalOrders ?? "-"}
          icon="📋"
          loading={loading}
        />
        <StatCard
          title="처리 대기"
          value={stats?.pendingOrders ?? "-"}
          icon="⏳"
          loading={loading}
          highlight
        />
        <StatCard
          title="오늘 주문"
          value={stats?.todayOrders ?? "-"}
          icon="📅"
          loading={loading}
        />
        <StatCard
          title="등록 상품"
          value={stats?.totalProducts ?? "-"}
          icon="📦"
          loading={loading}
        />
      </div>

      {/* Quick Links */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>빠른 이동</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <QuickLinkCard href="/admin/orders" title="주문 관리" description="주문 목록 조회 및 처리" icon="📋" />
          <QuickLinkCard href="/admin/products" title="상품 관리" description="상품 등록 및 수정" icon="📦" />
          <QuickLinkCard href="/admin/stores" title="가게 관리" description="지점 추가 및 관리" icon="🏪" />
          <QuickLinkCard href="/admin/brand" title="브랜드 관리" description="브랜드 정보 설정" icon="🏢" />
        </div>
      </div>

      {/* Info */}
      <div style={infoBox}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>💡 시작하기</div>
        <ol style={{ margin: 0, paddingLeft: 20, color: "#aaa", fontSize: 13, lineHeight: 1.8 }}>
          <li>브랜드 관리에서 브랜드를 생성하세요.</li>
          <li>가게 관리에서 브랜드에 속한 가게를 추가하세요.</li>
          <li>상품 관리에서 가게별 상품을 등록하세요.</li>
          <li>주문이 들어오면 주문 관리에서 처리하세요.</li>
        </ol>
      </div>
    </div>
  );
}

// ============================================================
// Sub Components
// ============================================================

function StatCard({
  title,
  value,
  icon,
  loading,
  highlight,
}: {
  title: string;
  value: number | string;
  icon: string;
  loading?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        padding: 20,
        borderRadius: 14,
        border: `1px solid ${highlight ? "#333" : "#222"}`,
        background: highlight ? "#0f0f0f" : "#0a0a0a",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ color: "#aaa", fontSize: 13 }}>{title}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800 }}>
        {loading ? <span style={{ color: "#444" }}>...</span> : value}
      </div>
    </div>
  );
}

function QuickLinkCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div style={quickLinkStyle}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
        <div style={{ fontWeight: 700, color: "white", marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: "#666" }}>{description}</div>
      </div>
    </Link>
  );
}

// ============================================================
// Styles
// ============================================================

const quickLinkStyle: React.CSSProperties = {
  width: 180,
  padding: 16,
  borderRadius: 12,
  border: "1px solid #222",
  background: "#0a0a0a",
  cursor: "pointer",
  transition: "all 0.15s",
};

const infoBox: React.CSSProperties = {
  padding: 20,
  borderRadius: 12,
  border: "1px solid #222",
  background: "#0a0a0a",
};
