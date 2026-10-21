# Unified CI orchestration — 2026-10-21

Owner instruction: «Φτιάξτο» in response to proposal for one MyFinHub CI pipeline.
Baseline: `develop@5b58d3f26e25ade08157c9099b820f46c61df5b2`.
Owner branch: `feat/unified-ci-workflow-20261021`. Independent of Dashboard PR #595 and roadmap #588 PRs.

## Acceptance — 1 implementation, 7 sub-implementations
- [ ] One standard `CI` workflow on PRs targeting develop/main and on develop/main pushes, retaining the existing core tests, type checks, security audits, full rendered QA and bundle limits.
- [ ] CodeQL remains a real security-scanning job in unified CI; preserve independent scheduled weekly scan and native CodeQL security upload permissions.
- [ ] Reuse exact existing WebKit and Lighthouse jobs in parallel; no weakened browser/performance thresholds or redundant PR/push workflow executions.
- [ ] Reuse existing Windows installer/package smoke and dedicated first-run/clean-launch contracts; retain explicit manual/tag release controls and their existing safety boundaries.
- [ ] Final 216-image QA is a gated opt-in job after all required checks; upload screenshot artifact, **never auto-commit screenshots**, avoid duplicate CI cycles; preserve optional manual release visual inspection.
- [ ] A single fail-closed aggregated `CI / gate` result across all required jobs, correct draft behavior, concurrency cancellation and explicit PR/manual dispatch semantics. Adjust genuine workflow-contract tests and guidance.
- [ ] Targeted source/YAML contract validation, final coherent GitHub CI CodeQL/WebKit/Windows/performance and direct logs/artifact review; record final active head and migration advice for required branch-protection contexts.

## Constraints and architecture
- Reuse workflow files via `on: workflow_call` and `jobs.<name>.uses`; do not copy 300-line Windows commands or Lighthouse thresholds.
- Do not add secrets or expose financial/card data. Preserve published installer tag `myfinhub-v*` with deliberate main ancestry checks, never publish on PR.
- CI must not automatically mutate source control or create new commits via QA.
- Preserve scheduled CodeQL and explicit manual emergency workflows; these are deliberate non-PR entrypoints, not duplicate normal PR gates.
- Draft PRs retain quick source/security checks; expensive browser, Windows and performance jobs defer until Ready. Strict final aggregate must reject failures/cancellations for required non-skipped jobs.
- This is **not** approval to merge Dashboard PR #595, promote main, deploy to production, or touch Android.

## Live status
Implementations 0/1 completed · Sub-implementations 0/7 completed.
Current next: implement the batch and run local/source structural checks before opening a draft PR; verify no concurrent workflow owners.
