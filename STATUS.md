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

## Active completion batch — #476

**Workstreams 5/8 complete · Deep findings 40/41 repo-side complete**

- Branch: `feat/476-completion-audit-hardening`.
- Deep-audit tracker: **41 unique findings** after duplicate-ID cleanup.
- **40/41** findings are implemented/dispositioned on the repo side.
- **1/41** is external: owner manual upload of the remaining provider logo binaries; this branch must not touch the database.
- **27 findings** still require final rendered/runtime proof before they can be considered fully closed.
- Major implemented areas include responsive/overlap fixes, bounded mobile histories, card profile vs secure-details editing, real card-vault Save→Reveal QA, persistent per-library icon choices/colors, OCR runtime-asset preflight, provider presentation, CRUD/lifecycle browser coverage, and mobile modal geometry.
- PR #477 is intentionally closed while the deep implementation/audit batch continues so intermediate commits do not trigger repeated CI.
- Remaining work: fresh rendered QA + manual screenshot inspection, fix any defects found, reconcile with current `develop`, then one exact-final-head CI/security/cross-engine/performance/Windows wave and squash merge to `develop`.
- No `main` promotion/release is included.

## Next work

Subsequent changes are product fixes against the completed v1.3.0 baseline. Routine implementation remains **Issue → short-lived branch → PR → required checks → squash merge into `develop`**. `main` remains release-only.
