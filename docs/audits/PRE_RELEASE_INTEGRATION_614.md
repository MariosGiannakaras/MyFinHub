# Consolidated final pre-release finance fixes — #608, #610, #612
Date 2026-10-23. Current integration baseline `develop@b7bccaea26ec82d31d66b2ef57f12df1acb65bfb`; no production release.
## Scoped ownership
This branch integrates **only** three disjoint accepted domain/test deltas from previously active PRs #609, #611 and #613, onto newest protected develop, which already contains #607. Source work remains tracked in #608/#610/#612 and per-branch audit plans. No unrelated branch, migration or Android changes.
- [x] OCR selected-grant-total currency and foreign-value guard + unit tests (from #609)
- [x] Date-reconciled imported receivable source for as-of Lending and netWorth + unit tests (from #611)
- [x] No arithmetic saturation of savings-goal scenario cents + unit tests (from #613)
- [x] Additional verified #615 budget semantic contracts: real future-month recurring cadence, independent obligations with identical labels, exclusion of variable estimates from known exact due amounts; protected linked-payment suppression + focused tests
## Acceptance/validation
- [ ] Draft exact-head source CI (hygiene/TS/unit/source/security) green
- [ ] One coherent Ready full CI (rendered browser/WebKit/Lighthouse/Windows/CodeQL) green at exact integration PR head
- [ ] Protected merge to newest develop, then develop push CI validated
- [ ] Release branch #605 delta-only reconciliation with original main ancestry; final new exact-head release CI. Production promotion/deploy is separate owner decision.
## Known warnings/boundaries
#611's prior full Lighthouse median mobile Dashboard LCP 5,573 ms exceeded unchanged hard 5,500 ms by 73 ms, while unmodified develop CI measured 5,263 ms. Do not weaken thresholds or assume this is a false alarm. #609 full matrix is success only at its older develop base; branch protection correctly refuses that stale PR. #613 old full matrix canceled WebKit; its draft code/security passed.
Financial-history source data is never altered or silently inferred; when an imported lending timeline cannot reconcile, original snapshot is preserved. All changes advisory or future-facing, no new writes.
#588: **Implementations 12/12 completed · Sub-implementations 24/24 completed**; #601: **Implementations 4/4 completed · Sub-implementations 8/8 completed**. New fixes not yet accepted until green integration.

## Additional audit finding #615 (scope updated before Ready)
The initial #614 draft CI was green at its prior head. The owner-approved forecast source-identity contract specifically forbids heuristic deduplication of independently created Scheduled and Recurring obligations; previously budgets hid equal-looking entries without an explicit link. Budget forecasts also examined only the first next recurrence after today, hiding later selected-month obligations, and misrepresented variable estimates as known exact due. Corrected at the canonical budget module using the already reviewed recurring cadence. No posted finance values or database schema changed. New source CI must pass at the revised head before full Ready; preserve unmodified quality gates.
