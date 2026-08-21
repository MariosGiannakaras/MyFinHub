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

The v1.0.2 production build is intentionally unchanged while the newer development batch remains unreleased.

## Production security verification

The post-release verification tracked in #88 is complete and closed.

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
- Any number of active cards may coexist under one bank.
- Multiple active credit cards may coexist across or within banks.
- Credit purchases and payments target a specific `cardId`; liability, limit, available credit and history are independent per credit card.
- Legacy pre-`cardId` credit events remain readable through deterministic backward-compatible attribution rather than destructive history rewriting.
- Card removal is archival/soft-delete so finance events, liability/balance history and card identity survive restoration.
- Archive/restore retains recoverable PAN/expiry state in the server vault and same-device local CVV state for the same card id; explicit secure deletion remains separate.
- `/api/card-secrets` requires same-origin, owner and AAL2 authorization. CVV/CVC is rejected by the server boundary and remains device-local only.
- Production migration `20260819072000_tighten_card_secret_grants.sql` narrows authenticated card-vault privileges while retaining owner+AAL2 RLS.

### Windows desktop application

The Windows desktop application is released and validated through the v1.0.2 release channel.

- Electron owns the Windows application and starts the existing Express backend as a hidden child process using the bundled Node.js 22 runtime.
- The backend binds only to `127.0.0.1` on an OS-selected ephemeral port and serves the packaged Vite frontend from the same local origin.
- Renderer Node access remains disabled; context isolation, sandboxing, navigation restrictions and desktop security headers remain enabled.
- Desktop uses the same Supabase project, owner login, mandatory TOTP AAL2, RLS/RPC rules and optimistic revisions as the Vercel client.
- No service-role/secret Supabase credential is part of the desktop runtime.
- PAN/expiry vault configuration can be protected per Windows user through Electron `safeStorage` / Windows DPAPI. CVV remains device-local only.
- The per-user NSIS installer creates Desktop and Start Menu shortcuts and does not require Git, Node.js, a terminal or a browser for normal released use.
- In-app updates use the controlled `myfinhub-v<semver>` GitHub Release channel, exact installer/checksum naming, trusted-host checks, size bounds and streamed SHA-256 verification.
- Unsigned personal-use releases are supported; Authenticode remains optional if signing credentials are later configured.

### Production branding

The released v1.0.2 production build still contains the earlier pre-rebrand wallet/`R` artwork recovered from repository history. That remains production truth until a separately approved release changes it.

## Current development integration

The current `develop` integration head is `6b015b7e73a0a23d844fc99bc6631901631ce148`. It is three integration commits ahead of the v1.0.2 production `main` baseline and contains the fully verified development batch from PRs #179, #181 and #182.

PR #179 merged the complete verified capability stack into `develop` as `cdad04e67bfb5d782e9971f85f44ab51b0aef706`:

- application-wide UI/UX, accessibility, responsive, modal/focus, sorting, readability, owned-control and user-copy hardening from #158/#160/#162/#163;
- new MyFinHub light/dark branding across browser/PWA/Windows surfaces;
- the approved Reports/Analytics restructure with deterministic comparative KPIs, flow/trend, commitment/credit pressure, category momentum and responsive drill-downs;
- atomic first-class transfers and split transactions;
- scheduled transactions and deterministic 30/60/90 cash-flow forecasting;
- Needs Attention action center and context-aware Quick Add;
- monthly category budgets and deterministic transaction rules;
- privacy-safe unified search and command palette;
- normalized payment flows across credit cards, loans/installments and recurring obligations;
- bundle ceilings, focused WebKit compatibility, production-mode performance/loading-shift checks and Windows package evidence.

PR #181 then merged the final original-requirement reconciliation as `78afee74db4893f208b14536123f1232625422eb`:

- Dashboard semantic/read order is exactly **Μετρητά → Μισθοδοσία → Αποταμίευση → λοιπά υπόλοιπα → εκκρεμή/actionable → Quick Entry → analytics/rest**;
- Undo/Redo has a visible, accessible, privacy-safe session change history;
- loading skeletons are route-shaped and the Dashboard skeleton mirrors the real ordered UI.

PR #182 merged the automated release-readiness closeout as `6b015b7e73a0a23d844fc99bc6631901631ce148`:

- generated NSIS install → identity verification → installed-app launch → uninstall smoke on a fresh GitHub-hosted Windows runner;
- installed `MyFinHub.exe`, Desktop/Start Menu shortcuts, uninstall registration, associated icon and installed process path are verified;
- source regressions lock MyFinHub product/window-title and installed-package contracts;
- human-only physical-device, NVDA/VoiceOver and browser-owned visual-install checks are not completion gates.

Final exact-head automated evidence for #182:

- CI #755: success;
- CodeQL #709: success;
- Cross-engine smoke #54: success;
- Performance smoke #49: success;
- Windows Desktop #410: success;
- primary Chromium remains required.

No feature PR or open issue remains after the #165 closeout.

## Release-readiness state

Issue #165 is complete and closed. The maintained automated release-readiness boundary covers primary Chromium, focused WebKit compatibility, responsive/mobile viewports, accessibility semantics, production-mode performance, skeleton/overflow regression checks, browser/PWA source identity and Windows installed-package validation.

Human-only physical-device, NVDA/VoiceOver, manual Windows visual inspection and browser-owned install-prompt checks are explicitly out of scope and do not block repository readiness.

A future production release remains separate. Version bump, `develop -> main`, production deployment, post-deployment smoke, release tag and installer publication are performed and verified only when that release is explicitly approved.

No version bump, `develop -> main` merge, production deployment, GitHub Release/tag or installer publication was performed by the #165/#182 closeout.

## Implemented platform

- React + Vite + TypeScript responsive web client
- Node.js 22.x runtime contract
- Vercel Functions in Frankfurt (`fra1`)
- Supabase/PostgreSQL in `eu-central-1`
- single-owner email/password authentication with mandatory TOTP MFA (`aal2`)
- HttpOnly/Secure sessions and same-origin mutation protection
- owner + AAL2 enforcement in API logic and PostgreSQL RLS/RPCs
- publishable-key + user-JWT online Supabase access; no service-role secret required
- optimistic revisions with stale-write conflicts instead of silent overwrite
- bounded backups and append-only write audit events
- full-state import with mandatory pre-import backup
- server-side finance validation and request-size bounds
- GitHub CI, dependency audits, CodeQL, Dependabot and privacy/security guards
- Vercel Production Smoke tied to the released production deployment
- lazy-loaded finance pages and memoized derived selectors
- mutable-state-only normal writes
- native Windows Electron distribution with controlled GitHub Release updates

## Financial/product invariants

The current development batch preserves the established accounting and privacy contracts:

- internal transfers, withdrawals, savings transfers, card payments and reconciliation adjustments do not become ordinary spending;
- split portions are counted once without rounding drift;
- scheduled items do not affect current balances until explicit completion;
- credit purchases are spending while paying the credit liability is not spending again;
- payment operations use one logical mutation and shared source/target/result semantics;
- existing `ΔΙΟΡΘΩΣΗ` remains the manual balance-correction mechanism; no duplicate reconciliation feature was introduced;
- undo/redo, revision/conflict persistence, privacy boundaries and payment-card secret isolation remain intact.

## Data and card-secret model

The compatibility `FinanceData` document remains the canonical read/import representation. Normal saves update the mutable `state` subtree under revision locking.

Payment-card metadata may live in `FinanceData.state.cards`; full PAN, expiry and CVV do not. PAN/expiry use the ciphertext-only legacy-named `rheomiq_card_secrets` table, while CVV uses the separate device-local encrypted vault. Ordinary FinanceData backups remain outside both secret stores.

## Known non-blocking platform notes

- Supabase Security Advisor previously reported `Leaked Password Protection Disabled`; mandatory owner + TOTP AAL2 remains the current application access boundary.
- Supabase per-PR database branching is not enabled on the current plan; production migrations remain version-controlled and release-controlled.
- The repository declares Node.js `22.x`; Electron may embed a different Node major internally, but the hidden local backend uses the bundled Node 22 runtime.
- Unsigned Windows releases can trigger Windows reputation/SmartScreen warnings. This is an accepted personal-use distribution tradeoff, not a release-integrity bypass: the MyFinHub updater still requires the controlled release source and SHA-256 verification.

## Delivery workflow

Implementation work follows Issue → short-lived branch → PR → required checks → squash merge into `develop`. Production release is a separate deliberate `develop -> main` PR followed by production verification. Desktop public release artifacts are created only from a `myfinhub-v<version>` tag whose commit is already present on `main`.
