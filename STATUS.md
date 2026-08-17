# RheomIQ status

## Implemented

- Vite + React + TypeScript application shell
- RheomIQ branding, logo-derived blue/cyan design tokens, app icons and manifest
- Accessible neo-neumorphic responsive UI
- Dashboard, transactions, Smart Review, savings, credit/installments, lending, recurring, reports, settings
- Supabase/PostgreSQL persistence adapter with optimistic revision conflict detection and database backups
- Version-controlled Supabase schema migrations plus schema v2 -> v3 runtime data migration without committing private finance data
- Compound event/ledger model
- Correct cash-offset savings model (cash untouched)
- Refund, lending/repayment, credit purchase/payment, reconciliation and split semantics
- Review suggestions that do not affect reports before confirmation
- Mixed-comment split review editor
- Event edit/delete and recurring/loan editing
- Reduced-motion support
- Unit tests and GitHub Actions CI

## Validation state

- GitHub CI passes tests, TypeScript compilation and production build on `main`.
- Production Supabase project is healthy in `eu-central-1`.
- Production database contains the migrated RheomIQ schema-v3 state.
- Imported legacy corpus verified at 5 accounts, 39 months, 2,853 transactions, 1,184 balance snapshots, 7 recurring entries, 18 subscriptions, 9 loans and 2 lending records.
- The temporary private import bucket and uploaded JSON were deleted after migration.
- The one-time import Edge Function is disabled and JWT-protected.
- RLS is enabled on application state and backup tables; anonymous/authenticated roles have no table or RPC access.

## Supabase migration

- Production migrations applied:
  - `20260817063947_create_rheomiq_state`
  - `20260817070649_enable_pg_net`
- Repository migration filenames are aligned with production migration history.
- `server/storage.ts` now treats Supabase/PostgreSQL as the durable data source; browser storage and the local JSON file are no longer the persistence layer.
- GitHub migration deployment workflow is committed and ready.
- Remaining external setup: configure the repository variable `SUPABASE_PROJECT_REF` and GitHub Actions secrets `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` so future migrations can deploy from `main` automatically.
