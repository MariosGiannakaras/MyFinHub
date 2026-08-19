<p align="center">
  <img src="assets/branding/myfinhub/icon-192.png" width="128" alt="MyFinHub authentic application mark" />
</p>

<h1 align="center">MyFinHub</h1>
<p align="center"><strong>Smart. Clear. In Control.</strong></p>
<p align="center">Private, single-owner personal finance workspace for Windows, web and mobile.</p>

<p align="center">
  <a href="https://github.com/MariosGiannakaras/MyFinHub/releases/download/myfinhub-v1.0.1/MyFinHub-Setup-1.0.1-x64.exe"><img alt="Download MyFinHub for Windows" src="https://img.shields.io/badge/Download%20for%20Windows-v1.0.1-2563EB?style=for-the-badge&logo=windows11&logoColor=white"></a>
  <a href="https://github.com/MariosGiannakaras/MyFinHub/releases/latest"><img alt="Latest release" src="https://img.shields.io/badge/Release-v1.0.1-0F766E?style=for-the-badge"></a>
  <a href="CHANGELOG.md"><img alt="Changelog" src="https://img.shields.io/badge/Changelog-View-475569?style=for-the-badge"></a>
</p>

<p align="center">
  <a href="https://github.com/MariosGiannakaras/MyFinHub/releases">All releases</a> ·
  <a href="https://github.com/MariosGiannakaras/MyFinHub/releases/tag/myfinhub-v1.0.1">v1.0.1 release notes</a> ·
  <a href="https://github.com/MariosGiannakaras/MyFinHub/releases/download/myfinhub-v1.0.1/MyFinHub-Setup-1.0.1-x64.exe.sha256">SHA-256</a> ·
  <a href="docs/WINDOWS_DESKTOP.md">Windows documentation</a>
</p>

> **Windows release:** download only `MyFinHub-Setup-1.0.1-x64.exe`. You do not need to clone or download the repository. The current personal-use build is unsigned, so Windows may display **Unknown publisher / Microsoft Defender SmartScreen**. Installer integrity is protected by the published SHA-256 checksum.

## Download and install

1. Click **Download for Windows** above.
2. Run `MyFinHub-Setup-1.0.1-x64.exe`.
3. Choose the installation folder if desired; Setup creates Start Menu and Desktop shortcuts.
4. On first launch, complete the MyFinHub setup window for the shared Supabase connection.
5. Use **Ρυθμίσεις → Ενημερώσεις** for future desktop update checks.

The installed application contains its own Electron host, bundled Node.js runtime and local backend. Normal use does not require Git, Node.js, a terminal or a browser.

## What MyFinHub manages

- **Dashboard:** balances, net worth, spending, savings and receivables.
- **Transactions:** income, expenses, transfers, withdrawals, refunds and reconciliation.
- **Savings:** cash-offset saving and savings-account movements without corrupting spending totals.
- **Recurring:** repeated obligations and long-term payment flows.
- **Cards & credit:** card purchases, liability repayments and protected PAN/expiry storage.
- **Loans & lending:** personal loans, installments, receivables and repayment history.
- **Review:** controlled proposals that do not affect reports until confirmed.
- **Reports:** finance summaries derived from the same canonical state used by every client.
- **Autosave + Undo/Redo:** normal edits persist automatically while remaining reversible in the UI.

## One finance state, multiple clients

MyFinHub has two clients over the same canonical Supabase/PostgreSQL finance state:

- **Web/mobile:** React/Vite with Node API routes on Vercel.
- **Windows desktop:** Electron with the existing Express backend running locally on `127.0.0.1`.

Changes made on one client synchronize through the shared database. Application updates are separate from finance-data synchronization.

## Security and privacy

MyFinHub is intentionally a **single-owner** application. Supabase Auth uses email/password plus mandatory TOTP Authenticator MFA. Finance access requires the configured owner UID and an `aal2` session in both API authorization and PostgreSQL RLS.

Access and refresh tokens remain in HttpOnly cookies. The online runtime uses the Supabase publishable key, never a service-role secret. Full PAN/expiry use a separate ciphertext-only card vault; CVV remains encrypted device-local state and is never included in ordinary finance backups.

Desktop updates are accepted only from the controlled MyFinHub GitHub Release channel. The app requires the exact versioned installer and `.sha256` asset pair, validates trusted GitHub URLs and verifies the downloaded installer hash before installation.

## Authentic branding

The application mark in this repository is the **original project artwork**, recovered byte-for-byte from the pre-rebrand Git history. It is the blue wallet with the `R` mark used by the original RheomIQ application. MyFinHub keeps that authentic mark while the visible product name remains **MyFinHub**.

`assets/branding/myfinhub/icon-192.png` is the historical 192×192 source-of-truth. The 32×32 favicon and 512×512 Windows/PWA variants are deterministic size derivatives of that source; they are not replacement artwork or a newly invented `MF` logo.

Compatibility-critical historical identifiers such as `rheomiq_*` database objects and `RHEOMIQ_*` desktop/backend protocol variables remain intentionally unchanged because they are persistence/protocol contracts, not visible product branding.

## Accounting model

MyFinHub preserves the existing Excel-derived behavior rather than flattening everything into generic income/expense rows:

- **Cash-offset saving:** payroll/current → savings; physical cash is untouched. Counts as savings, not spending.
- **Withdrawals:** bank → cash; no income/expense.
- **Internal transfers:** balance movement only.
- **Refunds:** reduce spending.
- **Credit card:** purchase is spending; card payment is liability repayment.
- **Lending:** creates a receivable; repayment reduces it; net worth includes receivables.
- **Reconciliation:** balance correction without polluting spending.
- **Splits:** category parts must balance to the parent amount.
- **Smart Review:** proposals affect reports only after confirmation.

## Updates and release history

The current stable Windows release is **v1.0.1**. See [`CHANGELOG.md`](CHANGELOG.md) for released and unreleased changes, or browse the complete [GitHub Releases](https://github.com/MariosGiannakaras/MyFinHub/releases) history.

Desktop releases use `myfinhub-v<version>` tags. The Windows release workflow verifies that the tag is already on `main`, builds and smoke-tests `MyFinHub.exe`, creates the interactive NSIS installer, generates SHA-256 metadata and publishes the controlled GitHub Release.

## Development

<details>
<summary>Local development and architecture details</summary>

### Requirements

Node.js 22 LTS.

### Web/local server

```bash
npm ci
npm run dev
```

### Windows desktop development

```bash
npm ci
npm ci --prefix desktop
npm run desktop:dev
```

### Validation

```bash
npm run test
npm run build
npm run check
```

### Runtime environment

Online/Vercel runtime:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Desktop/local PAN + expiry access additionally uses the existing vault key:

```text
CARD_VAULT_KEY=<64 hex chars or Base64 decoding to 32 bytes>
CARD_VAULT_KEY_VERSION=1
```

Offline emergency migration/verification may additionally use `SUPABASE_SECRET_KEY`. Never configure that secret in Vercel/Electron runtime and never expose it as `VITE_*`.

### Persistence

SQL schema changes are version-controlled under `supabase/migrations/`. The compatibility `FinanceData` document remains the canonical read/import representation. Normal saves use optimistic revision locking so a stale client cannot silently overwrite newer state.

### Delivery workflow

**Issue → short-lived branch → Pull Request → CI/CodeQL/relevant platform gates → squash merge to `develop`.**

`main` is release-only. Deliberate `develop → main` releases promote coherent batches to production. Windows changes also pass the real-Windows package gate before release.

</details>

## Repository structure

```text
MyFinHub/
├─ api/                      # Vercel Auth + finance API routes
├─ assets/branding/myfinhub/ # canonical authentic application artwork
├─ desktop/                  # Electron Windows host + setup/update tooling
├─ public/brand/             # runtime web/PWA/desktop icons
├─ src/                      # React UI + finance domain logic
├─ server/                   # auth, HTTP validation and Supabase adapters
├─ scripts/                  # migration/verification utilities
├─ supabase/migrations/      # PostgreSQL schema source of truth
├─ tests/                    # finance, security and desktop regressions
├─ docs/                     # architecture, Windows desktop and UX rules
├─ CHANGELOG.md
└─ .github/                  # CI, CodeQL, Dependabot + Windows release workflow
```

Personal finance payloads and credentials are excluded from Git history.
