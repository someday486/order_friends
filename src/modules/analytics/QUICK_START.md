# Analytics Module - Quick Start Guide

## Overview

The Analytics module provides 4 main endpoints for comprehensive business insights:

1. **Sales Analytics** - Revenue tracking and trends
2. **Product Analytics** - Product performance and inventory
3. **Order Analytics** - Order patterns and status tracking
4. **Customer Analytics** - Customer behavior and lifetime value

## Quick Reference

### Base URL
```
/customer/analytics
```

### Authentication
All endpoints require Bearer token authentication:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

### Common Query Parameters
- `branchId` (required) - Branch UUID
- `startDate` (optional) - ISO 8601 date (e.g., "2026-01-01")
- `endDate` (optional) - ISO 8601 date (e.g., "2026-01-31")

**Default:** Last 30 days if dates not provided

---

## API Endpoints Summary

| Endpoint | Purpose | Key Metrics |
|----------|---------|-------------|
| `GET /sales` | Revenue analysis | Total revenue, order count, daily trends |
| `GET /products` | Product performance | Top products, sales distribution, turnover |
| `GET /orders` | Order patterns | Status distribution, peak hours, trends |
| `GET /customers` | Customer insights | CLV, retention rate, new/returning customers |

---

## Quick Examples

### 1. Sales Analytics
```bash
GET /customer/analytics/sales?branchId={UUID}
```

**Returns:**
```json
{
  "totalRevenue": 4500000,
  "orderCount": 150,
  "avgOrderValue": 30000,
  "revenueByDay": [...]
}
```

**Use for:**
- Revenue dashboards
- Sales performance tracking
- Financial reports

---

### 2. Product Analytics
```bash
GET /customer/analytics/products?branchId={UUID}
```

**Returns:**
```json
{
  "topProducts": [...],
  "salesByProduct": [...],
  "inventoryTurnover": { "averageTurnoverRate": 5.2, "periodDays": 30 }
}
```

**Use for:**
- Identifying best sellers
- Inventory management
- Product strategy

---

### 3. Order Analytics
```bash
GET /customer/analytics/orders?branchId={UUID}
```

**Returns:**
```json
{
  "statusDistribution": [...],
  "ordersByDay": [...],
  "peakHours": [...]
}
```

**Use for:**
- Staff scheduling
- Order fulfillment tracking
- Operational insights

---

### 4. Customer Analytics
```bash
GET /customer/analytics/customers?branchId={UUID}
```

**Returns:**
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

**Use for:**
- Customer retention analysis
- Marketing effectiveness
- Loyalty programs

---

## TypeScript Integration

### Install Types (if needed)
```typescript
interface SalesAnalytics {
  totalRevenue: number;
  orderCount: number;
  avgOrderValue: number;
  revenueByDay: { date: string; revenue: number; orderCount: number }[];
}
```

### Basic Usage
```typescript
const fetchSalesAnalytics = async (
  branchId: string,
  token: string,
  startDate?: string,
  endDate?: string
): Promise<SalesAnalytics> => {
  const params = new URLSearchParams({ branchId });
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const response = await fetch(
    `https://api.example.com/customer/analytics/sales?${params}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch analytics');
  }

  return await response.json();
};
```

---

## React Hook Example

```typescript
import { useState, useEffect } from 'react';

export const useAnalytics = (
  branchId: string,
  token: string,
  startDate?: string,
  endDate?: string
) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ branchId });
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        const [sales, products, orders, customers] = await Promise.all([
          fetch(`/customer/analytics/sales?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(r => r.json()),
          fetch(`/customer/analytics/products?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(r => r.json()),
          fetch(`/customer/analytics/orders?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(r => r.json()),
          fetch(`/customer/analytics/customers?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(r => r.json())
        ]);

        setData({ sales, products, orders, customers });
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    if (branchId && token) {
      fetchData();
    }
  }, [branchId, token, startDate, endDate]);

  return { data, loading, error };
};

// Usage in component
const AnalyticsDashboard = () => {
  const { data, loading, error } = useAnalytics(
    branchId,
    token,
    '2026-01-01',
    '2026-01-31'
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>Revenue: ₩{data.sales.totalRevenue.toLocaleString()}</h1>
      {/* ... rest of dashboard */}
    </div>
  );
};
```

---

## Common Patterns

### 1. Dashboard Overview
Fetch all analytics at once for a complete dashboard:
```typescript
const fetchAllAnalytics = async (branchId: string, token: string) => {
  const params = new URLSearchParams({ branchId });
  const baseUrl = '/customer/analytics';

  return await Promise.all([
    fetch(`${baseUrl}/sales?${params}`, { headers: { 'Authorization': `Bearer ${token}` }}).then(r => r.json()),
    fetch(`${baseUrl}/products?${params}`, { headers: { 'Authorization': `Bearer ${token}` }}).then(r => r.json()),
    fetch(`${baseUrl}/orders?${params}`, { headers: { 'Authorization': `Bearer ${token}` }}).then(r => r.json()),
    fetch(`${baseUrl}/customers?${params}`, { headers: { 'Authorization': `Bearer ${token}` }}).then(r => r.json())
  ]);
};
```

### 2. Period Comparison
Compare current period vs previous period:
```typescript
const comparePeriods = async (branchId: string, token: string) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [currentPeriod, previousPeriod] = await Promise.all([
    fetchSalesAnalytics(
      branchId,
      token,
      thirtyDaysAgo.toISOString().split('T')[0],
      now.toISOString().split('T')[0]
    ),
    fetchSalesAnalytics(
      branchId,
      token,
      sixtyDaysAgo.toISOString().split('T')[0],
      thirtyDaysAgo.toISOString().split('T')[0]
    )
  ]);

  return {
    current: currentPeriod,
    previous: previousPeriod,
    growth: ((currentPeriod.totalRevenue - previousPeriod.totalRevenue) / previousPeriod.totalRevenue) * 100
  };
};
```

### 3. Real-time Updates
Auto-refresh analytics every 5 minutes:
```typescript
useEffect(() => {
  const fetchData = () => {
    // Fetch analytics...
  };

  fetchData(); // Initial fetch
  const interval = setInterval(fetchData, 5 * 60 * 1000); // Every 5 minutes

  return () => clearInterval(interval);
}, [branchId, token]);
```

---

## Error Handling

### Common Errors

| Status Code | Error | Solution |
|-------------|-------|----------|
| 400 | Bad Request | Check `branchId` is provided and valid UUID |
| 401 | Unauthorized | Verify Bearer token is valid and not expired |
| 403 | Forbidden | User needs active branch membership |
| 500 | Server Error | Retry request or contact support |

### Error Handling Example
```typescript
try {
  const data = await fetchSalesAnalytics(branchId, token);
  return data;
} catch (error) {
  if (error.status === 401) {
    // Redirect to login
    window.location.href = '/login';
  } else if (error.status === 403) {
    // Show access denied message
    alert('You do not have access to this branch');
  } else {
    // Show generic error
    console.error('Analytics error:', error);
  }
}
```

---

## Best Practices

1. **Cache Results**: Cache analytics data for 5 minutes to reduce API calls
2. **Batch Requests**: Fetch all analytics at once instead of sequential calls
3. **Handle Loading**: Show loading states during data fetch
4. **Error Recovery**: Implement retry logic for failed requests
5. **Date Validation**: Validate date ranges before sending requests
6. **Token Refresh**: Implement token refresh logic for expired tokens

---

## Performance Tips

1. Use `Promise.all()` for parallel requests
2. Implement client-side caching (localStorage or React Query)
3. Use pagination for large date ranges
4. Consider using a state management library (Redux, Zustand)
5. Debounce date range changes to avoid excessive API calls

---

## Testing

### Test with cURL
```bash
# Replace YOUR_TOKEN and YOUR_BRANCH_ID
export TOKEN="your_jwt_token_here"
export BRANCH_ID="550e8400-e29b-41d4-a716-446655440000"

# Test all endpoints
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/customer/analytics/sales?branchId=$BRANCH_ID"

curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/customer/analytics/products?branchId=$BRANCH_ID"

curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/customer/analytics/orders?branchId=$BRANCH_ID"

curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/customer/analytics/customers?branchId=$BRANCH_ID"
```

---

## Next Steps

1. **Full Documentation**: See [README.md](./README.md) for complete API details
2. **Code Examples**: Check [EXAMPLES.md](./EXAMPLES.md) for integration examples
3. **Type Definitions**: Import types from [dto/analytics.dto.ts](./dto/analytics.dto.ts)

---

## Support

For issues or questions:
1. Check the full [README.md](./README.md) documentation
2. Review [EXAMPLES.md](./EXAMPLES.md) for implementation patterns
3. Inspect the service code: [analytics.service.ts](./analytics.service.ts)
4. Check controller routes: [analytics.controller.ts](./analytics.controller.ts)

---

**Module Version:** 1.0.0
**Last Updated:** 2026-02-06
