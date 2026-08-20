# MyFinHub status

## Current production baseline

MyFinHub is released in production from `main` with Vercel as the web runtime and Supabase/PostgreSQL as the durable store. Historical GitHub history and compatibility-critical persistence/protocol identifiers may still use `RheomIQ`, `rheomiq_*`, and `RHEOMIQ_*`; those internal contracts are intentionally not rewritten merely for branding.

Current stable release: **v1.0.2**.

- production release commit: `main@d054ad549549c19039b70e76780e84feca7f3104`
- release tag: `myfinhub-v1.0.2`
- Windows installer: `MyFinHub-Setup-1.0.2-x64.exe`
- Windows release run `32345463537`: successful `validate-windows-package` and `publish-desktop-release`
- published installer SHA-256: `7bbbb92ce59d926671f48e55747536bdb868871932e8b15665856e36aa3081c3`
- Vercel production deployment for the exact release SHA reached READY and `/`, `/api/health`, and unauthenticated `/api/data` smoke checks passed
- `main` and `develop` were re-synchronized to the exact v1.0.2 production SHA after release diagnostics were removed

The v1.0.2 release completed the Cards v15 contract restoration, unlimited card stacks, archive/restore secret-retention behavior, and independent multi-credit-card model tracked in #154.

## Production security verification

The post-release verification tracked in #88 is **complete and closed**.

Verified on production on 2026-08-20:

- authenticated PAN/expiry save → reveal → delete passed with a non-real test card;
- device-local CVV save → reveal → delete passed on the production origin;
- ordinary production FinanceData and JSON backups contain no PAN/expiry/CVV fields;
- canonical `rheomiq_app_state` revision `99` contained no payment-secret JSON keys;
- seven production backup rows contained zero matching payment-secret keys;
- latest checked backup was id `8`, revision `98`, reason `automatic`, and was clean;
- `rheomiq_card_secrets` contained zero rows at the time of the read-only verification.

No finance values were returned and no production finance data was mutated by the read-only isolation verification.

## Released application capabilities

### Cards and Credit identity

The released card model is the v1.0.2 behavior from #154 / PRs #155–#157.

- Cards and Credit Card share `FinanceData.state.cards` / `PaymentCard` identities keyed by `cardId`.
- Any number of active cards may coexist under one bank; the supplied Cards v15 visual/interaction contract remains the source of truth for the bank/card stack.
- Multiple active credit cards may coexist across or within banks.
- Credit purchases and payments target a specific `cardId`; liability, limit, available credit, and history are independent per credit card.
- Legacy pre-`cardId` credit events remain readable through deterministic backward-compatible attribution rather than destructive history rewriting.
- Card removal is archival/soft-delete so finance events, liability/balance history, and card identity survive restoration.
- Archive/restore retains recoverable PAN/expiry state in the server vault and retains same-device local CVV state for the same card id; explicit secure deletion remains a separate action.
- `/api/card-secrets` requires same-origin, owner, and AAL2 authorization. CVV/CVC is rejected by the server boundary and remains device-local only.
- Production migration `20260819072000_tighten_card_secret_grants.sql` narrows authenticated card-vault privileges while retaining owner+AAL2 RLS.

### Windows desktop application

The Windows desktop application is released and validated through the v1.0.2 release channel.

- Electron owns the Windows application and starts the existing Express backend as a hidden child process using the bundled Node.js 22 runtime.
- The backend binds only to `127.0.0.1` on an OS-selected ephemeral port and serves the packaged Vite frontend from the same local origin.
- Renderer Node access remains disabled; context isolation, sandboxing, navigation restrictions, and desktop security headers remain enabled.
- Desktop uses the same Supabase project, owner login, mandatory TOTP AAL2, RLS/RPC rules, and optimistic revisions as the Vercel client.
- No service-role/secret Supabase credential is part of the desktop runtime.
- PAN/expiry vault configuration can be protected per Windows user through Electron `safeStorage` / Windows DPAPI. CVV remains device-local only.
- The per-user NSIS installer creates Desktop and Start Menu shortcuts and does not require Git, Node.js, a terminal, or a browser for normal released use.
- In-app updates use the controlled `myfinhub-v<semver>` GitHub Release channel, exact installer/checksum naming, trusted-host checks, size bounds, and streamed SHA-256 verification.
- Unsigned personal-use releases are supported; Authenticode remains optional if signing credentials are later configured.

### MyFinHub branding

The visible application identity is **MyFinHub** across web/PWA/desktop surfaces. The authentic original wallet/`R` artwork recovered from pre-rebrand Git history is used across favicon, PWA, setup, and Windows packaging assets. Compatibility-critical historical database, migration, cookie, storage, package, and desktop/backend protocol identifiers remain unchanged where renaming would add migration risk without user value.

## Current development integration

`main` and `develop` share the released v1.0.2 baseline `d054ad549549c19039b70e76780e84feca7f3104`.

The application-wide UI/UX/browser/analytics hardening batch is implemented on `feat/ui-ux-hardening-batch` in PR #159. Issue #158 is complete. The PR is ready for review but remains **unmerged and unreleased**; its changes are not part of the production baseline described above.

Production release remains a separate deliberate action. Documentation or feature-branch changes do not imply a production deployment, version bump, desktop tag, or installer publication.

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
- GitHub CI, dependency audits, CodeQL, Dependabot, and privacy/security guards
- Vercel Production Smoke tied to the released production deployment
- lazy-loaded finance pages and memoized derived selectors
- mutable-state-only normal writes
- native Windows Electron distribution with controlled GitHub Release updates

## Data and card-secret model

The compatibility `FinanceData` document remains the canonical read/import representation. Normal saves update the mutable `state` subtree under revision locking.

Payment-card metadata may live in `FinanceData.state.cards`; full PAN, expiry, and CVV do not. PAN/expiry use the ciphertext-only legacy-named `rheomiq_card_secrets` table, while CVV uses the separate device-local encrypted vault. Ordinary FinanceData backups remain outside both secret stores.

Production read-only verification on 2026-08-20 found:

- canonical `rheomiq_app_state` revision `99` with no payment-secret JSON keys;
- seven production backup rows with zero payment-secret JSON-key matches;
- latest checked backup id `8`, revision `98`, reason `automatic`, also clean;
- zero current rows in `rheomiq_card_secrets`.

## Known non-blocking platform notes

- Supabase Security Advisor previously reported `Leaked Password Protection Disabled`; mandatory owner + TOTP AAL2 remains the current application access boundary.
- Supabase per-PR database branching is not enabled on the current plan; production migrations remain version-controlled and release-controlled.
- The repository declares Node.js `22.x`; Electron may embed a different Node major internally, but the hidden local backend uses the bundled Node 22 runtime.
- Unsigned Windows releases can trigger Windows reputation/SmartScreen warnings. This is an accepted personal-use distribution tradeoff, not a release-integrity bypass: the MyFinHub updater still requires the controlled release source and SHA-256 verification.

## Delivery workflow

Implementation work follows Issue → short-lived branch → PR → required checks → squash merge into `develop`. Production release is a separate deliberate `develop -> main` PR followed by production verification. Desktop public release artifacts are created only from a `myfinhub-v<version>` tag whose commit is already present on `main`.
