# Historical failure evidence intake — 2026-10-08

Issue: #533. This is an **evidence / method record**, not a complete list of product defects. The accepted failure-class registry remains `quality/defect-patterns.json`.

## Audited GitHub population

- GitHub Issues API, state=all, six 100-item pages through the end: **218 actual issues** (exclude entries returned by the issues endpoint that have a `pull_request` field). Four issues were open in the observed population; issue #533 is included.
- GitHub PR API, state=closed, four pages through the end: **311 closed PR records**, some superseded/closed without merge. **Four additional PRs were open** in the separate live-state check (#518/#528/#529/#532); closed does not imply merged.
- Current branches endpoint: **11 surviving named branches** at observation time; deleted historical branches cannot be recovered from this endpoint. The underlying commit history, issues and PR head references can still contain their evidence.
- Actions runs API initially reported more than **20,000 total runs**; a single status/month query may report 2,500 matches while pagination exposes only the most recent 1,000. To avoid this, historical failed-run metadata was gathered in **disjoint weekly windows** with at most 728 matches per window and all returned pages retrieved, deduplicated by workflow-run ID.
- Search of windows before August 2026 returned no failed runs. These results cover **2026-08-01 through 2026-10-08** as available at the observation instant. GitHub may expire logs/runs; this is not a claim about events that are no longer available.

| Period | `failure`-status Actions runs | Collection |
| --- | ---: | --- |
| 2026-08-01–31 | 859 | 9 pages of 100 |
| 2026-09-01–07 | 728 | 8 pages |
| 2026-09-08–14 | 177 | 2 pages |
| 2026-09-15–21 | 33 | 1 page |
| 2026-09-22–28 | 273 | 3 pages |
| 2026-09-29–30 | 300 | 3 pages |
| 2026-10-01–08 | 342 | 4 pages |
| **Total** | **2,712** | **30 paginated requests** |

These are **failed workflow runs, not 2,712 unique defects**. Several workflows can fail for the same commit, and multiple pushes can reproduce the same root cause. The status filter excludes cancelled/skipped/successful runs. August had 581 unique failing commit heads; September was collected in smaller windows to avoid GitHub's 1,000-item pagination cap. No body of raw job logs, financial data or credentials is copied here.

### Workflow families most often reported as failed

| Workflow | Failed runs (above window collection) |
| --- | ---: |
| CI | 1,162 |
| Performance smoke | 353 |
| Windows Desktop | 302 |
| Visual QA Snapshots | 293 |
| Cross-engine smoke | 179 |
| Windows Clean Launch | 148 |
| CodeQL | 122 |
| Windows First Run | 49 |
| Real Stack E2E | 25 |
| Other/temporary workflows | 79 |

Workflow name is only a **triage dimension**. It cannot establish a root cause, recurrence count of a bug, or remediation status. Some temporary one-shot workflows and repeated visual snapshot runs are not present-day release gates. Job-step information and original incident/fix PRs are necessary before a historical run can be promoted to a confirmed class.

## Cross-linked confirmed incident examples for curating additional prevention patterns

| Issue/PR | Verified root-cause evidence | Existing focused guard |
| --- | --- | --- |
| [#204](https://github.com/MariosGiannakaras/MyFinHub/issues/204) / PR #215 | Windows first-run ESM backend bundle lacked CommonJS `require` bridge; host-only liveness smoke falsely passed | `tests/desktop-first-run-source.test.ts` |
| [#225](https://github.com/MariosGiannakaras/MyFinHub/issues/225) / PR #243 | Schema-v3 migration discarded saved category trees | `tests/product-migration-category-trees.test.ts` |
| [#317](https://github.com/MariosGiannakaras/MyFinHub/issues/317) | PL/pgSQL output-column ambiguity prevented first account-metadata upsert | `tests/account-metadata.test.ts` |
| [#287](https://github.com/MariosGiannakaras/MyFinHub/issues/287) / #286 | Audit-log action constraint did not permit undo/redo used by durable history | `tests/durable-history-source.test.ts` |
| [#9](https://github.com/MariosGiannakaras/MyFinHub/issues/9) / PR #10 | Vercel Node-function TypeScript pipeline incompatible with root TS project references | `api/tsconfig.json` plus API check; verify a true local automated guard before accepting |
| [#16](https://github.com/MariosGiannakaras/MyFinHub/issues/16) | Transient Supabase upstream failure misclassified as revoked credentials/session | `tests/auth-resilience.test.ts` |
| [#18](https://github.com/MariosGiannakaras/MyFinHub/issues/18) | Import/save document limit larger than Vercel body budget; nested validation gaps | `tests/settings-data-source.test.ts`, `tests/semantic-validation.test.ts` (partial; inspect before promotion) |
| [#29](https://github.com/MariosGiannakaras/MyFinHub/issues/29) | Editing a loan-linked payment dropped `loanId` | `tests/loans.test.ts` |
| [#30](https://github.com/MariosGiannakaras/MyFinHub/issues/30) | Latest snapshot chosen by array order, duplicate lending keys overwritten | `tests/derived-finance.test.ts` |
| [#47](https://github.com/MariosGiannakaras/MyFinHub/issues/47) | Raw recurring seed ignored overrides; truthy defaults overwrote valid zero settings | `tests/ui.test.ts` |
| [#26](https://github.com/MariosGiannakaras/MyFinHub/issues/26) | App-level TODAY constant stayed stale after midnight | `tests/local-date.test.ts` |
| [#142](https://github.com/MariosGiannakaras/MyFinHub/issues/142) | Production smoke asserted obsolete health app name after rebrand | Review smoke source + existing guard before promotion |
| [#497](https://github.com/MariosGiannakaras/MyFinHub/pull/497) | Vite proxy forwarded upstream Host, causing 403 same-origin mismatch on local login | `tests/security.test.ts` |
| [#352](https://github.com/MariosGiannakaras/MyFinHub/pull/352) | Production serverless function count exceeded the plan limit | `tests/vercel-function-budget.test.ts` |

The originating issues/PRs preserve their own diagnosis and resolution; this document is just the bounded cross-domain learning index. Evidence of a single incident is not proof that the same problem recurred in the workflow tally.

## Candidate queue — not accepted as root-cause patterns

| Candidate | Evidence | What is missing |
| --- | --- | --- |
| Recent Cards shared-button failures | [PR #529](https://github.com/MariosGiannakaras/MyFinHub/pull/529), run [37758402959](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/37758402959) | Differentiate real generic-button regression from brittle exact-component-count test; owned by the active Cards branch |
| August visual-snapshot failure cluster | Visual QA Snapshots (123 failed runs) | Per-job logs and reviewed PR cause; old snapshot commits were sometimes emitted by Actions themselves, so run count is not bug count |
| September recurring performance/Windows failures | Performance smoke (273) / Windows Desktop (197) failures during September | Break down root causes, platform/runner noise and repeated changed heads; no automatic test/threshold relaxation |
| Old PRs replaced without code change | Superseded PR #338/#339, #335/#336, #325/#328, #330/#331 | Administrative connector/review-ready or generated-screenshot Git head issues do not justify a new product regression pattern without a reproducible guard |
| Short-lived one-shot deployment/update workflows | August temporary workflows in failed-run population | Not current production gates; diagnose by surviving incident/PR before treating as reusable prevention |

## Reproducible extension

Use the optional offline-safe historian under `scripts/historical-defect-miner.mjs`, with read-only GitHub repo Actions metadata, explicit date bounds, automatic window splitting and request limits. The output groups workflow/commit metadata as **candidates**, not confirmed bugs. Do not upload raw action logs. Investigate the highest-impact groups via originating PR/issue/fix diff; curate a new FP registry entry only once root cause and practical narrow guard are verified.
