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

RheomIQ is designed as a private **single-owner online application** with an optional Windows desktop client.

- React/Vite frontend and Node API routes are deployable on Vercel from this GitHub repository.
- Supabase Auth authenticates the single owner with email/password plus mandatory TOTP Authenticator MFA.
- Finance access requires both the configured owner UID and an `aal2` Supabase session. A password-only (`aal1`) session cannot read or write finance state.
- Access/refresh tokens are stored only in `HttpOnly`, `SameSite=Strict` cookies; finance data and auth tokens are not persisted in browser storage.
- The online runtime uses only `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
- PostgreSQL RLS is the final authorization boundary; the API layer independently checks owner identity and `aal2` before finance operations.
- The online runtime **does not need a Supabase secret/service-role key**.
- `SUPABASE_SECRET_KEY` is reserved for offline emergency import/verification tooling and must never be configured in Vercel, Electron runtime configuration or exposed as `VITE_*`.
- State-changing API routes enforce same-origin checks, bounded JSON payloads and server-side finance-state validation.
- Normal saves require an explicit current revision; stale, missing, malformed, or unsafe revision preconditions are rejected.
- Login errors are intentionally generic; MFA verification uses Supabase Auth's challenge/verify flow and does not store the TOTP secret after enrollment.
- Unexpected backend errors return stable public error codes plus a request ID instead of raw database/internal errors.
- Vercel security headers include CSP, anti-framing, MIME-sniffing protection, HSTS and restricted browser permissions.
- Vercel Functions are configured for Frankfurt (`fra1`) to stay close to the Supabase `eu-central-1` data region.

## Windows desktop

The Windows edition is a packaged Electron application with its own RheomIQ window, icon, Desktop shortcut and Start Menu shortcut. It does **not** open an external browser and normal use does not start a terminal.

Electron starts the existing Express backend automatically as a hidden child process on `127.0.0.1` using an OS-selected ephemeral port. The backend is packaged with a dedicated Node.js 22 runtime and serves the same built React application locally. It then connects directly to the same Supabase project, owner account, MFA/RLS policies and optimistic revision model used by Vercel.

First installation from a checkout is double-clickable:

```text
INSTALL_RHEOMIQ_WINDOWS.bat
```

The BAT/PowerShell bootstrap verifies its Node.js build runtime, runs the existing validation gates, builds an NSIS installer and provisions per-machine runtime configuration without committing secrets. The optional card-vault key is imported once into Windows-backed Electron `safeStorage` and is never compiled into the desktop package.

After installation, everyday use is simply the `RheomIQ` shortcut. The local backend starts and stops with the application automatically.

### Data synchronization vs application updates

Finance data does **not** require Git fetches or reinstallations. Desktop and web use the same canonical Supabase state, so successful saves from either client are stored in the same database; loads/reloads read the current revision and stale writes are rejected rather than overwriting newer data.

Application code is different: the Electron shell, React bundle and local backend are installed locally on purpose. New UI/backend code therefore requires a new desktop build/release. Rerunning `INSTALL_RHEOMIQ_WINDOWS.bat` installs the currently checked-out source. Once a signed desktop GitHub Release exists, this updates without a Git checkout:

```text
INSTALL_RHEOMIQ_WINDOWS.bat --latest
```

`--latest` downloads the newest Windows installer plus its SHA-256 checksum, verifies it and reinstalls while preserving per-user runtime configuration. Public desktop releases fail closed unless the Windows installer has a valid Authenticode signature. See `docs/WINDOWS_DESKTOP.md` for the full runtime, signing and update model.

## Persistence and recovery

- SQL schema is version-controlled in `supabase/migrations/`.
- `rheomiq_app_state` stores the current state as PostgreSQL `jsonb` with optimistic revision locking.
- Stale writes are rejected as revision conflicts.
- `rheomiq_backups` stores bounded database snapshots; automatic backups are throttled and retention is capped.
- Imports create a pre-import backup.
- `rheomiq_audit_log` records save/import/backup write events without duplicating the finance payload.
- The original local JSON remains only as a private emergency source/export and is never committed.

## Delivery workflow

Implementation and infrastructure changes follow **Issue → short-lived branch → Pull Request → automated checks → squash merge**. Branch naming and security/domain invariants are defined in `AGENTS.md`; the PR and issue templates under `.github/` make the verification steps explicit.

`main` is the production source of truth. Database DDL is never applied as an untracked change: every schema change is an ordered SQL migration under `supabase/migrations/`.

Supabase production deployment uses the native GitHub integration connected to this repository. Pushes/merges to `main` trigger the production deployment workflow and apply pending migrations. Per-PR Supabase preview databases are intentionally not required because Supabase Branching is a Pro-plan feature.

Vercel remains connected through its Git integration. Non-main deployment creation is disabled by repository configuration; `main` is the production deployment branch.

Windows desktop PRs have a separate `windows-latest` package gate. CI builds the packaged executable and NSIS installer and smoke-checks the local backend. A signed public desktop release is created only from a commit already on `main` using a matching `desktop-v<version>` tag and configured Windows signing credentials.

## Runtime environment

Online/Vercel runtime:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Local/desktop PAN + expiry vault access additionally uses the same existing server-vault encryption key:

```text
CARD_VAULT_KEY=<64 hex chars or Base64 decoding to 32 bytes>
CARD_VAULT_KEY_VERSION=1
```

The Windows bootstrap imports that value into per-user Windows-protected storage; it is not stored in the installed application files.

Offline emergency migration/verification may additionally use:

```text
SUPABASE_SECRET_KEY=sb_secret_...
```

Never commit real keys. Never expose any secret key through a public/Vite environment variable.

## Production migration state

The production Supabase project is initialized and the legacy RheomIQ corpus is stored in schema version 3. Storage artifacts used for the one-time import were removed. The old one-time import Edge Function remains server-side in a disabled `410 Gone` state with JWT verification because the connected management API does not expose function deletion; it is not part of the runtime contract.

Migration-only database leftovers are removed through normal forward migrations rather than manual production DDL.

## Development

Requirements: Node.js 22 LTS. The repository pins the major in `.nvmrc` and `package.json`.

Web/local-server development:

```bash
npm ci
npm run dev
```

Windows desktop development:

```text
npm ci
npm ci --prefix desktop
npm run desktop:dev
```

Create a local `.env` (never commit it) from `.env.example`.

## Validation and security gates

```bash
npm run test
npm run build
npm run check
```

GitHub CI runs deterministic installation, production dependency audit, tests/security guard, typecheck and build. CodeQL performs static security analysis and Dependabot tracks npm/GitHub Actions updates. Third-party GitHub Actions are pinned to immutable commit SHAs. Supabase Security Advisor should remain free of security findings after schema changes.

The Windows desktop workflow additionally runs deterministic desktop dependency installation, desktop dependency audit, a real Windows package build, packaged-process/local-backend smoke and NSIS installer verification.

## Repository structure

```text
RheomIQ/
├─ api/                       # Vercel Auth + finance API routes
├─ desktop/                   # Electron Windows host, packaging + installer bootstrap
├─ public/brand/              # RheomIQ application icon assets
├─ src/                       # React UI + finance domain logic
├─ server/                    # auth, HTTP validation and Supabase adapters
├─ scripts/                   # offline migration/verification utilities
├─ supabase/migrations/       # source of truth for PostgreSQL schema
├─ tests/                     # finance + security regression tests
├─ data/                      # ignored private data + empty example
├─ docs/                      # architecture, Windows desktop and UX rules
├─ INSTALL_RHEOMIQ_WINDOWS.bat # double-click Windows install/update bootstrap
├─ AGENTS.md                  # durable repository invariants/workflow
├─ SECURITY.md                # vulnerability-reporting policy
└─ .github/                   # templates, CI, CodeQL, Dependabot + Windows package CI
```

## Privacy

RheomIQ has one owner and no user picker, teams, tenant switching or multi-user business model. Personal finance data and credentials are excluded from Git history.
