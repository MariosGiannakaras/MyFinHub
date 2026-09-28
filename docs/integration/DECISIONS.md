# Canonical integration decisions

These decisions are authoritative for issue #429 unless the owner explicitly changes them later.

## A. Product and architecture direction

### D-001 — develop is canonical

`develop` is the product to preserve and evolve. `main` is the deployed/release branch that must be adapted to the canonical app, not an equal competing product direction.

### D-002 — preserve the redesign

Keep the current redesigned UI, page/tabs structure, shared primitives and approved interaction patterns. Fix defects in the new UI when necessary; do not revert to old styling for parity.

### D-003 — preserve functionality, not legacy presentation

If a real production capability is missing from the new UI, restore the capability using the new architecture and components. Do not keep duplicate old/new implementations after the replacement is verified.

### D-004 — backend follows the canonical app

Backend/API/schema/validation/migrations may be extended or changed as required by the canonical develop app. Existing correct backend functionality should not be removed without a concrete reason.

### D-005 — keep code-health cleanup

Prefer one authoritative finance engine, one state path and shared components. Avoid parallel legacy helpers/components solely for compatibility when an adapter or migration can safely converge them.

### D-006 — META is contextual, not strict product spec

Historical META material can explain intent and communication conventions but does not override newer owner decisions here. Security/data/accounting invariants that are independently encoded in `AGENTS.md`, tests or current schema remain technical constraints.

## B. Owner product decisions imported from the workbook

### P-001 — Savings goals: IMPLEMENT

Owner choice: **A**.

Implement the new Savings concepts as real functionality instead of placeholders:

- goal amount;
- optional target/deadline date;
- persisted canonical model;
- create/edit/delete;
- progress derived from canonical financial state;
- validation, backup/import compatibility and tests.

Do not fabricate a target amount/date when none exists.

### P-002 — Budget management: REPORTS

Owner choice: **A**.

Budget create/edit/delete belongs in **Reports**, next to budget usage/analysis. Preserve the existing budget domain/persistence and remove the routed CRUD gap without restoring the old Settings presentation.

### P-003 — Dashboard quick actions: DELEGATED TECHNICAL CHOICE

Owner choice: **Custom — use what is best and functional**.

Implementation direction:

- do not restore permanent legacy-style shortcut blocks;
- preserve global Quick Entry and Έλεγχος access;
- use small contextual actions only where they add real value and fit the redesigned Dashboard;
- show Έλεγχος contextually when actionable items exist;
- add Quick Entry only through the existing redesigned action area/pattern, not as a duplicate competing control.

Final placement must be validated visually against the current Dashboard.

### P-004 — Credit statement boundary: EXPLICIT PER CARD/PRODUCT

Owner choice: **A**.

Introduce a stored explicit statement-boundary rule per card/product.

Compatibility rule:

- settled/historical statements are never rewritten;
- existing cards should preserve their current effective behavior when migrated;
- new/open calculations use the explicit stored rule;
- no hidden engine assumption may contradict the UI.

### P-005 — Privacy: ONE SHARED APP/SESSION MODE

Owner choice: **A**.

Reports/Lending and any other relevant views use one shared session-wide privacy state.

- It changes presentation only.
- It does not mutate financial data.
- Default to non-persistent/session scope unless an explicit future decision says otherwise.

### P-006 — Legacy diagnostics: DEV/SUPPORT ONLY

Owner choice: **C**.

Technical counters/diagnostics do not return to normal user Settings. Keep them available only through an explicit development/support path where useful.

## C. Technical directions that do not require repeated owner decisions

These are implementation defaults unless current code proves a better equivalent.

1. **Branch/release:** work from `develop`; forward-port still-relevant production-only behavior rather than rebuilding from `main`.
2. **Shared UI:** keep new shared primitives; wrap preserved business logic rather than restoring duplicate legacy UI components.
3. **Review/Έλεγχος:** one canonical Έλεγχος experience; legacy review entrypoints may redirect/alias if compatibility is needed.
4. **Accounts:** keep the configurable account/provider model; replace hard-coded bank/account IDs in business presentation with semantic roles/default mappings.
5. **Device access:** keep the feature; compatible code must be live before the security-sensitive device-session migration.
6. **Card vault:** canonical server-side encrypted owner+AAL2 vault for PAN/expiry/CVV. Existing local-only CVV may be read during transition and moved only on explicit user save/update; delete the local copy only after confirmed server persistence.
7. **Recurring end date:** formalize the field in the canonical type/server contract. Treat the date as advisory renewal/expiry review input; do not auto-stop recurring obligations merely because a date passes unless a later product decision explicitly adds that behavior.
8. **Auth/RLS:** preserve fail-closed authentication and owner+AAL2 boundaries; no permissive compatibility shortcuts.
9. **Migration ledger:** live migration state is authoritative; do not replay/reset historical migrations.
10. **Android updater/Vercel budget:** preserve the production updater routing/function-budget semantics when reconciling branches.
11. **Deleted financial entities:** preserve finance events/statements/history; minimize secrets/identity metadata rather than cascading historical deletion.
12. **Savings target rate:** keep its editor in Savings; do not create a duplicate Settings editor.
13. **Credit limit:** prefer per-card values; retain legacy global value only as compatibility fallback where required.
14. **Final validation:** run tests/visual QA on the exact integrated SHA, not only on earlier develop checkpoints.

## D. Non-goals

- Do not redesign the application again.
- Do not preserve obsolete duplicate UI solely for backward familiarity.
- Do not perform a destructive data reset/re-import.
- Do not rewrite settled finance history.
- Do not merge/deploy/migrate production simply because implementation work is complete; use the release checklist.
