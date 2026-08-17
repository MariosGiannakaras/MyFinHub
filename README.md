<p align="center">
  <img src="public/brand/icon-192.png" width="128" alt="RheomIQ icon" />
</p>

<h1 align="center">RheomIQ</h1>
<p align="center"><strong>Smart. Clear. In Control.</strong></p>
<p align="center">Single-user personal finance ledger with Supabase/PostgreSQL persistence, compound transactions, savings logic, reconciliation and intelligent review.</p>

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

## Persistence

The browser is not the database. RheomIQ keeps the current UI/domain contract but stores durable state in **Supabase/PostgreSQL** through the server API.

- SQL schema is version-controlled in `supabase/migrations/`.
- `rheomiq_app_state` stores the current state as PostgreSQL `jsonb` with an optimistic revision number.
- `rheomiq_backups` stores database snapshots.
- stale writes are rejected as revision conflicts;
- imports create a pre-import backup;
- the one-time JSON migration verifies a canonical checksum after writing;
- RLS is enabled and browser roles have no direct access;
- the privileged Supabase secret key is server-side only.

The existing ignored `data/rheomiq-data.json` remains only as the one-time migration source / local emergency export. It is never committed.

## Repository-managed Supabase changes

Every future schema/backend database change must be added as a new migration under `supabase/migrations/`.

GitHub Actions contains `supabase-deploy.yml`, which uses the official Supabase CLI to link the project, preview pending migrations, and run `supabase db push`. It remains skipped until the project variable/secrets are configured.

Required GitHub configuration after creating the Supabase project:

- repository variable: `SUPABASE_PROJECT_REF`
- repository secret: `SUPABASE_ACCESS_TOKEN`
- repository secret: `SUPABASE_DB_PASSWORD`

Runtime/server environment:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

Never prefix the secret key with `VITE_`; that would expose it to the browser bundle.

## One-time migration of the existing JSON

After the Supabase migration has been deployed and the server environment variables are available:

```bash
npm run db:import -- /absolute/path/to/MBAI_Finance_Data.json
```

The importer migrates the existing RheomIQ document in memory, imports the complete state, reads it back, checks entity counts, and compares a canonical SHA-256 checksum. It fails if anything differs.

Re-check later without overwriting:

```bash
npm run db:verify -- /absolute/path/to/MBAI_Finance_Data.json
```

## Development

Requirements: Node.js 22.12+.

```bash
npm install
npm run dev
```

Create a local `.env` (never commit it) with the values shown in `.env.example`.

## Validation

```bash
npm run test
npm run build
npm run check
```

CI runs the full application checks on pushes and pull requests. Database migrations are deployed separately through `.github/workflows/supabase-deploy.yml` once the project configuration exists.

## Repository structure

```text
RheomIQ/
├─ public/brand/              # RheomIQ application icon assets
├─ src/                       # React UI + finance domain logic
├─ server/                    # server API + Supabase persistence adapter
├─ scripts/                   # safe one-time data migration/verification
├─ supabase/
│  ├─ config.toml
│  └─ migrations/             # source of truth for PostgreSQL schema
├─ tests/                     # ledger invariants/regression tests
├─ data/                      # ignored real migration source + empty example
├─ docs/                      # architecture and UX rules
├─ AGENTS.md                  # durable repository invariants
└─ .github/workflows/         # CI + Supabase migration deployment
```

## Privacy

RheomIQ is a single-user application. No user picker, team model, roles UI or multi-user data model is added. Personal finance data and Supabase credentials are excluded from Git history.
