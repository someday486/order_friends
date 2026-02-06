import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

/**
 * Centralized caching service with typed keys and TTL management
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Cache TTL constants (in seconds)
   */
  static readonly TTL = {
    STATIC: 3600, // 1 hour - Static data (branches, categories)
    PRODUCTS: 300, // 5 minutes - Product listings
    INVENTORY: 60, // 1 minute - Inventory status
    ORDERS: 30, // 30 seconds - Order listings
    ANALYTICS: 600, // 10 minutes - Analytics data
    SHORT: 10, // 10 seconds - Very dynamic data
  };

  /**
   * Cache key generators
   */
  static keys = {
    // Products
    products: (branchId: string) => `products:${branchId}`,
    product: (id: string) => `product:${id}`,
    productSearch: (branchId: string, query: string) =>
      `products:search:${branchId}:${query}`,

    // Orders
    orders: (branchId: string, page: number, limit: number) =>
      `orders:${branchId}:${page}:${limit}`,
    order: (id: string) => `order:${id}`,

    // Inventory
    inventory: (branchId: string) => `inventory:${branchId}`,
    productInventory: (branchId: string, productId: string) =>
      `inventory:${branchId}:${productId}`,

    // Branches
    branch: (id: string) => `branch:${id}`,
    branches: (brandId: string) => `branches:${brandId}`,

    // Analytics
    analytics: (branchId: string, metric: string) =>
      `analytics:${branchId}:${metric}`,
    dashboard: (branchId: string) => `dashboard:${branchId}`,
  };

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const value = await this.cacheManager.get<T>(key);
      if (value) {
        this.logger.debug(`Cache HIT: ${key}`);
      } else {
        this.logger.debug(`Cache MISS: ${key}`);
      }
      return value;
    } catch (error) {
      this.logger.error(`Cache GET error for key ${key}:`, error);
      return undefined;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl);
      this.logger.debug(`Cache SET: ${key} (TTL: ${ttl || 'default'}s)`);
    } catch (error) {
      this.logger.error(`Cache SET error for key ${key}:`, error);
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.logger.debug(`Cache DEL: ${key}`);
    } catch (error) {
      this.logger.error(`Cache DEL error for key ${key}:`, error);
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      const store = this.cacheManager.store as any;

      // If store has keys() method (memory cache, Redis)
      if (typeof store.keys === 'function') {
        const keys = await store.keys();
        const matchedKeys = keys.filter((key: string) =>
          key.includes(pattern),
        );

        await Promise.all(matchedKeys.map((key: string) => this.del(key)));
        this.logger.debug(
          `Cache DEL pattern: ${pattern} (${matchedKeys.length} keys)`,
        );
      } else {
        this.logger.warn(
          `Cache store does not support pattern deletion: ${pattern}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Cache DEL pattern error for pattern ${pattern}:`,
        error,
      );
    }
  }

  /**
   * Clear all cache
   */
  async reset(): Promise<void> {
    try {
      await this.cacheManager.reset();
      this.logger.debug('Cache RESET: All keys cleared');
    } catch (error) {
      this.logger.error('Cache RESET error:', error);
    }
  }

  /**
   * Get or set cache (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    // Execute factory function
    const value = await factory();

    // Store in cache
    await this.set(key, value, ttl);

    return value;
  }

  /**
   * Invalidate product caches
   */
  async invalidateProduct(productId: string, branchId?: string): Promise<void> {
    await this.del(CacheService.keys.product(productId));

    if (branchId) {
      await this.delPattern(`products:${branchId}`);
      await this.delPattern(`inventory:${branchId}`);
    }
  }

  /**
   * Invalidate order caches
   */
  async invalidateOrder(orderId: string, branchId?: string): Promise<void> {
    await this.del(CacheService.keys.order(orderId));

    if (branchId) {
      await this.delPattern(`orders:${branchId}`);
      await this.delPattern(`dashboard:${branchId}`);
    }
  }

  /**
   * Invalidate inventory caches
   */
  async invalidateInventory(
    branchId: string,
    productId?: string,
  ): Promise<void> {
    await this.delPattern(`inventory:${branchId}`);

    if (productId) {
      await this.del(
        CacheService.keys.productInventory(branchId, productId),
      );
    }
  }

  /**
   * Invalidate branch caches
   */
  async invalidateBranch(branchId: string, brandId?: string): Promise<void> {
    await this.del(CacheService.keys.branch(branchId));

    if (brandId) {
      await this.del(CacheService.keys.branches(brandId));
    }

    // Invalidate all branch-related caches
    await this.delPattern(`products:${branchId}`);
    await this.delPattern(`orders:${branchId}`);
    await this.delPattern(`inventory:${branchId}`);
    await this.delPattern(`dashboard:${branchId}`);
  }

  /**
   * Get cache statistics (if supported by store)
   */
  async getStats(): Promise<any> {
    try {
      const store = this.cacheManager.store as any;

      if (typeof store.keys === 'function') {
        const keys = await store.keys();
        return {
          totalKeys: keys.length,
          keys: keys.slice(0, 10), // First 10 keys as sample
        };
      }

      return { message: 'Stats not supported by current cache store' };
    } catch (error) {
      this.logger.error('Cache stats error:', error);
      return { error: 'Failed to get cache stats' };
    }
  }
}
