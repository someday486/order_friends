import type { Cache } from 'cache-manager';
export declare class CacheService {
    private cacheManager;
    private readonly logger;
    constructor(cacheManager: Cache);
    static readonly TTL: {
        STATIC: number;
        PRODUCTS: number;
        INVENTORY: number;
        ORDERS: number;
        ANALYTICS: number;
        SHORT: number;
    };
    static keys: {
        products: (branchId: string) => string;
        product: (id: string) => string;
        productSearch: (branchId: string, query: string) => string;
        orders: (branchId: string, page: number, limit: number) => string;
        order: (id: string) => string;
        inventory: (branchId: string) => string;
        productInventory: (branchId: string, productId: string) => string;
        branch: (id: string) => string;
        branches: (brandId: string) => string;
        analytics: (branchId: string, metric: string) => string;
        dashboard: (branchId: string) => string;
    };
    get<T>(key: string): Promise<T | undefined>;
    set<T>(key: string, value: T, ttl?: number): Promise<void>;
    del(key: string): Promise<void>;
    delPattern(pattern: string): Promise<void>;
    reset(): Promise<void>;
    getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T>;
    invalidateProduct(productId: string, branchId?: string): Promise<void>;
    invalidateOrder(orderId: string, branchId?: string): Promise<void>;
    invalidateInventory(branchId: string, productId?: string): Promise<void>;
    invalidateBranch(branchId: string, brandId?: string): Promise<void>;
    getStats(): Promise<any>;
}
