# Issue #588 — Batch A working checkpoint (2026-10-20)

Source of truth: [approved plan #588](https://github.com/MariosGiannakaras/MyFinHub/issues/588). Branch `feat/588-loans-credit-history`, based on `develop@f08cdf1e18060acf4b3733775bc1d1af04425e4b`. Review exact live branch head and CI before further writes.

**Current accepted progress: Implementations 0/12 completed · Sub-implementations 0/24 completed.** Feature code is present, but acceptance remains pending real test/rendered/CI evidence. Do not pre-check work based on source changes alone.

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

## Remaining acceptance of Batch A
- Run focused tests for `tests/loans.test.ts`, `tests/reports.test.ts`, `tests/credit-rates.test.ts`, server card validation and existing affected card/finance tests.
- Verify TypeScript/build, security/defect preflight, normal coherent Ready-for-Review CI and rendered mobile/tablet/desktop Light/Dark UI (including card rate modal, payoff input and loan payment modal), QA evidence inspection, history/Do→Undo→Redo and failed-save semantics.
- Inspect any CI failures as one set, correct root causes, rerun exact-head acceptance. Do not report PASS for pending/untested gates.
- On full acceptance update the checkbox progress for #10, #11 (and any other finished items) in issue #588; only then mark `Implementations 2/12 completed · Sub-implementations 4/24 completed` if *all four* sub-items are actually proven.
- Stop after Batch A, even if later work is unblocked; wait for explicit owner «Συνέχισε». Next approved Batch B: #4/#5/#12 then #2 after finance-contract planning and review.

## Safety/risks
- No Production/main or Android changes. No bank Excel/CSV import, auto Euribor, loan amortization engine or auto interest entries.
- No local git checkout was available in this agent runtime (network DNS to GitHub blocked). Consequently source-anchor verification is **not equivalent to executing tests**. Required CI/rendered acceptance remains a hard gate; do not merge beforehand.
- Old Production Card Vault recoverable key escrow and owner authenticated AAL2 live test remain independent unresolved Production release prerequisites, not Batch A development blockers.
