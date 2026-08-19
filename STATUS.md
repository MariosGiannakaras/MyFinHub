# MyFinHub status

## Current production baseline

The product is now branded **MyFinHub**. The historical GitHub repository name and compatibility-critical persistence/protocol identifiers may still use `RheomIQ` / `rheomiq_*` / `RHEOMIQ_*`; those internal names are intentionally not rewritten merely for branding.

Production still deploys from `main` to Vercel with Supabase/PostgreSQL as the durable store. The August 2026 product/frontend release was promoted through PR #133. Issue #88 remains open only for the remaining authenticated/browser card-secret and backup smokes from that release.

`main` is release-only. Routine work integrates into `develop` first.

## Current develop integration — unreleased

### Interactive Cards / shared Credit identity

Issue #134 / PR #135 is integrated on `develop` and awaits the next deliberate `develop -> main` release.

- Cards and Credit Card share the same `FinanceData.state.cards` / `PaymentCard` identity and `cardId`.
- New credit purchases/payments carry that shared `cardId`; legacy pre-linkage history remains compatible.
- The current singular credit liability allows one active credit-card identity and rejects orphan references.
- Card removal is archival/soft-delete: finance events, liability/balance history and PAN/expiry vault rows remain available for restoration.
- Device-local CVV is removed on archive; PAN/expiry deletion is a separate explicit secure action.
- `/api/card-secrets` requires same-origin, owner and AAL2. CVV is rejected by the server boundary.
- Product migration/read/import paths preserve `cardBanks` and `cards`.
- Pending migration `20260819072000_tighten_card_secret_grants.sql` narrows authenticated card-vault table privileges while retaining owner+AAL2 RLS. It was previously transactionally dry-run and rolled back; production DDL waits for release.

### Windows desktop foundation

Issue #136 / PR #137 is integrated on `develop`.

- Electron owns the Windows app and starts the existing Express backend as a hidden child process using the bundled Node.js 22 runtime.
- The backend binds only to `127.0.0.1` on an OS-selected ephemeral port and serves the packaged Vite frontend from the same local origin.
- Renderer Node access remains disabled; context isolation, sandboxing, navigation restrictions and desktop-appropriate security headers remain enabled.
- Desktop uses the same Supabase project, owner login, mandatory TOTP AAL2, RLS/RPC rules and optimistic revisions as the Vercel client.
- Service-role/secret credentials are explicitly removed from the desktop runtime environment.
- The shared PAN/expiry encryption key can be stored per Windows user through Electron `safeStorage` / Windows DPAPI. CVV remains device-local only.

### MyFinHub rebrand + normal Windows distribution

Issue #138 / draft PR #139 is the active integration branch for the final rebrand and desktop distribution work.

Implemented in the feature branch:

- visible web/PWA/desktop identity is `MyFinHub`;
- Windows identity is `app.myfinhub.desktop`, executable `MyFinHub.exe` and installer `MyFinHub-Setup-<version>-x64.exe`;
- interactive per-user NSIS installation with Desktop and Start Menu shortcuts;
- app-owned first-run configuration UI with step indicators, animated progress/status surface, background-work explanation and reduced-motion fallback;
- same-Supabase runtime configuration with no Git/Node/terminal requirement for released installations;
- in-app Windows update status and actions in **Ρυθμίσεις**;
- automatic update checks but explicit user download/install/restart;
- controlled `myfinhub-v<semver>` GitHub Release channel, exact installer/checksum asset naming, host allowlisting, size bounds and streamed SHA-256 verification;
- unsigned personal-use releases allowed with explicit SmartScreen/Unknown publisher tradeoff; Authenticode remains optional if both signing secrets are later configured;
- canonical runtime brand assets under `public/brand/` and an easy-to-find source pack under `assets/branding/myfinhub/`;
- Windows CI validates branding changes, the actual packaged `MyFinHub.exe`, hidden backend startup, interactive Setup and update checksum contract.

The feature branch/PR must still pass final exact-head CI, CodeQL and Windows packaging gates before it can be squash-merged into `develop`. No production deployment or desktop public release is performed from the feature branch.

## Implemented production platform

- React + Vite + TypeScript responsive web client
- Node.js 22.x runtime contract
- Vercel Functions in Frankfurt (`fra1`)
- Supabase/PostgreSQL in `eu-central-1`
- single-owner email/password authentication with mandatory TOTP MFA (`aal2`)
- HttpOnly/Secure sessions and same-origin mutation protection
- owner + AAL2 enforcement in API logic and PostgreSQL RLS/RPCs
- publishable-key + user-JWT online Supabase access; no service-role secret required
- optimistic revisions with stale-write conflicts instead of silent overwrite
- bounded backups and append-only audit events
- full-state import with mandatory pre-import backup
- server-side finance validation and request-size bounds
- GitHub CI, dependency audits, CodeQL, Dependabot and privacy/security guards
- Vercel Production Smoke tied to the released production deployment
- lazy-loaded finance pages and memoized derived selectors
- mutable-state-only normal writes

## Data and card-secret model

The compatibility `FinanceData` document remains the canonical read/import representation. Normal saves update the mutable `state` subtree under revision locking.

Payment-card metadata may live in `FinanceData.state.cards`; full PAN, expiry and CVV do not. PAN/expiry use the ciphertext-only legacy-named `rheomiq_card_secrets` table, while CVV uses the separate device-local encrypted vault. Ordinary FinanceData backups therefore remain outside both secret stores.

## Known non-blocking platform notes

- Supabase Security Advisor previously reported `Leaked Password Protection Disabled`; mandatory owner + TOTP AAL2 remains the current application access boundary.
- Supabase per-PR database branching is not enabled on the current plan; production migrations remain version-controlled and release-controlled.
- The repository declares Node.js `22.x`; Electron may embed a different Node major internally, but the hidden local backend uses the bundled Node 22 runtime.
- Unsigned Windows releases can trigger Windows reputation/SmartScreen warnings. This is an accepted personal-use distribution tradeoff, not a release-integrity bypass: the MyFinHub updater still requires the controlled release source and SHA-256 verification.

## Delivery workflow

Implementation work follows Issue → short-lived branch → PR → required checks → squash merge into `develop`. Production release is a separate deliberate `develop -> main` PR followed by production verification. Desktop public release artifacts are created only from a `myfinhub-v<version>` tag whose commit is already present on `main`.
