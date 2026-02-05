# User-Based Rate Limiting

## Overview

The user-based rate limiting system protects API endpoints from abuse by limiting the number of requests a single user can make within a time window.

## Features

- **Per-User Tracking**: Rate limits are tracked per authenticated user
- **Flexible Configuration**: Set different limits for different endpoints
- **Automatic Blocking**: Users exceeding limits are temporarily blocked
- **Rate Limit Headers**: Responses include standard rate limit headers
- **Cache-Based**: Uses in-memory cache for high performance

## Usage

### Basic Example

```typescript
import { Controller, Post, UseGuards } from '@nestjs/common';
import { UserRateLimit } from '@/common/decorators/user-rate-limit.decorator';
import { UserRateLimitGuard } from '@/common/guards/user-rate-limit.guard';
import { AuthGuard } from '@/common/guards/auth.guard';

@Controller('orders')
@UseGuards(AuthGuard, UserRateLimitGuard)
export class OrdersController {
  @Post()
  @UserRateLimit({ points: 10, duration: 60 })
  createOrder() {
    // Allow 10 order creations per minute per user
    return 'Order created';
  }

  @Post('cancel')
  @UserRateLimit({ points: 5, duration: 60, blockDuration: 300 })
  cancelOrder() {
    // Allow 5 cancellations per minute
    // Block for 5 minutes if limit exceeded
    return 'Order cancelled';
  }
}
```

### Configuration Options

```typescript
interface UserRateLimitOptions {
  points: number;        // Number of requests allowed
  duration: number;      // Time window in seconds
  blockDuration?: number; // Optional: How long to block after exceeding (seconds)
}
```

### Recommended Limits

| Endpoint Type | Points | Duration | Block Duration |
|---------------|--------|----------|----------------|
| Read (GET) | 100 | 60s | - |
| Create (POST) | 10 | 60s | 300s (5min) |
| Update (PUT/PATCH) | 20 | 60s | 180s (3min) |
| Delete | 5 | 60s | 600s (10min) |
| Authentication | 5 | 300s | 900s (15min) |
| Payment | 3 | 60s | 1800s (30min) |

### Response Headers

When rate limiting is active, responses include:

```
X-RateLimit-Limit: 10           # Total requests allowed
X-RateLimit-Remaining: 7        # Requests remaining
X-RateLimit-Reset: 1706789123000 # When limit resets (Unix timestamp)
```

### Error Response

When rate limit is exceeded:

```json
{
  "statusCode": 429,
  "message": "Too many requests. Please try again in 60 seconds.",
  "error": "Rate Limit Exceeded",
  "retryAfter": 60
}
```

## Implementation Examples

### Order Creation Endpoint

```typescript
@Post()
@UseGuards(AuthGuard, UserRateLimitGuard)
@UserRateLimit({ points: 10, duration: 60 })
async createOrder(@Body() dto: CreateOrderDto) {
  return this.ordersService.create(dto);
}
```

### Payment Endpoint (Stricter Limits)

```typescript
@Post('payment')
@UseGuards(AuthGuard, UserRateLimitGuard)
@UserRateLimit({ points: 3, duration: 60, blockDuration: 1800 })
async processPayment(@Body() dto: PaymentDto) {
  return this.paymentsService.process(dto);
}
```

### Product Search (Lenient Limits)

```typescript
@Get('search')
@UseGuards(AuthGuard, UserRateLimitGuard)
@UserRateLimit({ points: 100, duration: 60 })
async searchProducts(@Query() query: SearchDto) {
  return this.productsService.search(query);
}
```

## Testing

### Unit Test Example

```typescript
import { UserRateLimitGuard } from './user-rate-limit.guard';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HttpException } from '@nestjs/common';

describe('UserRateLimitGuard', () => {
  let guard: UserRateLimitGuard;
  let cacheManager: any;

  beforeEach(() => {
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };

    guard = new UserRateLimitGuard(
      {} as any, // reflector
      cacheManager,
    );
  });

  it('should block user after exceeding rate limit', async () => {
    cacheManager.get.mockResolvedValue(10); // Already at limit

    await expect(guard.canActivate({} as any)).rejects.toThrow(HttpException);
  });
});
```

## Best Practices

1. **Always use with AuthGuard**: Rate limiting requires authenticated users
2. **Set appropriate limits**: Balance security and user experience
3. **Use blockDuration for sensitive operations**: Prevent rapid retry attacks
4. **Monitor metrics**: Track rate limit hits to adjust limits as needed
5. **Document limits**: Inform API consumers about rate limits

## Monitoring

Track these metrics for optimization:

- Number of rate limit hits per endpoint
- Most frequently blocked users
- Average requests per user
- Time distribution of requests

## Troubleshooting

### Issue: Rate limiting not working

**Solution**: Ensure:
1. `UserRateLimitGuard` is added to `UseGuards`
2. `@UserRateLimit()` decorator is present
3. Cache manager is properly configured
4. User is authenticated (has user.id)

### Issue: Users blocked too frequently

**Solution**:
1. Increase `points` value
2. Increase `duration` window
3. Remove or increase `blockDuration`

### Issue: Bypass by creating multiple accounts

**Solution**:
1. Add IP-based rate limiting
2. Implement account verification
3. Add CAPTCHA for sensitive operations
