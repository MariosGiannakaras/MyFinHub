# Historical defect-mining evidence report — #533

## Scope and reproducibility (snapshot 2026-10-08)

This is a **read-only inventory of the available MyFinHub GitHub history**, not a claim to have opened and diagnosed every CI log or personally verified every historical bug. The machine-readable snapshots in `quality/historical-mining/` are evidence inventories, not executable instructions or production data.

| Current GitHub object | Enumerated | Scope and qualification |
| --- | ---: | --- |
| Issues, excluding PR-shaped issue entries | 218 | All returned pages of `issues?state=all`; 213 closed, 5 open at enumeration |
| Pull requests | 321 | All returned pages of `pulls?state=all`; 255 merged, 57 closed without merge, 9 open |
| Surviving branch refs | 16 | `branches` API at snapshot only; deleted historical branches are **not** discoverable from this endpoint |
| Failed Actions runs, 2026-08-01–31 | 859 | 581 distinct commit SHAs |
| Failed Actions runs, 2026-09-01–30 | 1,511 | 703 distinct commit SHAs; date-window sharding required |
| Failed Actions runs, 2026-10-01–08 | 354 | 237 distinct commit SHAs; **month in progress**, count changes with time |
| **Failed runs retrieved** | **2,724** | Failed **workflow executions**, not 2,724 distinct failures/root causes or bugs |

The GitHub Actions endpoint returns only the first 1,000 results of a broad search, even if `total_count` reports more. An unsharded September query misleadingly reported 1,511 but pages after the first ten returned no runs. The inventory therefore splits September into five non-overlapping date windows, each below 1,000 matching runs. Per-month JSON snapshots include the query, shard counts, completeness status, representative URLs and grouping by workflow/day/branch. Sampled logs are not reproduced verbatim and private payloads/secrets are not collected.

Before August 2026, dated queries returned zero retained runs for the selected 2025-01–2026-07 range; this establishes **API visibility**, not proof that older runs never existed. Historical/deleted refs, deleted/expired log contents and outside-GitHub incident knowledge may be unrecoverable. PRs and issues share a global number space: GitHub's issues endpoint contains PR-shaped records; they were excluded from the **218** issue count to avoid double-counting. Superseded/duplicate PRs are counted separately in PR inventory but are not independent defect classes.

## Broad failure distribution

| Workflow | August | September | October through 08 |
| --- | ---: | ---: | ---: |
| Core CI | 472 | 488 | 214 |
| Visual QA Snapshots | 123 | 170 | — |
| Windows Desktop | 83 | 197 | 22 |
| Performance smoke | 65 | 273 | 15 |
| Cross-engine smoke | 33 | 133 | 13 |
| Windows Clean Launch | 18 | 114 | 16 |
| CodeQL | 12 | 95 | 15 |
| Real Stack E2E | — | — | 25 |

The remainder includes additional or legacy workflows; see the source JSON for complete per-workflow counts. These counts cannot be converted into defect recurrence or failure rate without the successful/cancelled denominator, job-step correlation and accepted-fix provenance. Branch concentrations reflect churn, not developer or surface quality rankings. The project had 16 live branch refs when inventoried; prior branch names embedded in runs/PRs are not proof those refs still exist.

## Failure-step sampling — explicitly **not** population-wide root-cause estimates

Read-only sampled jobs and available log excerpts from August, September and October:

| Run | Observed failure | Evidence status |
| --- | --- | --- |
| [31996713321](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/31996713321) | TS1005 missing brace in `useFinance.ts`; core CI check | Confirmed compilation failure on that old head; not a novel reusable pattern |
| [32130127644](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/32130127644) | Rendered frontend QA could not find clickable recurring navigation | Candidate; check associated UI branch/fix before treating as product regression |
| [96138855316](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/32274578426) | Old source assertion expected an image asset size greater than 20,000 bytes | Candidate obsolete/brittle assertion; not confirmed product bug |
| [33475615497](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/33475615497) | Loading-shift audit reported Transactions CLS 0.473 against 0.10 limit | Measured historic rendered failure, not confirmed fix/root cause |
| [33793997810](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/33793997810) | Playwright/WebKit driver install step failed | CI environment/toolchain candidate, not necessarily app regression |
| [33959763157](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/33959763157) | Visual snapshot job ended with missing Chromium context | Browser harness/teardown candidate; underlying trigger not yet proven |
| [34062658674](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/34062658674) | Eager CSS raw bundle 240.2 KiB exceeded 240.0 KiB budget | Real contract failure on historical head; never increase budget merely to pass |
| [36800462067](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/36800462067) | Deferred Dashboard chart readiness timeout during rendered QA | UI async-state or harness candidate; root owner not yet proven |
| [36855771954](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/36855771954) | Frontend bundle budget failed before Windows packaging | Existing budget gate already protects this category |
| [36984615107](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/36984615107) | Final Visual QA screenshot persistence step failed | Candidate until job output/follow-up history determines root cause |

This is a bounded **illustrative** sample, not a random/statistically representative survey. Do not extrapolate category frequencies from it. Cancellation, superseded PRs, draft-skipped heavy workflows and dependency-bot failures have distinct semantics and must not count as application defects.

## Correlating fixed root causes

Examples of accepted, documented root causes supported by historical issues/PRs and **existing current regression checks**:

- [#225](https://github.com/MariosGiannakaras/MyFinHub/issues/225) → migration silently dropped persisted category trees → `tests/product-migration-category-trees.test.ts`.
- [#204](https://github.com/MariosGiannakaras/MyFinHub/issues/204) / [PR #215](https://github.com/MariosGiannakaras/MyFinHub/pull/215) → ESM Windows backend bundle lacked CommonJS `createRequire` bridge; startup smoke previously checked only Electron, not its backend → `tests/desktop-first-run-source.test.ts` and Windows packaged-host smoke.
- [PR #317](https://github.com/MariosGiannakaras/MyFinHub/pull/317) → PL/pgSQL output-field ambiguity broke initial metadata UPSERT → `tests/account-metadata.test.ts`.
- [PR #287](https://github.com/MariosGiannakaras/MyFinHub/pull/287) → durable-history audit action constraint omitted undo/redo → `tests/durable-history-source.test.ts`.
- [PR #352](https://github.com/MariosGiannakaras/MyFinHub/pull/352) → 13th Vercel serverless function exceeded hosting plan's 12-function limit → `tests/vercel-function-budget.test.ts`.
- [PR #497](https://github.com/MariosGiannakaras/MyFinHub/pull/497) → local Vite API proxy omitted browser-facing forwarded host, causing legitimate `ORIGIN_MISMATCH` without relaxing same-origin enforcement → `tests/security.test.ts`.
- [#29](https://github.com/MariosGiannakaras/MyFinHub/issues/29) → editing a linked loan payment dropped its `loanId` → `tests/loans.test.ts`.

All historical notes and regression tests must be reconciled against the **current** `develop` source before pattern acceptance. A source issue/PR is evidence of the diagnosis; the guard verifies the invariant remains enforced. No historical branch is merged or reused as a code baseline.

## Next prevention actions

1. Promote only confirmed independent root causes with existing tested guards into `quality/defect-patterns.json`; allow actual `/pull/` evidence links rather than fabricating an `/issues/` source URL.
2. Keep unproven renderer/browser tooling, CSS budget, assertion brittleness and old standalone CI logs in an explicit candidate queue with state and follow-up needed; avoid speculative diagnosis.
3. Add an optional, read-only rate-bounded live GitHub collector whose coverage output automatically reveals the 1,000-result cap and supports date-window splitting. Never make network calls part of routine `npm run check` or `CI`.
4. Treat this report as a snapshot. New runs and PRs will change the visible population; subsequent analyses must record their own timestamp/window and reconcile metadata instead of overwriting claims about this snapshot.

## Safety

No private financial records, Supabase secrets, card data, CI raw logs, Android commits, live database mutations, unreviewed production releases or history rewrites are included.
