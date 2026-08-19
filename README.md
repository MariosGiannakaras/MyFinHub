<p align="center">
  <img src="public/brand/icon-192.png" width="128" alt="MyFinHub icon" />
</p>

<h1 align="center">MyFinHub</h1>
<p align="center"><strong>Smart. Clear. In Control.</strong></p>
<p align="center">Private single-owner personal finance ledger with Supabase/PostgreSQL persistence, compound transactions, savings logic, reconciliation and intelligent review.</p>

> The GitHub repository and several compatibility-critical internal identifiers still use the historical `RheomIQ` name. The product identity is **MyFinHub**. Existing `rheomiq_*` database objects, migration history and `RHEOMIQ_*` desktop-backend protocol variables remain intentionally stable rather than being renamed for cosmetics.

## Accounting model

MyFinHub preserves the existing Excel-derived behavior instead of flattening it into a generic income/expense tracker.

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

MyFinHub is a private **single-owner** application with two clients over the same canonical finance state:

- **Web/mobile:** React/Vite + Node API routes on Vercel.
- **Windows desktop:** Electron + the existing Express backend, bundled locally with Node.js 22 and started automatically in the background.
- **Durable state:** the same Supabase/PostgreSQL project for both clients.

Supabase Auth uses email/password plus mandatory TOTP Authenticator MFA. Finance access requires the configured owner UID and an `aal2` session in both API logic and PostgreSQL RLS. Access/refresh tokens stay in HttpOnly cookies; the online runtime uses the publishable key, never a service-role secret.

Normal writes use optimistic revision checks so a stale client cannot silently overwrite a newer save from another device.

## Windows desktop

The Windows edition installs as a normal application:

```text
MyFinHub-Setup-<version>-x64.exe
```

It creates `MyFinHub.exe`, Desktop and Start Menu shortcuts, opens in its own window and starts the existing local Express backend automatically on `127.0.0.1` using an OS-selected ephemeral port. Ordinary use requires no browser, terminal, Git, Node command or Vercel process.

On first launch, missing runtime configuration is collected in an app-owned MyFinHub setup window with step indicators, progress/status UI and a live explanation of the background work. The optional `CARD_VAULT_KEY` is imported only for PAN/expiry support and stored with Windows-backed Electron `safeStorage` / DPAPI; it is never bundled into the app. CVV remains device-local and is never sent to the server boundary.

### Data synchronization vs updates

Finance data synchronizes through the shared Supabase database and does **not** require Git fetches or reinstallations.

Application code is installed locally on purpose. Packaged MyFinHub therefore checks the controlled GitHub Release channel for newer desktop releases. Update checks are automatic, while download and install/restart remain explicit user actions in **Ρυθμίσεις**. The updater accepts only the exact MyFinHub installer/checksum asset pair and verifies SHA-256 before installation.

A paid Windows code-signing certificate is not required for this personal-use application. Unsigned releases are allowed; Windows may show **Unknown publisher / SmartScreen**. Authenticode remains optional if signing credentials are added later.

Full desktop details: `docs/WINDOWS_DESKTOP.md`.

A source-build/recovery fallback also remains available:

```text
INSTALL_MYFINHUB_WINDOWS.bat
```

This fallback is not needed for normal installed/released usage.

## Persistence and card secrets

SQL schema changes are version-controlled under `supabase/migrations/`.

The compatibility `FinanceData` document remains the canonical read/import representation. Normal saves update mutable state under revision locking. Existing historical PostgreSQL objects keep their legacy names, including `rheomiq_app_state`, `rheomiq_backups`, `rheomiq_audit_log` and `rheomiq_card_secrets`.

Payment-card metadata may live in finance state. Full PAN/expiry do not: they use the separate ciphertext-only card vault. CVV remains encrypted device-local state. Ordinary finance backups therefore do not contain PAN/expiry/CVV.

## Delivery workflow

Implementation and infrastructure work follows:

**Issue → short-lived branch → Pull Request → CI/CodeQL/relevant platform gates → squash merge to `develop`.**

`main` remains release-only. A deliberate `develop → main` release promotes a coherent batch to production and triggers the Vercel deployment. Database DDL is never applied as an untracked production change.

Windows desktop changes have a separate real-Windows package gate that builds and launches `MyFinHub.exe`, verifies the hidden local backend, builds the interactive NSIS Setup and validates the release checksum contract. Public desktop releases use `myfinhub-v<version>` tags only after the tagged commit is already on `main`.

## Runtime environment

Online/Vercel runtime:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Desktop/local PAN + expiry access additionally uses the same existing vault key:

```text
CARD_VAULT_KEY=<64 hex chars or Base64 decoding to 32 bytes>
CARD_VAULT_KEY_VERSION=1
```

Offline emergency migration/verification may additionally use `SUPABASE_SECRET_KEY`. Never configure that secret in Vercel/Electron runtime and never expose it as `VITE_*`.

## Development

Requirements: Node.js 22 LTS.

Web/local server:

```bash
npm ci
npm run dev
```

Windows desktop:

```text
npm ci
npm ci --prefix desktop
npm run desktop:dev
```

Validation:

```bash
npm run test
npm run build
npm run check
```

## Repository structure

```text
RheomIQ/                    # historical repository name
├─ api/                     # Vercel Auth + finance API routes
├─ assets/branding/myfinhub # easy-to-find canonical MyFinHub assets
├─ desktop/                 # Electron Windows host + setup/update tooling
├─ public/brand/            # runtime web/PWA/desktop icons
├─ src/                     # React UI + finance domain logic
├─ server/                  # auth, HTTP validation and Supabase adapters
├─ scripts/                 # offline migration/verification utilities
├─ supabase/migrations/     # PostgreSQL schema source of truth
├─ tests/                   # finance + security + desktop regressions
├─ docs/                    # architecture, Windows desktop and UX rules
├─ INSTALL_MYFINHUB_WINDOWS.bat
├─ AGENTS.md
└─ .github/                 # CI, CodeQL, Dependabot + Windows package workflow
```

## Privacy

MyFinHub has one owner and no user picker, teams, tenant switching or multi-user business model. Personal finance payloads and credentials are excluded from Git history.
