# RheomIQ status

## Current production baseline

RheomIQ is a single-owner personal finance application deployed from `main` to Vercel with Supabase/PostgreSQL as the durable store.

The August 2026 product/frontend batch tracked by #64 was promoted to production through PR #133. Issue #88 remains open only for the authenticated/browser post-deployment card-secret and backup smokes from that release; it is not an indication that the production promotion itself is pending.

`main` remains the release-only production branch. New routine work integrates into `develop` through short-lived issue branches and does not deploy to production until a later deliberate `develop -> main` release.

## Current develop integration — unreleased

### Interactive Cards / shared Credit identity

Issue #134 / PR #135 is integrated on `develop` and remains unreleased from production until the next deliberate `develop -> main` release.

- Cards use horizontal bank columns, bank-specific visual designs, a live creation preview, masked fields, explicit reveal/copy controls, pointer tilt with reduced-motion fallback, and deliberate soft-archive/restore interactions.
- Cards and Credit Card use the same `FinanceData.state.cards` / `PaymentCard` record. A card created or restored from either page is the same underlying record and `cardId`.
- New credit purchases/payments carry the shared `cardId`; legacy pre-linkage credit events remain compatible.
- The current singular credit liability permits one active credit-card identity. The server mutable-state boundary rejects multiple active credit identities and orphan `cardId` links.
- Credit Card is redesigned around the same large interactive card surface plus debt, available limit, utilization, purchases and repayments.
- Card removal is archival/soft-delete. It preserves finance events, liability/balance history and the PAN/expiry server-vault row; restoring the same card reuses the same id and vault reference.
- Device-local CVV is removed on archive. PAN/expiry deletion is a distinct explicit secure-editor action and never happens as a side effect of archival.
- PAN/expiry are exposed through `/api/card-secrets`, requiring same-origin, owner and AAL2. The online path uses the owner JWT + Supabase publishable key so RLS remains authoritative.
- CVV remains encrypted browser-local IndexedDB only. It is rejected by the server boundary and the browser client runtime-whitelists only PAN/expiry for server requests.
- The product migration/read/import/offline migration paths explicitly preserve `cardBanks` and `cards`, preventing the older schema-v3 migrator from dropping card metadata.
- `20260819072000_tighten_card_secret_grants.sql` narrows `authenticated` table privileges on `rheomiq_card_secrets` to SELECT/INSERT/UPDATE/DELETE while retaining owner+AAL2 RLS. The migration was dry-run in a production transaction and rolled back; no production schema mutation occurred during feature development.

### Windows desktop application

Issue #136 / PR #137 adds a Windows desktop target without replacing or weakening the Vercel web client.

- Electron owns a native-feeling `RheomIQ` window; ordinary use does not open an external browser or terminal.
- The packaged application includes a dedicated Node.js 22 runtime and starts the existing Express backend as a hidden child process.
- The backend binds only to `127.0.0.1` on an operating-system-selected ephemeral port and serves the packaged Vite frontend from the same local origin.
- Electron waits for the local backend readiness signal, opens that origin, and stops the backend with the application lifecycle.
- React remains sandboxed from Node/Electron APIs (`nodeIntegration` disabled, context isolation + sandbox enabled); arbitrary navigation and webview attachment are blocked.
- The local HTTP surface carries desktop-appropriate CSP, anti-framing, MIME-sniffing, referrer, permissions and cross-origin headers. HTTPS-only/HSTS directives are intentionally not applied to loopback HTTP.
- Desktop uses the same Supabase project, owner login, mandatory TOTP AAL2, RLS/RPC rules and optimistic revisions as Vercel. There is no separate desktop finance database or alternate ledger implementation.
- `SUPABASE_SECRET_KEY` / service-role credentials are not part of the Electron/local-runtime contract and are explicitly removed from the hidden backend environment.
- PAN/expiry use the same shared Supabase ciphertext vault. The existing `CARD_VAULT_KEY` can be provisioned once per Windows user and is then encrypted with Electron `safeStorage`/Windows DPAPI; it is never compiled into the package.
- CVV remains origin/device-local encrypted IndexedDB state and is not synchronized to Supabase.
- NSIS packaging creates the RheomIQ executable plus Desktop and Start Menu shortcuts.
- `INSTALL_RHEOMIQ_WINDOWS.bat` automates source installation. It can locate Node 22 or download the pinned Node 22 runtime with official SHA-256 verification, run project/desktop checks, build the installer and provision runtime configuration.
- `INSTALL_RHEOMIQ_WINDOWS.bat --latest` is the non-Git update path for a published desktop release: it selects a `desktop-v*` GitHub Release, requires the installer checksum asset and verifies SHA-256 before installation.
- Public desktop releases fail closed unless their tag points to a commit already on `main` and the installer has a valid Authenticode signature produced from configured Windows signing credentials.
- Finance data changes do not require Git fetches or desktop reinstalls. Both clients persist to the same Supabase state. Application-code/UI/backend changes do require a new desktop build/release because the Windows client is deliberately local rather than a remote Vercel shell.
- Cross-device correctness is revision-based rather than BroadcastChannel-based: desktop and Vercel load the same canonical database revision, and stale writes are rejected. Same-origin BroadcastChannel remains only an optimization for tabs/windows sharing one origin.

Windows-specific CI runs on a real Windows runner, validates dependencies/security/tests, builds the unpacked app, launches the packaged `RheomIQ.exe` against its hidden local backend, builds and verifies the NSIS installer, and uploads the installer/checksum as short-retention CI evidence. The double-click installer bootstrap is also exercised under Windows PowerShell 5.1 compatibility mode.

Neither PR #135 nor PR #137 deploys Vercel production or publishes a public desktop release; those remain release-stage actions from `main`.

## Implemented production platform

- React + Vite + TypeScript responsive application
- Node.js 22.x runtime contract
- Vercel Functions in Frankfurt (`fra1`)
- Supabase/PostgreSQL in `eu-central-1`
- single-owner email/password authentication with mandatory TOTP MFA (`aal2`)
- HttpOnly/Secure production sessions and same-origin mutation protection
- owner + AAL2 enforcement in API logic and PostgreSQL RLS/RPCs
- publishable-key + user-JWT online Supabase access; no service-role secret required by the production web runtime
- optimistic revisions with stale-write conflicts instead of silent overwrite
- bounded full-document backups and append-only audit events
- full-state import with a mandatory pre-import backup
- production-safe finance validation and request-size bounds
- GitHub CI, dependency audits, CodeQL, Dependabot and privacy/security guards
- Supabase migrations deployed from version-controlled SQL on `main`
- Vercel Production Smoke for public health, security headers, unauthenticated API denial, no-store caching and Frankfurt routing
- coalesced client persistence and same-origin multi-tab revision synchronization
- lazy-loaded finance pages and memoized derived month/as-of selectors
- mutable-state-only normal writes; immutable legacy seed/history is not resent on every save
- lightweight `Server-Timing` and browser Performance timing containing durations only

## Data and card-secret model

The compatibility `FinanceData` document remains the canonical read/import representation so the imported legacy corpus and historical snapshots keep their original semantics. Normal saves update only the mutable `state` subtree under revision locking.

Payment-card metadata may live in `FinanceData.state.cards`, but full PAN, expiry and CVV do not. PAN/expiry use the separate ciphertext-only `rheomiq_card_secrets` table; CVV uses the separate device-local encrypted vault. Ordinary FinanceData backups therefore remain outside both secret stores.

## Known non-blocking platform notes

- Supabase Security Advisor reports `Leaked Password Protection Disabled`; mandatory owner + TOTP AAL2 remains the application access boundary on the current plan.
- Supabase per-PR database branching is not enabled on the current plan. Production migrations remain version-controlled and are applied from `main`.
- The repository declares Node.js `22.x` in `package.json`; that remains the local-backend/runtime contract even though Electron itself may embed a different Node major internally.
- A public Windows desktop release requires an appropriate Windows code-signing certificate configured as repository secrets. CI can validate/build an unsigned installer as evidence, but the release workflow will not publish it as the signed update channel without valid Authenticode credentials.

## Delivery workflow

New implementation work starts from a GitHub issue and short-lived branch, is reviewed through a PR, and requires the applicable CI/CodeQL checks before squash merge into `develop`. Database changes also require migration validation. Production release is a separate `develop -> main` action with post-deploy verification. Desktop public releases are likewise release-stage artifacts from `main`, not feature-branch outputs. Personal finance payloads and credentials must never appear in issues, commits, logs or chat.
