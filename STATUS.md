# RheomIQ status

## Implemented

- Vite + React + TypeScript application shell and responsive RheomIQ UI
- Dashboard, transactions, Smart Review, savings, credit/installments, lending, recurring, reports and settings
- Supabase/PostgreSQL persistence with optimistic revisions, bounded backups and audit events
- Single-owner authorization enforced by API checks and PostgreSQL RLS
- Email/password authentication with mandatory TOTP MFA (`aal2`) before finance access
- HttpOnly/Secure production sessions, same-origin protection, request-size limits and generic public errors
- Version-controlled Supabase schema migrations without committed personal finance data
- Compound event/ledger model and finance-domain regression tests
- Correct cash-offset savings, transfer, refund, lending, card, reconciliation and split semantics
- GitHub CI, production dependency audit, CodeQL, Dependabot and privacy/security guards
- Native Supabase GitHub production deployment from `main`

## Verified production state

- Supabase project is healthy in `eu-central-1` on PostgreSQL 17.
- Production state is schema version 3, revision 2.
- Legacy corpus remains 2,853 transactions and 1,184 balance snapshots.
- One verified automatic database backup exists from persistence smoke testing.
- RLS is enabled on finance/owner/backup/audit tables and anonymous table access is denied.
- Supabase Security Advisor was clean after the authentication/RLS hardening.
- The Supabase GitHub integration is active and has successfully cloned/deployed `main` with migration history aligned to the repository.
- Import Storage objects/bucket were removed after migration. The disabled one-time importer still exists server-side as a JWT-protected `410 Gone` function because the connected management API has no delete action.

## Production-readiness PR

Issue #7 tracks the current delivery audit. PR #8 (`chore/7-production-readiness-hardening`) contains:

- deterministic Node 22 runtime and immutable SHA-pinned GitHub Actions
- issue/PR templates, security policy and documented branch/merge workflow
- Vercel Frankfurt function region and deterministic `npm ci` / build / `dist` contract
- strict revision preconditions in the API/storage layer with regression coverage
- pending Supabase migrations to enforce the revision precondition in PostgreSQL and remove the unused import staging table / `pg_net`

PR #8 CI and CodeQL are green. The Supabase Preview check is intentionally skipped because per-PR Supabase Branching is disabled and requires the Pro plan; production migrations remain pending until merge to `main`.

## External settings still required before final production merge

- Protect `main` with a GitHub branch ruleset: require Pull Requests, require the `validate` and `Analyze JavaScript/TypeScript` checks, require resolved conversations, and block force-push/deletion. Do not require another person's approval because RheomIQ has one owner.
- Enable automatic deletion of merged head branches and use squash merging for the clean production history.
- Import `MariosGiannakaras/RheomIQ` into Vercel as a Git-connected project. No Vercel project currently exists in the connected account.
- Configure only `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for the Vercel Production environment. Do not configure `SUPABASE_SECRET_KEY` there.
- Create the single Supabase Auth owner account, bind its UID to `rheomiq_owner`, complete TOTP enrollment, then disable public signup.

After those settings are complete, merge PR #8, verify the Supabase production migration run, re-check state counts/advisors, verify the Vercel production deployment, and close/supersede stale Dependabot PRs/branches.
