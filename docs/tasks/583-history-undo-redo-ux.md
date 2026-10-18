# #583 — Do/Undo/Redo coverage, safety and UX audit

**2026-10-18 baseline: Implementations 0/4 completed · Sub-implementations 0/12 completed (fully accepted).** Audit's 4/12 checklist remains issue #583; work branch `audit/583-do-undo-safety-ux` begins from `develop@f1a63ce07b449469d202946ab4732324b8579229`. This draft audit does not authorize a release or merge before external-domain decisions.

## Owner intent / taxonomy
The owner requests **a coherent Do → Undo → Redo experience across all application actions**, with consistent visible controls, truthful messages and modern accessible UI. Implement the common contract for every *persisted reversible financial/settings mutation*. Enumerate separate categories:
- **State-cursor reversible:** finance events (including edit/delete/split/transfer), balances, schedules, loans, recurring, budgets, payment-card *metadata* while secret exists, account display settings, category trees, rules, presets and review decisions. Each confirmed write creates one durable revision/history point; redo follows the remaining active branch. No fake success before DB commit.
- **Local-only reversible while draft remains:** form edits, locally retained OCR/review drafts and unsaved changes (local Undo must not masquerade as persisted server Undo).
- **External irreversible effects requiring decision/protection:** truly deleted card PAN/CVV/local secrets, import containing mutable state *and immutable seed*, external exports/backups/downloads, security device revocation, logout, third-party actions. A finance snapshot **cannot** recreate a destroyed secret or erase a downloaded file. Fail closed or introduce explicitly approved reversible staging; do not falsely claim blanket Undo success.

## Confirmed architecture risks (see issue #583 forensic matrix)
1. Latest relational SQL import is recorded in cursor, but Undo only replaces state and *not imported seed*, risking mismatched data.
2. Completed card-vault deletion is outside finance snapshots; Undo can resurrect metadata without deleted ciphertext. Already-live encrypted Production rows must remain untouched.
3. Manual reload can overwrite optimistic pending writes; guard at UI and hook, add deterministic synthetic race verification.
4. History popup erroneously treated all stored snapshot points as audit of Do/Undo/Redo operations. Current vs redo descendants lacked labels. Free-form category names are persisted in privacy-misleading labels.

## Shared-owner UX and copy changes in draft batch
- History becomes explicit **snapshot cursor**, not chronological list of Undo button presses. A parentId-linked future descendant gets "Αναιρεμένη · διαθέσιμη για επαναφορά"; current point is visibly marked; remaining points neutral. If ancestry cannot be proved, *do not guess* a redo.
- Display actual server undoDepth/redoDepth, or a contextual reason controls are disabled: saving, error, revision conflict, reload. Existing top-edge save bar remains **the only normal save success feedback**, no extra "Saved" toast.
- Correct false import-exclusion and privacy claims in the dialog. Note that full import undo and deleted secrets are not yet safe, pending fail-closed backend contract.
- Reusable semantic status area and 44px modal actions, wrapping long Greek labels, keyboard focus, reduced-motion and mobile stacking. No new page-local generic button system.
- Block manual reload during queued writes, preserving optimistic data and normal conflict recovery.
- Tests: pure deterministic ancestry classification/reason copy; source ownership/guard tests; required actual rendered Light/Dark desktop/tablet/mobile and delayed save/reload tests pending.

## Product decision still required before claims of universal reversible behavior
Choose a safe import strategy: **full atomic snapshot restore across seed+state** (owner asks "everything" and this is the necessary architectural design, with new migrations/integration gates) versus an explicit fail-closed Undo barrier at import. Card vault secrets cannot be recreated after cryptographic deletion: decide whether to stage deletion with a reversible retention period, or keep irreversible final deletion separately confirmed. Do not touch real Production data or change security semantics while undecided.

## Validation and concurrency
- Draft-only, no full CI yet. Run focused tests and source/geometry checks as a coherent batch; exact final review CI only once implementation and decisions settle.
- Concurrent PR #582 owns transaction responsiveness after #581 and has a failing 5-second Chromium route gate; **do not touch its branch/files or merge it**. This #583 work is isolated to audit/history/UI/hook files.
- Later: deterministic synthetic SQL/real-stack tests for import boundary, post-vault deletion Undo, reload race, concurrent client conflicts, 10-day/100-point retention, error/retry and privacy. No destructive migration or live owner data, Android code or main deployment.
- Final checkpoint must reflect accepted counters, open blockers, exact branch head, gates, next action.

## 2026-10-18 Draft main-bundle budget and lazy shared history dialog

**Implementations 0/4 · Sub-implementations 0/12 accepted.** Draft `85a42aab` failed main JS budget **529.2 KiB raw / 528.0 KiB strict maximum** after passing unused-export hygiene. Rather than weakening the cap or removing meaningful messages, extract shared History popup, classification, copy and cursor status into **lazy-loaded `HistoryDialog.tsx`**, triggered only on opening History. Keep real focus management, Framer motion/reduced-motion, 44px actions, shortcut owner and accurate messages; source-owner tests updated. No finance/API backend behavior changes. Next: validate bundle budget + focused CI before Ready. Full reversible import and permanent card-delete semantics still require an explicit safe design.

## 2026-10-18 second-phase deterministic delayed-refresh race hardening

**Implementations 0/4 completed · Sub-implementations 0/12 fully accepted (issue #583).** Active branch remains Draft #584 from `develop@f1a63ce`; original #580's **6/6 · 28/28** are already merged, not re-opened. Separate performance #582 remains blocked by its own >5s route-ready Chromium failure, and is not edited here.

**New audited asynchronous hole (confirmed from hook source):** the prior `reload()` guarded `coordinator.hasWork()` / `exclusiveOperation.current` only *before* awaiting `loadData()` and `loadHistory()`. If the user initiated an optimistic write while either read was in flight, then the write completed before the stale request returned, both flags would be false and the delayed old snapshot could replace newer finance state/revision/redo cursor. An old GET rejection could also switch a now-successful write back to `error`. Overlapping manual/remote reloads could apply out of request order.

**Non-destructive shared-hook remediation:** epoch bump at each accepted `persist()` enqueue, `move()` cursor action, and `doImport()` exclusive start; each `reload()` captures both the mutation epoch and a monotonically increasing request ID. Pure `canApplyFinanceReload` in the existing persistence-queue owner must remain true after *each awaited GET* and before applying snapshots or request errors. Only the newest read for an unchanged mutation epoch in a loading state can update app data/history. Stale responses become no-ops without discarding confirmed writes, breaking pending saves or calling a new API. Three synthetic unit cases cover completed-save stale responses, out-of-order GETs, pending/exclusive operations; source contracts lock guard use in production hook. No real owner DB reads/writes, migrations, card-vault key/secret, Android or Production touches.

**Next:** review exact Draft narrow CI for this coherent five-file batch, fix source/build/bundle errors if real. Add safe synthetic SQL import and completed card-secret deletion boundary regression evidence, then obtain owner's retention decision before any irreversible backend implementation or merge. Entire 4/12 audit remains unaccepted until architectural boundary decisions and full rendered/security/DB gates; do not count the earlier Draft source PASS as complete acceptance.

## 2026-10-18 synthetic browser proof — delayed GET after confirmed import

Prior Draft source CI [#39141306429](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/39141306429) and CodeQL [#39141306478](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/39141306478) both terminal SUCCESS for the reload epoch fix. The new QA-only persistence probe can hold one GET snapshot from before an import. A fake `/api/import` response then applies a newer finance budget and revision through the **real useFinance hook**, with no Production connection. A rendered CDP test in existing `scripts/save-progress-qa.mjs` releases the stale GET afterward and requires that the newer confirmed imported budget and saved state remain unchanged; artifact `history-refresh-stale-read-after-import-1440-dark.png`. Dedicated source contract locks mock/fixture wiring; no weakening of previous top-edge database-save feedback tests. Draft source and focused rendered checks still required on new head; full architecture/import seed+state Undo and card-vault irreversible deletion remain blocked pending owner security decision. **Implementations 0/4 completed · Sub-implementations 0/12 fully accepted.**

## 2026-10-19 synthetic stale-read failure extension (Draft, validation pending)

**Implementations 0/4 completed · Sub-implementations 0/12 fully accepted.** Extend the *existing* local persistence-probe browser path to reject a previously held finance GET **after** a successful synthetic import has advanced the real mounted `useFinance` state/revision. Require both the newer imported budget and the confirmed saved state to survive; an obsolete GET error must not create a false red save bar. Keep the positive delayed-GET response case unchanged; add focused source locks and a second named screenshot `history-refresh-stale-error-after-import-1440-dark.png`. QA-only intercepted requests; no live Supabase, production finance/vault data, migration, or API security change. Verify source/CI and the actual screenshot before claiming rendered PASS. Remaining critical choices: atomic import/seed Undo vs explicit boundary; secure staged vault deletion vs separately confirmed irreversible destruction, with corresponding non-destructive integration tests.
