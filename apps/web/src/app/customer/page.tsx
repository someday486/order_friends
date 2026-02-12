"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { formatWon } from "@/lib/format";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/types/common";
import { useAuth } from "@/hooks/useAuth";
import {
  BrandIcon,
  InventoryIcon,
  OrderIcon,
  ProductIcon,
  TrendIcon,
} from "@/components/ui/icons";

type DashboardStats = {
  myBrands?: number;
  myBranches?: number;
  myBrandsCount?: number;
  myBranchesCount?: number;
  totalOrders: number;
  todayOrders: number;
  pendingOrders: number;
  totalProducts: number;
  brands: Array<{
    id: string;
    name: string;
    myRole?: string;
  }>;
  recentOrders: Array<{
    id: string;
    order_no?: string;
    status: string;
    total_amount: number;
    created_at: string;
    branch?: {
      name: string;
    };
  }>;
};

type Branch = {
  id: string;
  name: string;
};

type LowStockAlert = {
  product_id: string;
  product_name: string;
  branch_name?: string;
  qty_available: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
};

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

export default function CustomerDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
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

  useEffect(() => {
    const loadAlerts = async () => {
      try {
        const branches = await apiClient.get<Branch[]>("/customer/branches");
        const results = await Promise.all(
          branches.map((branch) =>
            apiClient
              .get<LowStockAlert[]>(
                `/customer/inventory/alerts?branchId=${encodeURIComponent(branch.id)}`,
              )
              .catch(() => []),
          ),
        );
        const merged = results
          .flat()
          .filter((item) => item.is_low_stock)
          .sort((a, b) => a.qty_available - b.qty_available);
        setAlerts(merged);
      } catch (e) {
        console.warn("low stock alerts fetch failed", e);
      }
    };
    loadAlerts();
  }, []);

  const myBrands = stats?.myBrands ?? stats?.myBrandsCount ?? 0;
  const myBranches = stats?.myBranches ?? stats?.myBranchesCount ?? 0;
  const recentRevenue = useMemo(
    () => (stats?.recentOrders ?? []).reduce((sum, order) => sum + (order.total_amount || 0), 0),
    [stats?.recentOrders],
  );

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold mb-8 text-foreground">대시보드</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold mb-4 text-foreground">대시보드</h1>
        <Card className="border-danger bg-danger/10">
          <CardContent className="p-4">
            <p className="text-danger">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-gradient-to-r from-bg-secondary to-bg-tertiary p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">
              운영 대시보드{user?.email ? ` · ${user.email.split("@")[0]}` : ""}
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              주문/재고 중심 핵심 지표를 한 화면에서 확인합니다.
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-text-tertiary">최근 주문 매출 합계</div>
            <div className="text-2xl font-extrabold text-foreground">{formatWon(recentRevenue)}</div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="내 브랜드" value={myBrands} icon={<BrandIcon size={18} />} />
        <MetricCard title="내 매장" value={myBranches} icon={<TrendIcon size={18} />} />
        <MetricCard title="총 주문" value={stats?.totalOrders ?? 0} icon={<OrderIcon size={18} />} />
        <MetricCard title="등록 상품" value={stats?.totalProducts ?? 0} icon={<ProductIcon size={18} />} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">최근 주문</h2>
            <Link href="/customer/orders" className="text-sm text-primary-500 hover:underline">
              전체 보기
            </Link>
          </div>
          {(stats?.recentOrders ?? []).length === 0 ? (
            <div className="text-sm text-text-tertiary py-8 text-center">최근 주문이 없습니다.</div>
          ) : (
            <div className="space-y-2">
              {(stats?.recentOrders ?? []).map((order) => (
                <Link
                  key={order.id}
                  href={`/customer/orders/${order.id}`}
                  className="block no-underline rounded-lg border border-border p-3 hover:bg-bg-tertiary transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">
                        주문 #{order.order_no || order.id.slice(0, 8)}
                      </div>
                      <div className="text-xs text-text-tertiary">
                        {order.branch?.name || "매장 미상"} · {new Date(order.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-foreground">{formatWon(order.total_amount)}</div>
                      <Badge variant={getStatusVariant(order.status)}>
                        {ORDER_STATUS_LABEL[order.status as OrderStatus] ?? order.status}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <InventoryIcon size={18} />
            <h2 className="text-lg font-bold text-foreground">재고 부족 알림</h2>
          </div>
          <div className="mb-3 text-sm text-text-secondary">
            현재 <span className="font-bold text-danger-500">{alerts.length}</span>개 상품이 부족 상태입니다.
          </div>
          {alerts.length === 0 ? (
            <div className="text-sm text-text-tertiary py-4">모든 상품의 재고가 정상입니다.</div>
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, 6).map((alert) => (
                <Link
                  key={`${alert.product_id}-${alert.branch_name || ""}`}
                  href={`/customer/inventory/${alert.product_id}`}
                  className="block no-underline rounded-lg border border-danger-500/20 bg-danger-500/5 p-2.5 hover:bg-danger-500/10 transition-colors"
                >
                  <div className="text-sm font-semibold text-foreground truncate">{alert.product_name}</div>
                  <div className="text-xs text-text-secondary mt-0.5">
                    {alert.branch_name || "-"} · {alert.qty_available}/{alert.low_stock_threshold}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-text-secondary">{title}</div>
        <div className="text-text-tertiary">{icon}</div>
      </div>
      <div className="text-3xl font-extrabold text-foreground">{value}</div>
    </Card>
  );
}
