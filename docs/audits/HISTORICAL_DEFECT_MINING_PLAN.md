# Historical defect mining — #533

Baseline: `develop` at `b71e9d3a27a4931df75f75802defcc2807676809`.
Branch: `chore/533-historical-defect-mining`; PR to `develop`.
The latest version of this checkpoint, rather than a stale chat summary, controls accepted progress.

**Implementations 4/4 completed · Sub-implementations 16/16 completed**

## 1. Historical inventory and limits — 4/4
- [x] HM-01 Inventory historical issues and PRs, excluding PRs from issue counts.
- [x] HM-02 Stratify failed Actions runs by month/date; distinguish cancelled/skipped/failed.
- [x] HM-03 Link representative committed fixes, issue evidence and surviving branch lineage.
- [x] HM-04 Document provenance/coverage gaps, retention, historical API and sample limitations.

## 2. Evidence-based learning — 4/4
- [x] HM-05 Review root-cause-bearing incident families beyond FP-001–004.
- [x] HM-06 Verify current owning paths and narrow regression guards against develop.
- [x] HM-07 Add only confirmed nonduplicate classes to defect registry.
- [x] HM-08 Separate investigation candidates/flakes/obsolete tests from confirmed cases.

## 3. Reproducible mining pipeline — 4/4
- [x] HM-09 Read-only paginated/rate-bounded GitHub API inventory with token scoped to repo.
- [x] HM-10 Consistent filtering/dedup/grouping, explicit partial coverage and provenance.
- [x] HM-11 Bounded JSON and text reports, dry-run safety, no unchecked log/secret capture.
- [x] HM-12 Deterministic unit fixtures covering windows/pages/partial/rate limits/grouping.

## 4. Integration and acceptance — 4/4
- [x] HM-13 Add documented opt-in collector command without network dependency in routine CI.
- [x] HM-14 Add or reuse the cheapest relevant regression locks for learned classes; no threshold relaxation.
- [x] HM-15 Run targeted, hygiene, build and applicable CI and review real outcomes.
- [x] HM-16 Open scoped PR and durable checkpoint for any remaining exact-head gates.

## Safety and workflow
- This is a **separate learning/workflow** from the active #519/#528/#529/#532 UI remediation and PR #518 Windows launcher. No speculative changes in their files.
- No Android modifications, database writes, release, production changes, financial data or credentials in reports.
- Historical API availability/retention and issue body language are not proof of full-archive coverage. Only confirmed causes and functioning guards enter the accepted registry. Candidate queue is not a bug ledger.
- Expensive CI only on the final coherent review head; never merge with failing/pending gates.

## Integration synchronization checkpoint — exact-head review revalidation pending

**Implementations 4/4 completed · Sub-implementations 16/16 completed.**

- The previously green PR head `9afed180d710fda7ec30696118450ac59d216a91` was behind `develop` because independent PR #534 changed only `scripts/bundle-budget.mjs` and `tests/release-readiness-source.test.ts` on integration head `8b74f261f6e6e36eb71258ec3f7946103f15f9c3`.
- Reconcile all 18 changed historical-mining files by exact blob SHA onto that newer `develop` tree; preserve both newer CSS budget files unchanged. Use a force-with-lease ref update on this owned implementation branch only, with expected previous HEAD `9afed180d710fda7ec30696118450ac59d216a91`, rather than introducing a merge commit.
- All required final-head gates passed for the preceding head, but **must be repeated and inspected** for the new linear integration head. No merge with pending or failing checks.
- Latest historical snapshot: 218 issues, 321 PRs, 16 visible branches and 2,724 Actions failures (859 Aug, 1,511 Sep, 354 Oct 1–8). Registry FP-001–FP-020, 21 focused guards; candidate incidents are not confirmed bugs.
- PR [#537](https://github.com/MariosGiannakaras/MyFinHub/pull/537) targets `develop`. After new CI/CodeQL/Real Stack E2E/browser/performance/Windows gates are green on exact PR HEAD, verify updated base and mergeability and perform policy-compliant squash merge to `develop`.
- No Android, release, production deployment, finance data or database mutation.
