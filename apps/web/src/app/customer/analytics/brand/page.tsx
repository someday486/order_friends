"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSelectedBranch } from "@/hooks/useSelectedBranch";
import { apiClient } from "@/lib/api-client";
import Link from "next/link";

// ============================================================
// Types
// ============================================================

interface RevenueByDay {
  date: string;
  revenue: number;
  orderCount: number;
}

interface BranchBreakdown {
  branchId: string;
  branchName: string;
  revenue: number;
  orderCount: number;
}

interface BrandSalesAnalytics {
  totalRevenue: number;
  orderCount: number;
  avgOrderValue: number;
  revenueByDay: RevenueByDay[];
  byBranch: BranchBreakdown[];
}

interface TopProduct {
  productId: string;
  productName: string;
  soldQuantity: number;
  totalRevenue: number;
}

interface ProductAnalytics {
  topProducts: TopProduct[];
  salesByProduct: { productId: string; productName: string; quantity: number; revenue: number; revenuePercentage: number }[];
  inventoryTurnover: { averageTurnoverRate: number; periodDays: number };
}

interface OrderAnalytics {
  statusDistribution: { status: string; count: number; percentage: number }[];
  ordersByDay: { date: string; orderCount: number; completedCount: number; cancelledCount: number }[];
  peakHours: { hour: number; orderCount: number }[];
}

interface CustomerAnalytics {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  clv: number;
  repeatCustomerRate: number;
  avgOrdersPerCustomer: number;
}

interface PeriodComparison<T> {
  current: T;
  previous?: T;
  changes?: Record<string, number>;
}

interface Brand {
  id: string;
  name: string;
}

// ============================================================
// Helpers
// ============================================================

function formatWon(amount: number) {
  return amount.toLocaleString("ko-KR") + "원";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const STATUS_LABELS: Record<string, string> = {
  CREATED: "접수",
  CONFIRMED: "확인",
  PREPARING: "준비중",
  READY: "준비완료",
  COMPLETED: "완료",
  CANCELLED: "취소",
  REFUNDED: "환불",
};

// ============================================================
// Components
// ============================================================

function KpiCard({
  title,
  value,
  change,
}: {
  title: string;
  value: string;
  change?: number;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs text-text-secondary mb-1">{title}</div>
      <div className="text-xl font-extrabold text-foreground">{value}</div>
      {change !== undefined && (
        <div
          className={`text-xs font-semibold mt-1 ${change >= 0 ? "text-success" : "text-danger-500"}`}
        >
          {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}% vs 이전 기간
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function BrandAnalyticsPage() {
  const { session, status } = useAuth();
  const { branchId: selectedBranchId } = useSelectedBranch();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [compare, setCompare] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Date range
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Analytics data
  const [sales, setSales] = useState<PeriodComparison<BrandSalesAnalytics> | null>(null);
  const [products, setProducts] = useState<PeriodComparison<ProductAnalytics> | null>(null);
  const [orders, setOrders] = useState<PeriodComparison<OrderAnalytics> | null>(null);
  const [customers, setCustomers] = useState<PeriodComparison<CustomerAnalytics> | null>(null);

  // Load brands
  useEffect(() => {
    if (status !== "authenticated") return;
    const loadBrands = async () => {
      try {
        const data = await apiClient.get<Brand[]>("/customer/brands");
        setBrands(data);
        if (data.length > 0 && !selectedBrandId) {
          setSelectedBrandId(data[0].id);
        }
      } catch (e) {
        console.error("Failed to load brands", e);
      }
    };
    loadBrands();
  }, [status, selectedBrandId]);

  // Load analytics
  useEffect(() => {
    if (!selectedBrandId || status !== "authenticated") return;

    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          brandId: selectedBrandId,
          startDate,
          endDate,
          compare: compare.toString(),
        });

        const [salesRes, productsRes, ordersRes, customersRes] =
          await Promise.all([
            apiClient.get<PeriodComparison<BrandSalesAnalytics>>(
              `/customer/analytics/brand/sales?${params}`,
            ),
            apiClient.get<PeriodComparison<ProductAnalytics>>(
              `/customer/analytics/brand/products?${params}`,
            ),
            apiClient.get<PeriodComparison<OrderAnalytics>>(
              `/customer/analytics/brand/orders?${params}`,
            ),
            apiClient.get<PeriodComparison<CustomerAnalytics>>(
              `/customer/analytics/brand/customers?${params}`,
            ),
          ]);

        setSales(salesRes);
        setProducts(productsRes);
        setOrders(ordersRes);
        setCustomers(customersRes);
      } catch (e) {
        setError(e instanceof Error ? e.message : "분석 데이터를 불러오지 못했습니다");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [selectedBrandId, startDate, endDate, compare, status]);

  if (status === "loading") {
    return (
      <div className="p-6">
        <p className="text-text-secondary">로딩 중...</p>
      </div>
    );
  }

  const s = sales?.current;
  const c = customers?.current;
  const ch = sales?.changes;
  const cch = customers?.changes;
  const branchLinkId = selectedBranchId || s?.byBranch?.[0]?.branchId;
  const branchLink = branchLinkId
    ? `/customer/analytics?branchId=${encodeURIComponent(branchLinkId)}`
    : "/customer/analytics";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-foreground">브랜드 분석</h1>
          <p className="text-text-secondary text-[13px] mt-1">
            전체 지점 통합 분석
          </p>
        </div>
        {branchLinkId ? (
          <Link
            href={branchLink}
            className="text-xs text-primary-500 hover:underline"
          >
            지점별 분석 보기 →
          </Link>
        ) : (
          <span className="text-xs text-text-tertiary">
            지점을 선택하면 지점별 분석으로 이동합니다.
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={selectedBrandId}
          onChange={(e) => setSelectedBrandId(e.target.value)}
          className="input-field max-w-[240px]"
        >
          <option value="">브랜드 선택</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="input-field w-[140px]"
        />
        <span className="self-center text-text-tertiary">~</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="input-field w-[140px]"
        />

        <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer self-center">
          <input
            type="checkbox"
            checked={compare}
            onChange={(e) => setCompare(e.target.checked)}
            className="accent-primary"
          />
          이전 기간 비교
        </label>
      </div>

      {error && (
        <div className="border border-danger-500 rounded-md p-4 bg-danger-500/10 text-danger-500 mb-6">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-text-secondary">
          분석 데이터를 불러오는 중...
        </div>
      )}

      {!loading && s && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <KpiCard
              title="총 매출"
              value={formatWon(s.totalRevenue)}
              change={ch?.totalRevenue}
            />
            <KpiCard
              title="주문 수"
              value={`${s.orderCount}건`}
              change={ch?.orderCount}
            />
            <KpiCard
              title="평균 주문가"
              value={formatWon(s.avgOrderValue)}
              change={ch?.avgOrderValue}
            />
            <KpiCard
              title="총 고객 수"
              value={c ? `${c.totalCustomers}명` : "-"}
              change={cch?.totalCustomers}
            />
          </div>

          {/* Branch Breakdown */}
          {s.byBranch.length > 0 && (
            <div className="card p-4 mb-6">
              <h2 className="text-sm font-bold text-foreground mb-3">
                지점별 매출 비교
              </h2>
              <div className="space-y-2">
                {s.byBranch.map((branch) => {
                  const pct =
                    s.totalRevenue > 0
                      ? (branch.revenue / s.totalRevenue) * 100
                      : 0;
                  return (
                    <Link
                      key={branch.branchId}
                      href={`/customer/analytics?branchId=${encodeURIComponent(branch.branchId)}`}
                      className="flex items-center gap-3 rounded px-2 py-1 transition-colors hover:bg-bg-secondary"
                    >
                      <div className="w-24 text-xs text-foreground font-medium truncate">
                        {branch.branchName}
                      </div>
                      <div className="flex-1 h-6 bg-bg-tertiary rounded overflow-hidden">
                        <div
                          className="h-full bg-primary-500 rounded transition-all duration-500"
                          style={{ width: `${Math.max(pct, 1)}%` }}
                        />
                      </div>
                      <div className="w-28 text-right text-xs text-text-secondary">
                        {formatWon(branch.revenue)}
                      </div>
                      <div className="w-14 text-right text-xs text-text-tertiary">
                        {branch.orderCount}건
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Revenue by Day */}
          {s.revenueByDay.length > 0 && (
            <div className="card p-4 mb-6">
              <h2 className="text-sm font-bold text-foreground mb-3">
                일별 매출 추이
              </h2>
              <div className="overflow-x-auto">
                <div className="flex gap-1 min-w-fit">
                  {s.revenueByDay.map((day) => {
                    const maxRevenue = Math.max(
                      ...s.revenueByDay.map((d) => d.revenue),
                    );
                    const height =
                      maxRevenue > 0
                        ? Math.max((day.revenue / maxRevenue) * 120, 4)
                        : 4;
                    return (
                      <div
                        key={day.date}
                        className="flex flex-col items-center gap-1"
                        title={`${day.date}: ${formatWon(day.revenue)} (${day.orderCount}건)`}
                      >
                        <div
                          className="w-4 bg-primary-500 rounded-t transition-all duration-300"
                          style={{ height: `${height}px` }}
                        />
                        <span className="text-[9px] text-text-tertiary -rotate-45 origin-top-left whitespace-nowrap">
                          {formatDate(day.date)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Top Products */}
          {products?.current.topProducts &&
            products.current.topProducts.length > 0 && (
              <div className="card p-4 mb-6">
                <h2 className="text-sm font-bold text-foreground mb-3">
                  인기 상품 Top 10
                </h2>
                <div className="space-y-1.5">
                  {products.current.topProducts.map((p, i) => (
                    <div
                      key={p.productId}
                      className="flex items-center gap-3 py-2 px-3 rounded bg-bg-secondary"
                    >
                      <span className="w-6 h-6 flex items-center justify-center rounded-full bg-bg-tertiary text-xs font-bold text-text-secondary">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm text-foreground truncate">
                        {p.productName}
                      </span>
                      <span className="text-xs text-text-secondary">
                        {p.soldQuantity}개
                      </span>
                      <span className="text-xs font-semibold text-foreground w-24 text-right">
                        {formatWon(p.totalRevenue)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Order Status Distribution + Peak Hours */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            {orders?.current.statusDistribution &&
              orders.current.statusDistribution.length > 0 && (
                <div className="card p-4">
                  <h2 className="text-sm font-bold text-foreground mb-3">
                    주문 상태 분포
                  </h2>
                  <div className="space-y-2">
                    {orders.current.statusDistribution.map((s) => (
                      <div key={s.status} className="flex items-center gap-2">
                        <span className="w-16 text-xs text-text-secondary">
                          {STATUS_LABELS[s.status] || s.status}
                        </span>
                        <div className="flex-1 h-4 bg-bg-tertiary rounded overflow-hidden">
                          <div
                            className="h-full bg-primary-500/70 rounded"
                            style={{ width: `${s.percentage}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-xs text-text-secondary">
                          {s.count}건
                        </span>
                        <span className="w-12 text-right text-xs text-text-tertiary">
                          {s.percentage}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {orders?.current.peakHours &&
              orders.current.peakHours.length > 0 && (
                <div className="card p-4">
                  <h2 className="text-sm font-bold text-foreground mb-3">
                    시간대별 주문
                  </h2>
                  <div className="flex items-end gap-0.5 h-[120px]">
                    {orders.current.peakHours.map((ph) => {
                      const maxCount = Math.max(
                        ...orders.current.peakHours.map((h) => h.orderCount),
                      );
                      const height =
                        maxCount > 0
                          ? Math.max((ph.orderCount / maxCount) * 100, 2)
                          : 2;
                      return (
                        <div
                          key={ph.hour}
                          className="flex flex-col items-center flex-1"
                          title={`${ph.hour}시: ${ph.orderCount}건`}
                        >
                          <div
                            className="w-full bg-primary-500/60 rounded-t"
                            style={{ height: `${height}%` }}
                          />
                          <span className="text-[8px] text-text-tertiary mt-0.5">
                            {ph.hour}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
          </div>

          {/* Customer KPIs */}
          {c && (
            <div className="card p-4 mb-6">
              <h2 className="text-sm font-bold text-foreground mb-3">
                고객 분석
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <KpiCard
                  title="신규 고객"
                  value={`${c.newCustomers}명`}
                  change={cch?.newCustomers}
                />
                <KpiCard
                  title="재구매 고객"
                  value={`${c.returningCustomers}명`}
                  change={cch?.returningCustomers}
                />
                <KpiCard
                  title="재구매율"
                  value={`${c.repeatCustomerRate}%`}
                  change={cch?.repeatCustomerRate}
                />
                <KpiCard
                  title="고객 생애 가치"
                  value={formatWon(c.clv)}
                  change={cch?.clv}
                />
                <KpiCard
                  title="평균 주문 수"
                  value={`${c.avgOrdersPerCustomer}회`}
                />
              </div>
            </div>
          )}
        </>
      )}

      {!loading && !s && selectedBrandId && !error && (
        <div className="text-center py-12 text-text-tertiary">
          데이터가 없습니다.
        </div>
      )}
    </div>
  );
}
