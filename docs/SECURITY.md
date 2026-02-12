# Security Documentation

## Overview

This document outlines the security measures implemented in the Order Friends API.

## Security Layers

### 1. HTTP Security Headers (Helmet)

**Implementation:** `src/main.ts`

```typescript
app.use(helmet());
```

Helmet provides:
- X-DNS-Prefetch-Control
- X-Frame-Options (clickjacking protection)
- X-Content-Type-Options (MIME sniffing protection)
- X-XSS-Protection
- Strict-Transport-Security (HSTS)
- Content-Security-Policy

### 2. CORS (Cross-Origin Resource Sharing)

**Implementation:** `src/main.ts`

```typescript
app.enableCors({
  origin: (origin, callback) => {
    // Allow localhost and 127.0.0.1
    if (origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }

    // Allow local network IPs in development
    if (process.env.NODE_ENV !== 'production' &&
        /^http:\/\/192\.168\.\d+\.\d+:/.test(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked: ${origin}`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

**Features:**
- Origin validation with whitelist
- Credentials support for authenticated requests
- Limited HTTP methods
- Controlled headers

**Production Setup:**
Add production domains to the origin whitelist in `main.ts`.

### 3. Input Validation

**Implementation:** `src/main.ts`

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,           // Strip unknown properties
    forbidNonWhitelisted: true, // Reject unknown properties
    transform: true,            // Auto-transform to DTO types
    transformOptions: {
      enableImplicitConversion: true,
    },
  }),
);
```

**Features:**
- Automatic validation using class-validator decorators
- Whitelisting of known properties
- Type transformation
- Rejection of unknown properties

**Example DTO:**
```typescript
import { IsString, IsNumber, Min, Max } from 'class-validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;
}
```

### 4. Rate Limiting

**Implementation:** `src/common/guards/user-rate-limit.guard.ts`

User-based rate limiting prevents abuse by tracking requests per user/IP.

**Decorator:** `src/common/decorators/user-rate-limit.decorator.ts`

```typescript
@UserRateLimit({ points: 10, duration: 60, blockDuration: 300 })
```

**Parameters:**
- `points`: Number of allowed requests
- `duration`: Time window in seconds
- `blockDuration`: Block duration in seconds after limit exceeded

**Applied Endpoints:**

#### Public Endpoints
| Endpoint | Rate Limit | Notes |
|----------|-----------|-------|
| GET /public/branch/:id | 60/min | Branch info |
| GET /public/branch/:id/products | 30/min | Product list |
| POST /public/orders | 5/min | Order creation, 5min block |
| GET /public/orders/:id | 30/min | Order status |

#### Public Order (Anonymous)
| Endpoint | Rate Limit | Notes |
|----------|-----------|-------|
| POST /public-order | 10/min | Anonymous orders, 5min block |

#### File Upload (Authenticated)
| Endpoint | Rate Limit | Notes |
|----------|-----------|-------|
| POST /upload/image | 20/min | Single image upload |
| POST /upload/images | 10/min | Batch upload |
| DELETE /upload/image | 30/min | Delete image |
| DELETE /upload/images | 10/min | Batch delete |

**How it Works:**
1. Extracts user ID from JWT or uses IP as fallback
2. Stores request count in cache (memory-cache)
3. Returns 429 Too Many Requests when limit exceeded
4. Includes rate limit headers:
   - X-RateLimit-Limit
   - X-RateLimit-Remaining
   - X-RateLimit-Reset

### 5. Authentication & Authorization

**Guards:**
- `AuthGuard`: Validates JWT tokens
- `AdminGuard`: Checks admin role
- `MembershipGuard`: Verifies branch membership
- `PolicyGuard`: Role-based access control (RBAC)

**Implementation:**
```typescript
@Controller('products')
@UseGuards(AuthGuard, MembershipGuard)
export class ProductsController {
  @Post()
  @RequirePermissions(['products:create'])
  async createProduct() { ... }
}
```

### 6. Error Handling

**Global Exception Filter:** `src/common/filters/global-exception.filter.ts`

- Sanitizes error messages for production
- Prevents sensitive information leakage
- Logs errors to Sentry
- Returns standardized error responses

### 7. File Upload Security

**Implementation:** `src/modules/upload/upload.service.ts`

**Validations:**
- File type validation (MIME type checking)
- File size limit: 5MB
- Allowed types: JPEG, JPG, PNG, WebP, GIF
- Unique filename generation (UUID)
- Path sanitization

**Example:**
```typescript
private readonly ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
```

### 8. Monitoring (Sentry)

**Implementation:** `src/main.ts`

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 1.0,
});
```

**Features:**
- Error tracking
- Performance monitoring
- User context tracking
- Breadcrumb logging

**Setup:**
Set `SENTRY_DSN` environment variable in production.

## Security Best Practices

### 1. Environment Variables

**Required:**
```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# JWT
JWT_SECRET=your-secret-key-min-32-chars

# Sentry (Optional)
SENTRY_DSN=https://your-sentry-dsn

# Node Environment
NODE_ENV=production
```

**Important:**
- Never commit `.env` files to version control
- Use strong, randomly generated secrets
- Rotate secrets periodically
- Use different secrets for each environment

### 2. Database Security (Supabase RLS)

**Row Level Security (RLS):**
- Enable RLS on all tables
- Define policies for each table
- Use service role key only on backend
- Use anon key for public endpoints

**Example Policy:**
```sql
-- Only allow users to read their own orders
CREATE POLICY "Users can view own orders"
  ON orders
  FOR SELECT
  USING (auth.uid() = user_id);
```

### 3. Password Security

**Requirements:**
- Minimum 8 characters
- Use bcrypt or Supabase auth
- Never store plain text passwords
- Implement password reset flow

### 4. API Security Checklist

- [x] HTTPS only in production
- [x] Helmet security headers
- [x] CORS configuration
- [x] Input validation
- [x] Rate limiting
- [x] Authentication
- [x] Authorization (RBAC)
- [x] Error sanitization
- [x] File upload validation
- [x] Monitoring (Sentry)
- [ ] CSRF protection (if needed for web forms)
- [ ] SQL injection protection (using parameterized queries)
- [ ] XSS protection (input sanitization)

## Incident Response

### 1. Security Breach

1. **Immediate Actions:**
   - Rotate all secrets and API keys
   - Review Sentry logs for suspicious activity
   - Check rate limit violations
   - Review database audit logs

2. **Investigation:**
   - Identify affected users
   - Determine breach scope
   - Document timeline

3. **Remediation:**
   - Patch vulnerabilities
   - Force password resets if needed
   - Notify affected users
   - Update security measures

### 2. DDoS Attack

1. **Detection:**
   - Monitor rate limit violations
   - Check server resource usage
   - Review traffic patterns

2. **Mitigation:**
   - Enable stricter rate limits
   - Use CDN/WAF (e.g., Cloudflare)
   - Block malicious IPs
   - Scale infrastructure if needed

## Security Updates

- Review dependencies monthly: `npm audit`
- Update packages regularly: `npm update`
- Monitor security advisories
- Test updates in staging environment

## Contact

For security issues, please contact:
- Email: security@example.com
- Do NOT create public GitHub issues for security vulnerabilities

---

**Last Updated:** 2026-02-06
**Version:** 1.0.0
