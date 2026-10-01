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

## Completed CI/workflow optimization — #483

**Implementations 9/9 · Sub-implementations 24/24**

- PR #484 passed exact-head CI, CodeQL, Cross-engine Smoke, median-of-three Performance Smoke, Windows Desktop, Windows First Run and Windows Clean Launch on `4d129c05ee4d0f0110dc86d801cf3e359c301e50`.
- PR #484 squash-merged into `develop` as `a752e417d339bce3eb2aab0a0b3918140533318e`.
- Draft PRs now keep core CI + CodeQL feedback while expensive rendered/cross-engine/performance/Windows lifecycle work is deferred until review-ready.
- Production Smoke targets the canonical `https://mgfinhub.vercel.app` origin.
- Repository execution authority is consolidated in `AGENTS.md`; issue #266 remains the durable owner/product decision ledger.
- GitHub admin-only follow-up is tracked in #485: protect `develop` with an integration ruleset and update the repository homepage to the canonical production URL.

## Active completion batch — #476

**Implementations 7/8 completed · Sub-implementations 21/26 completed**

- The explicit accepted checklist was normalized to 20 items, increased through FV-40 to 24, to 25 for FV-41, and is now 26 because the exact-final-head Transactions scanability run exposed FV-42: the harness assumed a newly created split would remain on the visible ASC pagination page. The 500 KiB threshold remains unchanged.

- Branch: `feat/476-completion-audit-hardening`.
- **54 deep-audit findings are now tracked.** DA-01..DA-53 retain their existing implementation/disposition state; DA-54 adds the owner-reported dark-theme color/contrast defect.
- DA-54 analysis shows the core dark text/status palette is readable, but interactive boundaries and several light-biased component surfaces were not semantically themed. The source fix adds a dedicated >=3:1 interactive control-border role, semantic dark surfaces for mobile More/Settings chrome, and computed-style rendered contrast assertions.
- DA-54 is **completed**. Dashboard, Transactions, Quick Entry, Reports, Settings and mobile More now use readable semantic dark surfaces/boundaries. Computed contrast/luminance checks pass, and manual artifact review confirms the settled post-animation More sheet plus the representative desktop/mobile dark states with no residual light-island defect.
- FV-24 records the prior exact-head Settings QA failure: the harness expected a removed duplicate provider preview. The source fix now validates the selected branded radio card itself; provider-management product code remains untouched.
- FV-25 records the next Settings QA failure: edit mode intentionally supports correcting an existing account's provider, but the harness still required that field to be absent. The assertion is aligned with the accepted provider-correction behavior; product code remains untouched.
- FV-26 records the bundle-budget failure introduced by loading the DA-54 remediation eagerly. The same dark rules now load through the existing lazy workspace style layer; the 240 KiB CSS budget is unchanged.
- FV-27 is **completed**. Explicit `ResponsiveContainer` sizing remains inside the lazy chunk; exact-head full-page evidence passed 24/24 and Dashboard hierarchy QA passed, proving deferred charts render while performance remains green.
- FV-28 is **completed**. Exact-head full-page evidence passed with separate desktop deferred-chart and mobile collapsed-state contracts; no product scope or threshold changed.
- FV-29 is **completed**. Exact-head hierarchy QA passed the semantic compact-mobile expanded state with summary/cash-flow readiness, open KPI/analytics regions, hidden category donut and visible category table.
- FV-30 is **completed**. Theme QA passes after the 220ms settle window and manual review confirms the settled mobile More sheet is opaque/readable; product opacity/color tokens were unchanged.
- FV-31 is **completed**. The responsive flow-chart host now has a 153px height/min-height through 980px; exact-head 375px hierarchy QA passes the expanded state and Lighthouse/bundle gates remain green.
- FV-32 is **completed** with no new product scope. Exact-head CRUD QA passes Lending 12/42 partial repayment plus protected Settings custom-account create/delete. Device revoke remains intentionally non-destructive in synthetic QA and is covered by API/security contracts.
- FV-33 is **completed** with no product change. Exact-head CRUD QA passes the canonical destructive `role="alertdialog"` confirmation path.
- The separate database workstream is complete by owner confirmation, including the relational ledger cutover. This branch will not touch the live database.
- Owner confirms logos, backend/database work and owner-side Settings work are complete. The accepted #482 provider-management/API/Storage delta is now source-integrated into #477 at `98293e962b227336dc8f6f05cd5b65f89adb67bb`; exact-head validation is still required before this reconciliation is counted complete.
- FV-34 is **completed** with no product change. Exact-head rendered validation passed Transactions/Recurring/Reports/Quick Entry icon adoption, narrow-mobile containment and the full icon-pack rendered suite.
- FV-35 is **source-fixed; exact-head proof pending** with no product regression identified: legacy transaction management now waits for the visible Transactions search control on desktop and mobile before applying the `Supermarket` filter, so CI no longer races initial rendering while the real pagination/search behavior remains unchanged.no product regression identified: legacy transaction management now applies the real Transactions search control to `Supermarket` on desktop and mobile before edit/delete/undo/redo proof, so the target row is deterministic without bypassing or weakening the 14-row pagination contract.
- FV-37 is **completed**: exact-head CI confirms the aggregate CSS budget is green without raising the 500 KiB raw / 100 KiB gzip ceiling after redundant legacy card/create-dialog CSS removal.
- Draft CI on provider-reconciled head `98293e9…` reached 760/761 unit/source tests; the sole failure was a stale migration-source assertion expecting the pre-back-sync fallback text. Commit `8066c2a88899…` updates that assertion to the actual production-synced `else logo_asset_key` / `else wordmark_asset_key` contract without weakening behavior.
- **FV-38 completed:** exact-head CI on `c95746b…` passes 761/761 tests and measures aggregate CSS at 499.7 KiB raw / 93.4 KiB gzip against the unchanged 500/100 KiB budget after provider-specific styling was consolidated onto shared UI surfaces.
- **FV-41 source-fixed; exact-head proof pending:** Settings → Accounts provider Edit actions now use a 44px mobile touch target without changing desktop density or the provider-management layout.
- **FV-42 source-fixed; exact-head proof pending:** the five-part split saves correctly; the rendered harness now finds it through the real Transactions search after save instead of assuming it remains visible on the current ASC pagination page. No product behavior changed.
- Current final-validation head: use the head SHA of PR #477 as the authoritative value.
- Remaining work: rerun the exact-head rendered validation to prove FV-35, the source-integrated #482 provider-management flow, FV-41 and FV-42, then require all final-head CI/security/cross-engine/performance/Windows gates green and squash-merge to `develop`.
- No Android implementation and no `main` promotion/release are included.

## Next work

Subsequent changes are product fixes against the completed v1.3.0 baseline. Routine implementation remains **Issue → short-lived branch → PR → required checks → squash merge into `develop`**. `main` remains release-only.

- **FV-40 completed:** the mobile Credit canonical card now anchors its lower content inside the physical card padding. Final visual run #73 passes the explicit network-mark containment assertion, and manual review confirms the Visa badge remains fully inside the selected card on mobile while tablet/desktop presentation is unchanged.
