# Finance ledger normalization and atomic cutover

Issue: #478

## Objective

Move MyFinHub from a single mutable finance JSON document to relational PostgreSQL storage without ever running two authoritative accounting engines.

The current JSON state remains authoritative until the cutover transaction completes. After cutover, relational tables become authoritative and JSON finance arrays are generated compatibility output only; mutable UI/preferences may remain JSON.

## Non-negotiable invariants

- Existing finance history is never silently rewritten.
- Event IDs remain stable across migration.
- Event dates, kinds, categories, notes and amounts round-trip exactly.
- Transaction legs preserve the current accounting semantics.
- Credit purchases/payments preserve card and statement linkage.
- Pay & Save remains internal savings-transfer semantics.
- Reconciliation remains non-spending.
- Deleted credit-card history keeps neutral tombstone references.
- Owner/RLS/AAL2/revision/history-conflict behavior is preserved.
- There is exactly one authoritative write path before and after cutover.

## Target relational model

The canonical relational tables live in the non-exposed `private` schema. Authenticated access is still owner/AAL2 constrained by RLS, but normal clients reach finance data only through the established public RPC contract.

### rheomiq_accounts

One row per financial account identity. Primary key: (owner_user_id, account_id). Fields cover account kind, provider, display name, active state and excluded-from-available semantics.

### rheomiq_transactions

Canonical event header keyed by (owner_user_id, event_id). It preserves the original stable event ID and stores date, kind, amount, category/subcategory, note, source, card/statement/recurring references and bounded event-specific metadata.

### rheomiq_transaction_legs

Ordered account effects keyed by (owner_user_id, event_id, leg_index), with FK to both event and account. Existing single-sided income/expense legs and two-sided internal transfers are preserved; migration does not invent synthetic external counterpart accounts.

### rheomiq_cards

Non-secret card profile/reference data only, preserving the established card-vault boundary unchanged. The encrypted card-secret vault is explicitly outside this workstream.

### rheomiq_credit_statements

One row per stored statement cycle, with FK to the credit card and date constraints for open/close/due ordering.

### rheomiq_budgets

Month/scope/category budget rows with one unique logical key per owner/month/scope/category.

### rheomiq_recurring

Canonical recurring-domain rows. Supports monthly, multi-month, annual and multi-year cadence; no separate subscription engine.

### rheomiq_scheduled

Pending/planned dated items with stable IDs and explicit status.

## What remains JSON

UI/preferences such as visual settings, category/icon presentation, pinned presets and bounded non-ledger UI decisions may remain in rheomiq_app_state. Immutable legacy/import seed data also remains in the compatibility envelope; the mutable live ledger arrays are not duplicated there. The relational ledger is never duplicated into mutable JSON as a second source of truth.

## Cutover stages

### Stage A — reviewed migration unit

The table DDL, RLS, helper functions, verifier, compatibility RPC rewrites and authority switch are authored and reviewed together in one pending migration. The relational tables are **not** deployed as a dormant second ledger.

### Stage B — in-transaction verifier

When that migration is finally applied, it converts the locked canonical JSON state into relational rows and composes the FinanceData ledger arrays back from those rows. The JSONB round-trip for events/ordered legs, cards/tombstones, statements, budgets, recurring and scheduled items must be exact before the transaction is allowed to commit.

### Stage C — one atomic cutover transaction

Inside one transaction:

1. Lock rheomiq_app_state and history cursor.
2. Verify expected revision/history generation.
3. Populate the relational rows from the locked canonical JSON.
4. Run the full verifier against persisted relational rows.
5. Switch one storage-mode marker to relational_v1.
6. Replace finance read/save RPC behavior so post-commit reads/writes use relational storage.
7. Preserve semantic finance revision/history state because the cutover changes storage representation, not user finance data.
8. Commit.

If any verification fails, the whole transaction rolls back and JSON remains authoritative.

### Stage D — compatibility envelope, not duplicate storage

Existing clients may continue receiving the FinanceData shape. The server/RPC assembles finance arrays from relational tables at read time and combines them with JSON settings. Writes in the existing mutable-state shape are validated and translated to relational rows transactionally; a second mutable copy of finance arrays is not persisted in app_state.

### Stage E — remove obsolete JSON finance payload

Only after production verification and compatibility coverage, remove obsolete live ledger arrays from canonical JSON. Historical snapshots/backups may retain old shapes because they are history, not live authority.

## Constraints required before cutover

- owner-scoped PK/FK on every financial row
- non-empty stable IDs
- positive event/header amounts where required
- non-zero leg amounts
- unique logical budget keys
- valid credit statement date ordering
- credit event card/statement foreign keys
- provider/account foreign keys where applicable
- owner/AAL2 RLS consistent with the current finance API
- authenticated access only; no anonymous finance grants
- no SECURITY DEFINER finance mutation shortcuts

## Index policy for the Free plan

Add only indexes matching real read paths: owner/date/event for transactions, owner/account/event for legs, card/statement paths, logical budget uniqueness and owner/status/date paths for recurring/scheduled data. Avoid speculative indexes and validate against real query plans/advisor data.

## Rollback and recovery

Before cutover, create a manual backup of the current canonical JSON state. Because the storage-mode switch occurs in the same transaction as population, verification and RPC cutover, a failed cutover leaves no partial production state. Any later rollback is a forward migration; migration history is never rewritten.

## Implementation gate

Do not create dormant relational tables until the cutover migration/RPC/test set is ready as one reviewed unit. This prevents an abandoned secondary ledger from becoming accidental product behavior.
