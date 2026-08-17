# RheomIQ architecture

## Runtime

RheomIQ is a React/Vite client plus a small Express API. The browser remains UI-only. Durable finance state lives in Supabase/PostgreSQL; no finance data is stored in localStorage or IndexedDB.

The Express API is deliberately retained as a server-side boundary so the privileged Supabase secret key is never shipped to the browser. The UI contract (`FinanceData`) remains unchanged during this migration, which preserves all legacy Excel-derived semantics and existing UI behavior.

## PostgreSQL persistence

The database schema is owned by version-controlled SQL migrations in `supabase/migrations/`.

- `rheomiq_app_state`: exactly one current application-state row (`id = 'primary') stored as `jsonb`, with an integer revision and timestamp.
- `rheomiq_backups`: immutable database snapshots created before imports, manually, and at most hourly during normal saves.
- `rheomiq_save_state(...)`: optimistic-concurrency write RPC. Stale revisions fail rather than overwrite newer state.
- `rheomiq_import_state(...)`: one-time/full-state import RPC that first snapshots the previous state.
- `rheomiq_create_backup(...)`: explicit backup RPC.

RLS is enabled and no `anon`/`authenticated` table policies are granted. Only the backend's server-side Supabase secret/service role may call the persistence RPCs.

This document-oriented first migration is intentional: it moves durability to PostgreSQL without reinterpreting 2,800+ legacy transactions. Future normalization can be added incrementally through migrations while preserving the current state document as the compatibility source.

## Migration and deployment

1. All schema changes are SQL migrations committed under `supabase/migrations/`.
2. GitHub Actions uses the official Supabase CLI to `link`, dry-run, and `db push` migrations.
3. Deployment runs only after the repository variable `SUPABASE_PROJECT_REF` is configured; credentials remain GitHub encrypted secrets.
4. Real personal finance JSON is never committed. The one-time migration script reads the ignored local JSON and verifies a canonical checksum after import.

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
