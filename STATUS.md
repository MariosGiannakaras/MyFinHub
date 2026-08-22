# MyFinHub status

## v1.2.0 release-preparation snapshot

MyFinHub is a private, single-owner personal finance application. Production deploys from `main` to Vercel and uses Supabase/PostgreSQL as the durable finance store. Compatibility-critical historical identifiers such as `RheomIQ`, `rheomiq_*` and `RHEOMIQ_*` remain intentionally unchanged where they are persistence/protocol contracts.

This snapshot records the release batch tracked by issue #199.

- production baseline entering this release: **v1.1.0**
- production baseline commit: `main@3614988377f77c0370370117bc072873949b13ab`
- integrated development baseline before release metadata: `develop@8b4e242ea067aef623ed1a45dc23e79cc12edab4`
- `develop` at release-prep start: **3 commits ahead / 0 behind** `main`
- release scope: PRs #194, #197 and #195
- release target: **v1.2.0**
- release tracker: issue #199

Final release-prep, production `main`, deployment, tag and Windows release evidence are recorded in #199 and the corresponding release PRs as those gates complete.

## v1.2.0 capability batch

### Home navigation and category management

PR #194 added:

- semantic MyFinHub brand/home buttons on desktop and mobile that route to Dashboard;
- normalized category/subcategory comparison across whitespace, case and Greek diacritics;
- deterministic merging of normalized duplicate categories/subcategories while preserving the first visible spelling;
- safer non-overlapping vehicle subcategory defaults;
- explicit expense/income category Save actions with dirty/saved state and accessible feedback;
- invalid/empty category trees are rejected without overwriting the last persisted configuration;
- no historical transaction category migration or accounting rewrite.

Exact validated feature head: `c3fa44c880d259fe95390ba8f2572e53d3c6df5d`.

Feature validation:

- CI #791: success, including **52 test files / 252 tests**, app/API checks, production build and bundle budgets;
- Primary-Chromium rendered QA: success;
- CodeQL #745: success;
- Cross-engine/WebKit #84: success;
- Performance #78: success;
- Windows Desktop #443: success;
- unresolved review threads before merge: zero.

### Native Android bearer API contract

PR #197 added a narrow native-client authentication mode to the existing MyFinHub finance API. Android application code remains in the separate `MariosGiannakaras/MyFinHub-Android-App` repository.

Native bearer support is disabled by default and explicitly enabled only on approved finance/card-secret routes. Browser auth/session/MFA/login/logout remain cookie-oriented.

Security invariants:

- browser/Windows HttpOnly/Secure cookie sessions remain unchanged;
- cookie mutations still require same-origin/CSRF validation;
- an explicit bearer credential is authoritative and fails closed without ambient-cookie fallback;
- bearer mutations may omit browser Origin metadata only after bearer authentication succeeds;
- no permissive CORS policy is introduced;
- configured owner UID and `aal2` remain mandatory;
- database access remains publishable-key + user JWT under existing RLS/RPC;
- optimistic revision conflicts, validation, backups and audit behavior remain intact;
- bearer failures do not clear unrelated browser cookies;
- no service-role/secret credential is required or allowed in the Android client;
- PAN/expiry remain in the existing owner+AAL2 encrypted card vault and CVV remains device-local only.

Exact validated feature head: `e0d4ee10ec42688008a4d8436c0df8e42f7a94f2`.

Feature validation:

- CI #801: success;
- CodeQL #755: success;
- Cross-engine/WebKit #93: success;
- Performance #87: success;
- Windows Desktop #453: success;
- final exact-diff security review: success;
- unresolved review threads before merge: zero.

The durable consumer contract is documented in `docs/ANDROID_NATIVE_API.md`.

### Device-local receipt capture and OCR

PR #195 added a capture-first receipt workflow attached only to generic Quick Entry.

Lifecycle:

**camera/file JPG/PNG → normalized device-local IndexedDB draft → optional local OCR → deterministic proposal → existing Quick Entry → explicit normal submit → local draft deletion**.

Privacy and behavior invariants:

- pending receipt images remain device-local and survive normal reload/app close/logout until handled;
- Tesseract.js 7 uses pinned Greek `ell` + English `eng` packages and self-hosted worker/WASM/language assets;
- no Azure, Google, AWS, external LLM/VLM or other receipt-processing provider;
- OCR is lazy-loaded, bounded, cancellable/retriable and raw OCR text is transient;
- receipt images/raw OCR never enter FinanceData, Supabase, normal backups, Change History or application logs;
- no permanent receipt archive or cloud receipt sync;
- deterministic parsing proposes merchant/date/total/currency and may conservatively reuse an existing category;
- account/card selection remains manual;
- non-EUR detection warns and prevents silent EUR amount prefill;
- normal Quick Entry submit remains the only transaction-creation action;
- cancellation leaves the receipt pending and a draft is deleted only after successful normal submit;
- no database/schema migration or accounting rewrite.

Exact validated feature head: `88fce8217b9cb87179055bd6b25d953b02d2b3d8`.

Feature validation:

- exact-head CI: success with **56 test files / 267 tests**, app/API checks, TypeScript/Vite build and bundle budgets;
- dedicated Primary-Chromium receipt lifecycle QA: success;
- OCR recognition observed **zero external HTTP requests**;
- CodeQL: success;
- Cross-engine/WebKit: success;
- Performance: success;
- Windows Desktop: success;
- unresolved review threads before merge: zero.

Hands-on testing with representative real receipts is intentionally outside GitHub engineering tracking and is not a release gate. Issue #198 is closed as `not planned` to record that policy.

## Finance, persistence and secret invariants

The compatibility `FinanceData` document remains the canonical read/import representation. Normal writes update mutable state through optimistic revision locking.

This release does not introduce a database migration, destructive production-data rewrite or alternate finance engine. Existing accounting behavior remains authoritative:

- internal transfers, withdrawals, savings transfers, card payments and reconciliation adjustments do not become ordinary spending;
- `saving_cash_offset` remains payroll/current → savings with no physical-cash ledger leg;
- split portions balance to the parent and are counted once;
- scheduled items do not affect current balances until explicit completion;
- credit purchases are spending while credit liability repayment is not counted as spending again;
- lending remains a receivable and repayment reduces that receivable;
- Smart Review remains advisory until explicit user confirmation.

Payment-card metadata may live in `FinanceData.state.cards`; full PAN, expiry and CVV do not. PAN/expiry use the ciphertext-only server card vault. CVV uses the encrypted device-local vault and is rejected by server persistence boundaries.

## Windows desktop and release contract

- Electron owns the Windows application and starts the existing Express backend as a hidden child process using the bundled Node.js 22 runtime.
- The backend binds only to `127.0.0.1` on an OS-selected ephemeral port and serves the packaged Vite frontend from the same local origin.
- Renderer Node access remains disabled; context isolation, sandboxing, navigation restrictions and desktop security headers remain enabled.
- Desktop uses the same Supabase project, owner login, mandatory TOTP AAL2, RLS/RPC and optimistic revision rules.
- Desktop releases use `myfinhub-v<semver>` tags already present on `main`.
- The Windows release workflow builds/smoke-tests the packaged executable and NSIS installer, verifies exact tag/version/main ancestry, generates SHA-256 metadata and publishes the controlled GitHub Release.
- Unsigned personal-use releases may trigger SmartScreen/Unknown publisher warnings; release integrity still depends on the controlled GitHub source and checksum verification.

## Repository cleanup policy

The v1.2.0 release finalization also closes stale bookkeeping without rewriting Git history:

- issue #188 no longer presents #198 as an active manual-test backlog;
- #198 remains closed `not planned` because personal hands-on OCR testing is outside GitHub tracking;
- merged PR #197 records its actually completed Windows and final security-review gates;
- `docs/ANDROID_NATIVE_API.md` records the contract as merged rather than as an implementation branch;
- historical commit messages are not rewritten solely to remove old issue references.

NPM lockfiles remain dependency snapshots rather than release-note authorities. Manifest versions define the application/desktop release version; dependency lockfiles are not regenerated solely for a version-only release metadata bump because doing so would create unrelated dependency churn. Their install compatibility is revalidated by exact-head CI and Windows package gates.

## Final release gates

Feature-branch validation above is supporting evidence only. The integrated v1.2.0 release-prep head must independently pass the repository's current applicable gates before merge:

- root/API installs, audits, security guard, full unit/source suite, TypeScript/Vite build, bundle budgets and API checks;
- Primary-Chromium rendered frontend QA;
- CodeQL;
- Cross-engine/WebKit;
- Performance/loading-shift smoke;
- Windows Desktop package/install/launch/uninstall/checksum validation;
- zero unresolved review threads on the unchanged exact head.

After release-prep is squash-merged into `develop`, a separate controlled `develop → main` release PR is validated and squash-merged. Production deployment provenance/API/security behavior must resolve to the resulting exact `main` commit before the `myfinhub-v1.2.0` Windows publication tag is considered complete.

## Delivery workflow

Implementation work follows Issue → short-lived branch → PR → required checks → squash merge into `develop`. Production release is a separate deliberate `develop -> main` PR followed by production verification. After a release, `develop` may be synchronized to the exact released `main` commit only after verifying that doing so loses no tree content.
