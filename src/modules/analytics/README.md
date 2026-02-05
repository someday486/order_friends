# Analytics Module

The Analytics module provides comprehensive reporting and analytics capabilities for order management, sales tracking, product performance, and customer insights.

## Features

- **Sales Analytics**: Revenue tracking, order counts, average order values, and daily trends
- **Product Analytics**: Top-selling products, sales by product, and inventory turnover rates
- **Order Analytics**: Order status distribution, daily trends, and peak hours analysis
- **Customer Analytics**: Customer segmentation, lifetime value, and retention metrics

## API Endpoints

All endpoints are protected with `AuthGuard` and `CustomerGuard`, requiring authenticated users with active brand/branch memberships.

### Base URL
```
GET /customer/analytics/*
```

### 1. Sales Analytics

**Endpoint:** `GET /customer/analytics/sales`

**Query Parameters:**
- `branchId` (required): Branch UUID
- `startDate` (optional): Start date in ISO 8601 format (e.g., `2026-01-01`)
- `endDate` (optional): End date in ISO 8601 format (e.g., `2026-01-31`)

**Default Date Range:** Last 30 days if not specified

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
    }
  ]
}
```

**Use Cases:**
- Dashboard revenue widgets
- Sales performance tracking
- Revenue trend charts
- Period-over-period comparisons

---

### 2. Product Analytics

**Endpoint:** `GET /customer/analytics/products`

**Query Parameters:**
- `branchId` (required): Branch UUID
- `startDate` (optional): Start date in ISO 8601 format
- `endDate` (optional): End date in ISO 8601 format

**Response:**
```json
{
  "topProducts": [
    {
      "productId": "123e4567-e89b-12d3-a456-426614174000",
      "productName": "아메리카노",
      "soldQuantity": 120,
      "totalRevenue": 480000
    }
  ],
  "salesByProduct": [
    {
      "productId": "123e4567-e89b-12d3-a456-426614174000",
      "productName": "카페라떼",
      "quantity": 80,
      "revenue": 400000,
      "revenuePercentage": 8.89
    }
  ],
  "inventoryTurnover": {
    "averageTurnoverRate": 5.2,
    "periodDays": 30
  }
}
```

**Use Cases:**
- Identify best-selling products
- Stock planning and inventory optimization
- Product performance dashboards
- Revenue contribution analysis

---

### 3. Order Analytics

**Endpoint:** `GET /customer/analytics/orders`

**Query Parameters:**
- `branchId` (required): Branch UUID
- `startDate` (optional): Start date in ISO 8601 format
- `endDate` (optional): End date in ISO 8601 format

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
      "hour": 14,
      "orderCount": 25
    },
    {
      "hour": 12,
      "orderCount": 22
    }
  ]
}
```

**Use Cases:**
- Order fulfillment tracking
- Staff scheduling optimization
- Daily/hourly order patterns
- Order status monitoring

---

### 4. Customer Analytics

**Endpoint:** `GET /customer/analytics/customers`

**Query Parameters:**
- `branchId` (required): Branch UUID
- `startDate` (optional): Start date for new customer calculation
- `endDate` (optional): End date for new customer calculation

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

**Metrics:**
- `totalCustomers`: All-time unique customers
- `newCustomers`: Customers who made their first order within the date range
- `returningCustomers`: Customers with more than one order (all-time)
- `clv`: Customer Lifetime Value (average total spent per customer)
- `repeatCustomerRate`: Percentage of customers who ordered more than once
- `avgOrdersPerCustomer`: Average number of orders per customer

**Use Cases:**
- Customer retention analysis
- Marketing campaign effectiveness
- Customer segmentation
- Loyalty program design

---

## Authentication & Authorization

All endpoints require:
1. **Bearer Token**: Valid JWT token in `Authorization` header
2. **Customer Guard**: User must have active brand or branch membership
3. **Branch Access**: User must have permission to access the specified branch

**Example Request:**
```bash
curl -X GET "https://api.example.com/customer/analytics/sales?branchId=123e4567-e89b-12d3-a456-426614174000&startDate=2026-01-01&endDate=2026-01-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Error Handling

All endpoints use standardized error responses:

**400 Bad Request:**
```json
{
  "statusCode": 400,
  "message": "branchId is required"
}
```

**401 Unauthorized:**
```json
{
  "statusCode": 401,
  "message": "Authentication required"
}
```

**403 Forbidden:**
```json
{
  "statusCode": 403,
  "message": "No active brand or branch memberships found"
}
```

**500 Internal Server Error:**
```json
{
  "statusCode": 500,
  "message": "Failed to fetch sales analytics",
  "code": "SALES_ANALYTICS_FAILED",
  "details": {
    "branchId": "123e4567-e89b-12d3-a456-426614174000",
    "error": "Database connection error"
  }
}
```

---

## Data Aggregation

### Date Range Handling
- If no dates provided: defaults to last 30 days
- `startDate` only: from start date to today
- `endDate` only: from 30 days before end date to end date
- Both dates: exact range specified

### Customer Identification
- Customers are identified by `customer_phone` field in orders
- Anonymous orders (no phone) are tracked separately
- Phone numbers serve as unique customer identifiers

### Order Status Filtering
- Sales/revenue calculations include orders in: `COMPLETED`, `READY`, `PREPARING`, `CONFIRMED`, `CREATED`
- Excludes: `CANCELLED`, `REFUNDED`
- Status distribution shows all statuses in the period

### Time Zone
- All timestamps are stored and processed in UTC
- Date grouping uses ISO date format (YYYY-MM-DD)
- Hours are calculated in UTC (0-23)

---

## Performance Considerations

### Caching
The module uses Supabase admin client for optimal performance. Consider implementing:
- Redis caching for frequently accessed analytics
- Cache invalidation on order status changes
- Scheduled pre-computation for dashboard metrics

### Query Optimization
- All analytics queries use indexed columns (`branch_id`, `created_at`, `status`)
- Date range filters applied at database level
- Aggregations performed in application layer for flexibility

### Rate Limiting
- Protected by global throttle guard (100 requests per minute)
- Consider adding specific rate limits for expensive analytics queries

---

## Database Schema

The module queries the following tables:

### orders
- `id`, `branch_id`, `status`, `total_amount`, `created_at`
- `customer_phone`, `customer_name`

### order_items
- `id`, `order_id`, `product_id`, `product_name_snapshot`
- `qty`, `unit_price`

### products
- `id`, `name`, `branch_id`, `base_price`

---

## Future Enhancements

Potential improvements for the analytics module:

1. **Export Functionality**
   - CSV/Excel export for all analytics
   - PDF report generation
   - Scheduled email reports

2. **Advanced Analytics**
   - Cohort analysis
   - Revenue forecasting
   - Seasonal trend detection
   - Product recommendation engine

3. **Real-time Updates**
   - WebSocket support for live dashboards
   - Real-time order tracking
   - Live revenue counters

4. **Comparative Analysis**
   - Period-over-period comparisons
   - Branch-to-branch comparisons
   - Industry benchmarking

5. **Custom Reports**
   - User-defined metrics
   - Custom date groupings (weekly, monthly, quarterly)
   - Multi-branch aggregation

---

## Testing

### Manual Testing
```bash
# Sales Analytics
curl -X GET "http://localhost:3000/customer/analytics/sales?branchId=YOUR_BRANCH_ID&startDate=2026-01-01&endDate=2026-01-31" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Product Analytics
curl -X GET "http://localhost:3000/customer/analytics/products?branchId=YOUR_BRANCH_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Order Analytics
curl -X GET "http://localhost:3000/customer/analytics/orders?branchId=YOUR_BRANCH_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Customer Analytics
curl -X GET "http://localhost:3000/customer/analytics/customers?branchId=YOUR_BRANCH_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Integration Testing
See `analytics.service.spec.ts` for unit tests and `analytics.e2e.spec.ts` for end-to-end tests.

---

## Troubleshooting

### Common Issues

**Issue:** Empty results despite having orders
- Check date range - ensure dates are in ISO 8601 format
- Verify branch ID is correct
- Check order statuses (cancelled orders excluded from sales)

**Issue:** Slow query performance
- Verify database indexes on `branch_id`, `created_at`, `status`
- Consider narrowing date ranges
- Implement caching for frequently accessed data

**Issue:** Customer analytics showing incorrect counts
- Customer identification relies on phone numbers
- Ensure phone numbers are consistently formatted
- Anonymous orders (no phone) are counted separately

---

## Module Structure

```
src/modules/analytics/
├── dto/
│   └── analytics.dto.ts          # All DTOs and response types
├── analytics.controller.ts        # API endpoints
├── analytics.service.ts           # Business logic and calculations
├── analytics.module.ts            # Module configuration
└── README.md                      # This file
```

---

## Dependencies

- `@nestjs/common`: Core NestJS functionality
- `@nestjs/swagger`: API documentation
- `@supabase/supabase-js`: Database client
- `class-validator`: Input validation
- `class-transformer`: DTO transformation

---

## Contributing

When adding new analytics endpoints:

1. Define DTOs in `analytics.dto.ts`
2. Implement business logic in `analytics.service.ts`
3. Add controller endpoint in `analytics.controller.ts`
4. Update this README with endpoint documentation
5. Add unit tests for new functionality
6. Update Swagger documentation

---

## License

This module is part of the OrderFriends project.
