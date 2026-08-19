# RheomIQ architecture

## Runtime and trust boundary

RheomIQ is a React/Vite client with a small TypeScript API boundary. Production API handlers run as Vercel Node.js Functions in Frankfurt (`fra1`); local development exposes the same server modules through Express. The repository runtime contract is Node.js 22.x.

The browser is UI-only for durable finance state. Durable finance data lives in Supabase/PostgreSQL in `eu-central-1`, and finance data or access tokens are not persisted in `localStorage` or IndexedDB. The one deliberate exception is the separately classified **CVV device vault**: when the owner explicitly saves a CVV, it is encrypted by a non-extractable Web Crypto key and stored in origin-local IndexedDB. It never joins FinanceData and is not synchronized to the server.

Production browser requests authenticate through HttpOnly/Secure session cookies. API handlers use the Supabase publishable key together with the signed-in user's access JWT, so PostgreSQL RLS remains part of the online authorization boundary. The production web runtime does not require a Supabase secret/service-role key. Privileged keys are limited to offline/admin workflows where explicitly required.

Finance access requires all of the following:

1. a valid Supabase Auth session;
2. the configured single owner UID;
3. an `aal2` TOTP-MFA session;
4. matching API checks and PostgreSQL RLS/RPC checks.

### Windows desktop runtime

The Windows application is a packaged desktop client, not a Vercel wrapper or PWA. Electron owns the application window while a separately bundled Node.js 22 executable starts the existing Express backend as a hidden child process.

The desktop backend binds only to `127.0.0.1` and asks Windows for an ephemeral port. Electron waits for a machine-readable readiness line containing that actual loopback origin, then opens the packaged Vite build from the same Express origin. This preserves the existing same-origin HTTP/API and HttpOnly-cookie model without exposing Electron/Node APIs to React.

The Electron renderer has Node integration disabled, context isolation enabled, sandboxing enabled and arbitrary top-level navigation/webview attachment blocked. The hidden backend receives only the Supabase URL, publishable key and the authenticated owner's cookie/JWT flow; service-role/secret admin credentials are explicitly removed from its environment.

Desktop and Vercel therefore remain separate runtime hosts but share one Supabase source of truth, one owner+AAL2 authorization model and the same optimistic revision RPCs. Finance data is not copied to a desktop database. A stale desktop or web client still receives a revision conflict rather than silently overwriting a newer save.

Desktop PAN/expiry operations require the same existing `CARD_VAULT_KEY` used by the server-side vault. The installer imports that key only through a one-time restricted per-user provisioning file; Electron immediately encrypts it with Windows-backed `safeStorage`/DPAPI and deletes the plaintext file. The key is never compiled into Electron, the React bundle or Git history.

Electron itself follows its supported release line independently of the application's Node 22 backend contract. Packaging copies the Node 22 executable that ran the deterministic build into desktop resources and uses that executable for Express at runtime, avoiding an accidental backend runtime upgrade when Electron's embedded Node major changes.

## Persistence model

The database schema is owned by ordered SQL migrations under `supabase/migrations/`.

- `rheomiq_app_state`: one canonical row (`id = 'primary'`) containing the compatibility `FinanceData` document as `jsonb`, plus schema version, optimistic revision and timestamp.
- `rheomiq_backups`: immutable full-document snapshots created before imports, manually, and periodically during normal saves; retention is bounded to the newest 100 snapshots.
- `rheomiq_audit_log`: append-only save/import/backup events without finance payloads.
- `rheomiq_owner`: singleton owner identity used by the RLS/RPC authorization checks.
- `rheomiq_card_secrets`: separate ciphertext-only PAN/expiry vault keyed by owner + shared card id. It is not embedded in `FinanceData` and is not included in normal finance backups.

The full finance document remains the compatibility read/import format because the imported Excel corpus contains 2,800+ legacy transactions whose historical meaning must not be reinterpreted casually.

### Normal writes

Ordinary UI changes do **not** resend or replace the immutable seed/history. The client sends only the mutable `state` subtree and its optimistic revision to `/api/data`.

`rheomiq_save_mutable_state(...)` then:

1. requires owner + AAL2;
2. locks the canonical state row;
3. rejects a stale expected revision;
4. creates a full automatic backup when the current backup window requires one;
5. replaces only the nested `state` and top-level `updatedAt` fields in the existing JSON document;
6. increments the revision and appends an audit event;
7. returns only the new revision/timestamp rather than echoing the full finance document.

This preserves the stable `FinanceData` read contract while removing the large immutable transaction/snapshot seed from the normal browser -> Vercel -> Supabase write path.

### Full import and backup

`rheomiq_import_state(...)` is the explicit full-document replacement path. It validates the complete document, takes a pre-import snapshot, replaces the canonical document atomically and increments the revision.

`rheomiq_create_backup(...)` creates an explicit immutable full snapshot. Backup/import operations are serialized behind pending client saves so a known-stale state is never backed up as if it were current.

The product migration wrapper explicitly preserves `state.cardBanks` and `state.cards` around the historical schema-v3 migrator. This prevents older migration code, which predates the Cards domain, from dropping shared card identities on load/import/offline migration.

## Shared payment-card model

Card metadata lives in `FinanceData.state.cards` as `PaymentCard` records. The same record is rendered by both the Cards workspace and the dedicated Credit Card page.

Non-secret card metadata may include bank id, nickname, kind, network, physical/virtual form factor, visual design id, holder label, last four digits, vault reference, active/archive state and timestamps. Full PAN, expiry and CVV are forbidden from this document.

New `card_purchase` and `card_payment` events may carry `cardId`. This binds history to the shared card identity without changing the existing ledger legs. Historical pre-linkage credit events with no `cardId` remain compatible and are interpreted as belonging to the historical primary credit card.

The current product has one synthetic `credit-card` liability, so only one credit-card identity may be active at a time. Archiving that identity does not alter the liability or its ledger events. Repayment remains possible while archived; new purchases require an active card.

### Server PAN / expiry vault

`/api/card-secrets` is the only online card-secret endpoint.

- `POST`: reveal PAN/expiry for one `cardId`.
- `PUT`: create/update PAN/expiry for one `cardId`.
- `DELETE`: explicit permanent deletion of PAN/expiry for one `cardId`.

Every method requires same-origin, an authenticated owner session and AAL2. The server uses the existing authenticated owner's JWT plus the Supabase publishable key to access `rheomiq_card_secrets`, therefore table RLS remains authoritative.

PAN/expiry are validated before encryption. Encryption is AES-256-GCM with a random 96-bit IV, AAD bound to owner id + card id + key version, and key material supplied only through the runtime `CARD_VAULT_KEY` environment boundary. PostgreSQL stores only ciphertext/IV/auth tag/key version and lookup metadata.

The API body is tightly bounded and key-whitelisted. CVV/CVC/security-code-like keys are rejected. The browser client also runtime-whitelists `pan` and `expiry` rather than spreading arbitrary objects into the request.

### Device-local CVV vault

CVV save/reveal/delete uses the browser-local encrypted IndexedDB vault and Web Crypto. No CVV request is made to `/api/card-secrets` or any other server endpoint.

Archiving a card removes its local CVV record from that browser/device but deliberately preserves its PAN/expiry server-vault row. Permanently removing PAN/expiry is a separate explicit secure-editor action.

### Soft archive / restore

Card removal from active UI is metadata-only archival (`active = false` plus archive timestamp). It must not delete:

- card purchase/payment events;
- credit liability/debt;
- repayment history;
- other finance history associated by `cardId`;
- the PAN/expiry server-vault row.

Restoring/re-adding the same card reactivates the original `PaymentCard` with the same `cardId` and vault reference. No history relinking or reconstruction is required.

## Concurrency and client synchronization

Every normal save uses an `If-Match` revision. Stale writes fail with a conflict instead of overwriting newer data.

The browser keeps one write in flight and retains only the newest pending snapshot, avoiding redundant intermediate full-state mutations. Successful revisions are announced through same-origin `BroadcastChannel` when supported: a clean second tab on the same origin reloads, while a tab with local work enters conflict state instead of being overwritten.

Desktop and Vercel run on different origins, so that `BroadcastChannel` is intentionally not a cross-device transport. They synchronize through the canonical Supabase state: each load/reload reads the current database revision, and every write is revision-checked. Cross-device live-push/realtime replication is not required for correctness and is not emulated by polling the full finance document.

## Performance model

Secondary finance pages are lazy-loaded so the authenticated shell does not eagerly download every page/chart module. Derived month/as-of selectors are memoized per immutable `FinanceData` object to avoid repeatedly scanning and sorting the legacy corpus during UI-only rerenders.

`/api/data` emits `Server-Timing` metrics for session, owner, data-storage and total request time. The browser records a `rheomiq:data-load` Performance entry for initial/full data loads. These timings contain durations only, never finance values.

## Migration and deployment

1. All schema changes are committed as ordered SQL migrations.
2. GitHub CI runs the security guard, tests, type/build checks and dependency audits; CodeQL scans JavaScript/TypeScript.
3. Supabase Git integration applies production migrations from `main`.
4. Vercel deploys the Git-connected `main` branch and the post-deploy Production Smoke workflow verifies the public surface, required security headers, unauthenticated API protection, `no-store` caching and Frankfurt routing.
5. Windows desktop PRs additionally build on `windows-latest`, launch the packaged executable against its hidden local backend, build an NSIS installer and retain it only as CI evidence.
6. Published desktop releases are allowed only from commits already on `main`, require a matching `desktop-v<version>` tag and valid Windows Authenticode signing credentials, and publish both the installer and a SHA-256 checksum.
7. Real personal finance JSON, `.env` files, card secrets and credentials are never committed.

## Ledger model

Legacy Excel rows remain immutable seed data unless the user explicitly creates an override/review decision. New actions are `FinanceEvent` objects containing one or more ledger legs.

- `expense`: asset account decreases; spending increases.
- `income`: asset account increases; income increases.
- `transfer`: two asset legs, cashflow impact zero.
- `withdrawal`: bank -> cash, cashflow impact zero.
- `saving_cash_offset`: payroll/current -> savings; cash unchanged; savings KPI increases.
- `refund`: asset increases and spending decreases.
- `lending`: asset decreases and receivable increases.
- `repayment`: asset increases and receivable decreases.
- `card_purchase`: credit liability decreases (more negative) and spending increases exactly once; optional `cardId` identifies the shared card.
- `card_payment`: bank decreases and credit liability increases toward zero; spending impact zero; optional `cardId` identifies the shared card.
- `reconciliation`: balance-only adjustment; spending impact zero.
- `split`: one payment with category-level parts that must equal the parent amount.

## Legacy Smart Review

Heuristics only create suggestions. Reporting remains based on the original legacy row until a decision is `confirmed`. Mixed comments are routed to a split editor. `kept` permanently records that the original meaning should remain.
