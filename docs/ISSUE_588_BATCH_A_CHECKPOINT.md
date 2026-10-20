# Issue #588 — Batch A working checkpoint (2026-10-20)

Source of truth: [approved plan #588](https://github.com/MariosGiannakaras/MyFinHub/issues/588). Branch `feat/588-loans-credit-history`, based on `develop@f08cdf1e18060acf4b3733775bc1d1af04425e4b`. Review exact live branch head and CI before further writes.

**Current accepted progress: Implementations 2/12 completed · Sub-implementations 4/24 completed.** Features #10 (Loans) and #11 (credit rate history and advisory payoff), each with both subitems, accepted after tests and direct artifact review on `f7bcdc37`. No remaining Batch A implementation task. This checkpoint metadata edit does not modify product code; validate exact new review head before merge.

## Batch A implementation present
- Loans #10: verified existing explicit ContextualQuickAdd linked payment workflow. Per-payment amount is editable in EUR cents rather than read-only nominal installment; changing the installment count updates only the suggested amount. Preserve each event amount/date and links.
- Legacy loan safeguard: `legacyPaidAmount` is frozen on first existing loan edit at the canonical upsert boundary, rather than repricing `paidCount + loanExtra` using a later nominal installment. No historical event rewriting, new loan engine or Euribor feed.
- Reports: subcategory aggregate no longer subtracts a canonical refund twice; deterministic fixture regression included.
- Credit #11: versioned manually entered nominal annual percentages with effective-from dates and read-back as of date, server-side finite/range/chronological validation, durable card-profile write via existing revisioned finance path, history tracking, separate advisory monthly payoff estimator using integer cents. No automatic interest posting or bank statement modification.
- Loan and credit tests added; existing finance revisions, history/Undo/Redo, AAL2/RLS, card vault and deployed DB untouched.

## Review-head failure-class correction
- The initial Ready-for-Review PR #589 head exposed a stale rendered assertion for read-only loan payments; this was updated to require editable actual EUR cents. Loan preview now reflects the real typed amount, not the nominal preset.
- Initial full-gate evidence: CI `validate` stopped at unused-export hygiene (`CreditPayoffEstimate` exported without consumers); Windows Clean Launch blocked by raw eager app JS 531.1 KiB versus the existing 528.0 KiB budget. Correct at source by keeping the payoff result type internal and moving only the legacy-baseline boundary helper into its own lightweight eager module rather than importing the whole loan analytics module into `App.tsx`. Never raise existing size thresholds to pass.
- Revalidate *all* checks on the subsequent coherent head; prior failures are not acceptance evidence and completed unrelated checks do not certify the new head.

## Second exact-head CI learning
- `0b485397...` executed 1,358 Vitest tests: 1,355 passed, three stale source contracts failed (Credit button count and two old read-only loan-payment assumptions). Updated the assertions to encode the new approved interactions and added a browser-driven 31.47 EUR preview regression.
- Windows bundle moved from 531.1 to 528.3 KiB raw, still 0.3 KiB above fixed 528.0 KiB ceiling. The React 404 page, irrelevant to the finance bootstrap, now loads lazily behind the existing privacy-safe 404 route and `Suspense` fallback; this intentionally reduces eager code without changing security/routing semantics or limit. All route/rendered checks must confirm it.
- New exact-head required CI and rendered/light-dark viewport inspection pending. No local checkout to run tests; do not assert PASS without actual run evidence.

## Exact-head validation and final focused acceptance addition
- `8112736a...` PASS CI (`236/236` Vitest files, `1358/1358` tests), 55 rendered QA scripts including editable loan EUR-cent preview, Chromium/desktop/tablet/mobile Light/Dark and 648 evidence screenshots. Bundle main raw `526.0 KiB`, under `528.0 KiB`; CodeQL, WebKit, Lighthouse, Windows Desktop/First Run/Clean Launch all PASS.
- Directly inspected rendered Credit/Loans screenshots and contextual loan payment on desktop, tablet, mobile and both themes, plus save-progress failure evidence. Existing snapshots do not open the new rate editor: added browser regression within existing credit statement suite for rate modal validation, successful readback, approximate payoff with no ledger event, duplicate effective date, dark tablet geometry and mobile failed durable-save semantics. This new head must pass source/rendered/security checks before accepted progress changes.
- Final 216-image visual sweep is reserved for the roadmap's final acceptance boundary unless another requirement triggers an earlier sweep; keep current focus on the verified Batch A review head.

## Exact-head visual evidence finding and bounded correction
- On `a02d9603...`, all required checks PASS: CI 1358/1358, rendered 55 QA modules and 653 screenshots (including interest-editor successful/duplicate/failed save), Windows Desktop/First Run/Clean Launch, CodeQL, WebKit and Lighthouse.
- Direct screenshot review exposed a **transient** partially transparent **mobile** rate dialog immediately after an error; the shared editor's 190 ms opacity entrance transition means capture at first DOM/error readiness can record the mid-animation composite even though its opaque semantic surface token is correct. Updated the existing rendered flow to wait for settled backdrop/dialog opacity, assert the actual solid backdrop and dialog alpha and capture stable mobile evidence; do not change shared colors or motion unnecessarily. This regression locks evidence quality and catches a genuinely translucent stable dialog.
- Another user-visible correction: after empty-rate validation, typing a valid numeric rate now clears the stale error immediately; effective-date edits also clear outdated errors. Source/browser regression requires this behavior. Existing sibling editor geometry/interaction QA remains in the required rendered suite.
- This final UI-validation update requires a **new exact-head** CI/gate cycle; prior green results are not transferred to the newest head. Keep accepted counters at 0/12 and 0/24 until verification and review.
 
## Exact-head QA environment regression
- `66063e47...` passed 1358 Vitest tests, bundle, CodeQL, WebKit, Lighthouse and all Windows checks, but Chromium rendered QA failed while waiting for an opaque mobile rate dialog. Failure occurred **after** a new `Page.navigate` into `qa.html`; unlike production startup, that synthetic QA document does not automatically reinitialize runtime semantic theme tokens. The bottom sheet uses `--surface-elevated` and can be transparent without them, so merely waiting for the 190 ms animation is not sufficient.
- Corrected the narrow browser test to apply the canonical Light theme after mobile fixture navigation, then assert `--surface-elevated:#ffffff` before opening the editor and checking settled alpha, failed-save/history behavior and final screenshot. No production UI/CSS, finance data, security or real persisted history changed. New exact-head CI/rendered and visual artifact inspection required before accepting #10/#11.

## Batch A accepted evidence and integration boundary

- Code head `f7bcdc3724002aa95e10f61de9973269c29340ef`: GitHub CI PASS (236/236 Vitest files, 1,358/1,358 tests, API checks, hygiene, security audit), 55 primary Chromium rendered suites with 653 screenshots, CodeQL, WebKit cross-engine, Lighthouse performance, Windows Desktop/First Run/Clean Launch all PASS. Main app JS within the unchanged budget (~526.0 KiB raw vs 528.0 KiB limit).
- Downloaded the full `39469572415` rendered artifact and directly inspected selected desktop/tablet/mobile Light/Dark Credit, Loans, pay-input and persistence-error screenshots, including the final opaque `credit-rate-save-failure-mobile.png`, rate editor tablet/dialog and exact EUR-cent contextual payment. No relevant overlap, clipped controls, unreadable text or unexpected transparent dialog at its settled state.
- #10 verified editable actual EUR cents per loan payment with independent linked event, frozen legacy paid baseline after preset edit, and no automatic amortization/rate changes. #11 verified manual effective-date nominal rates with as-of version history, revisioned finance persistence/server validation, non-posting advisory payoff scenario, failed-save/duplicate checks and no retrospective card transactions or statements rewritten.
- #588 acceptance checklist now marks **#10 and #11 plus all four subitems completed**: **Implementations 2/12 completed · Sub-implementations 4/24 completed**. Independent remaining roadmap features remain unchecked.
- This final **checkpoint-only commit** is an intentional metadata reconciliation. Required PR checks must still be green on the new exact head before squash merge to `develop`; verify `develop` SHA and any postmerge gates. No `main`/Production or Android changes. The roadmap Final 216-image Visual QA remains a final roadmap/release boundary.
- **Stop after Batch A merge**; do not begin Batch B until the next explicit owner «Συνέχισε». Planned Batch B features #4/#5/#12 then #2 require a shared finance-contract design before editing.

## Safety/risks
- No Production/main or Android changes. No bank Excel/CSV import, auto Euribor, loan amortization engine or auto interest entries.
- No local git checkout was available in this agent runtime (network DNS to GitHub blocked). Consequently source-anchor verification is **not equivalent to executing tests**. Required CI/rendered acceptance remains a hard gate; do not merge beforehand.
- Old Production Card Vault recoverable key escrow and owner authenticated AAL2 live test remain independent unresolved Production release prerequisites, not Batch A development blockers.
