# Release checklist — develop → main → production

This checklist is intentionally separate from implementation. A completed implementation PR on `develop` does not itself authorize production changes.

## Gate A — develop release candidate

- [ ] All issue #429 implementation tasks intended for the release are merged to `develop`.
- [ ] `PROGRESS.md` records the exact develop SHA.
- [ ] Current develop/main comparison has been re-run.
- [ ] Any main-only production hotfix after the implementation baseline has been semantically reconciled.
- [ ] No unresolved legacy/new duplicate path remains for changed functionality.
- [ ] No known incomplete visible feature is presented as working.

## Gate B — exact-SHA validation

On the exact proposed release head:

- [ ] CI / project checks green.
- [ ] API/backend checks green.
- [ ] finance-domain regression suite green.
- [ ] auth/security/device checks green.
- [ ] card-vault checks green.
- [ ] migration ledger checks green.
- [ ] Vercel function-budget check green.
- [ ] CodeQL green.
- [ ] required dependency/security audit green or explicitly reviewed.
- [ ] cross-engine smoke green.
- [ ] Windows Desktop green.
- [ ] Windows First Run / Clean Launch green when affected.
- [ ] fresh desktop/mobile visual QA for changed surfaces reviewed.

Record run/check IDs in `PROGRESS.md`.

## Gate C — migration readiness before main merge

### Device-session migration

Before production migration:
- [ ] compatible application/server code is included in the release;
- [ ] missing registry remains a safe compatibility state;
- [ ] current session registration path is verified in code/tests;
- [ ] revoke/fail-closed behavior is covered;
- [ ] migration SQL has been reviewed against current live schema.

**Required order:** code live first, device migration second.

### Provider brand migration

- [ ] migration still matches current provider registry/storage state;
- [ ] embedded/fallback assets work before migration;
- [ ] asset-key refresh has a visual verification step.

### Other schema changes introduced by issue #429

For each:
- [ ] ordered migration committed;
- [ ] backward-compatible application path documented where needed;
- [ ] no destructive reset/replay;
- [ ] rollback/forward-fix approach documented.

## Gate D — develop → main release PR

- [ ] Open release PR targeting `main`.
- [ ] PR body lists product changes, backend/schema changes and migration order.
- [ ] PR explicitly states settled finance history is not rewritten.
- [ ] PR explicitly calls out card-vault transition and device migration sequencing.
- [ ] Required checks green on final release head.
- [ ] Review final diff for accidental legacy UI restoration.

## Gate E — production deploy

After merge to main:

- [ ] Verify Vercel production deployment reached READY.
- [ ] Verify deployed Git SHA equals the main release commit.
- [ ] Root application responds.
- [ ] Unauthenticated protected endpoints still fail closed.
- [ ] Authenticated owner+AAL2 session works.
- [ ] Core finance read works.
- [ ] A small reversible finance write path works where appropriate.
- [ ] Quick Entry/Transactions navigation works.
- [ ] Cards/credit protected secret path works.
- [ ] Reports load and budget management works.
- [ ] Savings goals load/persist.
- [ ] Global privacy mode behaves consistently.
- [ ] Android updater route still respects auth/function-budget routing.

Do not apply the device migration until this pre-migration production smoke passes.

## Gate F — production migrations

### F1. Device registry

- [ ] Apply the exact reviewed device-session migration.
- [ ] Confirm current active session/device row exists.
- [ ] Confirm finance read/write remains available.
- [ ] Confirm device list works.
- [ ] Confirm revoke works.
- [ ] Confirm a revoked session is denied.
- [ ] Confirm owner+AAL2 + active-device RLS behavior.

If the active session cannot be established safely, stop and repair forward; do not reset finance data.

### F2. Provider assets

- [ ] Apply the reviewed provider asset refresh when authorized.
- [ ] Verify provider logos/wordmarks/fallbacks across affected Settings/Cards surfaces.

### F3. Any additional issue #429 migration

- [ ] Apply in documented order.
- [ ] Verify immediately after each migration before proceeding.

## Gate G — final production smoke

- [ ] Dashboard real data/KPIs.
- [ ] Transactions CRUD/split/category paths.
- [ ] Savings target + new goals.
- [ ] Cards CRUD + PAN/expiry/CVV protected path.
- [ ] Credit purchases/payments/statements and boundary rule.
- [ ] Loans.
- [ ] Lending + shared privacy.
- [ ] Recurring including persisted renewal/expiry date.
- [ ] Planning complete/skip/cancel.
- [ ] Έλεγχος advisory actions; no silent destructive mutation.
- [ ] Reports including budget CRUD.
- [ ] Settings accounts/security/devices/rules/data.
- [ ] Web and relevant Windows smoke.
- [ ] Production logs checked for new high-severity runtime errors.

## Gate H — closeout

- [ ] Record release SHA and production deployment ID in `PROGRESS.md`.
- [ ] Record applied migration versions.
- [ ] Record production smoke outcome.
- [ ] Update changelog/release notes if this is a published release.
- [ ] Close issue #429 only when all intended scope is complete or explicitly split into new tracked issues.
- [ ] Remove obsolete temporary compatibility code only after its migration window is demonstrably complete.
