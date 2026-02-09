import { SetMetadata } from '@nestjs/common';
import {
  USER_RATE_LIMIT_KEY,
  UserRateLimitOptions,
} from '../guards/user-rate-limit.guard';

/**
 * Apply user-based rate limiting to a route handler.
 *
 * @param options Rate limit configuration
 * @param options.points Number of requests allowed
 * @param options.duration Time window in seconds
 * @param options.blockDuration (Optional) How long to block after limit exceeded (seconds)
 *
 * @example
 * @UserRateLimit({ points: 10, duration: 60 })
 * // Allows 10 requests per minute per user
 *
 * @example
 * @UserRateLimit({ points: 3, duration: 60, blockDuration: 300 })
 * // Allows 3 requests per minute, blocks for 5 minutes if exceeded
 */
export const UserRateLimit = (options: UserRateLimitOptions) =>
  SetMetadata(USER_RATE_LIMIT_KEY, options);
