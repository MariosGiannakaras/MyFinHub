# RheomIQ status

## Current production baseline

RheomIQ is a single-owner personal finance application deployed from `main` to Vercel with Supabase/PostgreSQL as the durable store.

The exhaustive production/backend audit tracked by #15 is complete. Its final verified baseline had all tracked defects fixed, CI green, CodeQL green, the current Vercel production revision deployed, and Production Smoke green against that exact revision.

`main` remains the release-only production branch. The current product work below is integrated on `develop` and is intentionally unreleased until a separate `develop -> main` release decision is made.

## Current develop integration batch — unreleased

As of 2026-08-18, `develop` contains the current application integration work without triggering a production Vercel deployment. The batch includes:

- automatic persistence for finance mutations with bounded Undo and Redo history;
- dedicated Cards workspace with bank grouping and local encrypted CVV handling;
- dedicated Credit Card workspace with configured limit, debt/available-credit utilization, isolated purchase history and Piraeus-only repayments;
- dedicated Installments & Loans workspace with variable manual payments, derived payment-day history, segmented installment progress and long-term obligation classification;
- HELP / ΒΟΗΘΕΙΑ self-loans from savings, RETURN / ΕΠΙΣΤΡΟΦΗ transfers back to savings, and explicit debt forgiveness without a money movement;
- long-term loans surfaced inside Recurring as obligations without automatic expense creation;
- mobile navigation and rendered QA updated for the separated Cards, Credit and Loans routes;
- server validation for the current card, recurring, linked-event and extended loan state fields.

This integration batch is not a statement that production has already been updated. Production verification and Production Smoke are required only after a future merge to `main` and the corresponding Vercel deployment.

## Implemented production platform

- React + Vite + TypeScript responsive application
- Dashboard, transactions, Smart Review, savings, finance workspaces, lending, recurring, reports and settings
- Node.js 22.x production/runtime contract
- Vercel Functions in Frankfurt (`fra1`)
- Supabase/PostgreSQL in `eu-central-1`
- Single-owner email/password authentication with mandatory TOTP MFA (`aal2`)
- HttpOnly/Secure production sessions and same-origin mutation protection
- Owner + AAL2 enforcement in both API logic and PostgreSQL RLS/RPCs
- Publishable-key + user-JWT online Supabase access; no service-role secret required by the production web runtime
- Optimistic revisions with stale-write conflicts instead of silent overwrite
- Bounded full-document backups and append-only audit events
- Full-state import with a mandatory pre-import backup
- Production-safe finance validation and request-size bounds
- GitHub CI, dependency audits, CodeQL, Dependabot and privacy/security guards
- Supabase migrations deployed from version-controlled SQL on `main`
- Vercel Production Smoke for public health, security headers, unauthenticated API denial, no-store caching and Frankfurt routing
- Coalesced client persistence: one write in flight plus only the newest pending snapshot
- Same-origin multi-tab revision synchronization with safe reload/conflict behavior
- Lazy-loaded finance pages and memoized derived month/as-of selectors
- Mutable-state-only normal writes: immutable legacy seed/history is no longer resent or replaced on every UI change
- Lightweight `Server-Timing` and browser Performance timing for the finance data path, containing durations only

## Data model

The compatibility `FinanceData` document remains the canonical read/import representation so the 2,853 imported legacy transactions and historical snapshots keep their original semantics.

Normal saves update only the mutable `state` subtree under revision locking. Full seed/history replacement remains restricted to the explicit import path. This avoids a risky relational rewrite while removing the large immutable corpus from ordinary write traffic.

At the 2026-08-17 production audit checkpoint:

- schema version was 3;
- the legacy transaction corpus contained 2,853 rows;
- Supabase was `ACTIVE_HEALTHY` on PostgreSQL 17;
- RLS was enabled on the RheomIQ state, backup, audit and owner tables;
- owner/AAL2 finance policies and RPC checks were present;
- the historical Git privacy review found no real finance JSON, `.env`, or Supabase import payload committed to repository history.

The live revision and backup/audit row counts are expected to increase during normal use and are intentionally not treated as fixed documentation constants.

## Known non-blocking platform notes

- Supabase Security Advisor reports `Leaked Password Protection Disabled`. Supabase exposes that protection on paid plans; mandatory owner + TOTP AAL2 remains the application access boundary on the current plan.
- Supabase per-PR database branching is not enabled on the current plan, so the `Supabase Preview` PR check may be skipped. Production migrations are still version-controlled and applied from `main`.
- The repository declares Node.js `22.x` in `package.json`, which Vercel documents as overriding a differing Node version selected in Project Settings. A dashboard mismatch may therefore produce a build warning without changing the actual Node 22 runtime contract.

## Delivery workflow

New implementation work starts from a GitHub issue and short-lived branch, is reviewed through a PR, and requires the applicable CI/CodeQL checks before squash merge. Backend/database changes also require migration validation and post-merge production verification. Personal finance payloads and credentials must never appear in issues, commits, logs or chat.
