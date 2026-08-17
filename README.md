<p align="center">
  <img src="public/brand/icon-192.png" width="128" alt="RheomIQ icon" />
</p>

<h1 align="center">RheomIQ</h1>
<p align="center"><strong>Smart. Clear. In Control.</strong></p>
<p align="center">Single-owner personal finance ledger with Supabase/PostgreSQL persistence, compound transactions, savings logic, reconciliation and intelligent review.</p>

## Accounting model

RheomIQ preserves the existing Excel-derived behavior instead of flattening it into a generic income/expense tracker.

- **Cash-offset saving:** payroll/current → savings; physical cash is untouched. Counts as savings, not spending.
- **Withdrawals:** bank → cash; no income/expense.
- **Internal transfers:** balance movement only.
- **Refunds:** reduce spending.
- **Credit card:** purchase is spending; card payment is liability repayment.
- **Lending:** creates a receivable; repayment reduces it; net worth includes receivables.
- **Reconciliation:** balance correction without polluting spending.
- **Splits:** category parts must balance to the parent amount.
- **Smart Review:** proposals do not affect reports until confirmed.

## Production architecture

RheomIQ is designed as a private **single-owner online application**.

- React/Vite frontend is deployable on Vercel from this GitHub repository.
- Supabase Auth authenticates the single owner with email/password plus mandatory TOTP Authenticator MFA.
- Finance access requires both the configured owner UID and an `aal2` Supabase session. A password-only (`aal1`) session cannot read or write finance state.
- Access/refresh tokens are stored only in `HttpOnly`, `SameSite=Strict` cookies in production; finance data and auth tokens are not persisted in browser storage.
- The online runtime uses only `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
- PostgreSQL RLS is the final authorization boundary; the API layer independently checks owner identity and `aal2` before finance operations.
- The online runtime **does not need a Supabase secret/service-role key**.
- `SUPABASE_SECRET_KEY` is reserved for offline emergency import/verification tooling and must never be configured in Vercel or exposed as `VITE_*`.
- State-changing API routes enforce same-origin checks, bounded JSON payloads and server-side finance-state validation.
- Login errors are intentionally generic; MFA verification uses Supabase Auth's challenge/verify flow and does not store the TOTP secret after enrollment.
- Unexpected backend errors return stable public error codes plus a request ID instead of raw database/internal errors.
- Vercel security headers include CSP, anti-framing, MIME-sniffing protection, HSTS and restricted browser permissions.

## Persistence and recovery

- SQL schema is version-controlled in `supabase/migrations/`.
- `rheomiq_app_state` stores the current state as PostgreSQL `jsonb` with optimistic revision locking.
- stale writes are rejected as revision conflicts.
- `rheomiq_backups` stores bounded database snapshots; automatic backups are throttled and retention is capped.
- imports create a pre-import backup.
- `rheomiq_audit_log` records save/import/backup write events without duplicating the finance payload.
- the original local JSON remains only as a private emergency source/export and is never committed.

## Repository-managed Supabase changes

Every future database/schema change must be committed as a new migration under `supabase/migrations/`.

Production deployment uses the native Supabase GitHub integration connected to `MariosGiannakaras/RheomIQ`. With **Deploy to production** enabled, commits to `main` apply pending migrations and supported Supabase configuration from the repository.

## Runtime environment

Online/Vercel runtime:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Offline emergency migration/verification may additionally use:

```text
SUPABASE_SECRET_KEY=sb_secret_...
```

Never commit real keys. Never expose the secret key through a public/Vite environment variable.

## Production migration state

The production Supabase project is initialized and the existing RheomIQ data has been imported to PostgreSQL. The complete legacy transaction/snapshot corpus remains in schema version 3. Temporary import storage/functions were removed after verification.

## Development

Requirements: Node.js 22.12+.

```bash
npm install
npm run dev
```

Create a local `.env` (never commit it) from `.env.example`.

## Validation and security gates

```bash
npm run test
npm run build
npm run check
```

GitHub CI runs tests/typecheck/build and production dependency audit. CodeQL performs static security analysis and Dependabot tracks npm/GitHub Actions updates. Supabase Security Advisor should remain free of security findings after schema changes.

## Repository structure

```text
RheomIQ/
├─ api/                       # Vercel Auth + finance API routes
├─ public/brand/              # RheomIQ application icon assets
├─ src/                       # React UI + finance domain logic
├─ server/                    # auth, HTTP validation and Supabase adapters
├─ scripts/                   # offline migration/verification utilities
├─ supabase/migrations/       # source of truth for PostgreSQL schema
├─ tests/                     # finance + security regression tests
├─ data/                      # ignored private data + empty example
├─ docs/                      # architecture and UX rules
├─ AGENTS.md                  # durable repository invariants
└─ .github/                   # CI, CodeQL and Dependabot configuration
```

## Privacy

RheomIQ has one owner and no user picker, teams, tenant switching or multi-user business model. Personal finance data and credentials are excluded from Git history.
