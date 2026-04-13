# Document Registry

This file records the current status of the documentation set after the cleanup.

## Active Canonical Docs

| Path | Status | Purpose |
| --- | --- | --- |
| `foundation/00-overview.md` | canonical | product overview |
| `foundation/01-requirements.md` | canonical | functional requirements |
| `foundation/02-architecture.md` | canonical | system architecture |
| `foundation/03-db-schema.md` | canonical | core data model |
| `foundation/04-user-flows.md` | canonical | major user flows |
| `foundation/auth-foundation.md` | canonical | app auth usage rules |
| `guides/SECURITY.md` | canonical | security guidance |
| `guides/SYSTEM_ADMIN_SETUP.md` | canonical | system-admin setup flow |
| `guides/TEST_DATA_SETUP.md` | canonical | repeatable local test data setup |
| `ENGINEERING_WORKFLOW.md` | canonical | repo working rules |

## Active Guides

| Path | Status | Purpose |
| --- | --- | --- |
| `guides/CACHING_IMPLEMENTATION_GUIDE.md` | active | cache implementation guide |
| `guides/CICD_GUIDE.md` | active | CI/CD workflow guide |
| `guides/RATE_LIMITING.md` | active | rate-limit implementation guide |
| `guides/REALTIME_NOTIFICATIONS.md` | active | realtime notification setup |
| `guides/SENTRY_SETUP.md` | active | monitoring setup |

## Active Reference Docs

| Path | Status | Purpose |
| --- | --- | --- |
| `reference/API_DOCUMENTATION.md` | reference | API surface reference |
| `reference/DATABASE_MEMBERS_VIEW.md` | reference | membership view reference |
| `reference/DATABASE_OPTIMIZATION.md` | reference | DB performance notes |
| `reference/ROLE_HIERARCHY.md` | reference | role quick reference |
| `decisions/ADR-0001-authorization-model.md` | reference | accepted authorization decision |

## Draft Specs

| Path | Status | Purpose |
| --- | --- | --- |
| `specs/material-procurement-all-phases-master-spec-2026-03-30.md` | draft | future procurement feature scope |
| `specs/material-procurement-phase0-master-spec-2026-03-30.md` | draft | procurement phase 0 |
| `specs/material-procurement-phase1-master-spec-2026-03-30.md` | draft | procurement phase 1 |
| `specs/material-procurement-phase2-master-spec-2026-03-30.md` | draft | procurement phase 2 |
| `specs/material-procurement-phase3-master-spec-2026-03-30.md` | draft | procurement phase 3 |
| `specs/material-procurement-phase4-master-spec-2026-03-30.md` | draft | procurement phase 4 |
| `specs/payment-billing-tiers-master-spec-2026-04-13.md` | draft | 결제 이원화 전체 로드맵 (PG/Non-PG 티어) |
| `specs/payment-billing-tiers-phase0-spec-2026-04-13.md` | draft | 결제 이원화 Phase 0: 데이터 모델 + 마이그레이션 |
| `specs/payment-billing-tiers-phase1-spec-2026-04-13.md` | draft | 결제 이원화 Phase 1: PG 티어 주문 플로우 |
| `specs/payment-billing-tiers-phase2-spec-2026-04-13.md` | draft | 결제 이원화 Phase 2: Non-PG 구독 빌링 |
| `specs/payment-billing-tiers-phase3-spec-2026-04-13.md` | draft | 결제 이원화 Phase 3: PG 정산 시스템 |
| `specs/payment-billing-tiers-codex-instructions-2026-04-13.md` | draft | 결제 이원화 추가 구현 지시서 및 후속 작업 체크리스트 |

## Research Docs

| Path | Status | Purpose |
| --- | --- | --- |
| `research/order-friends-diagnostic-2026-04-03.md` | research | codebase risk audit and execution backlog snapshot |
| `research/ux-competitive-audit-2026-03-02.md` | research | UX audit snapshot |
| `research/ux-improvement-backlog-2026-03-02.md` | research | UX backlog input |

## Historical Docs

| Path | Status | Purpose |
| --- | --- | --- |
| `archive/` | archived | old progress reports, session notes, root working docs, and retired tooling notes |

## Notes

- `canonical` means "use this to understand the current system"
- `active` means "useful operational guide, but not the first source of truth"
- `reference` means "supporting detail for implementation"
- `draft` means "future-facing spec, not guaranteed to match shipped behavior"
- `research` means "input for planning, not behavior definition"
- `archived` means "kept only for history"
