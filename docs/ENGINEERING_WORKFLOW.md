# Engineering Workflow

This document defines the current working rules for development flow, document hygiene, and release-note handling in this repository.

## 1. What Went Wrong Before

The repository history shows a few repeated process problems:

- working notes and long-lived reference docs were mixed together
- multiple status and roadmap files repeated the same story in different ways
- user-facing changes were shipped without a clean patch-note habit
- temporary task briefs stayed in the repo as if they were permanent guidance
- high-risk areas such as auth, payments, order states, and database changes did not have a consistent pre-change checklist

The result was not just "too many documents". The bigger problem was that it became hard to tell which document was the source of truth.

## 2. Document Structure Rules

### Root Rules
- Keep repository-root documents minimal
- `README.md` is for first-time repository entry
- `AGENTS.md` is for agent-specific operating rules
- Do not add one-off progress reports, task briefs, or fix logs at the root

### `docs/` Rules
- `docs/README.md` is the navigation entry point
- `docs/DOCUMENT_REGISTRY.md` is the status map
- `docs/foundation/` contains current product and system foundations
- `docs/guides/` contains recurring operational guides
- `docs/reference/` contains supporting technical reference material
- `docs/specs/` contains future-feature and draft specifications
- `docs/research/` contains audits, backlog seeds, and research snapshots
- `docs/decisions/` contains decision records
- `docs/patch-notes/` contains release logs
- `docs/archive/` contains retired or historical material

## 3. Before Creating a New Document

Answer these questions first:

1. Can this be added as a section in an existing document?
2. Will someone still need this document after the current task or branch is over?
3. Is this describing the current system, or only one temporary workstream?

If the answer pattern is:

- `yes` to question 1: update the existing doc
- `no` to question 2: do not create a permanent doc
- `temporary only` to question 3: archive it or avoid committing it

## 4. Document Lifecycle

### Canonical
Use for documents that define how the current product works.

Examples:
- requirements
- architecture
- schema
- operational setup guides

### Supporting Reference
Use for detailed implementation references that are helpful but not primary behavior documents.

Examples:
- API reference
- database optimization notes
- role quick reference

### Draft
Use for future-feature specs that are intentionally not yet shipped.

Examples:
- large feature specs
- multi-phase implementation plans

### Research
Use for audits, opportunity analysis, and backlog framing.

Examples:
- UX competitive review
- design backlog proposal

### Archive
Use for task-specific or historical material that is no longer a live reference.

Examples:
- session summaries
- project completion reports
- agent task briefs

## 5. Development Flow

Use this default sequence for product changes:

1. classify the request: bug, feature, operational fix, or documentation
2. identify the impact area
3. if the change touches a high-risk area, write down the affected flows first
4. make the smallest coherent change that solves the problem
5. validate with the repository checks
6. if users or operators will notice the change, add a patch note
7. archive or delete temporary working notes instead of leaving them in active docs

## 6. High-Risk Change Rules

These areas require extra care:

- authentication and authorization
- payments
- order status transitions
- database migrations, triggers, and policies
- large data corrections

For these changes, capture at least:

- who is affected
- success and failure flows
- rollback or recovery considerations
- whether patch notes are needed

## 7. Patch Notes Rules

Add patch notes for:

- UI or wording changes users will notice
- order, payment, permission, or policy behavior changes
- operator workflow changes
- changes likely to generate support questions

Skip patch notes for:

- pure refactors
- internal test additions
- comment-only or type-only cleanup

Store release notes in:

- `docs/patch-notes/YYYY-MM-DD.md`

Start from:

- `docs/patch-notes/TEMPLATE.md`

Automation:

- daily patch-note files are auto-created by repository git hooks
- commit messages automatically append a draft line to today's patch note with Seoul time and git author name
- push and PR checks fail when relevant product changes do not include a dated patch note
- after pulling patch-note automation changes into an existing clone, run `npm run hooks:install` once or any standard validation command to reconnect the local git hooks
- GitHub branch protection must require the `Docs Governance` check on `main` and `develop` if you want CI to block merges instead of only reporting failures after push

## 8. Quality Rules

- Save source documents as UTF-8
- Do not keep duplicate status reports in multiple places
- Prefer short, role-based titles over vague names like "summary" or "final"
- Date historical documents when they are snapshots
- If a document is no longer trustworthy, move it out of active folders

## 9. Maintenance Rule

When documentation starts growing again, do not create another top-level pile. First decide whether the new content is:

- canonical
- reference
- draft
- research
- archive

Then place it in the matching folder on purpose.
