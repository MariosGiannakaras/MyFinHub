# MyFinHub status

## Current production

MyFinHub v1.3.0 is the completed web/production and Windows release baseline.

- Canonical redesigned application is on release-only `main`.
- Vercel production deployment is READY on the validated production tree.
- Production device-session registry and provider-brand refresh migrations are applied.
- Owner + AAL2 + active-device RLS/session enforcement is active.
- Production recurring/workbook reconciliation is complete.
- Final integration gates passed: CI, CodeQL, Cross-engine, Performance, Windows Desktop, Windows First Run and Windows Clean Launch.
- Final persistent visual evidence contains 63 PNGs plus its manifest under `visual-qa/final/**`.

## Windows v1.3.0 release

**Tasks 3/3 · Subtasks 9/9**

- Release tag: `myfinhub-v1.3.0`.
- Exact tagged release commit: `2673ce626c0e3db6c30fea04a46b6cf1ce9517df`.
- Windows Desktop run #2029 completed successfully.
- Published release: `MyFinHub Desktop myfinhub-v1.3.0`.
- Installer: `MyFinHub-Setup-1.3.0-x64.exe`.
- Installer size: `148992632` bytes.
- GitHub asset digest: `sha256:a405189e016ddd03e31ab1ba92979b3991a64516edfa2a657eb7b9928fadc556`.
- Matching `.sha256` asset is published in the same controlled GitHub Release.
- Release is neither draft nor prerelease.

Release-closeout tracker: **#288 — complete**.

## Durable security and finance invariants

- Single-owner authentication remains email/password + mandatory TOTP/AAL2.
- Finance access remains API-authorized and RLS-backed.
- PAN/expiry/CVV are excluded from FinanceData and normal backups and live only in the encrypted owner+AAL2 server card vault.
- `CARD_VAULT_KEY`, service-role credentials and other privileged secrets are never distributed in browser, Windows or Android clients.
- Optimistic revisions, backups, audit/history boundaries and the canonical finance/accounting engine remain authoritative.

## Active CI/workflow optimization — #483

**Implementations 9/9 · Sub-implementations 24/24**

- Branch: `chore/483-ci-workflow-optimization`.
- Implementation complete: draft PRs keep core CI + CodeQL feedback while expensive rendered/cross-engine/performance/Windows lifecycle validation is deferred until ready-for-review.
- Performance and cross-engine triggers are scoped to relevant frontend surfaces; Performance now cancels superseded runs and also covers release PRs targeting `main`.
- Windows workflows no longer repeat the root `npm run check`; they retain Windows-specific/package/lifecycle validation while root validation remains owned by CI.
- Production Smoke uses the canonical `https://mgfinhub.vercel.app` origin.
- Repository instruction authority and progress terminology are consolidated around `AGENTS.md`, issue #266, and `Implementations/Sub-implementations`.
- Repository plan: `docs/CI_WORKFLOW_OPTIMIZATION_PLAN.md`.
- Follow-up hardening now uses explicit eager + total CSS budgets, median-of-three Lighthouse evidence with unchanged thresholds, one desktop-audit owner, one root build per Windows Desktop packaging wave, and patched desktop transitive dependency resolutions.
- Integration status: implementation committed; final PR validation/merge remains required before this becomes the `develop` baseline.

## Next work

Subsequent changes are product fixes against the completed v1.3.0 baseline. Routine implementation remains **Issue → short-lived branch → PR → required checks → squash merge into `develop`**. `main` remains release-only.
