# Analytics API Examples

This document provides practical examples for using the Analytics API endpoints.

## Table of Contents
1. [Authentication Setup](#authentication-setup)
2. [Sales Analytics Examples](#sales-analytics-examples)
3. [Product Analytics Examples](#product-analytics-examples)
4. [Order Analytics Examples](#order-analytics-examples)
5. [Customer Analytics Examples](#customer-analytics-examples)
6. [Frontend Integration Examples](#frontend-integration-examples)

---

## Authentication Setup

All analytics endpoints require authentication with a valid Bearer token.

### Getting Started

```javascript
// Example: Login and get token
const response = await fetch('https://api.example.com/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const { access_token } = await response.json();

// Use this token in all subsequent requests
const headers = {
  'Authorization': `Bearer ${access_token}`,
  'Content-Type': 'application/json'
};
```

---

## Sales Analytics Examples

### Example 1: Get Last 30 Days Sales (Default)

**Request:**
```bash
curl -X GET "https://api.example.com/customer/analytics/sales?branchId=550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**JavaScript/TypeScript:**
```typescript
const getSalesAnalytics = async (branchId: string, token: string) => {
  const response = await fetch(
    `https://api.example.com/customer/analytics/sales?branchId=${branchId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  const data = await response.json();
  return data;
};

// Usage
const sales = await getSalesAnalytics('550e8400-e29b-41d4-a716-446655440000', token);
console.log(`Total Revenue: ₩${sales.totalRevenue.toLocaleString()}`);
console.log(`Order Count: ${sales.orderCount}`);
console.log(`Average Order: ₩${sales.avgOrderValue.toLocaleString()}`);
```

**Response:**
```json
{
  "totalRevenue": 4500000,
  "orderCount": 150,
  "avgOrderValue": 30000,
  "revenueByDay": [
    {
      "date": "2026-01-15",
      "revenue": 150000,
      "orderCount": 12
    },
    {
      "date": "2026-01-16",
      "revenue": 180000,
      "orderCount": 15
    }
  ]
}
```

### Example 2: Get Sales for Specific Date Range

**Request:**
```bash
curl -X GET "https://api.example.com/customer/analytics/sales?branchId=550e8400-e29b-41d4-a716-446655440000&startDate=2026-01-01&endDate=2026-01-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**React Component Example:**
```typescript
import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const SalesChart = ({ branchId, token }) => {
  const [salesData, setSalesData] = useState(null);
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-01-31');

  useEffect(() => {
    const fetchSales = async () => {
      const response = await fetch(
        `https://api.example.com/customer/analytics/sales?branchId=${branchId}&startDate=${startDate}&endDate=${endDate}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      const data = await response.json();
      setSalesData(data);
    };

    fetchSales();
  }, [branchId, startDate, endDate, token]);

  if (!salesData) return <div>Loading...</div>;

  return (
    <div>
      <h2>Sales Analytics</h2>
      <div className="metrics">
        <div>Total Revenue: ₩{salesData.totalRevenue.toLocaleString()}</div>
        <div>Order Count: {salesData.orderCount}</div>
        <div>Avg Order Value: ₩{salesData.avgOrderValue.toLocaleString()}</div>
      </div>

      <LineChart width={600} height={300} data={salesData.revenueByDay}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="revenue" stroke="#8884d8" />
        <Line type="monotone" dataKey="orderCount" stroke="#82ca9d" />
      </LineChart>
    </div>
  );
};
```

---

## Product Analytics Examples

### Example 3: Get Top Products

**Request:**
```bash
curl -X GET "https://api.example.com/customer/analytics/products?branchId=550e8400-e29b-41d4-a716-446655440000&startDate=2026-01-01&endDate=2026-01-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "topProducts": [
    {
      "productId": "123e4567-e89b-12d3-a456-426614174000",
      "productName": "아메리카노",
      "soldQuantity": 120,
      "totalRevenue": 480000
    },
    {
      "productId": "223e4567-e89b-12d3-a456-426614174000",
      "productName": "카페라떼",
      "soldQuantity": 95,
      "totalRevenue": 475000
    }
  ],
  "salesByProduct": [
    {
      "productId": "123e4567-e89b-12d3-a456-426614174000",
      "productName": "아메리카노",
      "quantity": 120,
      "revenue": 480000,
      "revenuePercentage": 25.5
    }
  ],
  "inventoryTurnover": {
    "averageTurnoverRate": 5.2,
    "periodDays": 30
  }
}
```

**Vue.js Component Example:**
```vue
<template>
  <div class="product-analytics">
    <h2>Product Performance</h2>

    <div class="top-products">
      <h3>Top 10 Products</h3>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Quantity Sold</th>
            <th>Revenue</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="product in productData.topProducts" :key="product.productId">
            <td>{{ product.productName }}</td>
            <td>{{ product.soldQuantity }}</td>
            <td>₩{{ product.totalRevenue.toLocaleString() }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="inventory-turnover">
      <h3>Inventory Turnover</h3>
      <p>Average Rate: {{ productData.inventoryTurnover.averageTurnoverRate }}</p>
      <p>Period: {{ productData.inventoryTurnover.periodDays }} days</p>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      productData: null,
      branchId: '550e8400-e29b-41d4-a716-446655440000'
    };
  },
  async mounted() {
    const response = await fetch(
      `https://api.example.com/customer/analytics/products?branchId=${this.branchId}`,
      {
        headers: { 'Authorization': `Bearer ${this.$store.state.token}` }
      }
    );
    this.productData = await response.json();
  }
};
</script>
```

---

## Order Analytics Examples

### Example 4: Get Order Status Distribution

**Request:**
```bash
curl -X GET "https://api.example.com/customer/analytics/orders?branchId=550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "statusDistribution": [
    {
      "status": "COMPLETED",
      "count": 85,
      "percentage": 56.67
    },
    {
      "status": "PREPARING",
      "count": 30,
      "percentage": 20.0
    },
    {
      "status": "CANCELLED",
      "count": 10,
      "percentage": 6.67
    }
  ],
  "ordersByDay": [
    {
      "date": "2026-01-15",
      "orderCount": 15,
      "completedCount": 12,
      "cancelledCount": 1
    }
  ],
  "peakHours": [
    {
      "hour": 12,
      "orderCount": 25
    },
    {
      "hour": 14,
      "orderCount": 30
    },
    {
      "hour": 18,
      "orderCount": 22
    }
  ]
}
```

**Chart.js Integration Example:**
```typescript
import { Chart } from 'chart.js/auto';

const renderPeakHoursChart = async (branchId: string, token: string) => {
  const response = await fetch(
    `https://api.example.com/customer/analytics/orders?branchId=${branchId}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );

  const data = await response.json();

  const ctx = document.getElementById('peakHoursChart') as HTMLCanvasElement;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.peakHours.map(h => `${h.hour}:00`),
      datasets: [{
        label: 'Orders by Hour',
        data: data.peakHours.map(h => h.orderCount),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Number of Orders'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Hour of Day'
          }
        }
      }
    }
  });
};
```

---

## Customer Analytics Examples

### Example 5: Get Customer Insights

**Request:**
```bash
curl -X GET "https://api.example.com/customer/analytics/customers?branchId=550e8400-e29b-41d4-a716-446655440000&startDate=2026-01-01&endDate=2026-01-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "totalCustomers": 450,
  "newCustomers": 45,
  "returningCustomers": 120,
  "clv": 150000,
  "repeatCustomerRate": 26.67,
  "avgOrdersPerCustomer": 2.8
}
```

**Dashboard Widget Example:**
```typescript
interface CustomerAnalytics {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  clv: number;
  repeatCustomerRate: number;
  avgOrdersPerCustomer: number;
}

const CustomerMetricsWidget: React.FC<{ branchId: string; token: string }> = ({
  branchId,
  token
}) => {
  const [metrics, setMetrics] = useState<CustomerAnalytics | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      const response = await fetch(
        `https://api.example.com/customer/analytics/customers?branchId=${branchId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      const data = await response.json();
      setMetrics(data);
    };

    fetchMetrics();
  }, [branchId, token]);

  if (!metrics) return <div>Loading...</div>;

  return (
    <div className="customer-metrics-grid">
      <div className="metric-card">
        <h3>Total Customers</h3>
        <div className="metric-value">{metrics.totalCustomers}</div>
      </div>

      <div className="metric-card">
        <h3>New Customers</h3>
        <div className="metric-value">{metrics.newCustomers}</div>
        <div className="metric-trend">This period</div>
      </div>

      <div className="metric-card">
        <h3>Customer Lifetime Value</h3>
        <div className="metric-value">₩{metrics.clv.toLocaleString()}</div>
        <div className="metric-description">Average per customer</div>
      </div>

      <div className="metric-card">
        <h3>Repeat Rate</h3>
        <div className="metric-value">{metrics.repeatCustomerRate}%</div>
        <div className="metric-description">
          {metrics.returningCustomers} returning customers
        </div>
      </div>

      <div className="metric-card">
        <h3>Avg Orders/Customer</h3>
        <div className="metric-value">{metrics.avgOrdersPerCustomer}</div>
      </div>
    </div>
  );
};
```

---

## Frontend Integration Examples

### Example 6: Complete Analytics Dashboard

**Next.js Page Example:**
```typescript
// pages/analytics.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

interface AnalyticsData {
  sales: any;
  products: any;
  orders: any;
  customers: any;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { branchId } = router.query;
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: '2026-01-01',
    endDate: '2026-01-31'
  });
  const [loading, setLoading] = useState(false);

  const fetchAllAnalytics = async () => {
    setLoading(true);
    const token = localStorage.getItem('access_token');
    const baseUrl = 'https://api.example.com/customer/analytics';
    const params = new URLSearchParams({
      branchId: branchId as string,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate
    });

    try {
      const [sales, products, orders, customers] = await Promise.all([
        fetch(`${baseUrl}/sales?${params}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()),

        fetch(`${baseUrl}/products?${params}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()),

        fetch(`${baseUrl}/orders?${params}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()),

        fetch(`${baseUrl}/customers?${params}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json())
      ]);

      setAnalytics({ sales, products, orders, customers });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (branchId) {
      fetchAllAnalytics();
    }
  }, [branchId, dateRange]);

  if (loading) return <div>Loading analytics...</div>;
  if (!analytics) return <div>No data available</div>;

  return (
    <div className="analytics-dashboard">
      <h1>Analytics Dashboard</h1>

      <div className="date-picker">
        <input
          type="date"
          value={dateRange.startDate}
          onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
        />
        <input
          type="date"
          value={dateRange.endDate}
          onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
        />
      </div>

      <div className="metrics-overview">
        <div className="metric-card">
          <h3>Total Revenue</h3>
          <p>₩{analytics.sales.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="metric-card">
          <h3>Total Orders</h3>
          <p>{analytics.sales.orderCount}</p>
        </div>
        <div className="metric-card">
          <h3>Total Customers</h3>
          <p>{analytics.customers.totalCustomers}</p>
        </div>
        <div className="metric-card">
          <h3>CLV</h3>
          <p>₩{analytics.customers.clv.toLocaleString()}</p>
        </div>
      </div>

      <div className="charts-section">
        <div className="chart-container">
          <h3>Revenue Trend</h3>
          {/* Render sales chart here */}
        </div>

        <div className="chart-container">
          <h3>Top Products</h3>
          {/* Render product chart here */}
        </div>

        <div className="chart-container">
          <h3>Order Status Distribution</h3>
          {/* Render status pie chart here */}
        </div>

        <div className="chart-container">
          <h3>Peak Hours</h3>
          {/* Render peak hours chart here */}
        </div>
      </div>
    </div>
  );
}
```

### Example 7: Error Handling

```typescript
class AnalyticsService {
  private baseUrl = 'https://api.example.com/customer/analytics';
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(endpoint: string, params: URLSearchParams): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Request failed');
      }

      return await response.json();
    } catch (error) {
      console.error(`Analytics API Error (${endpoint}):`, error);
      throw error;
    }
  }

  async getSalesAnalytics(branchId: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams({ branchId });
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    return this.request('/sales', params);
  }

  async getProductAnalytics(branchId: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams({ branchId });
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    return this.request('/products', params);
  }

  async getOrderAnalytics(branchId: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams({ branchId });
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    return this.request('/orders', params);
  }

  async getCustomerAnalytics(branchId: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams({ branchId });
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    return this.request('/customers', params);
  }
}

// Usage
const analyticsService = new AnalyticsService(token);

try {
  const sales = await analyticsService.getSalesAnalytics(branchId, '2026-01-01', '2026-01-31');
  console.log('Sales data:', sales);
} catch (error) {
  console.error('Failed to load sales analytics:', error);
  // Show error message to user
}
```

---

## Testing Examples

### Example 8: Jest Unit Tests

```typescript
// analytics.service.test.ts
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  const mockToken = 'test-token';
  const mockBranchId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    service = new AnalyticsService(mockToken);
    global.fetch = jest.fn();
  });

  it('should fetch sales analytics', async () => {
    const mockResponse = {
      totalRevenue: 1000000,
      orderCount: 50,
      avgOrderValue: 20000,
      revenueByDay: []
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const result = await service.getSalesAnalytics(mockBranchId);
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sales'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': `Bearer ${mockToken}`
        })
      })
    );
  });
});
```

---

## Performance Optimization

### Example 9: Caching Analytics Data

```typescript
class CachedAnalyticsService {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheDuration = 5 * 60 * 1000; // 5 minutes

  private getCacheKey(endpoint: string, params: URLSearchParams): string {
    return `${endpoint}?${params.toString()}`;
  }

  async getCachedOrFetch(
    endpoint: string,
    params: URLSearchParams,
    fetcher: () => Promise<any>
  ): Promise<any> {
    const cacheKey = this.getCacheKey(endpoint, params);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      console.log('Returning cached data for', endpoint);
      return cached.data;
    }

    console.log('Fetching fresh data for', endpoint);
    const data = await fetcher();
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
```

---

## Additional Resources

- [API Documentation](./README.md)
- [TypeScript Interfaces](./dto/analytics.dto.ts)
- [Backend Service](./analytics.service.ts)
- [Controller Routes](./analytics.controller.ts)
