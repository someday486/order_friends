"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";

// ============================================================
// Types
// ============================================================

type DashboardStats = {
  myBrands: number;
  myBranches: number;
  totalOrders: number;
  todayOrders: number;
  pendingOrders: number;
  totalProducts: number;
  brands: Array<{
    id: string;
    name: string;
    myRole: string;
  }>;
  recentOrders: Array<{
    id: string;
    order_no: string;
    status: string;
    total_amount: number;
    created_at: string;
    branch?: {
      name: string;
    };
  }>;
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

export default function CustomerDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = await getAccessToken();

        const res = await fetch(`${API_BASE}/customer/dashboard`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`통계 조회 실패: ${res.status}`);
        }

        const data = await res.json();
        setStats(data);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "통계 조회 중 오류 발생");
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  if (loading) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 32 }}>로딩 중...</h1>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>오류 발생</h1>
        <div style={errorBox}>{error}</div>
      </div>
    );
  }

  return (
    <div>
      {/* Welcome */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>
          안녕하세요{user?.email ? `, ${user.email.split("@")[0]}님` : ""}!
        </h1>
        <p style={{ color: "#aaa", margin: "8px 0 0 0", fontSize: 14 }}>
          고객 대시보드에 오신 것을 환영합니다.
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
        <StatCard title="내 브랜드" value={stats?.myBrands ?? 0} icon="🏢" />
        <StatCard title="내 매장" value={stats?.myBranches ?? 0} icon="🏪" />
        <StatCard title="총 주문" value={stats?.totalOrders ?? 0} icon="📋" />
        <StatCard title="처리 대기" value={stats?.pendingOrders ?? 0} icon="⏳" highlight />
        <StatCard title="오늘 주문" value={stats?.todayOrders ?? 0} icon="📅" />
        <StatCard title="등록 상품" value={stats?.totalProducts ?? 0} icon="📦" />
      </div>

      {/* My Brands */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>내 브랜드</h2>
        {stats?.brands && stats.brands.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12 }}>
            {stats.brands.map((brand) => (
              <Link key={brand.id} href={`/customer/brands/${brand.id}`} style={brandCard}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{brand.name}</div>
                  <div style={{ fontSize: 12, color: "#aaa" }}>역할: {brand.myRole}</div>
                </div>
                <div style={{ fontSize: 18 }}>→</div>
              </Link>
            ))}
          </div>
        ) : (
          <div style={emptyBox}>등록된 브랜드가 없습니다.</div>
        )}
      </div>

      {/* Recent Orders */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>최근 주문</h2>
          <Link href="/customer/orders" style={{ color: "#fff", fontSize: 14 }}>
            전체 보기 →
          </Link>
        </div>
        {stats?.recentOrders && stats.recentOrders.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {stats.recentOrders.map((order) => (
              <Link key={order.id} href={`/customer/orders/${order.id}`} style={orderCard}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>주문 #{order.order_no}</div>
                  <div style={{ fontSize: 12, color: "#aaa" }}>
                    {order.branch?.name} • {new Date(order.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                    {order.total_amount.toLocaleString()}원
                  </div>
                  <div style={{ fontSize: 12, color: getStatusColor(order.status) }}>{order.status}</div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div style={emptyBox}>최근 주문이 없습니다.</div>
        )}
      </div>

      {/* Quick Links */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>빠른 이동</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <QuickLinkCard
            href="/customer/brands"
            title="브랜드 관리"
            description="브랜드 정보 수정"
            icon="🏢"
          />
          <QuickLinkCard
            href="/customer/branches"
            title="매장 관리"
            description="매장 추가 및 수정"
            icon="🏪"
          />
          <QuickLinkCard
            href="/customer/products"
            title="상품 관리"
            description="상품 등록 및 관리"
            icon="📦"
          />
          <QuickLinkCard
            href="/customer/orders"
            title="주문 관리"
            description="주문 처리 및 조회"
            icon="📋"
          />
        </div>
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
  highlight,
}: {
  title: string;
  value: number | string;
  icon: string;
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
      <div style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
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
    <Link href={href} style={quickLinkStyle}>
      <div style={{ fontSize: 18 }}>{icon}</div>
      <div>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: "#aaa" }}>{description}</div>
      </div>
    </Link>
  );
}

// ============================================================
// Helpers
// ============================================================

function getStatusColor(status: string): string {
  switch (status) {
    case "PENDING":
      return "#ffa500";
    case "CONFIRMED":
      return "#00bfff";
    case "PREPARING":
      return "#1e90ff";
    case "READY":
      return "#32cd32";
    case "COMPLETED":
      return "#888";
    case "CANCELLED":
      return "#ff4444";
    default:
      return "#aaa";
  }
}

// ============================================================
// Styles
// ============================================================

const brandCard: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "14px 16px",
  borderRadius: 10,
  border: "1px solid #222",
  background: "#0f0f0f",
  color: "white",
  textDecoration: "none",
  transition: "all 0.15s",
};

const orderCard: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 16px",
  borderRadius: 10,
  border: "1px solid #222",
  background: "#0f0f0f",
  color: "white",
  textDecoration: "none",
  transition: "all 0.15s",
};

const quickLinkStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #222",
  background: "#0f0f0f",
  color: "white",
  textDecoration: "none",
};

const emptyBox: React.CSSProperties = {
  border: "1px solid #222",
  borderRadius: 12,
  padding: 24,
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
