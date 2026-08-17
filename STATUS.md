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

- Domain TypeScript compiles standalone in the current sandbox.
- Domain smoke tests have been run against the real migrated MBAI dataset.
- Full npm install/build cannot run in this sandbox because outbound DNS to npm registry is unavailable; CI is configured to run the full check on GitHub.

## Supabase migration

- SQL schema and RPC migration is implemented under `supabase/migrations/`.
- One-time JSON import performs a post-write canonical checksum verification.
- GitHub migration deployment workflow is committed but remains skipped until the Supabase project ref/credentials are configured.
- Remote migration/data import cannot run until the external Supabase project is created and credentials are supplied.
