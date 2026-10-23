# #588 postmerge Transactions wall-clock QA stability — 2026-10-23

**Workstream:** `fix/588-postmerge-transactions-qa-isolation` off `develop@af7eecc6b77ac11dabb0b94d98fb05ce9f59643f`. No modifications to #596 or #600.

- **Actual failure:** [develop push #39905639986](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/39905639986) attempted twice, with strict Transactions large-data mutation 2,318ms and 2,422ms (requirement **<2,000ms**). All CodeQL/WebKit/Lighthouse/Windows jobs passed. Ready head #594 passed before merge without a product delta.
- **Approach:** the rendered runner previously included `transactions-scanability-qa.mjs` in concurrent Chromium workers (`MYFINHUB_QA_PARALLELISM=2`), despite treating another strict latency suite as resource-isolated. Run Transactions and Large Data latency probes sequentially after concurrent suites drain, without modifying strict thresholds, app code, browser engine, mutation fixture, screenshots, or checks. Add source regression covering both scheduling and unchanged mutation threshold.
- **Remaining:** draft narrow CI/CodeQL, Ready full Chromium/WebKit/Lighthouse/Windows/CodeQL, inspect browser artifacts, protected squash to develop, and develop push CI. If the isolated mutation still exceeds 2s, profile and optimize product render/write hot path; do not weaken thresholds.
- **Roadmap:** Implementations 10/12 completed · Sub-implementations 20/24 completed formally accepted. #13 remains pending successful develop push CI; #9 is independent draft #596. Main/Production/Android untouched.

## Narrow draft unit-test repair — 2026-10-23
- [Draft #602 CI #39916569589](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/39916569589) failed **one out of 1454 unit tests** because pre-existing `reports-large-state-memo-source.test.ts` asserted the old single-entry literal `resourceIsolatedSuites=new Set(['scripts/large-data-boundaries-qa.mjs'])`. The new runner deliberately includes two isolated suites, so the old literal cannot remain; no actual app/performance suite ran on failed draft.
- Repair source test to parse the complete isolated-suite list and require both strict probes. Preserve original strict <5s requirement and parallel-then-isolated scheduling assertions, and preserve new independent regression. No production change, no performance-threshold relaxation.
- Next: fresh draft CI/CodeQL, then Ready complete matrix/visual evidence, squash to develop and verify develop push.
