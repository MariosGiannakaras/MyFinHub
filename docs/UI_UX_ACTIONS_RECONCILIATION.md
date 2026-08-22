# PR #159 GitHub Actions reconciliation

Tracking: issue #163 · PR #159 · branch `feat/ui-ux-hardening-batch`

This record reconciles the failed/cancelled Actions runs that are recoverable from PR #159, issues #158/#160/#162/#163, commit-associated workflow results and retained job logs. It exists because historical red entries must be distinguished from unresolved current-head defects.

The connected GitHub interface used for this audit does not expose a repository-wide paginated Actions dashboard endpoint. Therefore this document does not claim an independently enumerated list of every historical run in repository history; it records every PR #159 failure/cancellation that could be resolved from the durable project history and the commit-associated runs inspected during the final reconciliation.

## Classification rules

- `superseded-fixed` — the run exposed a test/application/QA defect that was fixed on a later commit and verified by a later green run.
- `infra/bootstrap` — the application assertions were not the cause; browser/runner/workflow bootstrap failed or was unstable.
- `cancelled-by-newer-head` — concurrency cancelled an intermediate run because a newer branch head superseded it.
- `actionable` — a failure still reproduces or remains unresolved on the final candidate head.

Obsolete SHAs are intentionally not rerun merely to turn historical red entries green. Closure is based on a later same-scope successor plus a fully green final candidate head.

## Reconciled failed/cancelled runs

| Workflow / run | Head | Classification | What failed | Resolution / successor evidence |
| --- | --- | --- | --- | --- |
| temporary foundations bootstrap `32350030547` | `155accb2ebede5a9f5969b366f98acb3cd3e9ada` | `infra/bootstrap` / `superseded-fixed` | Temporary `.tmp-ux-foundations-bootstrap.yml` failed before creating any job. It was a branch-bootstrap diagnostic workflow, not a product gate. | Temporary diagnostics were replaced/removed; the normal CI/CodeQL/Windows workflow set later became the durable gate. |
| temporary foundations bootstrap `32350173344` | `4b601d1519404f8719e5f1028430609d434b4928` | `infra/bootstrap` / `superseded-fixed` | Same temporary bootstrap workflow failed with zero jobs. | Temporary diagnostic `32350174856` succeeded on the same head; later durable CI superseded the temporary workflow. |
| temporary foundations bootstrap `32350243157` | `b39c24cae6f9262c9ed300ed119ffa3994764a9f` | `infra/bootstrap` / `superseded-fixed` | Same temporary bootstrap workflow failed with zero jobs while the branch foundations were being established. | Temporary workflow was retired; later checkpoint CI `32398526378` passed the real product gates. |
| CI `32404765760` | `eca32b8749a8e4767c733632c391416796acd81f` | `superseded-fixed` | One brittle source-test assertion was over-escaped; product implementation was not the failure. | Assertion was corrected; subsequent CI passed the source suite and later final heads retained the coverage. |
| CI `32405835440` | `bbdf7f56d6c955ecea43abc51057ea57eca682e0` | `superseded-fixed` + `infra/bootstrap` | Chromium CDP bootstrap timed out for the first frontend suite and Chrome fallback completed that suite; the actual terminal failure was owned-controls QA looking for `Κάρτες` in the mobile More menu even though Cards is a primary mobile-nav item. | Cards navigation QA was fixed. Browser-bootstrap handling was later hardened separately; final enforced-Chromium CI proves no Chrome fallback activation. |
| CI `32455719978` | `c83e76d49d269816aba787827dfc6901772f9669` | `superseded-fixed` | Branding QA sampled the explicit dark-theme asset during its opacity transition and asserted too early. Unit/build and preceding rendered suites passed. | Timing assertion was corrected; Reports/branding implementation CI `32455966062` then passed. |
| CI `32460336318` | `9a96e979f9e9b84a0b615dc3c0c3e3b471501b7a` | `superseded-fixed` | Recovered-surface QA exposed a real same-route Dashboard → Dashboard `PageErrorBoundary` recovery defect. | Recovery ordering was fixed; recovered implementation CI `32461119019` and later final heads passed the scenario. |
| CI `32463531259` | `9fb90d78a900d8b33ad81115459fba12174e50b1` | `cancelled-by-newer-head` | Intermediate Chromium-reliability commit was superseded by the CI-enforcement commit. | Final candidate CI `32463568147` passed the combined implementation. |
| CodeQL `32463531315` | `9fb90d78a900d8b33ad81115459fba12174e50b1` | `cancelled-by-newer-head` | Same intermediate head superseded by a newer commit under workflow concurrency. | Final candidate CodeQL `32463568159` passed. |
| Windows Desktop `32463531270` | `9fb90d78a900d8b33ad81115459fba12174e50b1` | `cancelled-by-newer-head` | Same intermediate head superseded by a newer commit under workflow concurrency. | Final candidate Windows `32463568070` passed. |
| CI `32463549424` | `147ad6edac0f8e6ee23bbbed788624d6db54a196` | `cancelled-by-newer-head` | Intermediate CI-enforcement head was superseded by the source-regression test commit. | Final candidate CI `32463568147` passed. |
| CodeQL `32463549422` | `147ad6edac0f8e6ee23bbbed788624d6db54a196` | `cancelled-by-newer-head` | Intermediate head superseded under workflow concurrency. | Final candidate CodeQL `32463568159` passed. |
| Windows Desktop `32463549464` | `147ad6edac0f8e6ee23bbbed788624d6db54a196` | `cancelled-by-newer-head` | Intermediate head superseded under workflow concurrency. | Final candidate Windows `32463568070` passed. |

A recovered Compact/mobile touch-target regression was also found during the #162 audit and fixed by enforcing an explicit 44px floor on the privacy toggle. Its exact failed-run ID is not recoverable from the retained connector evidence used for this reconciliation, so no run ID is invented here. The behavior is covered by the later green recovered/final browser matrices.

## Chromium/CDP reliability closure

The prior documentation-head CI `32461814613` was green but its first rendered suite timed out waiting for Chromium on fixed CDP port `9222` and succeeded only after the coordinator switched that suite to Google Chrome. Because the original checklist explicitly required Chromium QA, issue #163 did not accept that as the final proof.

The final reliability implementation adds:

- an isolated primary-browser preflight using Chromium with `--remote-debugging-port=0` and `--remote-debugging-address=127.0.0.1`;
- `DevToolsActivePort` discovery instead of assuming a fixed preflight port;
- isolated user-data profiles, safe first-run/headless flags and `/dev/shm` mitigation;
- captured browser stderr/process-exit diagnostics when CDP does not become ready;
- one same-browser retry for recognized bootstrap failures before fallback is even considered;
- `MYFINHUB_QA_REQUIRE_PRIMARY=1` in pull-request CI, which disables Google Chrome fallback entirely;
- regression tests that lock the primary-browser enforcement and bootstrap-only retry policy.

Candidate head `bdad5e26c33b37535ccaffc9495c426989692495` was verified by PR merge ref `23bb09db1c31699623353ee1668ba1bfbc41aa97`:

- CI `32463568147`: **success**;
- privacy/security guard passed across **257 tracked files**;
- **35 test files / 157 tests passed**;
- production TypeScript/Vite build passed;
- API TypeScript check passed;
- CI identified Chromium `151.0.7922.0` as the enforced primary and explicitly reported installed Google Chrome as disabled for CI;
- the first cold-start preflight attempt did not expose CDP within 20 seconds and emitted only runner/DBus diagnostics; a second **Chromium** preflight succeeded on dynamic port `35861`;
- every product rendered suite then completed on primary Chromium;
- final coordinator summary: `Primary bootstrap retries: 0; fallback activations: 0`;
- screenshot artifact `9439901562`: **59 PNG files**, GitHub artifact SHA-256 `0994b685504828b6f16669514f4a459f548263089d5cedd7d02e509c776bc7ea`;
- CodeQL `32463568159`: **success**;
- Windows Desktop `32463568070`: **success** — application/desktop boundary, PowerShell fallback, unpacked Windows build, packaged executable/backend smoke, interactive NSIS Setup, checksum and evidence passed; release publication was correctly skipped.

The cold-start preflight retry is classified as contained runner/browser bootstrap behavior: it occurs before product suites, captures diagnostics, stays on Chromium, and cannot convert a product assertion into a retry. The acceptance criterion for #163 is met because all product rendered suites completed on enforced primary Chromium with zero fallback activations.

## Visual evidence audit

The 59-image candidate artifact was independently downloaded and its ZIP SHA-256 matched the GitHub Actions digest exactly. Contact-sheet review covered all screenshots, followed by full-resolution inspection of high-risk states including:

- credit-card utilization at 135%;
- restructured Reports on narrow mobile;
- mobile Settings and Transactions owned controls;
- recovered PageError focus/recovery surface;
- in-place Reports refresh skeleton;
- branding and responsive shell states.

No new clipping, horizontal overflow, unintended overlap, broken responsive state or visual artifact was found. Full-page mobile captures may show the fixed bottom navigation at the viewport capture position; this is the known full-page screenshot behavior and is not a runtime layout regression.

## Current workflow-set interpretation

The branch contains four durable workflow files: `ci.yml`, `codeql.yml`, `desktop-windows.yml`, and `production-smoke.yml`.

`Production Smoke` is not a PR-head gate. It runs from a successful Vercel Production deployment (or manual dispatch), so the existing v1.0.2 production-smoke evidence remains historical production evidence. A fresh Production Smoke is required only after a future owner-approved production release/deployment; running it against unchanged production during PR #159 would not validate the branch.

## Final closure rule

This document itself creates a documentation-only branch head. Technical closure of #163 therefore requires a fresh CI + CodeQL + Windows Desktop cycle on that final documentation head. The final same-head run IDs and artifact digest are recorded in issue #163 and PR #159 after those workflows finish; they are intentionally not back-written into this file because doing so would create an endless new-head/revalidation loop.

No merge, version bump, release, production deployment or installer publication is authorized by this reconciliation.
