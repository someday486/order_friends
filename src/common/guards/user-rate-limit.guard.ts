import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';

export const USER_RATE_LIMIT_KEY = 'userRateLimit';

export interface UserRateLimitOptions {
  points: number; // Number of requests
  duration: number; // Time window in seconds
  blockDuration?: number; // How long to block after limit exceeded (seconds)
}

@Injectable()
export class UserRateLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private getHeaderValue(request: any, name: string): string | undefined {
    const headers = request?.headers;
    if (!headers) return undefined;

    if (typeof headers.get === 'function') {
      const value = headers.get(name);
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    const direct = headers[name] ?? headers[name.toLowerCase()];
    if (Array.isArray(direct)) {
      return direct[0]?.toString().trim();
    }
    if (typeof direct === 'string' && direct.trim()) {
      return direct.trim();
    }

    return undefined;
  }

  private resolveRateLimitIdentity(request: any): {
    kind: 'user' | 'ip';
    value: string;
  } | null {
    const userId = request?.user?.id || request?.user?.sub;
    if (userId) {
      return { kind: 'user', value: String(userId) };
    }

    const forwardedFor = this.getHeaderValue(request, 'x-forwarded-for');
    const realIp = this.getHeaderValue(request, 'x-real-ip');
    const firstForwardedIp = forwardedFor?.split(',')[0]?.trim();
    const ip =
      firstForwardedIp ||
      realIp ||
      request?.ip ||
      request?.socket?.remoteAddress;

    if (!ip) return null;
    return { kind: 'ip', value: String(ip) };
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<UserRateLimitOptions>(
      USER_RATE_LIMIT_KEY,
      context.getHandler(),
    );

    if (!options) {
      return true; // No rate limit configured
    }

    const request = context.switchToHttp().getRequest();
    const identity = this.resolveRateLimitIdentity(request);
    if (!identity) return true;

    const key = `rate-limit:${identity.kind}:${identity.value}`;
    const blockKey = `rate-limit:block:${identity.kind}:${identity.value}`;

    // Check if user is currently blocked
    const isBlocked = await this.cacheManager.get(blockKey);
    if (isBlocked) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          error: 'Rate Limit Exceeded',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Get current request count
    const current = ((await this.cacheManager.get(key)) as number) || 0;

    if (current >= options.points) {
      // Exceeded rate limit - block the user
      const blockDuration = (options.blockDuration || options.duration) * 1000;
      await this.cacheManager.set(blockKey, true, blockDuration);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many requests. Please try again in ${options.blockDuration || options.duration} seconds.`,
          error: 'Rate Limit Exceeded',
          retryAfter: options.blockDuration || options.duration,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Increment request count
    await this.cacheManager.set(key, current + 1, options.duration * 1000);

    // Add rate limit headers
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', options.points);
    response.setHeader('X-RateLimit-Remaining', options.points - current - 1);
    response.setHeader(
      'X-RateLimit-Reset',
      Date.now() + options.duration * 1000,
    );

    return true;
  }
}
