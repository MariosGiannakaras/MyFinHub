# #652 — FinanceData JSON backup/restore scope copy

**Branch:** `fix/652-financedata-backup-scope-copy` · **base:** `develop@f10b963f650a5b9c185512986d62d572c7ef4420`.
**Umbrella:** #649, I18.01 (only). **Implementation scope:** code + regression guard one sub-implementation; remaining I18.02–I18.06 independent.

## Confirmed cause
Settings Data already lists exclusions but calls the import file a "πλήρες backup MyFinHub" and "πλήρες JSON της εφαρμογής". A FinanceData JSON is **not** an independent full PostgreSQL and Storage disaster-recovery checkpoint. Desktop backup panel explicitly distinguishes that scope; reconcile the Settings user-facing copy without changing backend or destructive import lifecycle.

## Implementation status
- [x] I18.01 Settings backup/export/restore descriptive text now calls the document financial data JSON and explicitly says it is *not* PostgreSQL/Storage recovery.
- [x] Specific copy guard in `tests/652-backup-scope-source.test.ts` pins Card Vault/IBAN/logo/receipt/PIN exclusions and existing destructive confirm, 4-MB, pre-import backup and Undo semantics.
- [ ] Narrow draft CI/CodeQL, exact-head rendered Settings Data desktop/mobile/keyboard/dark acceptance, one full Ready CI before merge.

**Implementation counters (umbrella #649 after this commit): Implementations 0/23 completed · Sub-implementations 1/132 completed.** I18 partial 1/6; validation and merge are separate.
**Invariants:** no production restore/import, no migration, no DB write, no Android change, no change to `onImport`/`onBackup` code; existing security and history semantics unchanged.

**Next action:** inspect actual CI results for draft PR, then full Ready matrix and generated Settings Data evidence before merging to develop.
