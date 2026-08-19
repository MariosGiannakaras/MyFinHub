# RheomIQ status

## Current production baseline

RheomIQ is a single-owner personal finance application deployed from `main` to Vercel with Supabase/PostgreSQL as the durable store.

The August 2026 product/frontend batch tracked by #64 was promoted to production through PR #133. `main` and `develop` were synchronized on the resulting release baseline before the next implementation work started. Issue #88 remains open only for the authenticated/browser post-deployment card-secret and backup smokes from that release; it is not an indication that the production promotion itself is pending.

`main` remains the release-only production branch. New routine work integrates into `develop` through short-lived issue branches and does not deploy to production until a later deliberate `develop -> main` release.

## Current develop integration — interactive Cards / shared Credit identity

Issue #134 / PR #135 implements the approved interactive card prototype for integration into `develop`.

- Cards use horizontal bank columns, bank-specific visual designs, a live creation preview, masked fields, explicit reveal/copy controls, pointer tilt with reduced-motion fallback, and deliberate soft-archive/restore interactions.
- Cards and Credit Card use the same `FinanceData.state.cards` / `PaymentCard` record. A card created or restored from either page is the same underlying record and `cardId`.
- New credit purchases/payments carry the shared `cardId`; legacy pre-linkage credit events remain compatible.
- The current singular credit liability permits one active credit-card identity. The server mutable-state boundary rejects multiple active credit identities and orphan `cardId` links.
- Credit Card is redesigned around the same large interactive card surface plus debt, available limit, utilization, purchases and repayments.
- Card removal is archival/soft-delete. It preserves finance events, liability/balance history and the PAN/expiry server-vault row; restoring the same card reuses the same id and vault reference.
- Device-local CVV is removed on archive. PAN/expiry deletion is a distinct explicit secure-editor action and never happens as a side effect of archival.
- PAN/expiry are exposed through `/api/card-secrets`, requiring same-origin, owner and AAL2. The online path uses the owner JWT + Supabase publishable key so RLS remains authoritative.
- CVV remains encrypted browser-local IndexedDB only. It is rejected by the server boundary and the browser client runtime-whitelists only PAN/expiry for server requests.
- The product migration/read/import/offline migration paths explicitly preserve `cardBanks` and `cards`, preventing the older schema-v3 migrator from dropping card metadata.
- `20260819072000_tighten_card_secret_grants.sql` narrows `authenticated` table privileges on `rheomiq_card_secrets` to SELECT/INSERT/UPDATE/DELETE while retaining owner+AAL2 RLS. The migration was dry-run in a production transaction and rolled back; no production schema mutation occurred during feature development.

### Validation evidence for #134 / #135

The implementation was validated with the repository privacy/security guard, dependency audits, 120 unit/domain/security tests, TypeScript/Vite production build, API typecheck, rendered desktop/mobile QA, app-owned-controls QA and CodeQL. The rendered suite includes shared Cards/Credit identity and Credit archive -> history retained -> restore.

The Supabase grant migration passed a transactional dry-run with the expected CRUD-only grant set, followed by rollback verification showing live production grants unchanged.

PR #135 requires CI and CodeQL green on its exact final head before squash merge to `develop`. The feature/develop branch does **not** deploy to production; production delivery remains a separate release decision.

## Implemented production platform

- React + Vite + TypeScript responsive application
- Node.js 22.x runtime contract
- Vercel Functions in Frankfurt (`fra1`)
- Supabase/PostgreSQL in `eu-central-1`
- single-owner email/password authentication with mandatory TOTP MFA (`aal2`)
- HttpOnly/Secure production sessions and same-origin mutation protection
- owner + AAL2 enforcement in API logic and PostgreSQL RLS/RPCs
- publishable-key + user-JWT online Supabase access; no service-role secret required by the production web runtime
- optimistic revisions with stale-write conflicts instead of silent overwrite
- bounded full-document backups and append-only audit events
- full-state import with a mandatory pre-import backup
- production-safe finance validation and request-size bounds
- GitHub CI, dependency audits, CodeQL, Dependabot and privacy/security guards
- Supabase migrations deployed from version-controlled SQL on `main`
- Vercel Production Smoke for public health, security headers, unauthenticated API denial, no-store caching and Frankfurt routing
- coalesced client persistence and same-origin multi-tab revision synchronization
- lazy-loaded finance pages and memoized derived month/as-of selectors
- mutable-state-only normal writes; immutable legacy seed/history is not resent on every save
- lightweight `Server-Timing` and browser Performance timing containing durations only

## Data and card-secret model

The compatibility `FinanceData` document remains the canonical read/import representation so the imported legacy corpus and historical snapshots keep their original semantics. Normal saves update only the mutable `state` subtree under revision locking.

Payment-card metadata may live in `FinanceData.state.cards`, but full PAN, expiry and CVV do not. PAN/expiry use the separate ciphertext-only `rheomiq_card_secrets` table; CVV uses the separate device-local encrypted vault. Ordinary FinanceData backups therefore remain outside both secret stores.

## Known non-blocking platform notes

- Supabase Security Advisor reports `Leaked Password Protection Disabled`; mandatory owner + TOTP AAL2 remains the application access boundary on the current plan.
- Supabase per-PR database branching is not enabled on the current plan. Production migrations remain version-controlled and are applied from `main`.
- The repository declares Node.js `22.x` in `package.json`; that remains the runtime contract even if a Vercel dashboard setting differs.

## Delivery workflow

New implementation work starts from a GitHub issue and short-lived branch, is reviewed through a PR, and requires the applicable CI/CodeQL checks before squash merge into `develop`. Database changes also require migration validation. Production release is a separate `develop -> main` action with post-deploy verification. Personal finance payloads and credentials must never appear in issues, commits, logs or chat.