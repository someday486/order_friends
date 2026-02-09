import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Cache } from 'cache-manager';
export declare const USER_RATE_LIMIT_KEY = "userRateLimit";
export interface UserRateLimitOptions {
    points: number;
    duration: number;
    blockDuration?: number;
}
export declare class UserRateLimitGuard implements CanActivate {
    private reflector;
    private cacheManager;
    constructor(reflector: Reflector, cacheManager: Cache);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
