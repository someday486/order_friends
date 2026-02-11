"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, type UserRole } from "@/hooks/useUserRole";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { formatWon } from "@/lib/format";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/types/common";

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

// ============================================================
// Helpers
// ============================================================

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
  const { role, loading: roleLoading } = useUserRole();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await apiClient.get<DashboardStats>("/customer/dashboard");
        setStats(data);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "데이터를 불러올 수 없습니다");
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold mb-8 text-foreground">대시보드</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
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
                        {formatWon(order.total_amount)}
                      </div>
                      <Badge variant={getStatusVariant(order.status)}>
                        {ORDER_STATUS_LABEL[order.status as OrderStatus] ?? order.status}
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
        {roleLoading ? (
          <div className="text-sm text-muted-foreground">빠른 이동 로딩 중...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                href: "/customer/brands",
                title: "브랜드 관리",
                description: "브랜드 정보 수정",
                icon: "🏢",
                allowedRoles: ["system_admin", "brand_owner"],
              },
              {
                href: "/customer/branches",
                title: "매장 관리",
                description: "매장 추가 및 수정",
                icon: "🏪",
                allowedRoles: ["system_admin", "brand_owner"],
              },
              {
                href: "/customer/products",
                title: "상품 관리",
                description: "상품 등록 및 관리",
                icon: "📦",
                allowedRoles: ["system_admin", "brand_owner", "branch_manager"],
              },
              {
                href: "/customer/orders",
                title: "주문 관리",
                description: "주문 처리 및 조회",
                icon: "📋",
                allowedRoles: ["system_admin", "brand_owner", "branch_manager", "staff"],
              },
              {
                href: "/customer/analytics/brand",
                title: "브랜드 분석",
                description: "지점 통합 리포트",
                icon: "📈",
                allowedRoles: ["system_admin", "brand_owner"],
              },
            ]
              .filter((item) => !item.allowedRoles || item.allowedRoles.includes(role as UserRole))
              .map((item) => (
                <QuickLinkCard
                  key={item.href}
                  href={item.href}
                  title={item.title}
                  description={item.description}
                  icon={item.icon}
                />
              ))}
          </div>
        )}
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
