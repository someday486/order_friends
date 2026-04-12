# Order Friends

Order Friends is a brand-and-branch based order operations platform. This repository contains both the backend API and the web app.

## Repository Layout
- Backend API: `src/` (NestJS 11)
- Web App: `apps/web/` (Next.js 16)
- Database migrations and seeds: `supabase/`

## Prerequisites
- Node.js 20+
- npm
- Supabase project credentials

## Install
```bash
npm ci
npm ci --prefix apps/web
```

## Environment Variables
### Backend
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TOSS_SECRET_KEY` (optional)
- `TOSS_CLIENT_KEY` (optional)
- `TOSS_WEBHOOK_SECRET` (optional)
- `TOSS_WEBHOOK_SIGNATURE_HEADER` (optional, defaults to `toss-signature`)
- `TOSS_WEBHOOK_MAX_AGE_SECONDS` (optional, defaults to `300`)

### Web
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_BASE_URL`

## Run Locally
```bash
# backend
npm run start:dev

# web
npm run dev --prefix apps/web
```

## Validate
```bash
# backend
npm run lint
npm run test
npm run test:e2e
npm run build
npm run migrations:check
npm run openapi:check

# web
npm run lint --prefix apps/web
npm run build --prefix apps/web
npm run test:e2e --prefix apps/web
```

## Migrations
- SQL migrations live in `supabase/migrations/`
- New migration files should use an 8-digit or 14-digit timestamp prefix
- Run `npm run migrations:check` before shipping migration-heavy changes

## API Contracts
- Generate backend OpenAPI schema and web types with `npm run openapi:types`
- Verify generated types are current with `npm run openapi:check`

## Documentation
- Main docs index: `docs/README.md`
- Patch notes: `docs/patch-notes/`
- Archived notes and old working docs: `docs/archive/`
