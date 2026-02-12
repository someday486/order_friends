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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRateLimitGuard = exports.USER_RATE_LIMIT_KEY = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const cache_manager_1 = require("@nestjs/cache-manager");
const common_2 = require("@nestjs/common");
exports.USER_RATE_LIMIT_KEY = 'userRateLimit';
let UserRateLimitGuard = class UserRateLimitGuard {
    reflector;
    cacheManager;
    constructor(reflector, cacheManager) {
        this.reflector = reflector;
        this.cacheManager = cacheManager;
    }
    async canActivate(context) {
        const options = this.reflector.get(exports.USER_RATE_LIMIT_KEY, context.getHandler());
        if (!options) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        const userId = request.user?.id || request.user?.sub;
        if (!userId) {
            return true;
        }
        const key = `rate-limit:user:${userId}`;
        const blockKey = `rate-limit:block:${userId}`;
        const isBlocked = await this.cacheManager.get(blockKey);
        if (isBlocked) {
            throw new common_1.HttpException({
                statusCode: common_1.HttpStatus.TOO_MANY_REQUESTS,
                message: 'Too many requests. Please try again later.',
                error: 'Rate Limit Exceeded',
            }, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        const current = (await this.cacheManager.get(key)) || 0;
        if (current >= options.points) {
            const blockDuration = (options.blockDuration || options.duration) * 1000;
            await this.cacheManager.set(blockKey, true, blockDuration);
            throw new common_1.HttpException({
                statusCode: common_1.HttpStatus.TOO_MANY_REQUESTS,
                message: `Too many requests. Please try again in ${options.blockDuration || options.duration} seconds.`,
                error: 'Rate Limit Exceeded',
                retryAfter: options.blockDuration || options.duration,
            }, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        await this.cacheManager.set(key, current + 1, options.duration * 1000);
        const response = context.switchToHttp().getResponse();
        response.setHeader('X-RateLimit-Limit', options.points);
        response.setHeader('X-RateLimit-Remaining', options.points - current - 1);
        response.setHeader('X-RateLimit-Reset', Date.now() + options.duration * 1000);
        return true;
    }
};
exports.UserRateLimitGuard = UserRateLimitGuard;
exports.UserRateLimitGuard = UserRateLimitGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_2.Inject)(cache_manager_1.CACHE_MANAGER)),
    __metadata("design:paramtypes", [core_1.Reflector, Object])
], UserRateLimitGuard);
//# sourceMappingURL=user-rate-limit.guard.js.map