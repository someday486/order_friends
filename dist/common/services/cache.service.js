"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var CacheService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
let CacheService = class CacheService {
    static { CacheService_1 = this; }
    cacheManager;
    logger = new common_1.Logger(CacheService_1.name);
    constructor(cacheManager) {
        this.cacheManager = cacheManager;
    }
    static TTL = {
        STATIC: 3600,
        PRODUCTS: 300,
        INVENTORY: 60,
        ORDERS: 30,
        ANALYTICS: 600,
        SHORT: 10,
    };
    static keys = {
        products: (branchId) => `products:${branchId}`,
        product: (id) => `product:${id}`,
        productSearch: (branchId, query) => `products:search:${branchId}:${query}`,
        orders: (branchId, page, limit) => `orders:${branchId}:${page}:${limit}`,
        order: (id) => `order:${id}`,
        inventory: (branchId) => `inventory:${branchId}`,
        productInventory: (branchId, productId) => `inventory:${branchId}:${productId}`,
        branch: (id) => `branch:${id}`,
        branches: (brandId) => `branches:${brandId}`,
        analytics: (branchId, metric) => `analytics:${branchId}:${metric}`,
        dashboard: (branchId) => `dashboard:${branchId}`,
    };
    async get(key) {
        try {
            const value = await this.cacheManager.get(key);
            if (value) {
                this.logger.debug(`Cache HIT: ${key}`);
            }
            else {
                this.logger.debug(`Cache MISS: ${key}`);
            }
            return value;
        }
        catch (error) {
            this.logger.error(`Cache GET error for key ${key}:`, error);
            return undefined;
        }
    }
    async set(key, value, ttl) {
        try {
            await this.cacheManager.set(key, value, ttl);
            this.logger.debug(`Cache SET: ${key} (TTL: ${ttl || 'default'}s)`);
        }
        catch (error) {
            this.logger.error(`Cache SET error for key ${key}:`, error);
        }
    }
    async del(key) {
        try {
            await this.cacheManager.del(key);
            this.logger.debug(`Cache DEL: ${key}`);
        }
        catch (error) {
            this.logger.error(`Cache DEL error for key ${key}:`, error);
        }
    }
    async delPattern(pattern) {
        try {
            const store = this.cacheManager.store;
            if (typeof store.keys === 'function') {
                const keys = await store.keys();
                const matchedKeys = keys.filter((key) => key.includes(pattern));
                await Promise.all(matchedKeys.map((key) => this.del(key)));
                this.logger.debug(`Cache DEL pattern: ${pattern} (${matchedKeys.length} keys)`);
            }
            else {
                this.logger.warn(`Cache store does not support pattern deletion: ${pattern}`);
            }
        }
        catch (error) {
            this.logger.error(`Cache DEL pattern error for pattern ${pattern}:`, error);
        }
    }
    async reset() {
        try {
            await this.cacheManager.reset();
            this.logger.debug('Cache RESET: All keys cleared');
        }
        catch (error) {
            this.logger.error('Cache RESET error:', error);
        }
    }
    async getOrSet(key, factory, ttl) {
        const cached = await this.get(key);
        if (cached !== undefined) {
            return cached;
        }
        const value = await factory();
        await this.set(key, value, ttl);
        return value;
    }
    async invalidateProduct(productId, branchId) {
        await this.del(CacheService_1.keys.product(productId));
        if (branchId) {
            await this.delPattern(`products:${branchId}`);
            await this.delPattern(`inventory:${branchId}`);
        }
    }
    async invalidateOrder(orderId, branchId) {
        await this.del(CacheService_1.keys.order(orderId));
        if (branchId) {
            await this.delPattern(`orders:${branchId}`);
            await this.delPattern(`dashboard:${branchId}`);
        }
    }
    async invalidateInventory(branchId, productId) {
        await this.delPattern(`inventory:${branchId}`);
        if (productId) {
            await this.del(CacheService_1.keys.productInventory(branchId, productId));
        }
    }
    async invalidateBranch(branchId, brandId) {
        await this.del(CacheService_1.keys.branch(branchId));
        if (brandId) {
            await this.del(CacheService_1.keys.branches(brandId));
        }
        await this.delPattern(`products:${branchId}`);
        await this.delPattern(`orders:${branchId}`);
        await this.delPattern(`inventory:${branchId}`);
        await this.delPattern(`dashboard:${branchId}`);
    }
    async getStats() {
        try {
            const store = this.cacheManager.store;
            if (typeof store.keys === 'function') {
                const keys = await store.keys();
                return {
                    totalKeys: keys.length,
                    keys: keys.slice(0, 10),
                };
            }
            return { message: 'Stats not supported by current cache store' };
        }
        catch (error) {
            this.logger.error('Cache stats error:', error);
            return { error: 'Failed to get cache stats' };
        }
    }
};
exports.CacheService = CacheService;
exports.CacheService = CacheService = CacheService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(cache_manager_1.CACHE_MANAGER)),
    __metadata("design:paramtypes", [Object])
], CacheService);
//# sourceMappingURL=cache.service.js.map