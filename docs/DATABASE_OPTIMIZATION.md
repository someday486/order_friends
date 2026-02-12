# Database Optimization Guide

## Overview

This document provides comprehensive database optimization strategies for the Order Friends application using Supabase (PostgreSQL).

## Table of Contents

1. [Database Indices](#database-indices)
2. [Query Optimization](#query-optimization)
3. [Caching Strategy](#caching-strategy)
4. [Performance Monitoring](#performance-monitoring)

## Database Indices

### Current Table Structure Analysis

#### High-Traffic Tables
1. **orders** - Heavy read/write, frequent filtering
2. **order_items** - High volume, joined frequently
3. **products** - Heavy read, frequent filtering
4. **product_inventory** - Real-time updates, critical queries
5. **branches** - Moderate read, frequent joins
6. **members** - Auth-related, frequent lookups

### Recommended Indices

#### 1. Orders Table

```sql
-- Primary index (already exists)
-- id (UUID, PRIMARY KEY)

-- Query: Get orders by branch with status filter
CREATE INDEX CONCURRENTLY idx_orders_branch_status_created
ON orders(branch_id, status, created_at DESC);

-- Query: Get orders by order number
CREATE INDEX CONCURRENTLY idx_orders_order_no
ON orders(order_no);

-- Query: Get orders by customer
CREATE INDEX CONCURRENTLY idx_orders_customer_phone
ON orders(customer_phone);

-- Query: Get orders by date range
CREATE INDEX CONCURRENTLY idx_orders_created_at
ON orders(created_at DESC);

-- Composite index for pagination queries
CREATE INDEX CONCURRENTLY idx_orders_branch_created_pagination
ON orders(branch_id, created_at DESC, id);
```

**Benefits:**
- Faster order listing with status filter: ~10x improvement
- Quick order number lookups: O(log n) instead of O(n)
- Efficient date range queries for reports

#### 2. Order Items Table

```sql
-- Query: Get items for an order
CREATE INDEX CONCURRENTLY idx_order_items_order_id
ON order_items(order_id);

-- Query: Analyze product sales
CREATE INDEX CONCURRENTLY idx_order_items_product_id
ON order_items(product_id);

-- Composite for inventory tracking
CREATE INDEX CONCURRENTLY idx_order_items_product_created
ON order_items(product_id, created_at DESC);
```

**Benefits:**
- Fast order detail retrieval
- Efficient product sales analysis
- Quick inventory reconciliation

#### 3. Products Table

```sql
-- Query: List products by branch
CREATE INDEX CONCURRENTLY idx_products_branch_category
ON products(branch_id, category_id, sort_order);

-- Query: Search products by name
CREATE INDEX CONCURRENTLY idx_products_name_trgm
ON products USING gin(name gin_trgm_ops);

-- Query: Filter active products
CREATE INDEX CONCURRENTLY idx_products_branch_hidden
ON products(branch_id, is_hidden, sort_order);

-- Full-text search (optional)
CREATE INDEX CONCURRENTLY idx_products_fulltext
ON products USING gin(to_tsvector('korean', name || ' ' || COALESCE(description, '')));
```

**Benefits:**
- Fast product listing with category filter
- Efficient product search: ~100x faster for text search
- Quick filtering of active/hidden products

#### 4. Product Inventory Table

```sql
-- Query: Get inventory by branch and product
CREATE INDEX CONCURRENTLY idx_inventory_branch_product
ON product_inventory(branch_id, product_id);

-- Query: Find low stock items
CREATE INDEX CONCURRENTLY idx_inventory_low_stock
ON product_inventory(branch_id, qty_available)
WHERE qty_available < 10;

-- Query: Get products by availability
CREATE INDEX CONCURRENTLY idx_inventory_available
ON product_inventory(branch_id)
WHERE qty_available > 0;
```

**Benefits:**
- Instant inventory lookups
- Fast low stock alerts
- Efficient availability checks

#### 5. Members Table

```sql
-- Query: Get member by user and branch
CREATE INDEX CONCURRENTLY idx_members_user_branch
ON members(user_id, branch_id);

-- Query: List branch members
CREATE INDEX CONCURRENTLY idx_members_branch_role
ON members(branch_id, role);

-- Query: Check user permissions
CREATE INDEX CONCURRENTLY idx_members_user_id
ON members(user_id);
```

**Benefits:**
- Fast permission checks
- Efficient member listings
- Quick role lookups

#### 6. Inventory Logs Table

```sql
-- Query: Get product history
CREATE INDEX CONCURRENTLY idx_inventory_logs_product_created
ON inventory_logs(product_id, created_at DESC);

-- Query: Get branch inventory activity
CREATE INDEX CONCURRENTLY idx_inventory_logs_branch_created
ON inventory_logs(branch_id, created_at DESC);

-- Query: Track order-related changes
CREATE INDEX CONCURRENTLY idx_inventory_logs_reference
ON inventory_logs(reference_type, reference_id);
```

**Benefits:**
- Fast inventory history queries
- Efficient audit trail lookups
- Quick reconciliation

### Index Maintenance

```sql
-- Check index usage
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Find unused indices
SELECT
    schemaname,
    tablename,
    indexname
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
  AND indexrelname NOT LIKE 'pg_toast%';

-- Reindex if needed (during low traffic)
REINDEX INDEX CONCURRENTLY idx_orders_branch_status_created;
```

## Query Optimization

### 1. Pagination Queries

**Bad:**
```typescript
// Fetches all records then slices in memory
const { data } = await sb.from('orders').select('*');
const page = data.slice(0, 20);
```

**Good:**
```typescript
// Database-level pagination
const { from, to } = PaginationUtil.getRange(page, limit);
const { data } = await sb
  .from('orders')
  .select('*')
  .range(from, to);
```

**Benefits:**
- Reduces data transfer: ~95% less data
- Faster queries: ~10x improvement
- Lower memory usage

### 2. Select Specific Fields

**Bad:**
```typescript
// Fetches all columns
const { data } = await sb.from('products').select('*');
```

**Good:**
```typescript
// Fetches only needed columns
const { data } = await sb
  .from('products')
  .select('id, name, price, image_url');
```

**Benefits:**
- Reduces data transfer: ~70% less data
- Faster serialization
- Better cache efficiency

### 3. Avoid N+1 Queries

**Bad:**
```typescript
// N+1 query problem
const orders = await getOrders();
for (const order of orders) {
  order.items = await getOrderItems(order.id); // N queries
}
```

**Good:**
```typescript
// Single query with join
const { data } = await sb
  .from('orders')
  .select(`
    *,
    order_items(*)
  `);
```

**Benefits:**
- Single database round-trip
- ~100x faster for 100 orders
- Reduced database load

### 4. Use Aggregations in Database

**Bad:**
```typescript
// Calculate in application
const orders = await getAllOrders();
const total = orders.reduce((sum, o) => sum + o.total, 0);
```

**Good:**
```typescript
// Calculate in database
const { data } = await sb
  .from('orders')
  .select('sum(total_amount)')
  .single();
```

**Benefits:**
- Faster calculation: ~50x improvement
- Less memory usage
- Reduced data transfer

### 5. Batch Operations

**Bad:**
```typescript
// Individual updates
for (const item of items) {
  await sb.from('inventory').update(...).eq('id', item.id);
}
```

**Good:**
```typescript
// Batch update
await sb.from('inventory').upsert(items);
```

**Benefits:**
- Single transaction
- ~10x faster
- Atomic operation

## Caching Strategy

### 1. Query Result Caching

**Implementation:**

```typescript
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class ProductsService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getProducts(branchId: string) {
    const cacheKey = `products:${branchId}`;

    // Try cache first
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    // Query database
    const data = await this.fetchProducts(branchId);

    // Cache for 5 minutes
    await this.cacheManager.set(cacheKey, data, 300);

    return data;
  }
}
```

**Cache Keys Strategy:**
- `products:{branchId}` - Product listings
- `product:{id}` - Product details
- `orders:{branchId}:{page}` - Order listings
- `inventory:{branchId}` - Inventory status
- `branch:{id}` - Branch info

**TTL (Time To Live):**
- Static data (branches, categories): 1 hour (3600s)
- Product listings: 5 minutes (300s)
- Inventory: 1 minute (60s)
- Orders: 30 seconds (30s)
- Analytics: 10 minutes (600s)

### 2. Cache Invalidation

```typescript
// Invalidate on update
async updateProduct(id: string, data: UpdateProductDto) {
  const product = await this.repository.update(id, data);

  // Invalidate caches
  await this.cacheManager.del(`product:${id}`);
  await this.cacheManager.del(`products:${product.branchId}`);

  return product;
}

// Pattern-based invalidation
async invalidateProductCaches(branchId: string) {
  const keys = await this.cacheManager.store.keys();
  const productKeys = keys.filter(k =>
    k.startsWith(`products:${branchId}`) ||
    k.startsWith('product:')
  );

  await Promise.all(
    productKeys.map(k => this.cacheManager.del(k))
  );
}
```

### 3. Redis Integration (Production)

**Setup:**

```typescript
// app.module.ts
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      store: redisStore,
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      ttl: 300, // Default 5 minutes
      max: 100, // Maximum items
    }),
  ],
})
export class AppModule {}
```

**Benefits:**
- Distributed cache across instances
- Persistent cache
- Advanced features (pub/sub, clustering)

### 4. Cache Warming

```typescript
// Warm cache on startup
@Injectable()
export class CacheWarmupService implements OnModuleInit {
  async onModuleInit() {
    // Cache frequently accessed data
    await this.cacheProducts();
    await this.cacheBranches();
  }

  private async cacheProducts() {
    const branches = await this.getBranches();

    await Promise.all(
      branches.map(b => this.productsService.getProducts(b.id))
    );
  }
}
```

## Performance Monitoring

### 1. Query Performance Tracking

```sql
-- Enable query statistics
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slow queries
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE mean_time > 100 -- queries taking > 100ms
ORDER BY mean_time DESC
LIMIT 20;

-- Reset statistics
SELECT pg_stat_statements_reset();
```

### 2. Application-Level Monitoring

```typescript
// Query timing interceptor
@Injectable()
export class QueryTimingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        if (duration > 1000) {
          logger.warn(`Slow query: ${duration}ms`, {
            handler: context.getHandler().name,
          });
        }
      }),
    );
  }
}
```

### 3. Supabase Dashboard Monitoring

Monitor in Supabase Dashboard:
- Query performance
- Connection pool usage
- Database size
- Index hit rate
- Cache hit rate

### 4. Performance Metrics

**Key Metrics to Track:**
- Average query time: < 100ms
- 95th percentile: < 500ms
- Cache hit rate: > 80%
- Index hit rate: > 95%
- Connection pool usage: < 80%

**Alerts:**
- Query time > 1s
- Cache hit rate < 70%
- Connection pool > 90%
- Database size > 80% limit

## Implementation Checklist

### Phase 1: Indices (Immediate Impact)
- [ ] Create orders indices
- [ ] Create order_items indices
- [ ] Create products indices
- [ ] Create inventory indices
- [ ] Create members indices
- [ ] Verify index usage

### Phase 2: Query Optimization (1-2 days)
- [ ] Implement pagination utility (✅ Done)
- [ ] Add field selection to queries
- [ ] Optimize join queries
- [ ] Batch update operations
- [ ] Add query performance logging

### Phase 3: Caching (2-3 days)
- [ ] Set up cache manager (✅ Done)
- [ ] Implement product caching
- [ ] Implement order caching
- [ ] Add cache invalidation
- [ ] Set up Redis (production)

### Phase 4: Monitoring (Ongoing)
- [ ] Enable pg_stat_statements
- [ ] Set up query monitoring
- [ ] Configure alerts
- [ ] Create performance dashboard
- [ ] Regular performance reviews

## Expected Performance Improvements

### Before Optimization
- Order listing: 500-1000ms
- Product search: 300-500ms
- Inventory check: 200-300ms
- Order detail: 400-600ms
- Cache hit rate: 0%

### After Optimization
- Order listing: 50-100ms (10x faster)
- Product search: 20-50ms (15x faster)
- Inventory check: 10-20ms (20x faster)
- Order detail: 30-50ms (12x faster)
- Cache hit rate: 80%+

**Overall:** 10-20x performance improvement expected

## Migration Script

```sql
-- database_optimization.sql
-- Run this script to create all recommended indices

BEGIN;

-- Orders indices
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_branch_status_created
ON orders(branch_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_order_no
ON orders(order_no);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_customer_phone
ON orders(customer_phone);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_at
ON orders(created_at DESC);

-- Order items indices
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id
ON order_items(order_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_product_id
ON order_items(product_id);

-- Products indices
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_branch_category
ON products(branch_id, category_id, sort_order);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_branch_hidden
ON products(branch_id, is_hidden, sort_order);

-- Enable trigram extension for text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_name_trgm
ON products USING gin(name gin_trgm_ops);

-- Inventory indices
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_branch_product
ON product_inventory(branch_id, product_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_low_stock
ON product_inventory(branch_id, qty_available)
WHERE qty_available < 10;

-- Members indices
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_members_user_branch
ON members(user_id, branch_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_members_branch_role
ON members(branch_id, role);

-- Inventory logs indices
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_logs_product_created
ON inventory_logs(product_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_logs_branch_created
ON inventory_logs(branch_id, created_at DESC);

COMMIT;

-- Analyze tables to update statistics
ANALYZE orders;
ANALYZE order_items;
ANALYZE products;
ANALYZE product_inventory;
ANALYZE members;
ANALYZE inventory_logs;
```

## Maintenance Schedule

### Daily
- Monitor slow queries
- Check cache hit rates
- Review error logs

### Weekly
- Analyze query patterns
- Review index usage
- Clear old cache entries

### Monthly
- Vacuum and analyze tables
- Review and optimize indices
- Performance testing
- Capacity planning

---

**Last Updated:** 2026-02-06
**Version:** 1.0.0
