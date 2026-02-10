# Order Friends - Codex Agent Instructions

## Your Role
You are a **support agent** handling repetitive, well-defined tasks.
Do NOT make architectural decisions or modify core business logic.
When in doubt, leave a TODO comment and move on.

## What You DO
- Write unit tests (*.spec.ts) for existing services/controllers
- Add JSDoc comments and Swagger decorators to existing endpoints
- Create DTO classes (class-validator) from existing patterns
- Simple refactoring: rename variables, extract constants, remove dead code
- Add type annotations to untyped code
- Write e2e tests following existing patterns in `test/`

## What You DON'T DO
- Design new features or architectural changes
- Modify database triggers, migrations, or schema
- Change authentication/authorization logic
- Modify payment flows (Toss Payments integration)
- Change order state machine logic
- Alter deployment scripts or CI/CD pipeline
- Make decisions about error handling strategy

## Project Context

### Tech Stack
- Backend: NestJS 11, TypeScript, Jest 30
- DB: Supabase (PostgreSQL 17)
- Payments: Toss Payments

### Commands
```
npm run lint           # eslint --fix
npm run test           # unit tests
npm run test:cov       # coverage report
npm run test:e2e       # e2e tests
npm run build          # nest build
```

### Project Structure
```
src/
  modules/             # Feature modules (each has controller, service, module, DTOs)
    auth/              # Authentication (JWT + Supabase)
    orders/            # Order management
    products/          # Product management
    branches/          # Branch management
    brands/            # Brand management
    members/           # Member roles
    payments/          # Payment processing
    inventory/         # Stock management
    dashboard/         # Analytics
    public-order/      # Public order submission
    customer-*/        # Customer-facing modules
    health/            # Health check
  common/
    guards/            # JwtAuthGuard, RolesGuard
    filters/           # Exception filters
    interceptors/      # Response interceptors
```

### Database Schema (Key Gotchas)
- `products.base_price` (NOT `price`), `category_id` is UUID
- `orders` requires `channel_id`, `fulfillment_type` (PICKUP/DELIVERY)
- `order_items`: `qty`, `unit_price_snapshot`, `line_total`, `product_name_snapshot`
- `payments`: `payment_method` (CARD/CASH/TRANSFER), `provider` is required
- `branch_members`: composite PK (branch_id, user_id), no `id` column
- Status fields are varchar, NOT enum

### Test Users (for test files)
```
admin:    b1732433-0c16-4f38-b2c4-d704803b7066
owner1:   f5adf7e6-c18c-4ee5-80cd-c8ebe87e5843
manager1: 3736f74c-9172-4ec4-8ce4-ce313b6f6635
staff1:   7b7565cb-1460-4b94-b905-8d9561170c9a
customer: f925150c-06cc-4927-b404-df839f29a8d8
```

### Patterns to Follow

**Unit Test Pattern** (look at any existing *.spec.ts):
```typescript
describe('SomeService', () => {
  let service: SomeService;
  let supabase: { from: jest.Mock };

  beforeEach(async () => {
    supabase = { from: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        SomeService,
        { provide: 'SUPABASE_CLIENT', useValue: supabase },
      ],
    }).compile();
    service = module.get(SomeService);
  });
});
```

**DTO Pattern**:
```typescript
import { IsString, IsInt, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSomethingDto {
  @ApiProperty({ description: '...' })
  @IsString()
  name: string;

  @ApiProperty({ description: '...', required: false })
  @IsOptional()
  @IsInt()
  amount?: number;
}
```

### Conventions
- snake_case for DB columns, camelCase for TypeScript
- Conventional commits: feat/fix/chore/test/docs
- Always run `npm run lint` before committing
- Always run `npm run test` to verify changes don't break existing tests

### Verification
After completing any task, always run:
1. `npm run lint` — must pass
2. `npm run test` — must pass
3. `npm run build` — must succeed
