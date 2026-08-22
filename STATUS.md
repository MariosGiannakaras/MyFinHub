# MyFinHub status

## v1.1.0 release-preparation snapshot

MyFinHub is a private, single-owner personal finance application. Production deploys from `main` to Vercel and uses Supabase/PostgreSQL as the durable store. Historical repository history and compatibility-critical identifiers may still use `RheomIQ`, `rheomiq_*` and `RHEOMIQ_*`; those contracts are intentionally not renamed merely for branding.

This status record describes the release batch being promoted through issue #187.

- production baseline entering the release: **v1.0.2**
- production baseline commit: `main@d054ad549549c19039b70e76780e84feca7f3104`
- validated development integration before release metadata: `develop@66c875b793ac91bfa823788a669faa4ab47b077c`
- implementation batch represented by PRs #179, #181, #182, #184 and #186
- release target: **v1.1.0**
- release tracker: issue #187
- future receipt OCR: issue #188, explicitly excluded from v1.1.0

The final production `main` SHA, deployment smoke, tag, GitHub Release and Windows installer/checksum evidence are recorded in #187 after promotion. This section intentionally preserves the pre-promotion baseline so the release transition remains auditable.

## Production security verification inherited from v1.0.2

The production security verification tracked in #88 is complete and remains the baseline for v1.1.0.

Verified on production on 2026-08-20:

- authenticated PAN/expiry save → reveal → delete passed with a non-real test card;
- device-local CVV save → reveal → delete passed on the production origin;
- ordinary production FinanceData and JSON backups contained no PAN/expiry/CVV fields;
- canonical `rheomiq_app_state` revision `99` contained no payment-secret JSON keys;
- seven production backup rows contained zero matching payment-secret keys;
- latest checked backup was id `8`, revision `98`, reason `automatic`, and was clean;
- `rheomiq_card_secrets` contained zero rows at the time of the read-only verification.

No finance values were returned and no production finance data was mutated by that read-only verification.

## v1.1.0 capability batch

### Application-wide UX, accessibility and responsive hardening

The integrated batch strengthens the existing product rather than introducing a parallel UI framework.

- application-wide UI/UX, accessibility, focus/modal, owned-control, sorting, readability and user-copy hardening;
- responsive desktop, intermediate and narrow/mobile behavior across finance workspaces;
- MyFinHub light/dark visual treatment across browser/PWA/Windows surfaces while retaining the authentic historical wallet/`R` application mark;
- motion-sensitive behavior continues to respect `prefers-reduced-motion`;
- Dashboard semantic/read order is locked to **Μετρητά → Μισθοδοσία → Αποταμίευση → λοιπά υπόλοιπα → εκκρεμή/actionable → Quick Entry → analytics/rest**.

### Reports and financial planning

- restructured Reports/Analytics with deterministic comparative KPIs, flow/trend views, commitment and credit-pressure indicators, category momentum and responsive drill-downs;
- first-class internal transfers and split transactions;
- scheduled transactions that do not affect current balances until explicit completion;
- deterministic 30/60/90-day cash-flow forecasting;
- monthly category budgets;
- deterministic transaction rules;
- Needs Attention action center;
- context-aware Quick Entry.

### Search, shortcuts and interaction model

- privacy-safe unified search and Command Palette;
- one shared app-wide shortcut registry/hook;
- Search / Command Palette: `Ctrl K` on Windows/Linux, `⌘ K` on Apple platforms;
- Quick Entry: `Ctrl Shift Space` / `⌘ ⇧ Space`;
- Undo: `Ctrl Z` / `⌘ Z`;
- Redo: `Ctrl Y` on Windows/Linux, `⌘ ⇧ Z` on Apple platforms, with `Ctrl Shift Z` compatibility;
- Escape remains owned by the existing topmost-modal focus manager;
- shortcuts are suppressed in editable fields and modal-owned contexts;
- Settings includes a responsive Keyboard Shortcuts reference.

### Undo/Redo and privacy-safe Change History

The existing Undo/Redo persistence/state-stack model is retained.

- session-only Change History remains capped at 20 entries;
- additions, edits, deletions, transfers, scheduled items, balance/reconciliation changes, budgets, rules, cards, loans/installments, recurring items, settings and review decisions receive concise safe summaries;
- supported non-sensitive changes can show bounded `previous → new` values;
- Undo/Redo entries identify the safe affected change where possible;
- history labels exclude transaction notes/descriptions, arbitrary private free-text, custom account names, PAN, expiry secrets, CVV/CVC, vault references and other card-private values;
- reload/import continues to clear session history as designed.

### High-fidelity loading skeletons

Route-shaped skeletons now closely represent the final structure for:

- Dashboard;
- Transactions;
- Review;
- Savings;
- Cards;
- Credit;
- Loans;
- Lending;
- Recurring;
- Planning;
- Attention;
- Reports;
- Settings.

The skeleton system uses representative headings, balances/KPIs, rows, controls, forms, buttons, cards and charts, with desktop/mobile overflow checks, reduced-motion support and the maintained CLS threshold.

### Cards and Credit identity

The v1.0.2 card model remains intact and is part of the v1.1.0 baseline.

- Cards and Credit share `FinanceData.state.cards` / `PaymentCard` identities keyed by `cardId`;
- unlimited active cards may coexist under one bank;
- multiple active credit cards may coexist across or within banks;
- credit purchases and payments target a specific `cardId` with independent liability/limit/available-credit/history presentation;
- legacy pre-`cardId` credit events remain readable through deterministic backward-compatible attribution;
- card removal is archival/soft-delete so finance history and card identity survive restoration;
- PAN/expiry remain in the owner+AAL2 encrypted server vault;
- CVV remains encrypted device-local only and is never accepted by server persistence boundaries.

### Normalized payment flows

Credit-card payments, loan/installment payments and recurring obligations use shared source/target/result semantics without changing the accounting model.

The following invariants remain enforced:

- internal transfers, withdrawals, savings transfers, card payments and reconciliation adjustments do not become ordinary spending;
- `saving_cash_offset` remains a payroll/current → savings transfer with no physical-cash ledger leg;
- split portions are counted once and must balance to the parent amount;
- credit purchases are spending while paying the credit liability is not spending again;
- lending creates a receivable and repayment reduces it;
- Smart Review remains advisory until explicit confirmation;
- reconciliation uses the existing correction model rather than a duplicate accounting path.

## Automated release-readiness evidence

The latest completed implementation exact head before release metadata is:

`7401eb0d4a274e2d367fe0c67ee91f77ca07ca09`

Final implementation evidence:

- CI #782: success;
- full unit/source suite: **51/51 files, 247/247 tests**;
- app/API dependency audits: zero reported vulnerabilities;
- production build and bundle budgets: success;
- Primary-Chromium rendered QA: success, including shortcuts, Change History privacy, mobile containment and ledger reconciliation;
- browser evidence artifact: 86 files;
- CodeQL #736: success;
- Cross-engine/WebKit #79: success;
- Performance/loading-shift #74: success;
- Windows Desktop #435: success, including packaged executable smoke, interactive NSIS build, fresh install/launch/uninstall and checksum evidence;
- unresolved PR review threads at merge time: zero.

The release-prep and production-promotion exact heads are revalidated separately in #187; previous green runs are supporting evidence, not a substitute for final-head gates.

## Windows desktop application

- Electron owns the Windows application and starts the existing Express backend as a hidden child process using the bundled Node.js 22 runtime.
- The backend binds only to `127.0.0.1` on an OS-selected ephemeral port and serves the packaged Vite frontend from the same local origin.
- Renderer Node access remains disabled; context isolation, sandboxing, navigation restrictions and desktop security headers remain enabled.
- Desktop uses the same Supabase project, owner login, mandatory TOTP AAL2, RLS/RPC rules and optimistic revisions as the Vercel client.
- No service-role/secret Supabase credential is part of the desktop runtime.
- PAN/expiry vault configuration can be protected per Windows user through Electron `safeStorage` / Windows DPAPI. CVV remains device-local only.
- The per-user NSIS installer creates Desktop and Start Menu shortcuts and does not require Git, Node.js, a terminal or a browser for normal use.
- In-app updates use the controlled `myfinhub-v<semver>` GitHub Release channel, exact installer/checksum naming, trusted-host checks, size bounds and streamed SHA-256 verification.
- Unsigned personal-use releases are supported; Authenticode remains optional if signing credentials are later configured.

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

## Data and card-secret model

The compatibility `FinanceData` document remains the canonical read/import representation. Normal saves update the mutable `state` subtree under revision locking.

Payment-card metadata may live in `FinanceData.state.cards`; full PAN, expiry and CVV do not. PAN/expiry use the ciphertext-only legacy-named `rheomiq_card_secrets` table, while CVV uses the separate device-local encrypted vault. Ordinary FinanceData backups remain outside both secret stores.

## Future receipt OCR backlog

Issue #188 records a future receipt OCR design and is **not part of v1.1.0**.

The required future model is:

**receipt upload/mobile camera → temporary OCR staging → explicit user review/approval → normal finance transaction(s) → immediate purge of receipt image and OCR staging data**.

There is no planned permanent receipt archive/history. Rejected, cancelled, expired or approved staging payloads must be purged, and raw receipt/OCR content must not enter canonical FinanceData, normal backups, Change History or logs.

## Known non-blocking platform notes

- Supabase Security Advisor previously reported `Leaked Password Protection Disabled`; mandatory owner + TOTP AAL2 remains the current application access boundary.
- Supabase per-PR database branching is not enabled on the current plan; production migrations remain version-controlled and release-controlled.
- The repository declares Node.js `22.x`; Electron may embed a different Node major internally, but the hidden local backend uses the bundled Node 22 runtime.
- Unsigned Windows releases can trigger Windows reputation/SmartScreen warnings. This is an accepted personal-use distribution tradeoff, not a release-integrity bypass: the MyFinHub updater still requires the controlled release source and SHA-256 verification.

## Delivery workflow

Implementation work follows Issue → short-lived branch → PR → required checks → squash merge into `develop`. Production release is a separate deliberate `develop -> main` PR followed by production verification. Desktop public release artifacts are created only from a `myfinhub-v<version>` tag whose commit is already present on `main`.
