# Implementation plan — canonical develop → production

Issue: #429

This plan is executable guidance, not a historical audit. Always verify the current code/ref before changing a task.

## Definition of done

The integration is complete only when:

- the redesigned `develop` application remains the canonical UI/UX;
- meaningful old functionality is preserved in the new architecture;
- all new visible functionality has a real domain/persistence/backend contract where required;
- backend/API/schema/RLS support the canonical client coherently;
- no legacy duplicate path remains merely to keep old presentation alive;
- current `develop` passes the repository validation gates after integration changes;
- a release candidate is promoted through the release checklist;
- production migrations occur in the safe order;
- production smoke verifies the deployed SHA and critical finance/auth flows.

---

# Phase 0 — Repository-owned handoff foundation

Status target: documentation only.

## Tasks

- [x] Create issue #429.
- [x] Create a branch from current `develop`.
- [x] Add root `INTEGRATION_HANDOFF.md`.
- [x] Add `START_HERE.md`.
- [x] Add `DECISIONS.md`.
- [ ] Add `PROGRESS.md`.
- [ ] Add `RELEASE_CHECKLIST.md`.
- [ ] Open a draft PR to `develop` so the handoff package has a durable GitHub checkpoint.
- [ ] Record the PR/head SHA in `PROGRESS.md`.

## Acceptance

A new agent can read only the repository and explain:
- what is canonical;
- what the owner decided;
- what work is next;
- what is prohibited;
- how to stop and hand off cleanly.

---

# Phase 1 — Recover the live integration baseline

Do this before editing product code.

## 1.1 Current refs and divergence

- [ ] Fetch current `develop` and `main` heads.
- [ ] Compare current refs, not historical counts from old docs.
- [ ] Identify main-only commits/semantics that are still production-relevant.
- [ ] Verify whether those semantics are already present in develop by file/behavior, not by commit ancestry alone.
- [ ] Record the exact refs in `PROGRESS.md`.

### Required checks

At minimum re-check:
- Android updater routing and authorization;
- Vercel function count/budget;
- auth-session rewrites;
- production-only deployment configuration;
- any emergency hotfix after the last documented audit.

## 1.2 Current database state

Read live state before planning DDL:

- [ ] applied migration ledger;
- [ ] presence/absence of device-session registry;
- [ ] current `rheomiq_is_owner_aal2()` behavior;
- [ ] financial-provider registry/assets state;
- [ ] auth/security advisor items relevant to release.

No production mutation in this phase.

## 1.3 Current integration-sensitive code map

Create/update a short list in `PROGRESS.md` of actual current files for:
- account model/settings;
- account management;
- card vault client/server/crypto;
- recurring type/validation/editor/attention;
- credit statement config;
- Reports budgets;
- Dashboard actions;
- privacy state;
- API rewrites/auth/device handlers;
- migrations;
- Vercel config.

## Acceptance

The recorded baseline is current and reproducible. No task below starts from remembered file locations or old SHAs.

---

# Phase 2 — Reconcile production constraints into canonical develop

Goal: preserve required production behavior without restoring legacy product code.

## 2.1 Android updater / Vercel function budget

- [ ] Verify develop still preserves the production `/api/android-update` compatibility route.
- [ ] Verify updater remains owner+AAL2 protected.
- [ ] Verify final API entrypoint count stays within the repository/platform budget.
- [ ] Keep/update the function-budget regression test.
- [ ] Do not add a standalone endpoint if the existing rewrite is the canonical constrained design.

## 2.2 Auth compatibility

- [ ] Preserve unauthenticated fail-closed behavior for protected APIs.
- [ ] Preserve same-origin protection for ambient-cookie mutations.
- [ ] Preserve explicit bearer behavior only on already approved native paths.
- [ ] Confirm no new backend work introduces a service-role runtime dependency.

## Acceptance

Canonical develop contains every still-required production constraint. No release-only fix is lost because of branch ancestry.

---

# Phase 3 — Backend/domain contract alignment

Goal: make backend/data contracts match the canonical develop app.

## 3.1 Configurable accounts/providers

- [ ] Inspect the current `Account` / settings types and server validators.
- [ ] Keep custom accounts, provider metadata, account overrides and quick-choice metadata.
- [ ] Define/confirm semantic role metadata for UI defaults (for example operating/current vs savings/reserve) without hard-coding a specific bank.
- [ ] Migrate existing seed accounts to equivalent default roles in normalization/defaulting logic; do not rewrite historical events.
- [ ] Replace presentation/business assumptions tied to `piraeus-payroll`, `piraeus-savings` or similar IDs where a role is intended.
- [ ] Keep stable IDs for history/reference compatibility even when behavior becomes role-driven.
- [ ] Add validation/normalization tests.

### Acceptance

A custom provider/account can become the effective primary/current/savings account without source changes, while existing users retain the current default experience.

## 3.2 Device-session registry

Code-first, migration-second.

- [ ] Verify compatible code handles the missing registry as an explicit migration-pending state.
- [ ] Verify session registration occurs before RLS begins requiring an active device row.
- [ ] Verify device list/revoke endpoints remain owner+AAL2 protected.
- [ ] Verify revoked sessions fail closed when registry exists.
- [ ] Add/repair tests for missing schema, active session and revoked session.
- [ ] Do **not** apply the production migration in implementation PRs.

### Acceptance

Both states are safe:
1. code deployed before migration — core finance still works;
2. migration applied after compatible code — active device required and revocation works.

## 3.3 Card vault contract

Canonical target: encrypted server-side owner+AAL2 vault for PAN/expiry/CVV.

- [ ] Verify request validation accepts exactly the canonical secret fields.
- [ ] Verify crypto/persistence handles CVV exactly like the other encrypted card secrets.
- [ ] Verify no card secret is written to FinanceData, normal backup/history/logs.
- [ ] Keep transitional local-CVV read support only as needed.
- [ ] If server CVV is absent and a local CVV exists, allow it to be used/displayed under the existing local security boundary.
- [ ] Migrate local CVV to server only on an explicit user Save/Update under a valid protected session.
- [ ] Delete local CVV only after confirmed successful server persistence.
- [ ] Test old-client/new-server and transition cases where practical; do not support an unsafe new-client/old-server state in release.

### Acceptance

No silent secret loss, no silent upload, no mixed contract at production release.

## 3.4 Recurring end/renewal date

- [ ] Add the date to the canonical recurring type/model.
- [ ] Add server validation and normalization.
- [ ] Ensure backup/import/persistence round-trips it.
- [ ] Keep the current UI field.
- [ ] Use the date for advisory expiry/renewal attention.
- [ ] Do not auto-stop an obligation merely because the date passed.
- [ ] Keep stop/pause as explicit lifecycle actions.
- [ ] Test attention lookahead and persisted values.

### Acceptance

The visible recurring date is no longer a frontend-only loose field.

## 3.5 Financial provider assets

- [ ] Verify the current pending brand-key migration against current registry/storage.
- [ ] Keep embedded/fallback provider rendering functional before migration.
- [ ] Add no release dependency that makes finance unavailable if an asset is missing.

---

# Phase 4 — Cross-cutting application behavior

## 4.1 Shared privacy mode

Owner decision P-005.

- [ ] Identify all current local privacy states/toggles.
- [ ] Introduce one shared app/session privacy state using the existing app state architecture.
- [ ] Reports, Lending and any other sensitive summary surfaces consume that same state.
- [ ] Keep it presentation-only.
- [ ] Do not persist it unless a later explicit decision changes scope.
- [ ] Add interaction tests for cross-page consistency.

### Acceptance

Toggle once; relevant values hide/show consistently across navigation during the session.

## 4.2 Dashboard contextual actions

Owner delegated exact placement.

- [ ] Inspect the current approved Dashboard layout before editing.
- [ ] Preserve global Quick Entry and Έλεγχος access.
- [ ] Do not re-add legacy shortcut blocks.
- [ ] Add an Έλεγχος contextual action only when there are actionable items.
- [ ] Add Quick Entry only through an existing compatible redesigned action pattern if it improves access without duplicating controls.
- [ ] Validate desktop and mobile visually.

### Acceptance

The Dashboard stays visually coherent and gains no redundant always-on legacy actions.

## 4.3 Credit statement boundary

Owner decision P-004.

### Domain model

- [ ] Add/confirm an explicit stored rule on each relevant credit card/product.
- [ ] Use a narrow enum/schema rather than an implicit boolean/string.
- [ ] Preserve the existing effective rule for existing cards during compatibility normalization so current forward behavior does not unexpectedly change.
- [ ] New cards must receive an explicit rule through the canonical create/edit flow.

### Calculation/history

- [ ] Update statement calculation to read the stored rule.
- [ ] Remove contradictory UI text/engine assumptions.
- [ ] Do not recompute settled historical statements.
- [ ] Open/future cycles use the explicit rule.
- [ ] If statements store rule/version metadata, preserve it to keep history reproducible.

### Acceptance

The UI and engine describe/use the same rule, and old settled history is unchanged.

## 4.4 Diagnostics

Owner decision P-006.

- [ ] Keep normal Settings clean.
- [ ] Preserve useful counters/diagnostics behind a dev/support-only boundary.
- [ ] Reuse existing safe redaction rules.
- [ ] Never surface secrets/private finance text merely for diagnostics.

---

# Phase 5 — Product functionality gaps / new visible features

## 5.1 Savings goals

Owner decision P-001.

### Model

Before coding, inspect the current finance/settings persistence structure and place the feature in the smallest canonical domain that works across clients/backups.

Minimum model requirements:
- stable goal ID;
- target amount;
- optional target/deadline date;
- active/completed/archived state only if current UX requires it;
- timestamps/versioning only if consistent with existing persisted domain conventions.

Do not create a second savings ledger.

### Behavior

- [ ] Create a goal.
- [ ] Edit amount/date.
- [ ] Delete/archive according to existing product deletion conventions.
- [ ] Persist across reload/client synchronization.
- [ ] Calculate progress from canonical savings/account state without fabricating values.
- [ ] Define the balance source using account roles/defaults rather than a hard-coded bank.
- [ ] No target date means no fake countdown.
- [ ] No amount means no fake monetary target.

### Backend/data

- [ ] Add type/schema/validation.
- [ ] Include in backup/import where canonical user configuration/state belongs.
- [ ] Preserve forward/backward normalization for existing data without goals.
- [ ] Add regression tests.

### UX

- [ ] Replace current placeholders with real goal rows/cards using the existing redesign.
- [ ] Keep empty state truthful.
- [ ] Use shared form/dialog/input primitives.

### Acceptance

The two visible concepts — amount and deadline — are real, persisted and editable with no mock values.

## 5.2 Budget CRUD in Reports

Owner decision P-002.

- [ ] Reuse the existing canonical budget model/handlers.
- [ ] Add create/edit/delete within Reports near the budget analysis section.
- [ ] Use a shared editor/dialog, not the legacy Settings component.
- [ ] Keep budget progress, Reports and Έλεγχος on the same stored budget data.
- [ ] Remove/avoid duplicate editor in Settings.
- [ ] Verify delete/edit updates report values immediately.
- [ ] Preserve budget/category validation and historical finance data.

### Acceptance

A user can fully manage budgets from Reports and every existing budget consumer observes the same state.

---

# Phase 6 — Page-by-page parity and cleanup pass

The objective is not to redesign again. Verify the canonical page and fix only functional/integration defects.

| Surface | Required result |
| --- | --- |
| Dashboard | new design preserved; role-driven account defaults; contextual actions only |
| Transactions | edit/delete/split/category/filter parity; no duplicate legacy controls |
| Savings | target rate retained; real savings goals; role-driven accounts |
| Cards | create/edit/archive/restore/delete retained; canonical server vault transition |
| Credit | purchases/payments/debt/statements/history retained; explicit boundary rule |
| Loans | create/pay/forgive/edit parity; numeric regression check |
| Lending | master/detail retained; shared privacy mode |
| Recurring | create/edit/pay/pause/stop retained; canonical end/renewal date |
| Planning | scheduled create/complete/skip/cancel and forecast parity |
| Έλεγχος | one canonical action center; no silent finance mutation |
| Reports | KPIs/history retained; budget CRUD added; shared privacy |
| Settings | tabbed IA retained; account/security/device/rules/data retained; diagnostics hidden from normal users |

For each page:
- [ ] desktop behavior;
- [ ] mobile/responsive behavior;
- [ ] keyboard/focus/disabled states where relevant;
- [ ] no dead clickable controls;
- [ ] no mock financial values;
- [ ] no old duplicate component path left active.

---

# Phase 7 — Validation gates

Run narrow tests during implementation, then broad gates on the exact final PR head.

## Required final repository checks

- [ ] project check/typecheck/lint/build command used by current CI;
- [ ] API/backend validation;
- [ ] finance-domain regression tests;
- [ ] auth/RLS/device tests;
- [ ] card-vault tests;
- [ ] migration ledger checks;
- [ ] Vercel function-budget test;
- [ ] CodeQL;
- [ ] dependency/security checks required by the repository;
- [ ] cross-engine smoke;
- [ ] performance smoke where current workflow requires it;
- [ ] Windows Desktop;
- [ ] Windows First Run / Clean Launch where affected;
- [ ] rendered desktop/mobile visual QA for changed surfaces.

## Evidence rule

Record exact run/check identifiers and final head SHA in `PROGRESS.md`.

Do not claim a gate passed based on an ancestor commit.

---

# Phase 8 — Integration into develop

- [ ] Ensure the implementation branch is up to date with current `develop`.
- [ ] Resolve conflicts semantically in favor of the canonical design/decisions.
- [ ] Re-run affected gates after conflict resolution.
- [ ] Complete PR checklist.
- [ ] Merge to `develop` only when all required checks are green.
- [ ] Update `PROGRESS.md` with merged develop SHA.

Implementation completion on develop is **not** production authorization.

---

# Phase 9 — Production promotion

Follow `RELEASE_CHECKLIST.md`.

High-level order:

1. current develop/main comparison;
2. develop → main release PR;
3. exact release-head validation;
4. merge to main;
5. verify Vercel production deployed SHA;
6. production smoke while device migration is still absent;
7. apply device-session migration only after compatible code is live;
8. verify current device registration, finance read/write, list/revoke, revoked denial;
9. apply/verify provider brand refresh as authorized;
10. final production smoke;
11. record release/migration results in repository docs.

No destructive production data operation is part of this plan.
