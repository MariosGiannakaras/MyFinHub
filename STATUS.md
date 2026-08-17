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
- Unit tests and GitHub Actions application CI

## Validation state

- Application CI passes on GitHub.
- Production Supabase schema is applied.
- Production data import completed with 2,853 legacy transactions and 1,184 balance snapshots.
- Save path, automatic backup creation, optimistic revision conflict rejection, and browser-role access restrictions have been smoke-tested against production.
- Temporary import Storage artifacts were deleted and the one-time importer was locked after migration.

## Supabase deployment

- SQL schema migrations are the source of truth under `supabase/migrations/`.
- Production migration history is aligned with the repository migration versions.
- `MariosGiannakaras/RheomIQ` is connected to the Supabase project through the native GitHub integration.
- The intended production deployment path is Supabase **Deploy to production** from `main`; this avoids long-lived Supabase CLI/database credentials in GitHub Actions.
- The old secret-based `supabase-deploy.yml` workflow has been removed.

## Remaining external setting

- Confirm/enable **Deploy to production** in Supabase Project Settings → Integrations → GitHub Integration. The connected tools available here do not expose that integration toggle programmatically.
