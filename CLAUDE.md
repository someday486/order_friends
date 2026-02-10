# Order Friends

NestJS 11 + Supabase(PostgreSQL 17) 기반 다중 테넌트 주문 관리 시스템.
프론트엔드는 `apps/web/` (Next.js 16).

## Tech Stack
- Backend: NestJS 11, TypeScript, Jest 30
- DB: Supabase (cloud PostgreSQL), migrations in `supabase/migrations/`
- Cache: Redis 7
- Deploy: Docker + GitHub Actions CI/CD
- Monitoring: Sentry (optional)

## Commands
```
npm run build          # nest build
npm run start:dev      # watch mode
npm run test           # unit tests
npm run test:cov       # coverage
npm run test:e2e       # e2e tests (needs SUPABASE env vars)
npm run lint           # eslint --fix
```

## Project Structure
```
src/
  modules/
    auth/              # JWT authentication, Supabase auth
    orders/            # Order CRUD (admin)
    products/          # Product management
    branches/          # Branch management
    brands/            # Brand management
    members/           # Branch member roles
    payments/          # Toss Payments integration
    inventory/         # Stock management
    dashboard/         # Admin dashboard analytics
    analytics/         # Analytics service
    public/            # Public menu pages
    public-order/      # Public order submission
    customer-*/        # Customer-facing modules
    health/            # GET /health endpoint
    notifications/     # Email/SMS (SendGrid)
    upload/            # File upload
  common/
    filters/           # Exception filters
    guards/            # Auth guards (JwtAuthGuard, RolesGuard)
    interceptors/      # Response interceptors
  infra/               # Cache, database config
```

## Database Schema Gotchas
- `products.base_price` (NOT `price`), `category_id` UUID (NOT text)
- `orders` requires `channel_id` from `order_channels`, `fulfillment_type` (PICKUP/DELIVERY)
- `order_items`: `qty`, `unit_price_snapshot`, `line_total`, `product_name_snapshot`
- `payments`: `payment_method` (CARD/CASH/TRANSFER), `currency` (KRW), `provider` required
- `product_inventory`: `qty_available`, `qty_reserved`, `qty_sold`, `branch_id`
- `branch_members`: composite PK (branch_id, user_id), no `id` column

## Triggers (DB-level, cannot bypass)
- `orders_set_tenant_fields()`: validates channel_id, auto-sets branch_id/brand_id, forces status='CREATED'
- `orders_enforce_status_and_log()`: state machine CREATED->CONFIRMED->PREPARING->READY->COMPLETED (CANCELLED from any)
- `generate_order_no()`: auto-generates OF-YYYYMMDD-NNNN
- `set_order_timestamps()`: auto-sets completed_at/cancelled_at

## Role System
- `profiles.is_system_admin` -> system_admin
- `brands.owner_user_id` -> brand_owner
- `branch_members.role`: BRANCH_OWNER, BRANCH_ADMIN, STAFF, VIEWER

## Test Users
```
admin:    b1732433-0c16-4f38-b2c4-d704803b7066
owner1:   f5adf7e6-c18c-4ee5-80cd-c8ebe87e5843
owner2:   e3c89916-68b6-4dc0-b9ab-cf0811f83c82
manager1: 3736f74c-9172-4ec4-8ce4-ce313b6f6635
manager2: 6cbd6b90-ad5a-460a-a398-7b4c7af83c22
staff1:   7b7565cb-1460-4b94-b905-8d9561170c9a
staff2:   e5847401-e1bc-40a8-8972-8bbdbd103a70
customer: f925150c-06cc-4927-b404-df839f29a8d8
```

## Conventions
- DB columns: snake_case, status fields are varchar (not enum)
- API: RESTful, Swagger docs at /api-docs
- Tests: *.spec.ts (unit), *.e2e-spec.ts (e2e)
- Commit style: conventional commits (feat/fix/chore)
