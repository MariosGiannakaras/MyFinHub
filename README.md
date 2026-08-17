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
- RLS is enabled and browser roles have no direct access;
- the privileged Supabase secret key is server-side only.

The original local JSON remains only as a private migration/emergency export source and is never committed.

## Repository-managed Supabase changes

Every future database/schema change must be committed as a new migration under `supabase/migrations/`.

Production deployment uses the **native Supabase GitHub integration** connected to `MariosGiannakaras/RheomIQ`. With **Deploy to production** enabled in Supabase, commits to `main` automatically apply pending migrations and supported Supabase configuration from the repository. This avoids storing a Supabase personal access token or database password in GitHub Actions.

Runtime/server environment still requires the backend-only Supabase URL and secret key:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

Never prefix the secret key with `VITE_`; that would expose it to the browser bundle.

## Production migration state

The production Supabase project is initialized and the existing RheomIQ data has been imported to PostgreSQL. The imported state includes the complete legacy transaction/snapshot corpus and uses schema version 3. Import staging artifacts were removed after verification.

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

CI runs the full application checks on pushes and pull requests. Supabase production migrations are deployed separately by the native Supabase GitHub integration.

## Repository structure

```text
RheomIQ/
├─ public/brand/              # RheomIQ application icon assets
├─ src/                       # React UI + finance domain logic
├─ server/                    # server API + Supabase persistence adapter
├─ scripts/                   # migration/verification utilities
├─ supabase/
│  ├─ config.toml
│  └─ migrations/             # source of truth for PostgreSQL schema
├─ tests/                     # ledger invariants/regression tests
├─ data/                      # ignored private data + empty example
├─ docs/                      # architecture and UX rules
├─ AGENTS.md                  # durable repository invariants
└─ .github/workflows/         # application CI
```

## Privacy

RheomIQ is a single-user application. No user picker, team model, roles UI or multi-user data model is added. Personal finance data and Supabase credentials are excluded from Git history.
