# Unified CI orchestration — 2026-10-21

Owner instruction: «Φτιάξτο» in response to proposal for one MyFinHub CI pipeline.
Baseline: `develop@5b58d3f26e25ade08157c9099b820f46c61df5b2`.
Owner branch: `chore/598-unified-ci-workflow`. Independent of Dashboard PR #595 and roadmap #588 PRs.

## Implementation — 1 implementation, 6 sub-implementations
- [x] One standard `CI` workflow on PRs targeting develop/main and on develop/main pushes, retaining the existing core tests, type checks, security audits, full rendered QA and bundle limits.
- [x] CodeQL remains a real security-scanning job in unified CI; preserve independent scheduled weekly scan and native CodeQL security upload permissions.
- [x] Reuse exact existing WebKit and Lighthouse jobs in parallel; no weakened browser/performance thresholds or redundant PR/push workflow executions.
- [x] Reuse existing Windows installer/package smoke and dedicated first-run/clean-launch contracts; retain explicit manual/tag release controls and their existing safety boundaries.
- [x] Final 216-image QA is a gated opt-in job after all required checks; upload screenshot artifact, **never auto-commit screenshots**, avoid duplicate CI cycles; preserve optional manual release visual inspection.
- [x] A single fail-closed aggregated `CI / gate` result across all required jobs, correct draft behavior, concurrency cancellation and explicit PR/manual dispatch semantics. Adjust genuine workflow-contract tests and guidance.
## Independent validation / integration acceptance (not counted as coding progress)
- [ ] Targeted source/YAML contract validation, final coherent GitHub CI CodeQL/WebKit/Windows/performance and direct logs/artifact review; record final active head and migration advice for required branch-protection contexts.
- [ ] GitHub's protected CodeQL code-scanning merge rule recognizes the separate direct PR scan on the current Ready-for-Review head.
- [ ] Squash-merge protected PR #599 to latest `develop` and verify the resulting integration SHA and unified develop CI.

## Constraints and architecture
- Reuse workflow files via `on: workflow_call` and `jobs.<name>.uses`; do not copy 300-line Windows commands or Lighthouse thresholds.
- Do not add secrets or expose financial/card data. Preserve published installer tag `myfinhub-v*` with deliberate main ancestry checks, never publish on PR.
- CI must not automatically mutate source control or create new commits via QA.
- Preserve scheduled CodeQL and explicit manual emergency workflows. **Enforced security-rule compatibility:** retain a direct PR CodeQL scan in addition to the unified nested CodeQL job until GitHub's protected code-scanning ruleset recognizes the reusable scan. Do not disable or bypass the security rule.
- Draft PRs retain quick source/security checks; expensive browser, Windows and performance jobs defer until Ready. Strict final aggregate must reject failures/cancellations for required non-skipped jobs.
- This is **not** approval to merge Dashboard PR #595, promote main, deploy to production, or touch Android.

Task: GitHub issue #598. Source branch was initially staged under `feat/unified-ci-workflow-20261021`; implementation ownership transferred to the issue-numbered branch before PR creation. Do not open a second implementation PR for the staging branch.

## Live status — owner progress-reporting correction (2026-10-21)
**Implementations 1/1 implemented · Sub-implementations 6/6 implemented.**
The implementation checkboxes above represent code/configuration, not whether GitHub has permitted the merge. Do not revert these counters to 0 when CI is pending or fails; reopen an individual item only when evidence identifies a real implementation defect.

- **Validation/CI:** original full Ready unified matrix [#39662037883](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/39662037883) PASS across core, nested CodeQL, WebKit, Lighthouse, three Windows jobs and aggregate. Original merge attempt was blocked by an **additional existing GitHub code-scanning rule** expecting a direct PR CodeQL analysis. Reinstated that independent required scan without weakening security. Draft-head CodeQL [#39664953983](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/39664953983) and unified CI [#39664954261](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/39664954261) both passed for `4ce396e`; a current-head Ready matrix still needs to run after documentation updates. Never treat earlier-head checks as current-head evidence.
- **Integration/merge:** PR #599 remains open, targeting `develop`, not merged; branch protections remain enforced.
- **Production/release:** no `main` promotion, tag, installer publication, or deployment.
- **Next action:** on coherent current head, complete Ready-for-Review unified CI and separate direct CodeQL scan, verify the protected code-scanning rule is satisfied, then squash-merge to `develop` and verify its unified integration CI. Do not bypass the rule.


## Current-develop merge-rule revalidation — 2026-10-21

- Owner-approved implementation remains complete: **Implementations 1/1 implemented · Sub-implementations 6/6 implemented**. All required Ready jobs and direct CodeQL scan passed on original exact head `869fd38b7a3e660435b964c3bfb923e3d33893cf`: unified CI run [39665766031](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/39665766031) and direct CodeQL [39665638886](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/39665638886).
- An authorized squash-merge attempt targeting `develop` was rejected by GitHub HTTP **405**, explicitly: `Required status check "validate" is expected.` No branch protection was bypassed; nothing merged. Meanwhile independent #597 had moved `develop` from `5b58d3f2` to `eb210dfb`. Old-head success does not satisfy an outstanding synthetic merge-ref requirement on the new integration base.
- This checkpoint commit refreshes the PR head for **current-develop Ready checks**, without modifying completed workflow behavior. Review the new head's unified `validate`, direct security CodeQL, WebKit, Lighthouse, Windows and fail-closed gate, and ensure GitHub accepts the protected `validate` context before attempting an expected-head squash merge. If still blocked, inspect the exact ruleset-reported context rather than lowering or bypassing protection.
- Do not mark integration acceptance complete until the merge succeeds and the new `develop` SHA receives its own successful CI. No `main`, production deployment or Android changes.
