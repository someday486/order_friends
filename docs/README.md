# Docs Index

This directory is now organized by document role instead of leaving every file in one flat list.

## Start Here
- `ENGINEERING_WORKFLOW.md`: current rules for development flow, document lifecycle, and patch notes
- `DOCUMENT_REGISTRY.md`: status map for every active document set

## Folder Layout

### `foundation/`
Core product and system design documents. These are the highest-value reference docs for understanding the product shape.

- `foundation/00-overview.md`
- `foundation/01-requirements.md`
- `foundation/02-architecture.md`
- `foundation/03-db-schema.md`
- `foundation/04-user-flows.md`
- `foundation/05-business-model.md`
- `foundation/auth-foundation.md`

### `guides/`
Operational how-to documents for recurring engineering and support tasks.

- `guides/CACHING_IMPLEMENTATION_GUIDE.md`
- `guides/CICD_GUIDE.md`
- `guides/RATE_LIMITING.md`
- `guides/REALTIME_NOTIFICATIONS.md`
- `guides/SECURITY.md`
- `guides/SENTRY_SETUP.md`
- `guides/SYSTEM_ADMIN_SETUP.md`
- `guides/TEST_DATA_SETUP.md`

### `reference/`
Supporting technical references. Useful for implementation details, but not the first source of truth for product behavior.

- `reference/API_DOCUMENTATION.md`
- `reference/DATABASE_MEMBERS_VIEW.md`
- `reference/DATABASE_OPTIMIZATION.md`
- `reference/ROLE_HIERARCHY.md`

### `specs/`
Future-feature or draft specifications. These are planning documents, not guaranteed to match the currently shipped product.

- `specs/material-procurement-*.md`
- `specs/payment-billing-tiers-*.md`

### `research/`
Research snapshots and backlog inputs. These help planning but do not define current behavior by themselves.

- `research/order-friends-diagnostic-2026-04-03.md`
- `research/ux-competitive-audit-2026-03-02.md`
- `research/ux-improvement-backlog-2026-03-02.md`

### `decisions/`
Architecture decision records and other design commitments.

- `decisions/ADR-0001-authorization-model.md`

### `patch-notes/`
Release-facing change logs.

- `patch-notes/TEMPLATE.md`

### `archive/`
Historical progress reports, session notes, old working docs, and retired tooling notes.

## Rule of Thumb
- If the document defines how the current product works, it belongs in `foundation/`, `guides/`, `reference/`, or `decisions/`.
- If it describes future work, it belongs in `specs/` or `research/`.
- If it was useful once but is no longer a live reference, it belongs in `archive/`.
