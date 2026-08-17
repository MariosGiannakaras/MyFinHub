# RheomIQ architecture

## Runtime and trust boundary

RheomIQ is a React/Vite client with a small TypeScript API boundary. Production API handlers run as Vercel Node.js Functions in Frankfurt (`fra1`); local development exposes the same server modules through Express. The repository runtime contract is Node.js 22.x.

The browser is UI-only. Durable finance data lives in Supabase/PostgreSQL in `eu-central-1`, and finance data or access tokens are not persisted in `localStorage` or IndexedDB.

Production browser requests authenticate through HttpOnly/Secure session cookies. API handlers use the Supabase publishable key together with the signed-in user's access JWT, so PostgreSQL RLS remains part of the online authorization boundary. The production web runtime does not require a Supabase secret/service-role key. Privileged keys are limited to offline/admin workflows where explicitly required.

Finance access requires all of the following:

1. a valid Supabase Auth session;
2. the configured single owner UID;
3. an `aal2` TOTP-MFA session;
4. matching API checks and PostgreSQL RLS/RPC checks.

## Persistence model

The database schema is owned by ordered SQL migrations under `supabase/migrations/`.

- `rheomiq_app_state`: one canonical row (`id = 'primary'`) containing the compatibility `FinanceData` document as `jsonb`, plus schema version, optimistic revision and timestamp.
- `rheomiq_backups`: immutable full-document snapshots created before imports, manually, and periodically during normal saves; retention is bounded to the newest 100 snapshots.
- `rheomiq_audit_log`: append-only save/import/backup events without finance payloads.
- `rheomiq_owner`: singleton owner identity used by the RLS/RPC authorization checks.

The full document remains the compatibility read/import format because the imported Excel corpus contains 2,800+ legacy transactions whose historical meaning must not be reinterpreted casually.

### Normal writes

Ordinary UI changes do **not** resend or replace the immutable seed/history. The client sends only the mutable `state` subtree and its optimistic revision to `/api/data`.

`rheomiq_save_mutable_state(...)` then:

1. requires owner + AAL2;
2. locks the canonical state row;
3. rejects a stale expected revision;
4. creates a full automatic backup when the current backup window requires one;
5. replaces only the nested `state` and top-level `updatedAt` fields in the existing JSON document;
6. increments the revision and appends an audit event;
7. returns only the new revision/timestamp rather than echoing the full finance document.

This preserves the stable `FinanceData` read contract while removing the large immutable transaction/snapshot seed from the normal browser -> Vercel -> Supabase write path.

### Full import and backup

`rheomiq_import_state(...)` is the explicit full-document replacement path. It validates the complete document, takes a pre-import snapshot, replaces the canonical document atomically and increments the revision.

`rheomiq_create_backup(...)` creates an explicit immutable full snapshot. Backup/import operations are serialized behind pending client saves so a known-stale state is never backed up as if it were current.

## Concurrency and client synchronization

Every normal save uses an `If-Match` revision. Stale writes fail with a conflict instead of overwriting newer data.

The browser keeps one write in flight and retains only the newest pending snapshot, avoiding redundant intermediate full-state mutations. Successful revisions are announced through same-origin `BroadcastChannel` when supported: a clean second tab reloads, while a tab with local work enters conflict state instead of being overwritten.

## Performance model

Secondary finance pages are lazy-loaded so the authenticated shell does not eagerly download every page/chart module. Derived month/as-of selectors are memoized per immutable `FinanceData` object to avoid repeatedly scanning and sorting the legacy corpus during UI-only rerenders.

`/api/data` emits `Server-Timing` metrics for session, owner, data-storage and total request time. The browser records a `rheomiq:data-load` Performance entry for initial/full data loads. These timings contain durations only, never finance values.

## Migration and deployment

1. All schema changes are committed as ordered SQL migrations.
2. GitHub CI runs the security guard, tests, type/build checks and dependency audits; CodeQL scans JavaScript/TypeScript.
3. Supabase Git integration applies production migrations from `main`.
4. Vercel deploys the Git-connected `main` branch and the post-deploy Production Smoke workflow verifies the public surface, required security headers, unauthenticated API protection, `no-store` caching and Frankfurt routing.
5. Real personal finance JSON, `.env` files and credentials are never committed.

## Ledger model

Legacy Excel rows remain immutable seed data unless the user explicitly creates an override/review decision. New actions are `FinanceEvent` objects containing one or more ledger legs.

- `expense`: asset account decreases; spending increases.
- `income`: asset account increases; income increases.
- `transfer`: two asset legs, cashflow impact zero.
- `withdrawal`: bank -> cash, cashflow impact zero.
- `saving_cash_offset`: payroll/current -> savings; cash unchanged; savings KPI increases.
- `refund`: asset increases and spending decreases.
- `lending`: asset decreases and receivable increases.
- `repayment`: asset increases and receivable decreases.
- `card_purchase`: credit liability decreases (more negative) and spending increases.
- `card_payment`: bank decreases and credit liability increases toward zero; spending impact zero.
- `reconciliation`: balance-only adjustment; spending impact zero.
- `split`: one payment with category-level parts that must equal the parent amount.

## Legacy Smart Review

Heuristics only create suggestions. Reporting remains based on the original legacy row until a decision is `confirmed`. Mixed comments are routed to a split editor. `kept` permanently records that the original meaning should remain.
