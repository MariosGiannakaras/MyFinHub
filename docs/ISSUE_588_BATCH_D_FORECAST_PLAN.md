# Issue #588 — independent Batch D #7 forecast-scenario slice

**Current branch:** `feat/588-forecast-scenarios-batch-d` (draft). **Base:** `develop@5b58d3f26e25ade08157c9099b820f46c61df5b2`. **Active shared-ledger integration owner:** [Batch B draft #590](https://github.com/MariosGiannakaras/MyFinHub/pull/590); this separate branch does not edit its `src/types.ts`, `src/lib/domain.ts`, SQL, credit, or finance persistence files.

**Roadmap counters (accepted): Implementations 2/12 completed · Sub-implementations 4/24 completed**. This pure forecast slice is **0 accepted additional implementations or sub-implementations**.

## Approved scope and dependency

- Roadmap #588 **#7 Scenario-based 30/60/90-day cash flow**. Its two subitems require: source deduplication of Scheduled/Recurring/Loan and known-vs-estimated assumptions; optional scenarios, low projected portfolio/account balances and date/amount/phantom-event testing. Both remain unchecked.
- Existing `src/lib/forecast.ts` already computes 30/60/90 horizons, distinct portfolio/account trajectories, and evidence-proven early-payment recurrence suppression via `tests/recurring-forecast-cadence.test.ts`. It intentionally omits unsupported loan/savings cases instead of inventing account moves.
- Do **not** heuristically treat same-day equal-amount scheduled, recurring and loan obligations as duplicates: two real obligations can share dates/amounts. Deduplicate only when canonical linked event IDs, recurring IDs, or loan settlement provenance establish identity; retain all otherwise.
- Hypothetical scenarios are **read-only**: they must never affect `FinanceData.state.events`, screenshots of real balances, backups/history or future recognized income/expenses.
- This branch may continue safely while Batch B CI runs because the current files have no overlap. Rebase/merge `develop` *after* Batch B's finance contract is accepted, before final #7 UI and full integrated QA.

## Implementation slice S1 — pure scenario calculator

- [x] Added `src/lib/forecastScenarios.ts`, a non-mutating overlay on existing `cashFlowForecast`. It accepts 0–16 explicit positive two-decimal hypotheses tied to active real account IDs, supported date window and 30/60/90 horizon.
- [x] Scenario maintains per-account balances, lowest balance, first negative, overall minimum, first portfolio shortfall and separates declared input (`scheduled` + already-dated events), estimated recurrences/loans, and owner hypotheses. These are labels describing *forecast evidence*, not actual cash guarantees.
- [x] Added `tests/forecast-scenarios.test.ts` with 5 deterministic cases: exact-cent shortfalls, portfolio/account distinction, same-day non-deduplication of unrelated obligations, empty scenario parity across horizons, and invalid date/precision/duplicates.
- [ ] **Targeted CI result** — not yet run; these code/test files are not an accepted feature. Check CI logs on exact head.
- [ ] Next S2: integrate optional scenario controls in shared planning workspace without weakening the approved desktop/mobile layout or page primitives; inspect `docs/UX_STANDARDS.md`, `docs/UI_UX_SYSTEM_AUDIT.md`, `docs/ACTUAL_VS_CONCEPT_RECONCILIATION.md` before visual modifications.
- [ ] Next S3: add source-provenance/linked dedup coverage, explicit known-vs-estimated labels, rendered 375/834/1440px light/dark, failure/empty/reduced-motion, Real Stack and integrated final exact-head CI/Windows/WebKit/performance gates. **Feature #7 remains unaccepted until complete**.

## Handoff and safety

**Exact next action:** Validate S1 pure module's data and source classification via draft `validate` CI; review server inputs not needed because scenario has no writes. Continue to Plan UI only on a current head and without editing canonical ledger owned by #590. If an overlapping active PR appears, reconcile ownership first. Do not merge into `develop` while Batch B has a newer incompatible baseline. No `main` production/Android changes. No preview credentials or real financial data. Update branch plan/checkpoint and issue #588 at meaningful accepted checkpoints, never simply because files were committed.

## S1 draft preflight repair
The first draft `validate` failed before tests because TypeScript correctly refused an unsupported literal `15` in a negative runtime horizon test. The negative test now explicitly casts it only inside the intentionally-invalid invocation; production API remains strongly typed to 30/60/90. No test guard or type contract relaxed.
