# Stage 7 — Full cleanup verification

## Verified base

Stage 7 starts from the exact verified Stage-6 merge:

- `develop@e0545d27c0e98e0f6bfaf6cd30bad6075d8c25b2`
- CI `36263913482` ✅
- CodeQL `36263913514` ✅
- Windows Desktop `36263913479` ✅
- Windows First Run `36263913476` ✅
- Windows Clean Launch `36263913483` ✅

## Why this is one consolidated batch

The owner prefers coherent changes to be grouped before CI. Stage 7 therefore performs the source audit, safe shared-control reconciliation, compatibility cleanup, test-contract hardening and documentation in one branch before opening the validation PR.

## Cross-page shared-control audit

The routed-page scan confirms the existing owned-control guard already blocks browser-native select/date/datalist/page-owned textarea regressions. The remaining high-confidence generic-control gaps are concentrated in late Settings/security surfaces that were added or replaced after the earlier Button/Input consolidation batches.

This batch moves only generic controls whose existing class and native semantics can be preserved:

- `AccountSecuritySettings`: six text/email/password/PIN fields -> `AppTextInput`; five generic actions -> `Button`.
- `DeviceAccessSettings`: refresh -> `IconButton`; revoke actions -> `Button`.
- `AccountManagementSettings`: create/save/cancel -> `Button`; close/delete icon actions -> `IconButton`.
- `SettingsPage`: backup/import data actions -> `Button`.
- `DesktopAppLockGate`: hidden PIN text field -> `AppTextInput`; retry action -> `Button`.

Intentional composites remain raw: Settings tabs, account mode/cash choices, account row/edit/delete domain controls where variant classes would change presentation, semantic checkboxes/file input, and the desktop PIN digit surface.

## Confirmed compatibility CSS removal

Stage 6 deleted the obsolete `AccountMetadataSettings` component, but its presentation selectors remained in `account-metadata-surfaces.css`.

A routed/shared-component source scan found no live references to `.account-metadata-settings`, `.account-metadata-list`, `.account-metadata-row`, or `.account-metadata-identity`.

Those selectors are removed. The surviving live IBAN rules are renamed to `account-iban-surfaces.css`, with the workspace cascade position preserved exactly.

## Durable source contract

`tests/stage-7-shared-control-audit-source.test.ts` records the intended final boundary: generic Settings/security actions use shared `Button` / `IconButton`; generic text/password fields use `AppTextInput`; intentional composite/native controls remain explicit; and the deleted account-metadata CSS owner cannot reappear silently.

Existing finance, auth, security, persistence and owned-control tests remain unchanged and continue to gate behavior.

## Validation plan

Before PR CI: inspect exact diff/scope against the verified base; scan for stale deleted CSS/module references; verify no new native select/date/datalist/page textarea path; verify intentional raw-control exceptions remain explicit; and verify no generated visual-QA files are present in the diff.

Then run one exact-head cycle covering hygiene, full application/API checks, rendered desktop/mobile QA, keyboard/focus/accessibility checks, CodeQL, cross-engine smoke, performance smoke, and Windows Desktop / First Run / Clean Launch. Fresh representative visual evidence must be inspected before merge.

## Guardrails

No finance/accounting, auth/MFA/RLS, persistence, API, database, migration, Windows packaging, release, deploy or production-data behavior change is intended. No `main` action is authorized.


## First exact-head validation correction

The first consolidated PR cycle reached the full test suite with hygiene and the new Stage-7 source contract green. It exposed four stale references caused by the intentional CSS/control ownership changes in this batch:

- `qa.html` still directly imported the retired `account-metadata-surfaces.css` path;
- the Loans and Quick Entry source contracts still named that retired workspace import;
- the Settings Data source contract still matched the old raw `secondary` button markup after migration to shared `Button`.

These are ownership-contract corrections only. They are grouped in one skip-CI correction commit, followed by one fresh exact-head validation trigger after source/diff checks are complete.
