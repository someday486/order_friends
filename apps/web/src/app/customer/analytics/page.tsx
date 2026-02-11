"use client";

import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSelectedBranch } from "@/hooks/useSelectedBranch";
import { apiClient } from "@/lib/api-client";
import { useRouter, useSearchParams } from "next/navigation";
import LineChart from "@/components/analytics/LineChart";
import BarChart from "@/components/analytics/BarChart";
import PieChart from "@/components/analytics/PieChart";
import KpiCard from "@/components/analytics/KpiCard";
import ParetoChart from "@/components/analytics/ParetoChart";
import HeatmapTable from "@/components/analytics/HeatmapTable";
import RfmScatterChart from "@/components/analytics/RfmScatterChart";
import Tooltip from "@/components/ui/Tooltip";
import {
  AbcAnalysis,
  CohortAnalysis,
  CombinationAnalysis,
  CustomerAnalytics,
  HourlyProductAnalysis,
  MaybePeriodComparison,
  OrderAnalytics,
  PeriodComparison,
  ProductAnalytics,
  RfmAnalysis,
  SalesAnalytics,
} from "@/types/analytics";

interface Branch {
  id: string;
  name: string;
}

const formatCurrency = (value: number | string) => {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numericValue)) {
    return String(value);
  }
  return `₩${numericValue.toLocaleString()}`;
};

const formatPercent = (value: number | string) => {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numericValue)) {
    return String(value);
  }
  return `${numericValue.toFixed(1)}%`;
};

const formatDecimal = (value: number | string) => {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numericValue)) {
    return String(value);
  }
  return numericValue.toFixed(1);
};

const isPeriodComparison = <T,>(
  value: MaybePeriodComparison<T>
): value is PeriodComparison<T> => {
  return typeof value === "object" && value !== null && "current" in value;
};

const normalizeComparison = <T,>(
  value: MaybePeriodComparison<T>
): PeriodComparison<T> => {
  if (isPeriodComparison(value)) {
    return value;
  }
  return { current: value as T };
};

const HelpLabel = ({ label, description }: { label: string; description: string }) => (
  <span className="inline-flex items-center gap-1">
    <span>{label}</span>
    <Tooltip content={description}>
      <button
        type="button"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-bg-tertiary text-[10px] text-text-tertiary"
        aria-label={`${label} 도움말`}
      >
        ?
      </button>
    </Tooltip>
  </span>
);

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-6"><p>로딩 중...</p></div>}>
      <AnalyticsContent />
    </Suspense>
  );
}

function AnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, status } = useAuth();
  const {
    branchId: selectedBranchId,
    selectBranch,
    clearBranch,
  } = useSelectedBranch();

  const branchId = searchParams.get("branchId");
  const effectiveBranchId = branchId || selectedBranchId;

  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [compareEnabled, setCompareEnabled] = useState(false);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchLoading, setBranchLoading] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);

  const [salesData, setSalesData] = useState<PeriodComparison<SalesAnalytics> | null>(null);
  const [productData, setProductData] = useState<PeriodComparison<ProductAnalytics> | null>(null);
  const [orderData, setOrderData] = useState<PeriodComparison<OrderAnalytics> | null>(null);
  const [customerData, setCustomerData] = useState<PeriodComparison<CustomerAnalytics> | null>(null);
  const [abcData, setAbcData] = useState<AbcAnalysis | null>(null);
  const [hourlyData, setHourlyData] = useState<HourlyProductAnalysis | null>(null);
  const [combinationData, setCombinationData] = useState<CombinationAnalysis | null>(null);
  const [cohortData, setCohortData] = useState<CohortAnalysis | null>(null);
  const [rfmData, setRfmData] = useState<RfmAnalysis | null>(null);

  const [activeTab, setActiveTab] = useState<"sales" | "products" | "orders" | "customers">("sales");
  const [tabLoading, setTabLoading] = useState({
    sales: false,
    products: false,
    orders: false,
    customers: false,
  });
  const [tabErrors, setTabErrors] = useState<{
    sales: string | null;
    products: string | null;
    orders: string | null;
    customers: string | null;
  }>({
    sales: null,
    products: null,
    orders: null,
    customers: null,
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;

    const loadBranches = async () => {
      setBranchLoading(true);
      setBranchError(null);
      try {
        const data = await apiClient.get<Branch[]>("/customer/branches");
        setBranches(data);

        if (!branchId && !selectedBranchId && data.length === 1) {
          const onlyBranchId = data[0].id;
          selectBranch(onlyBranchId);
          router.replace(`/customer/analytics?branchId=${encodeURIComponent(onlyBranchId)}`);
        }
      } catch (err) {
        setBranches([]);
        setBranchError(err instanceof Error ? err.message : "지점 목록을 불러오지 못했습니다");
      } finally {
        setBranchLoading(false);
      }
    };

    loadBranches();
  }, [status, branchId, selectedBranchId, selectBranch, router]);

  useEffect(() => {
    if (!branchId) return;
    if (branchId !== selectedBranchId) {
      selectBranch(branchId);
    }
  }, [branchId, selectedBranchId, selectBranch]);

  useEffect(() => {
    if (!effectiveBranchId) {
      setSalesData(null);
      setProductData(null);
      setOrderData(null);
      setCustomerData(null);
      setAbcData(null);
      setHourlyData(null);
      setCombinationData(null);
      setCohortData(null);
      setRfmData(null);
    }
  }, [effectiveBranchId]);

  useEffect(() => {
    if (!effectiveBranchId || !session || activeTab !== "sales") return;
    let cancelled = false;

    const fetchSales = async () => {
      setTabLoading((prev) => ({ ...prev, sales: true }));
      setTabErrors((prev) => ({ ...prev, sales: null }));

      try {
        const params = new URLSearchParams({
          branchId: effectiveBranchId,
          startDate,
          endDate,
        });

        if (compareEnabled) {
          params.set("compare", "true");
        }

        const [salesResult] = await Promise.allSettled([
          apiClient.get<MaybePeriodComparison<SalesAnalytics>>(
            `/customer/analytics/sales?${params}`
          ),
        ]);

        if (cancelled) return;

        if (salesResult.status === "fulfilled") {
          setSalesData(normalizeComparison(salesResult.value));
        } else {
          setSalesData(null);
          const message =
            salesResult.reason instanceof Error
              ? salesResult.reason.message
              : "매출 데이터를 불러오지 못했습니다";
          setTabErrors((prev) => ({ ...prev, sales: message }));
        }
      } finally {
        if (!cancelled) {
          setTabLoading((prev) => ({ ...prev, sales: false }));
        }
      }
    };

    fetchSales();
    return () => {
      cancelled = true;
    };
  }, [effectiveBranchId, session, startDate, endDate, compareEnabled, activeTab]);

  useEffect(() => {
    if (!effectiveBranchId || !session || activeTab !== "products") return;
    let cancelled = false;

    const fetchProducts = async () => {
      setTabLoading((prev) => ({ ...prev, products: true }));
      setTabErrors((prev) => ({ ...prev, products: null }));

      setProductData(null);
      setAbcData(null);
      setHourlyData(null);
      setCombinationData(null);

      try {
        const params = new URLSearchParams({
          branchId: effectiveBranchId,
          startDate,
          endDate,
        });

        if (compareEnabled) {
          params.set("compare", "true");
        }

        const combinationParams = new URLSearchParams(params);
        combinationParams.set("minCount", "2");

        const [productsResult, abcResult, hourlyResult, combinationsResult] =
          await Promise.allSettled([
            apiClient.get<MaybePeriodComparison<ProductAnalytics>>(
              `/customer/analytics/products?${params}`
            ),
            apiClient.get<AbcAnalysis>(`/customer/analytics/products/abc?${params}`),
            apiClient.get<HourlyProductAnalysis>(
              `/customer/analytics/products/hourly?${params}`
            ),
            apiClient.get<CombinationAnalysis>(
              `/customer/analytics/products/combinations?${combinationParams}`
            ),
          ]);

        if (cancelled) return;

        const errors: string[] = [];

        if (productsResult.status === "fulfilled") {
          setProductData(normalizeComparison(productsResult.value));
        } else {
          setProductData(null);
          errors.push("상품 분석");
        }

        if (abcResult.status === "fulfilled") {
          setAbcData(abcResult.value);
        } else {
          setAbcData(null);
          errors.push("ABC 분석");
        }

        if (hourlyResult.status === "fulfilled") {
          setHourlyData(hourlyResult.value);
        } else {
          setHourlyData(null);
          errors.push("시간대별 인기 상품");
        }

        if (combinationsResult.status === "fulfilled") {
          setCombinationData(combinationsResult.value);
        } else {
          setCombinationData(null);
          errors.push("조합 분석");
        }

        if (errors.length > 0) {
          setTabErrors((prev) => ({
            ...prev,
            products: `일부 데이터를 불러오지 못했습니다. (${errors.join(", ")})`,
          }));
        }
      } finally {
        if (!cancelled) {
          setTabLoading((prev) => ({ ...prev, products: false }));
        }
      }
    };

    fetchProducts();
    return () => {
      cancelled = true;
    };
  }, [effectiveBranchId, session, startDate, endDate, compareEnabled, activeTab]);

  useEffect(() => {
    if (!effectiveBranchId || !session || activeTab !== "orders") return;
    let cancelled = false;

    const fetchOrders = async () => {
      setTabLoading((prev) => ({ ...prev, orders: true }));
      setTabErrors((prev) => ({ ...prev, orders: null }));

      try {
        const params = new URLSearchParams({
          branchId: effectiveBranchId,
          startDate,
          endDate,
        });

        if (compareEnabled) {
          params.set("compare", "true");
        }

        const [ordersResult] = await Promise.allSettled([
          apiClient.get<MaybePeriodComparison<OrderAnalytics>>(
            `/customer/analytics/orders?${params}`
          ),
        ]);

        if (cancelled) return;

        if (ordersResult.status === "fulfilled") {
          setOrderData(normalizeComparison(ordersResult.value));
        } else {
          setOrderData(null);
          const message =
            ordersResult.reason instanceof Error
              ? ordersResult.reason.message
              : "주문 데이터를 불러오지 못했습니다";
          setTabErrors((prev) => ({ ...prev, orders: message }));
        }
      } finally {
        if (!cancelled) {
          setTabLoading((prev) => ({ ...prev, orders: false }));
        }
      }
    };

    fetchOrders();
    return () => {
      cancelled = true;
    };
  }, [effectiveBranchId, session, startDate, endDate, compareEnabled, activeTab]);

  useEffect(() => {
    if (!effectiveBranchId || !session || activeTab !== "customers") return;
    let cancelled = false;

    const fetchCustomers = async () => {
      setTabLoading((prev) => ({ ...prev, customers: true }));
      setTabErrors((prev) => ({ ...prev, customers: null }));

      setCustomerData(null);
      setCohortData(null);
      setRfmData(null);

      try {
        const params = new URLSearchParams({
          branchId: effectiveBranchId,
          startDate,
          endDate,
        });

        if (compareEnabled) {
          params.set("compare", "true");
        }

        const cohortParams = new URLSearchParams(params);
        cohortParams.set("granularity", "MONTH");

        const [customersResult, cohortResult, rfmResult] = await Promise.allSettled([
          apiClient.get<MaybePeriodComparison<CustomerAnalytics>>(
            `/customer/analytics/customers?${params}`
          ),
          apiClient.get<CohortAnalysis>(
            `/customer/analytics/customers/cohort?${cohortParams}`
          ),
          apiClient.get<RfmAnalysis>(`/customer/analytics/customers/rfm?${params}`),
        ]);

        if (cancelled) return;

        const errors: string[] = [];

        if (customersResult.status === "fulfilled") {
          setCustomerData(normalizeComparison(customersResult.value));
        } else {
          setCustomerData(null);
          errors.push("고객 분석");
        }

        if (cohortResult.status === "fulfilled") {
          setCohortData(cohortResult.value);
        } else {
          setCohortData(null);
          errors.push("코호트 분석");
        }

        if (rfmResult.status === "fulfilled") {
          setRfmData(rfmResult.value);
        } else {
          setRfmData(null);
          errors.push("RFM 분석");
        }

        if (errors.length > 0) {
          setTabErrors((prev) => ({
            ...prev,
            customers: `일부 데이터를 불러오지 못했습니다. (${errors.join(", ")})`,
          }));
        }
      } finally {
        if (!cancelled) {
          setTabLoading((prev) => ({ ...prev, customers: false }));
        }
      }
    };

    fetchCustomers();
    return () => {
      cancelled = true;
    };
  }, [effectiveBranchId, session, startDate, endDate, compareEnabled, activeTab]);

  if (status === "loading") {
    return (
      <div className="p-6">
        <p className="text-text-secondary">로딩 중...</p>
      </div>
    );
  }

  const statusLabelMap: Record<string, string> = {
    CREATED: "생성",
    CONFIRMED: "확정",
    PREPARING: "준비중",
    READY: "준비완료",
    COMPLETED: "완료",
    CANCELLED: "취소",
    REFUNDED: "환불",
  };

  const salesCurrent = salesData?.current;
  const productCurrent = productData?.current;
  const orderCurrent = orderData?.current;
  const customerCurrent = customerData?.current;
  const branchPlaceholder = branchLoading
    ? "지점 불러오는 중..."
    : branches.length === 0
      ? "지점 없음"
      : "지점 선택";
  const paretoItems = abcData?.items?.slice(0, 15) ?? [];
  const paretoChartData = paretoItems.map((item) => ({
    name: item.productName,
    revenue: item.revenue,
    cumulative: item.cumulativePercentage,
  }));
  const abcSummaryData = abcData
    ? [
        { grade: "A", value: abcData.summary.gradeA.revenuePercentage },
        { grade: "B", value: abcData.summary.gradeB.revenuePercentage },
        { grade: "C", value: abcData.summary.gradeC.revenuePercentage },
      ]
    : [];
  const hourlyList = hourlyData?.hourlyData ?? [];
  const hourlyMap = new Map(hourlyList.map((item) => [item.hour, item]));
  const hours = Array.from({ length: 24 }, (_, index) => index);
  const hourlyTotals = hourlyList.reduce<Map<string, number>>((acc, item) => {
    item.topProducts.forEach((product) => {
      acc.set(product.productName, (acc.get(product.productName) ?? 0) + product.quantity);
    });
    return acc;
  }, new Map());
  const topHourlyProducts = Array.from(hourlyTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);
  const hourlyMatrix = topHourlyProducts.map((name) =>
    hours.map((hour) => {
      const hourData = hourlyMap.get(hour);
      const product = hourData?.topProducts.find((item) => item.productName === name);
      return product?.quantity ?? 0;
    })
  );
  const combinationRows = combinationData?.combinations
    ?.slice()
    .sort((a, b) => b.supportRate - a.supportRate) ?? [];
  const cohortRows = cohortData?.cohorts ?? [];
  const cohortPeriods = Array.from(
    new Set(
      cohortRows.flatMap((row) => row.retention.map((retention) => retention.period))
    )
  ).sort((a, b) => a - b);
  const cohortMatrix = cohortRows.map((row) =>
    cohortPeriods.map((period) => {
      const retention = row.retention.find((entry) => entry.period === period);
      return retention?.retentionRate ?? 0;
    })
  );
  const rfmSummary = rfmData?.summary ?? [];
  const rfmPoints = rfmData?.customers ?? [];
  const activeLoading = tabLoading[activeTab];
  const activeError = tabErrors[activeTab];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <h1 className="text-2xl font-bold text-foreground">분석 대시보드</h1>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm mb-1 text-text-secondary">지점</label>
            <select
              value={effectiveBranchId ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                if (!value) {
                  clearBranch();
                  router.replace("/customer/analytics");
                  return;
                }
                selectBranch(value);
                router.replace(`/customer/analytics?branchId=${encodeURIComponent(value)}`);
              }}
              className="input-field min-w-[200px]"
              disabled={branchLoading || branches.length === 0}
            >
              <option value="">{branchPlaceholder}</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            {branchError && (
              <p className="text-xs text-danger-500 mt-1">{branchError}</p>
            )}
          </div>
          <div>
            <label className="block text-sm mb-1 text-text-secondary">시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-text-secondary">종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-field"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary-500"
              checked={compareEnabled}
              onChange={(e) => setCompareEnabled(e.target.checked)}
            />
            이전 기간 비교
          </label>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-6">
        {[
          { key: "sales", label: "매출" },
          { key: "products", label: "상품" },
          { key: "orders", label: "주문" },
          { key: "customers", label: "고객" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() =>
              setActiveTab(tab.key as "sales" | "products" | "orders" | "customers")
            }
            className={`category-tab ${activeTab === tab.key ? "category-tab-active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {!effectiveBranchId && (
        <div className="rounded-md border border-border bg-bg-secondary p-4 text-sm text-text-secondary">
          지점을 선택하면 분석 데이터를 확인할 수 있습니다.
        </div>
      )}

      {activeLoading && <p className="text-text-secondary">분석 데이터를 불러오는 중...</p>}
      {activeError && <p className="text-danger-500">오류: {activeError}</p>}

      {effectiveBranchId && (
        <>
          {/* 매출 분석 */}
          {activeTab === "sales" && salesCurrent && (
            <div className="card p-6 space-y-6">
              <h2 className="text-xl font-semibold text-foreground">매출 분석</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KpiCard
                  title="총 매출"
                  value={salesCurrent.totalRevenue}
                  change={compareEnabled ? salesData?.changes?.totalRevenue : undefined}
                  formatter={formatCurrency}
                />
                <KpiCard
                  title="주문 수"
                  value={salesCurrent.orderCount}
                  change={compareEnabled ? salesData?.changes?.orderCount : undefined}
                />
                <KpiCard
                  title="평균 주문 금액"
                  value={salesCurrent.avgOrderValue}
                  change={compareEnabled ? salesData?.changes?.avgOrderValue : undefined}
                  formatter={formatCurrency}
                />
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-foreground">일별 매출</h3>
                {salesCurrent.revenueByDay.length > 0 ? (
                  <LineChart
                    data={salesCurrent.revenueByDay}
                    xKey="date"
                    lines={[
                      { dataKey: "revenue", name: "매출", color: "#2563eb" },
                      { dataKey: "orderCount", name: "주문 수", color: "#22c55e" },
                    ]}
                    tooltipFormatter={(value, name) =>
                      name === "매출" ? formatCurrency(value) : value.toLocaleString()
                    }
                  />
                ) : (
                  <p className="text-sm text-text-secondary">데이터가 없습니다.</p>
                )}
              </div>
            </div>
          )}

          {/* 상품 분석 */}
          {activeTab === "products" && productCurrent && (
            <div className="card p-6 space-y-6">
              <h2 className="text-xl font-semibold text-foreground">상품 분석</h2>
              <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
                <div>
                  <h3 className="font-semibold mb-2 text-foreground">상위 10개 상품</h3>
                  {productCurrent.topProducts.length > 0 ? (
                    <BarChart
                      data={productCurrent.topProducts.map((product) => ({
                        name: product.productName,
                        revenue: product.totalRevenue,
                      }))}
                      xKey="name"
                      valueKey="revenue"
                      layout="vertical"
                      valueFormatter={(value) => formatCurrency(value)}
                    />
                  ) : (
                    <p className="text-sm text-text-secondary">데이터가 없습니다.</p>
                  )}
                </div>
                <div className="space-y-4">
                  <KpiCard
                    title="평균 회전율"
                    value={`${productCurrent.inventoryTurnover.averageTurnoverRate.toFixed(2)}배`}
                    titleTooltip="기간 내 판매량을 평균 재고량으로 나눈 재고 소진 속도입니다."
                  />
                  <KpiCard
                    title="기간"
                    value={`${productCurrent.inventoryTurnover.periodDays}일`}
                  />
                </div>
              </div>
            </div>
          )}

          {(abcData || hourlyData || combinationData) && (
            <div className="card p-6 space-y-8">
              <h2 className="text-xl font-semibold text-foreground">상품 분석 심화</h2>

              <div>
                <h3 className="font-semibold mb-2 text-foreground">
                  <HelpLabel
                    label="ABC 분석"
                    description="매출 기여도 기준으로 상품을 A/B/C로 분류합니다."
                  />
                </h3>
                {abcData && abcData.items.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
                    <ParetoChart
                      data={paretoChartData}
                      xKey="name"
                      barKey="revenue"
                      lineKey="cumulative"
                      barName="매출"
                      lineName="누적 비율"
                    />
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-2">
                        등급별 매출 비중
                      </h4>
                      <PieChart data={abcSummaryData} nameKey="grade" valueKey="value" />
                      <div className="mt-3 space-y-1 text-xs text-text-secondary">
                        <div>
                          A 등급: {abcData.summary.gradeA.count}개 ·{" "}
                          {formatPercent(abcData.summary.gradeA.revenuePercentage)}
                        </div>
                        <div>
                          B 등급: {abcData.summary.gradeB.count}개 ·{" "}
                          {formatPercent(abcData.summary.gradeB.revenuePercentage)}
                        </div>
                        <div>
                          C 등급: {abcData.summary.gradeC.count}개 ·{" "}
                          {formatPercent(abcData.summary.gradeC.revenuePercentage)}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">데이터가 없습니다.</p>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-foreground">
                  <HelpLabel
                    label="시간대별 인기 상품"
                    description="시간대별 판매 상위 상품을 보여줍니다."
                  />
                </h3>
                {hourlyList.length > 0 && topHourlyProducts.length > 0 ? (
                  <div className="overflow-x-auto">
                    <HeatmapTable
                      rows={topHourlyProducts}
                      columns={hours.map((hour) => `${hour}시`)}
                      values={hourlyMatrix}
                      valueFormatter={(value) => value.toLocaleString()}
                      emptyLabel="-"
                    />
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">데이터가 없습니다.</p>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-foreground">
                  <HelpLabel
                    label="조합 분석"
                    description="함께 주문되는 상품 조합과 지지도를 확인합니다."
                  />
                </h3>
                {combinationRows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-bg-tertiary">
                        <tr>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-text-secondary">
                            상품 조합
                          </th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-text-secondary">
                            동시 주문 수
                          </th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-text-secondary">
                            <HelpLabel
                              label="지지도"
                              description="전체 주문 중 해당 조합이 함께 포함된 비율입니다."
                            />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {combinationRows.map((row, index) => (
                          <tr key={`${row.products[0]?.productId ?? index}`} className="border-t border-border">
                            <td className="py-2 px-3 text-foreground">
                              {row.products.map((product) => product.productName).join(" + ")}
                            </td>
                            <td className="py-2 px-3 text-right text-text-secondary">
                              {row.coOrderCount.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right text-text-secondary">
                              {formatPercent(row.supportRate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">데이터가 없습니다.</p>
                )}
              </div>
            </div>
          )}

          {/* 주문 분석 */}
          {activeTab === "orders" && orderCurrent && (
            <div className="card p-6 space-y-6">
              <h2 className="text-xl font-semibold text-foreground">주문 분석</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-2 text-foreground">상태 분포</h3>
                  {orderCurrent.statusDistribution.length > 0 ? (
                    <PieChart
                      data={orderCurrent.statusDistribution.map((item) => ({
                        name: statusLabelMap[item.status] ?? item.status,
                        value: item.count,
                      }))}
                      nameKey="name"
                      valueKey="value"
                    />
                  ) : (
                    <p className="text-sm text-text-secondary">데이터가 없습니다.</p>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-foreground">피크 시간대</h3>
                  {orderCurrent.peakHours.length > 0 ? (
                    <BarChart
                      data={orderCurrent.peakHours
                        .slice()
                        .sort((a, b) => a.hour - b.hour)
                        .map((hour) => ({
                          hour: `${hour.hour}시`,
                          orderCount: hour.orderCount,
                        }))}
                      xKey="hour"
                      valueKey="orderCount"
                      layout="horizontal"
                    />
                  ) : (
                    <p className="text-sm text-text-secondary">데이터가 없습니다.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 고객 분석 */}
          {activeTab === "customers" && customerCurrent && (
            <div className="card p-6 space-y-6">
              <h2 className="text-xl font-semibold text-foreground">고객 분석</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KpiCard
                  title="총 고객 수"
                  value={customerCurrent.totalCustomers}
                  change={compareEnabled ? customerData?.changes?.totalCustomers : undefined}
                />
                <KpiCard
                  title="신규 고객"
                  value={customerCurrent.newCustomers}
                  change={compareEnabled ? customerData?.changes?.newCustomers : undefined}
                />
                <KpiCard
                  title="재방문 고객"
                  value={customerCurrent.returningCustomers}
                  change={compareEnabled ? customerData?.changes?.returningCustomers : undefined}
                />
                <KpiCard
                  title="고객 생애 가치"
                  value={customerCurrent.clv}
                  change={compareEnabled ? customerData?.changes?.clv : undefined}
                  formatter={formatCurrency}
                  titleTooltip="고객 1명이 평균적으로 가져오는 누적 매출(추정)입니다."
                />
                <KpiCard
                  title="재방문율"
                  value={customerCurrent.repeatCustomerRate}
                  change={compareEnabled ? customerData?.changes?.repeatCustomerRate : undefined}
                  formatter={formatPercent}
                  titleTooltip="전체 고객 중 재구매 고객의 비율입니다."
                />
                <KpiCard
                  title="고객당 평균 주문 수"
                  value={customerCurrent.avgOrdersPerCustomer}
                  formatter={formatDecimal}
                  titleTooltip="고객 1인당 평균 주문 횟수입니다."
                />
              </div>
            </div>
          )}

          {activeTab === "customers" && (cohortData || rfmData) && (
            <div className="card p-6 space-y-8">
              <h2 className="text-xl font-semibold text-foreground">고객 분석 심화</h2>

              <div>
                <h3 className="font-semibold mb-2 text-foreground">
                  <HelpLabel
                    label="코호트 분석"
                    description="가입/첫 주문 시기별로 재구매율(유지율)을 비교합니다."
                  />
                </h3>
                {cohortRows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <HeatmapTable
                      rows={cohortRows.map((row) => `${row.cohort} (${row.cohortSize}명)`)}
                      columns={cohortPeriods.map((period) =>
                        `${period}${cohortData?.granularity === "WEEK" ? "주" : "개월"}`
                      )}
                      values={cohortMatrix}
                      valueFormatter={(value) => `${value.toFixed(1)}%`}
                      emptyLabel="-"
                      baseColor="14,165,233"
                    />
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">데이터가 없습니다.</p>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-foreground">
                  <HelpLabel
                    label="RFM 분석"
                    description="R=최근성, F=빈도, M=금액 기준으로 고객을 분류합니다."
                  />
                </h3>
                {rfmSummary.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {rfmSummary.map((segment) => (
                      <div key={segment.segment} className="card p-4">
                        <div className="text-xs text-text-secondary mb-1">{segment.segment}</div>
                        <div className="text-2xl font-extrabold text-foreground">
                          {segment.customerCount.toLocaleString()}명
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-text-secondary">
                          <div>평균 최근성: {segment.avgRecency.toFixed(1)}일</div>
                          <div>평균 빈도: {segment.avgFrequency.toFixed(1)}회</div>
                          <div>평균 금액: {formatCurrency(segment.avgMonetary)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">세그먼트 요약이 없습니다.</p>
                )}

                <div className="mt-4">
                  {rfmPoints.length > 0 ? (
                    <>
                      <RfmScatterChart data={rfmPoints.slice(0, 500)} />
                      {rfmPoints.length > 500 && (
                        <p className="text-xs text-text-tertiary mt-2">
                          표시 성능을 위해 상위 500명만 표시합니다.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-text-secondary">데이터가 없습니다.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
