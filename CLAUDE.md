# Order Friends - Claude Instructions

Start every task by reading these files in order:

1. `README.md`
2. `docs/ENGINEERING_WORKFLOW.md`
3. `docs/DOCUMENT_REGISTRY.md`

## Repository Rules

- Treat `docs/ENGINEERING_WORKFLOW.md` as the shared process source of truth
- Do not create temporary work-summary files at the repository root
- Put current system docs under the correct `docs/` subfolder
- Put historical or one-off notes under `docs/archive/` only when they truly need to be kept
- Add patch notes under `docs/patch-notes/YYYY-MM-DD.md` for user-facing or operator-facing changes

## High-Risk Change Areas

Before changing any of these, summarize impact and verification scope:

- authentication and authorization
- payments
- order status transitions
- database migrations, triggers, and policies
- large data corrections

## Documentation Rules

- `docs/foundation/`: current product and system foundations
- `docs/guides/`: recurring operational guides
- `docs/reference/`: supporting technical references
- `docs/specs/`: future-feature and draft specs
- `docs/research/`: audits and backlog inputs
- `docs/decisions/`: decision records
- `docs/archive/`: retired or historical docs

If unsure where a document belongs, update `docs/DOCUMENT_REGISTRY.md` when you add or move it.
