import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

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
    STATIC: 3600,
    PRODUCTS: 300,
    INVENTORY: 60,
    ORDERS: 30,
    ANALYTICS: 600,
    SHORT: 10,
  };

  /**
   * Cache key generators
   */
  static keys = {
    products: (branchId: string) => `products:${branchId}`,
    product: (id: string) => `product:${id}`,
    productSearch: (branchId: string, query: string) =>
      `products:search:${branchId}:${query}`,

    orders: (branchId: string, page: number, limit: number) =>
      `orders:${branchId}:${page}:${limit}`,
    order: (id: string) => `order:${id}`,

    inventory: (branchId: string) => `inventory:${branchId}`,
    productInventory: (branchId: string, productId: string) =>
      `inventory:${branchId}:${productId}`,

    branch: (id: string) => `branch:${id}`,
    branches: (brandId: string) => `branches:${brandId}`,

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

      if (value !== null && value !== undefined) {
        this.logger.debug(`Cache HIT: ${key}`);
        return value as T;
      }

      this.logger.debug(`Cache MISS: ${key}`);
      return undefined; // 🔥 null → undefined 정규화
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
      const store = (this.cacheManager as any).stores?.[0];

      if (store && typeof store.keys === 'function') {
        const keys = await store.keys();
        const matchedKeys = keys.filter((key: string) => key.includes(pattern));

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
      const stores = (this.cacheManager as any).stores as any[] | undefined;

      if (stores?.length) {
        await Promise.all(
          stores.map((s) =>
            typeof s.clear === 'function' ? s.clear() : Promise.resolve(),
          ),
        );
      }

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
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
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
      await this.del(CacheService.keys.productInventory(branchId, productId));
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
      const store = (this.cacheManager as any).stores?.[0];

      if (store && typeof store.keys === 'function') {
        const keys = await store.keys();
        return {
          totalKeys: keys.length,
          keys: keys.slice(0, 10),
        };
      }

      return { message: 'Stats not supported by current cache store' };
    } catch (error) {
      this.logger.error('Cache stats error:', error);
      return { error: 'Failed to get cache stats' };
    }
  }
}
