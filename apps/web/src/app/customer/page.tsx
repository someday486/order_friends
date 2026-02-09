"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

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

function getStatusVariant(status: string): "info" | "success" | "warning" | "danger" | "default" {
  switch (status) {
    case "PENDING":
    case "CREATED":
      return "info";
    case "CONFIRMED":
    case "PREPARING":
      return "warning";
    case "READY":
    case "COMPLETED":
      return "success";
    case "CANCELLED":
      return "danger";
    default:
      return "default";
  }
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
        <h1 className="text-2xl font-extrabold mb-8">로딩 중...</h1>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold mb-4">오류 발생</h1>
        <Card className="border-danger bg-danger/10">
          <CardContent className="p-4">
            <p className="text-danger">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold m-0">
          안녕하세요{user?.email ? `, ${user.email.split("@")[0]}님` : ""}!
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          고객 대시보드에 오신 것을 환영합니다.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard title="내 브랜드" value={stats?.myBrands ?? 0} icon="🏢" />
        <StatCard title="내 매장" value={stats?.myBranches ?? 0} icon="🏪" />
        <StatCard title="총 주문" value={stats?.totalOrders ?? 0} icon="📋" />
        <StatCard title="처리 대기" value={stats?.pendingOrders ?? 0} icon="⏳" highlight />
        <StatCard title="오늘 주문" value={stats?.todayOrders ?? 0} icon="📅" />
        <StatCard title="등록 상품" value={stats?.totalProducts ?? 0} icon="📦" />
      </div>

      {/* My Brands */}
      <div className="mb-8">
        <h2 className="text-lg font-bold mb-4">내 브랜드</h2>
        {stats?.brands && stats.brands.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.brands.map((brand) => (
              <Link key={brand.id} href={`/customer/brands/${brand.id}`}>
                <Card hover className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold mb-1">{brand.name}</div>
                      <div className="text-xs text-muted-foreground">역할: {brand.myRole}</div>
                    </div>
                    <div className="text-lg">→</div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="bg-background">
            <CardContent className="p-6 text-center text-muted">
              등록된 브랜드가 없습니다.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Orders */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold m-0">최근 주문</h2>
          <Link href="/customer/orders" className="text-foreground text-sm hover:underline">
            전체 보기 →
          </Link>
        </div>
        {stats?.recentOrders && stats.recentOrders.length > 0 ? (
          <div className="flex flex-col gap-2">
            {stats.recentOrders.map((order) => (
              <Link key={order.id} href={`/customer/orders/${order.id}`}>
                <Card hover className="p-3">
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="font-semibold mb-1">주문 #{order.order_no}</div>
                      <div className="text-xs text-muted-foreground">
                        {order.branch?.name} • {new Date(order.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold mb-1">
                        {order.total_amount.toLocaleString()}원
                      </div>
                      <Badge variant={getStatusVariant(order.status)}>
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="bg-background">
            <CardContent className="p-6 text-center text-muted">
              최근 주문이 없습니다.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Links */}
      <div className="mb-8">
        <h2 className="text-lg font-bold mb-4">빠른 이동</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
    <Card className={highlight ? "border-warning" : ""} padding="lg">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <span className="text-muted-foreground text-sm">{title}</span>
      </div>
      <div className="text-3xl font-extrabold">{value}</div>
    </Card>
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
    <Link href={href}>
      <Card hover className="p-3">
        <div className="flex items-center gap-3">
          <div className="text-lg">{icon}</div>
          <div>
            <div className="font-bold mb-0.5">{title}</div>
            <div className="text-xs text-muted-foreground">{description}</div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
