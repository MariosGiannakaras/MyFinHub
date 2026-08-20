# MyFinHub status

## Current production baseline

MyFinHub is released in production from `main` with Vercel as the web runtime and Supabase/PostgreSQL as the durable store. The historical GitHub repository history and compatibility-critical persistence/protocol identifiers may still use `RheomIQ`, `rheomiq_*`, and `RHEOMIQ_*`; those internal contracts are intentionally not rewritten merely for branding.

Current stable release: **v1.0.1**.

- production release commit: `main@97872cdfda2521aa9bd26ec81d3abaf148525ebd`
- desktop tag: `myfinhub-v1.0.1`
- Windows installer: `MyFinHub-Setup-1.0.1-x64.exe`
- Windows Desktop release run `32317412473`: successful, including packaged executable smoke, NSIS Setup build, SHA-256 verification, and final GitHub Release publication
- `main` and `develop` were synchronized at the v1.0.1 production baseline before this documentation-only status refresh

Issue #88 remains open only for two authenticated/browser runtime smokes that cannot be certified from static or database-only evidence:

1. PAN/expiry save → reveal → delete against the production API using a non-real test card, validating the configured production card-vault key path.
2. Device-local CVV save → reveal → delete on the production origin while proving no CVV request reaches the server.

The production FinanceData/backup secret-isolation item in #88 is complete: read-only production checks found no PAN/expiry/CVV-like keys in the canonical FinanceData row or any of the seven current production backup rows.

## Released application capabilities

### Cards and shared Credit identity

The work from #134 / PR #135 is released.

- Cards and Credit Card share the same `FinanceData.state.cards` / `PaymentCard` identity and `cardId`.
- New credit purchases/payments carry the shared `cardId`; legacy pre-linkage history remains compatible.
- The singular credit-liability model allows one active credit-card identity and rejects orphan references.
- Card removal is archival/soft-delete so finance events, liability/balance history, and the PAN/expiry vault association survive restoration.
- Device-local CVV is removed on archive; PAN/expiry deletion remains a separate explicit secure action.
- `/api/card-secrets` requires same-origin, owner, and AAL2 authorization. CVV is rejected by the server boundary.
- Production migration `20260819072000_tighten_card_secret_grants.sql` is released and narrows authenticated card-vault privileges while retaining owner+AAL2 RLS.

### Windows desktop application

The work from #136 / PR #137 and #138 / PR #139 is released.

- Electron owns the Windows application and starts the existing Express backend as a hidden child process using the bundled Node.js 22 runtime.
- The backend binds only to `127.0.0.1` on an OS-selected ephemeral port and serves the packaged Vite frontend from the same local origin.
- Renderer Node access remains disabled; context isolation, sandboxing, navigation restrictions, and desktop security headers remain enabled.
- Desktop uses the same Supabase project, owner login, mandatory TOTP AAL2, RLS/RPC rules, and optimistic revisions as the Vercel client.
- No service-role/secret Supabase credential is part of the desktop runtime.
- PAN/expiry vault configuration can be protected per Windows user through Electron `safeStorage` / Windows DPAPI. CVV remains device-local only.
- The normal per-user NSIS installer creates Desktop and Start Menu shortcuts and does not require Git, Node.js, a terminal, or a browser for normal released use.
- In-app updates use the controlled `myfinhub-v<semver>` GitHub Release channel, exact installer/checksum naming, trusted-host checks, size bounds, and streamed SHA-256 verification.
- Unsigned personal-use releases are supported; Authenticode remains optional if signing credentials are later configured.

### MyFinHub branding

The visible application identity is **MyFinHub** across web/PWA/desktop surfaces. The authentic original wallet/`R` artwork recovered from pre-rebrand Git history is used across favicon, PWA, setup, and Windows packaging assets. Compatibility-critical historical database, migration, cookie, storage, and desktop/backend protocol identifiers remain unchanged where renaming would add migration risk without user value.

## Current develop integration

There are no unreleased application/runtime changes recorded at this status refresh. Routine future work integrates into `develop`; `main` remains release-only.

Documentation-only changes on `develop` do not imply a new production application release.

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
- latest backup id `8`, revision `98`, reason `automatic`, also clean;
- zero current rows in `rheomiq_card_secrets`.

No finance values were returned and no production data was mutated by that verification.

## Known non-blocking platform notes

- Supabase Security Advisor previously reported `Leaked Password Protection Disabled`; mandatory owner + TOTP AAL2 remains the current application access boundary.
- Supabase per-PR database branching is not enabled on the current plan; production migrations remain version-controlled and release-controlled.
- The repository declares Node.js `22.x`; Electron may embed a different Node major internally, but the hidden local backend uses the bundled Node 22 runtime.
- Unsigned Windows releases can trigger Windows reputation/SmartScreen warnings. This is an accepted personal-use distribution tradeoff, not a release-integrity bypass: the MyFinHub updater still requires the controlled release source and SHA-256 verification.

## Delivery workflow

Implementation work follows Issue → short-lived branch → PR → required checks → squash merge into `develop`. Production release is a separate deliberate `develop -> main` PR followed by production verification. Desktop public release artifacts are created only from a `myfinhub-v<version>` tag whose commit is already present on `main`.
