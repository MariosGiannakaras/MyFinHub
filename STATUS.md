# MyFinHub status

## v1.3.0 release candidate

MyFinHub is a private, single-owner personal finance application. Production deploys from release-only `main` to Vercel and uses Supabase/PostgreSQL as the durable finance store. Compatibility-critical historical identifiers such as `RheomIQ`, `rheomiq_*` and `RHEOMIQ_*` remain intentionally unchanged where they are persistence/protocol contracts.

Release tracker: **#293**.

Current production baseline remains **v1.2.2** on `main` until the controlled v1.3.0 promotion completes. The v1.3.0 candidate is prepared from current `develop` after the completed 20/20 implementation program and the final production-schema hardening pass.

## v1.3.0 scope

- Durable cross-session and cross-device Undo/Redo history stored outside FinanceData/backups, with optimistic finance-revision + history-generation coupling, 10-day/100-point retention, redo-branch invalidation and owner+AAL2/RLS protection.
- Dedicated owner-only account metadata storage for IBAN values, independent of FinanceData/history/backups, with validation, revision control and copy/edit UI.
- Cadence-aware recurring obligations supporting monthly, every-N-months, annual and every-N-years schedules without treating annual/biannual costs as monthly charges.
- Safe taxonomy retirement and category identity preservation, including active dependency blocking and no destructive auto-cascade/remap.
- Completed finance semantics for split transactions, scheduled flows, loan/installment payments, credit statements, savings, recurring projections and historical compatibility.
- System/Light/Dark appearance preference and the completed cross-app desktop/mobile accessibility/UI hardening program.
- Production database history/account-metadata least-privilege ACL, RLS performance and audit-action hardening.
- August 2026 production finance source reconciled to the owner-supplied `MB22222.xlsm`; the workbook is authoritative for August transactions and daily account snapshots.

## Production data state before promotion

The August source refresh is already complete in the production database. A pre-import backup was retained, old August test/app-created events that would double-count workbook data were removed, and a fresh durable-history baseline was created after reconciliation.

The workbook-derived closing balances currently verified in production are:

- Cash: **€128.40**
- Piraeus Payroll: **€76.10**
- Piraeus Savings: **€3,143.25**
- Alpha Bank: **€0.64**
- Revolut: **€9.01**

The final recurring/subscription refresh is intentionally deferred until the cadence-aware v1.3.0 runtime is live. After production promotion, the approved workbook mapping is **11 active + 5 stopped** recurring subscriptions, with the 2 lifetime purchases excluded and canonical Loan obligations not duplicated as independent recurring items.

## Security and finance invariants

- Browser/Windows authentication remains owner-only with mandatory TOTP/AAL2.
- The desktop backend remains bound only to `127.0.0.1`.
- Supabase RLS/RPC, optimistic revisions, validation, backups, audit behavior and durable-history generation remain authoritative.
- Approved native Android bearer routes remain explicitly scoped and fail closed.
- No service-role/secret credential is introduced into web, desktop or native client runtime code.
- PAN/expiry remain in the existing owner+AAL2 encrypted server vault; CVV remains encrypted device-local only and is rejected by server persistence.
- Receipt capture/OCR remains device-local under the existing local-only OCR contract.
- The v1.3.0 promotion does not require a database reset or destructive re-import.

## Release gates

The release-prep branch must pass exact-head CI, CodeQL, cross-engine, performance and all applicable Windows package/first-run/clean-launch gates with zero unresolved review threads. A separate `develop -> main` PR is then validated before production promotion.

After `main` is live, release closure requires:

1. Vercel production provenance resolving to the exact released `main` commit.
2. `/` and `/api/health` healthy; unauthenticated protected finance routes fail closed with expected security/no-store behavior.
3. `myfinhub-v1.3.0` resolving to the exact release commit and the Windows installer + SHA-256 asset pair published and verified.
4. Cadence-aware migration of the approved 11 active + 5 stopped subscriptions, excluding 2 lifetime purchases and Loan duplicates.
5. Final production finance/recurring smoke verification.

## Delivery workflow

Implementation work follows **Issue → short-lived branch → PR → required checks → squash merge into `develop`**. `main` remains release-only. Production promotion is a separate deliberate `develop → main` release PR followed by exact production provenance verification and controlled tag/Windows asset publication.
