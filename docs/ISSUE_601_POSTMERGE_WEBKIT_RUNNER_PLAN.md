# #601 postmerge WebKit runner stability — 2026-10-23

## Scope and evidence
- Parent taxonomy implementation PR #600 was validated and squash-merged as `ff095d17bb0226021464b5433ced1eb0bd819ca3` into `develop`. **Implementations 4/4 completed · Sub-implementations 8/8 completed** in taxonomy task plan; these numbers are unchanged by this CI-only follow-up.
- The postmerge push CI [#39926650146](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/39926650146) was cancelled twice (attempts 1 and 2) because **WebKit dependency installation never finished within the 20-minute job timeout**. Runner logs show `ubuntu-latest` now assigned **Ubuntu 26.04.1**, with `apt` stuck pulling large packages from `azure.archive.ubuntu.com`; **no actual WebKit smoke assertion failed or ran**. Each attempt had green validate/visual, CodeQL, Lighthouse, and three Windows gates; Unified required gate correctly failed closed on cancelled WebKit.
- Independent full CI [#39924312792](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/39924312792) had a successful WebKit run on the same pinned Playwright 1.62.1 driver before the mirror slowdown. GitHub's October/November 2026 `ubuntu-latest` migration guide explicitly supports pinning `ubuntu-24.04` when not ready for 26.04.

## Bounded remedy
- Workflow owner: `.github/workflows/cross-engine-smoke.yml`. Pin **only the WebKit reusable job** to `ubuntu-24.04` LTS, leaving all other CI environments, drivers, `install --with-deps webkit`, executable smoke, screenshots, and the strict 20-minute timeout unchanged.
- Regression lock: `tests/workflow-optimization-source.test.ts` asserts stable WebKit runner plus real dependency install and original Playwright pin.
- No changes to finance code, database, category contracts, security, historical data, production branch, or Android.

## Validation and integration
- Implement the small CI-only patch on `fix/601-webkit-stable-ubuntu-runner` from current `develop`; open draft PR referencing #601; run draft validate/CodeQL preflight.
- Mark Ready only when draft validation is successful; run exact ready-head full CI incl. real WebKit smoke + Unified gate, Lighthouse, Windows, CodeQL, and inspect smoke evidence. Do not relax checks or claim PASS for unrun checks.
- If the review head passes, squash-merge to `develop` preserving concurrent changes, then inspect develop push CI. If GitHub runner or mirror still fails, inspect root cause rather than repeatedly retrying indefinitely.

## Production boundary
Taxonomy is **not active in Supabase**. Last confirmed state at 2026-10-23: revision 465, 18 expense/6 income. Production release and owner-authorized protected activation remain separate and cannot be inferred from CI or develop merge.
