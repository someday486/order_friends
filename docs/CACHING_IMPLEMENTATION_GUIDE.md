# Caching Implementation Guide

## Overview

This guide demonstrates how to implement caching in the Order Friends application using the `CacheService`.

## Setup

### 1. Install Dependencies

```bash
npm install cache-manager
npm install @types/cache-manager --save-dev
```

### 2. Configure Cache Module

**app.module.ts:**

```typescript
import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { CacheService } from './common/services/cache.service';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true, // Make cache available globally
      ttl: 300, // Default TTL: 5 minutes (in seconds)
      max: 100, // Maximum number of items in cache
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class AppModule {}
```

### 3. Add CacheService to Module

**common/common.module.ts:**

```typescript
import { Module, Global } from '@nestjs/common';
import { CacheService } from './services/cache.service';

@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CommonModule {}
```

## Usage Examples

### Example 1: Product Listing with Cache

**products.service.ts:**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../common/services/cache.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Get products with caching
   */
  async getProducts(branchId: string): Promise<Product[]> {
    const cacheKey = CacheService.keys.products(branchId);

    // Try cache first
    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        // Cache miss - fetch from database
        this.logger.log(`Fetching products from DB for branch: ${branchId}`);

        const { data, error } = await this.supabase
          .adminClient()
          .from('products')
          .select('*')
          .eq('branch_id', branchId)
          .eq('is_hidden', false)
          .order('sort_order', { ascending: true });

        if (error) {
          throw new Error(`Failed to fetch products: ${error.message}`);
        }

        return data || [];
      },
      CacheService.TTL.PRODUCTS, // 5 minutes TTL
    );
  }

  /**
   * Get single product with cache
   */
  async getProduct(id: string): Promise<Product> {
    const cacheKey = CacheService.keys.product(id);

    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        const { data, error } = await this.supabase
          .adminClient()
          .from('products')
          .select('*')
          .eq('id', id)
          .single();

        if (error || !data) {
          throw new ProductNotFoundException(id);
        }

        return data;
      },
      CacheService.TTL.PRODUCTS,
    );
  }

  /**
   * Update product and invalidate cache
   */
  async updateProduct(
    id: string,
    updateData: UpdateProductDto,
  ): Promise<Product> {
    // Update in database
    const { data, error } = await this.supabase
      .adminClient()
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update product: ${error?.message}`);
    }

    // Invalidate caches
    await this.cache.invalidateProduct(id, data.branch_id);

    return data;
  }

  /**
   * Delete product and invalidate cache
   */
  async deleteProduct(id: string): Promise<void> {
    // Get product to find branch_id before deletion
    const product = await this.getProduct(id);

    // Delete from database
    const { error } = await this.supabase
      .adminClient()
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete product: ${error.message}`);
    }

    // Invalidate caches
    await this.cache.invalidateProduct(id, product.branch_id);
  }
}
```

### Example 2: Order Listing with Pagination Cache

**orders.service.ts:**

```typescript
import { Injectable } from '@nestjs/common';
import { CacheService } from '../../common/services/cache.service';
import { PaginatedResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Get paginated orders with cache
   */
  async getOrders(
    branchId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResponse<Order>> {
    const cacheKey = CacheService.keys.orders(branchId, page, limit);

    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        // Fetch from database
        const { from, to } = this.getRange(page, limit);

        const { data, count, error } = await this.supabase
          .adminClient()
          .from('orders')
          .select('*', { count: 'exact' })
          .eq('branch_id', branchId)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) {
          throw new Error(`Failed to fetch orders: ${error.message}`);
        }

        return {
          data: data || [],
          pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
          },
        };
      },
      CacheService.TTL.ORDERS, // 30 seconds TTL
    );
  }

  /**
   * Create order and invalidate cache
   */
  async createOrder(createDto: CreateOrderDto): Promise<Order> {
    const { data, error } = await this.supabase
      .adminClient()
      .from('orders')
      .insert(createDto)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create order: ${error?.message}`);
    }

    // Invalidate order listings cache
    await this.cache.invalidateOrder(data.id, data.branch_id);

    return data;
  }

  private getRange(page: number, limit: number): { from: number; to: number } {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    return { from, to };
  }
}
```

### Example 3: Inventory with Short TTL

**inventory.service.ts:**

```typescript
import { Injectable } from '@nestjs/common';
import { CacheService } from '../../common/services/cache.service';

@Injectable()
export class InventoryService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Get inventory with very short cache (1 minute)
   */
  async getInventory(branchId: string): Promise<Inventory[]> {
    const cacheKey = CacheService.keys.inventory(branchId);

    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        const { data, error } = await this.supabase
          .adminClient()
          .from('product_inventory')
          .select('*, products(*)')
          .eq('branch_id', branchId);

        if (error) {
          throw new Error(`Failed to fetch inventory: ${error.message}`);
        }

        return data || [];
      },
      CacheService.TTL.INVENTORY, // 1 minute TTL
    );
  }

  /**
   * Update inventory and invalidate cache
   */
  async updateInventory(
    branchId: string,
    productId: string,
    quantity: number,
  ): Promise<void> {
    const { error } = await this.supabase
      .adminClient()
      .from('product_inventory')
      .update({ qty_available: quantity })
      .eq('branch_id', branchId)
      .eq('product_id', productId);

    if (error) {
      throw new Error(`Failed to update inventory: ${error.message}`);
    }

    // Invalidate inventory cache
    await this.cache.invalidateInventory(branchId, productId);
  }
}
```

### Example 4: Dashboard Analytics with Long TTL

**dashboard.service.ts:**

```typescript
import { Injectable } from '@nestjs/common';
import { CacheService } from '../../common/services/cache.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Get dashboard data with analytics cache (10 minutes)
   */
  async getDashboard(branchId: string): Promise<DashboardData> {
    const cacheKey = CacheService.keys.dashboard(branchId);

    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        // Fetch multiple analytics queries
        const [todaySales, totalOrders, activeProducts] = await Promise.all([
          this.getTodaySales(branchId),
          this.getTotalOrders(branchId),
          this.getActiveProducts(branchId),
        ]);

        return {
          todaySales,
          totalOrders,
          activeProducts,
          lastUpdated: new Date(),
        };
      },
      CacheService.TTL.ANALYTICS, // 10 minutes TTL
    );
  }

  /**
   * Manually refresh dashboard cache
   */
  async refreshDashboard(branchId: string): Promise<DashboardData> {
    const cacheKey = CacheService.keys.dashboard(branchId);

    // Delete old cache
    await this.cache.del(cacheKey);

    // Fetch fresh data
    return await this.getDashboard(branchId);
  }
}
```

### Example 5: Search Results with Dynamic Keys

**search.service.ts:**

```typescript
import { Injectable } from '@nestjs/common';
import { CacheService } from '../../common/services/cache.service';

@Injectable()
export class SearchService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Search products with query-specific cache
   */
  async searchProducts(
    branchId: string,
    query: string,
  ): Promise<Product[]> {
    // Normalize query for consistent cache keys
    const normalizedQuery = query.toLowerCase().trim();
    const cacheKey = CacheService.keys.productSearch(branchId, normalizedQuery);

    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        const { data, error } = await this.supabase
          .adminClient()
          .from('products')
          .select('*')
          .eq('branch_id', branchId)
          .ilike('name', `%${query}%`)
          .limit(20);

        if (error) {
          throw new Error(`Search failed: ${error.message}`);
        }

        return data || [];
      },
      CacheService.TTL.PRODUCTS,
    );
  }
}
```

## Cache Invalidation Patterns

### Pattern 1: Invalidate on Write Operations

```typescript
// CREATE
async createProduct(data: CreateProductDto): Promise<Product> {
  const product = await this.repository.create(data);
  await this.cache.invalidateProduct(product.id, product.branch_id);
  return product;
}

// UPDATE
async updateProduct(id: string, data: UpdateProductDto): Promise<Product> {
  const product = await this.repository.update(id, data);
  await this.cache.invalidateProduct(id, product.branch_id);
  return product;
}

// DELETE
async deleteProduct(id: string): Promise<void> {
  const product = await this.repository.findOne(id);
  await this.repository.delete(id);
  await this.cache.invalidateProduct(id, product.branch_id);
}
```

### Pattern 2: Cascade Invalidation

```typescript
// When order is created, invalidate related caches
async createOrder(data: CreateOrderDto): Promise<Order> {
  const order = await this.repository.create(data);

  // Invalidate multiple related caches
  await Promise.all([
    this.cache.invalidateOrder(order.id, order.branch_id),
    this.cache.invalidateInventory(order.branch_id), // Inventory changed
    this.cache.del(CacheService.keys.dashboard(order.branch_id)), // Dashboard stats changed
  ]);

  return order;
}
```

### Pattern 3: Time-based Auto-refresh

```typescript
// Cache with auto-refresh for critical data
async getCriticalData(id: string): Promise<Data> {
  const cached = await this.cache.get<Data>(cacheKey);

  if (cached) {
    // Check if cache is stale (older than X seconds)
    if (this.isStale(cached.timestamp, 30)) {
      // Refresh in background
      this.refreshCacheInBackground(id);
    }
    return cached;
  }

  // No cache, fetch immediately
  return await this.fetchAndCache(id);
}

private async refreshCacheInBackground(id: string): Promise<void> {
  // Don't await - fire and forget
  this.fetchAndCache(id).catch((error) => {
    this.logger.error(`Background cache refresh failed: ${error}`);
  });
}
```

## Testing Caching

### Unit Test Example

```typescript
describe('ProductsService with Cache', () => {
  let service: ProductsService;
  let cacheService: CacheService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: CacheService,
          useValue: {
            getOrSet: jest.fn(),
            invalidateProduct: jest.fn(),
          },
        },
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    cacheService = module.get<CacheService>(CacheService);
  });

  it('should use cache on second call', async () => {
    const mockProducts = [{ id: '1', name: 'Test Product' }];

    // First call - cache miss
    (cacheService.getOrSet as jest.Mock).mockResolvedValueOnce(mockProducts);

    const result1 = await service.getProducts('branch-1');
    expect(result1).toEqual(mockProducts);

    // Second call - cache hit
    const result2 = await service.getProducts('branch-1');
    expect(result2).toEqual(mockProducts);

    // getOrSet should be called twice (but DB only once)
    expect(cacheService.getOrSet).toHaveBeenCalledTimes(2);
  });

  it('should invalidate cache on update', async () => {
    const productId = 'product-1';
    const branchId = 'branch-1';

    await service.updateProduct(productId, { name: 'Updated' });

    expect(cacheService.invalidateProduct).toHaveBeenCalledWith(
      productId,
      branchId,
    );
  });
});
```

## Performance Monitoring

### Add Cache Hit Rate Tracking

```typescript
@Injectable()
export class CacheMetricsService {
  private hits = 0;
  private misses = 0;

  recordHit(): void {
    this.hits++;
  }

  recordMiss(): void {
    this.misses++;
  }

  getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? (this.hits / total) * 100 : 0;
  }

  getStats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: this.getHitRate(),
    };
  }

  reset(): void {
    this.hits = 0;
    this.misses = 0;
  }
}
```

### Cache Stats Endpoint

```typescript
@Controller('admin/cache')
export class CacheController {
  constructor(
    private readonly cacheService: CacheService,
    private readonly metricsService: CacheMetricsService,
  ) {}

  @Get('stats')
  async getStats() {
    const metrics = this.metricsService.getStats();
    const cacheStats = await this.cacheService.getStats();

    return {
      metrics,
      cache: cacheStats,
    };
  }

  @Delete('clear')
  async clearCache() {
    await this.cacheService.reset();
    return { message: 'Cache cleared successfully' };
  }
}
```

## Best Practices

### 1. Cache Key Naming Convention
- Use consistent prefix: `resource:identifier`
- Include all parameters: `products:branch-123:page-1:limit-20`
- Use descriptive names: `dashboard:branch-123` not `db:b123`

### 2. TTL Selection
- **Static data** (categories, settings): 1 hour+
- **Semi-static** (products, branches): 5-10 minutes
- **Dynamic** (inventory, orders): 30-60 seconds
- **Real-time** (live data): Don't cache or < 10 seconds

### 3. Cache Invalidation
- Always invalidate on write operations
- Invalidate related caches (cascade)
- Use pattern matching for bulk invalidation
- Consider using cache tags/groups

### 4. Error Handling
- Never let cache errors break the app
- Fall back to database on cache errors
- Log cache errors for monitoring
- Consider circuit breaker pattern

### 5. Memory Management
- Set max cache size
- Use TTL to prevent stale data
- Monitor cache memory usage
- Implement cache eviction policies

## Production Checklist

- [ ] Cache module configured
- [ ] TTL values set appropriately
- [ ] Cache invalidation implemented
- [ ] Error handling in place
- [ ] Logging configured
- [ ] Metrics tracking enabled
- [ ] Redis configured (for distributed cache)
- [ ] Cache monitoring dashboard
- [ ] Load testing with cache
- [ ] Cache hit rate > 70%

---

**Last Updated:** 2026-02-06
**Version:** 1.0.0
