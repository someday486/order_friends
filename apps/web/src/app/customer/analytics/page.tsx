"use client";

import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, useSearchParams } from "next/navigation";

interface RevenueByDay {
  date: string;
  revenue: number;
  orderCount: number;
}

interface SalesAnalytics {
  totalRevenue: number;
  orderCount: number;
  avgOrderValue: number;
  revenueByDay: RevenueByDay[];
}

interface TopProduct {
  productId: string;
  productName: string;
  soldQuantity: number;
  totalRevenue: number;
}

interface SalesByProduct {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
  revenuePercentage: number;
}

interface ProductAnalytics {
  topProducts: TopProduct[];
  salesByProduct: SalesByProduct[];
  inventoryTurnover: {
    averageTurnoverRate: number;
    periodDays: number;
  };
}

interface OrderStatusDistribution {
  status: string;
  count: number;
  percentage: number;
}

interface OrdersByDay {
  date: string;
  orderCount: number;
  completedCount: number;
  cancelledCount: number;
}

interface PeakHours {
  hour: number;
  orderCount: number;
}

interface OrderAnalytics {
  statusDistribution: OrderStatusDistribution[];
  ordersByDay: OrdersByDay[];
  peakHours: PeakHours[];
}

interface CustomerAnalytics {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  clv: number;
  repeatCustomerRate: number;
  avgOrdersPerCustomer: number;
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-6"><p>Loading...</p></div>}>
      <AnalyticsContent />
    </Suspense>
  );
}

function AnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, status } = useAuth();

  const branchId = searchParams.get("branchId");

  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  const [salesData, setSalesData] = useState<SalesAnalytics | null>(null);
  const [productData, setProductData] = useState<ProductAnalytics | null>(null);
  const [orderData, setOrderData] = useState<OrderAnalytics | null>(null);
  const [customerData, setCustomerData] = useState<CustomerAnalytics | null>(
    null
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    if (!branchId || !session) return;

    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          branchId,
          startDate,
          endDate,
        });

        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
        const headers = {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        };

        const [sales, products, orders, customers] = await Promise.all([
          fetch(`${baseUrl}/customer/analytics/sales?${params}`, {
            headers,
          }).then((r) => r.json()),
          fetch(`${baseUrl}/customer/analytics/products?${params}`, {
            headers,
          }).then((r) => r.json()),
          fetch(`${baseUrl}/customer/analytics/orders?${params}`, {
            headers,
          }).then((r) => r.json()),
          fetch(`${baseUrl}/customer/analytics/customers?${params}`, {
            headers,
          }).then((r) => r.json()),
        ]);

        setSalesData(sales);
        setProductData(products);
        setOrderData(orders);
        setCustomerData(customers);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch analytics");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [branchId, session, startDate, endDate]);

  if (status === "loading") {
    return (
      <div className="p-6">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  if (!branchId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4 text-foreground">Analytics</h1>
        <p className="text-danger-500">
          Please select a branch from the URL (e.g., ?branchId=xxx)
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-foreground">Analytics Dashboard</h1>
        <div className="flex gap-4">
          <div>
            <label className="block text-sm mb-1 text-text-secondary">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-text-secondary">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-field"
            />
          </div>
        </div>
      </div>

      {loading && <p className="text-text-secondary">Loading analytics data...</p>}
      {error && <p className="text-danger-500">Error: {error}</p>}

      {!loading && !error && (
        <>
          {/* Sales Analytics */}
          {salesData && (
            <div className="card p-6">
              <h2 className="text-xl font-semibold mb-4 text-foreground">Sales Analytics</h2>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-bg-tertiary border-l-4 border-primary-500 p-4 rounded">
                  <p className="text-sm text-text-secondary">Total Revenue</p>
                  <p className="text-2xl font-bold text-foreground">
                    ₩{salesData.totalRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="bg-bg-tertiary border-l-4 border-success-500 p-4 rounded">
                  <p className="text-sm text-text-secondary">Order Count</p>
                  <p className="text-2xl font-bold text-foreground">
                    {salesData.orderCount.toLocaleString()}
                  </p>
                </div>
                <div className="bg-bg-tertiary border-l-4 border-secondary-500 p-4 rounded">
                  <p className="text-sm text-text-secondary">Avg Order Value</p>
                  <p className="text-2xl font-bold text-foreground">
                    ₩{salesData.avgOrderValue.toLocaleString()}
                  </p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-foreground">Revenue by Day</h3>
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-bg-tertiary sticky top-0">
                      <tr>
                        <th className="text-left p-2 text-text-secondary">Date</th>
                        <th className="text-right p-2 text-text-secondary">Revenue</th>
                        <th className="text-right p-2 text-text-secondary">Orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesData.revenueByDay.map((day) => (
                        <tr key={day.date} className="border-t border-border">
                          <td className="p-2 text-foreground">{day.date}</td>
                          <td className="text-right p-2 text-foreground">
                            ₩{day.revenue.toLocaleString()}
                          </td>
                          <td className="text-right p-2 text-foreground">{day.orderCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Product Analytics */}
          {productData && (
            <div className="card p-6">
              <h2 className="text-xl font-semibold mb-4 text-foreground">Product Analytics</h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-2 text-foreground">Top 10 Products</h3>
                  <div className="space-y-2">
                    {productData.topProducts.map((product, idx) => (
                      <div
                        key={product.productId}
                        className="flex justify-between items-center p-3 bg-bg-tertiary rounded"
                      >
                        <div>
                          <span className="font-semibold mr-2 text-primary-500">#{idx + 1}</span>
                          <span className="text-foreground">{product.productName}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-text-secondary">
                            {product.soldQuantity} sold
                          </p>
                          <p className="font-semibold text-foreground">
                            ₩{product.totalRevenue.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-foreground">Inventory Turnover</h3>
                  <div className="bg-bg-tertiary border-l-4 border-warning-500 p-4 rounded">
                    <p className="text-sm text-text-secondary">Average Turnover Rate</p>
                    <p className="text-3xl font-bold text-foreground">
                      {productData.inventoryTurnover.averageTurnoverRate.toFixed(2)}x
                    </p>
                    <p className="text-sm text-text-secondary mt-2">
                      Period: {productData.inventoryTurnover.periodDays} days
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Order Analytics */}
          {orderData && (
            <div className="card p-6">
              <h2 className="text-xl font-semibold mb-4 text-foreground">Order Analytics</h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-2 text-foreground">Status Distribution</h3>
                  <div className="space-y-2">
                    {orderData.statusDistribution.map((item) => (
                      <div
                        key={item.status}
                        className="flex justify-between items-center p-3 bg-bg-tertiary rounded"
                      >
                        <span className="font-medium text-foreground">{item.status}</span>
                        <div className="text-right">
                          <span className="font-semibold text-foreground">{item.count}</span>
                          <span className="text-sm text-text-secondary ml-2">
                            ({item.percentage.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-foreground">Peak Hours</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {orderData.peakHours
                      .sort((a, b) => b.orderCount - a.orderCount)
                      .map((hour) => (
                        <div
                          key={hour.hour}
                          className="flex justify-between items-center p-3 bg-bg-tertiary rounded"
                        >
                          <span className="text-foreground">{hour.hour}:00 - {hour.hour + 1}:00</span>
                          <span className="font-semibold text-foreground">
                            {hour.orderCount} orders
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Customer Analytics */}
          {customerData && (
            <div className="card p-6">
              <h2 className="text-xl font-semibold mb-4 text-foreground">Customer Analytics</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-bg-tertiary border-l-4 border-primary-500 p-4 rounded">
                  <p className="text-sm text-text-secondary">Total Customers</p>
                  <p className="text-2xl font-bold text-foreground">
                    {customerData.totalCustomers.toLocaleString()}
                  </p>
                </div>
                <div className="bg-bg-tertiary border-l-4 border-success-500 p-4 rounded">
                  <p className="text-sm text-text-secondary">New Customers</p>
                  <p className="text-2xl font-bold text-foreground">
                    {customerData.newCustomers.toLocaleString()}
                  </p>
                </div>
                <div className="bg-bg-tertiary border-l-4 border-secondary-500 p-4 rounded">
                  <p className="text-sm text-text-secondary">Returning Customers</p>
                  <p className="text-2xl font-bold text-foreground">
                    {customerData.returningCustomers.toLocaleString()}
                  </p>
                </div>
                <div className="bg-bg-tertiary border-l-4 border-warning-500 p-4 rounded">
                  <p className="text-sm text-text-secondary">Customer Lifetime Value</p>
                  <p className="text-2xl font-bold text-foreground">
                    ₩{customerData.clv.toLocaleString()}
                  </p>
                </div>
                <div className="bg-bg-tertiary border-l-4 border-danger-500 p-4 rounded">
                  <p className="text-sm text-text-secondary">Repeat Customer Rate</p>
                  <p className="text-2xl font-bold text-foreground">
                    {customerData.repeatCustomerRate.toFixed(1)}%
                  </p>
                </div>
                <div className="bg-bg-tertiary border-l-4 border-neutral-500 p-4 rounded">
                  <p className="text-sm text-text-secondary">Avg Orders per Customer</p>
                  <p className="text-2xl font-bold text-foreground">
                    {customerData.avgOrdersPerCustomer.toFixed(1)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
