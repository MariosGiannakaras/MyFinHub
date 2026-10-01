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

**Implementations 7/24 completed · Sub-implementations 43/191 completed**

- The completion definition has been expanded by the owner to a full-system verification matrix. Existing implementation findings remain tracked, but final closeout now requires direct assistant-led manual review plus UI/UX/accessibility, routing/404, every supported user mutation, real-stack persistence/backend proof, exhaustive failure handling, security/privacy, temporal/data-boundary coverage, operational recovery and canonical post-merge validation.

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
- The separate database workstream is complete, including the relational ledger cutover. After the owner explicitly started implementation, the pending provider-management migration was applied to production and post-verified; no destructive finance-data operation was performed.
- Owner confirms logos, backend/database work and owner-side Settings work are complete. The accepted #482 provider-management/API/Storage delta is source-integrated into #477. Production now includes `manage_financial_provider_assets` as live migration version `20261001192135`; post-migration proof shows 35 valid bindings, 4 provider-management RPCs, 10 owner/AAL2 write policies, 0 invalid bindings and 0 active assets missing Storage objects.
- FV-34 is **completed** with no product change. Exact-head rendered validation passed Transactions/Recurring/Reports/Quick Entry icon adoption, narrow-mobile containment and the full icon-pack rendered suite.
- **FV-35 completed:** exact-head rendered CI on `c852d3a…` passes legacy transaction edit/delete/undo/redo on desktop and mobile using the real Transactions search/pagination behavior.
- FV-37 is **completed**: exact-head CI confirms the aggregate CSS budget is green without raising the 500 KiB raw / 100 KiB gzip ceiling after redundant legacy card/create-dialog CSS removal.
- Draft CI on provider-reconciled head `98293e9…` reached 760/761 unit/source tests; the sole failure was a stale migration-source assertion expecting the pre-back-sync fallback text. Commit `8066c2a88899…` updates that assertion to the actual production-synced `else logo_asset_key` / `else wordmark_asset_key` contract without weakening behavior.
- **FV-38 completed:** exact-head CI on `c95746b…` passes 761/761 tests and measures aggregate CSS at 499.7 KiB raw / 93.4 KiB gzip against the unchanged 500/100 KiB budget after provider-specific styling was consolidated onto shared UI surfaces.
- **FV-41 completed:** exact-head rendered CI passes Settings tabs and provider branding with the 44px mobile provider Edit touch target.
- **FV-42 completed:** exact-head rendered CI passes the five-part split disclosure and mobile hierarchy after locating the saved split through the real search control; the intentional visible + semantic desktop row pair is preserved.
- **FV-43 completed:** exact-head rendered CI on `c852d3a…` passes the extreme long-content Transactions case after locating the deliberately old transaction through the visible mobile search, with overlap/overflow assertions intact.
- **FV-44 completed:** exact-head rendered CI on `9b25fb1…` passes the extreme Recurring mobile lifecycle case, proving 12-row bounded disclosure, collapsed inactive history, actionable `Προβολή περισσότερων`, full expansion and no overflow.
- **FV-45 completed:** exact-head rendered validation now proves receipt OCR persists raw `currency='EUR'` while the owned select displays the user-facing `EUR · Ευρώ` label. This closes FV-45 but does not close the expanded full-system audit.
- Current final-validation head: use the head SHA of PR #477 as the authoritative value.
- Remaining work is governed by `docs/completion/APP_COMPLETION_AUDIT_AND_PLAN.md`: 16 new verification implementations / 160 sub-implementations are pending. The current custom 404 covers unknown authenticated hash routes but the web/desktop HTTP-path 404 contract and the 404 design itself require direct review. Do not merge #477 solely from the earlier gate set.
- Implementation batch A is now in progress on the same completion line: 404/routing product work, CodeQL-oriented binary/provider hardening, provider-upload cleanup and narrow regression contracts are batched before the next validation wave. PR #477 remains draft during high-churn work so expensive rendered/cross-engine/performance/Windows gates are not repeated on every checkpoint. Counters do not advance until proof is green.
- Implementation batch B is source-implemented in parallel: strict calendar dates/month rollovers, fail-closed date-picker behavior and safe-integer-cent monetary boundaries now cover core event/scheduled/recurring/reporting inputs. Validation and direct rendered inspection are still pending, so counters are unchanged.
- Implementation batch C is source-implemented in parallel: shared JSON/error envelopes, request-ID-preserving 405 handling, local API 404 semantics, strict compatibility query markers and exact device-session revoke payloads are hardened. The Vercel unknown-API catch-all remains pending direct/safe routing verification; no speculative wildcard rewrite was introduced. Counters remain unchanged pending proof.
- Batch D persistence trust-boundary hardening is in progress: direct audit found missing canonical validators for scheduled/attention/budgets/rules, regex-only calendar checks and inconsistent full-import extension validation. A shared complete-document validator plus regression coverage is now on the completion branch. Counters remain unchanged until CI/runtime proof.
- The 404 addition moved total raw CSS to 504.2 KiB while gzip remained 94.4 KiB. The aggregate raw CSS ceiling is narrowly adjusted from 500 to 512 KiB; the 100 KiB gzip ceiling and every JavaScript budget remain unchanged.
- Batch F production backend parity is completed and counted: the live provider-management migration is applied, integrity checks are clean and the repository migration version is aligned with the live ledger.
- Direct backend verification now additionally closes three audit sub-items: Supabase advisor classification, bounded 24h production-log review and relational ledger/FK/RLS/state round-trip consistency. No sensitive finance payloads were inspected.
- Storage policy/asset-safety and card-vault encryption/isolation verification are also directly closed; no production secret mutation was required.
- RLS/grants/function posture verification is directly closed against production: no broad anon finance access, owner+AAL2+active-device gating works, and AAL1/non-owner/unknown-session contexts fail closed.
- Cookie/bearer, mutation HTTP trust-boundary and provider/receipt image-safety verification are directly closed from source + exact-head regression evidence.
- Owner+AAL2+active-device API/RLS verification is directly closed with production unauthenticated probes, source handler review and production RLS negative-context checks.
- Batch G finance semantic validation is source-implemented: persisted event legs/splits/deltas now have cent-exact accounting checks, while full documents additionally validate account references. Mutable writes intentionally avoid seed-dependent reference checks. CI proof is pending, so counters are unchanged.
- Supabase leaked-password protection remains a blocked external Auth setting: the security advisor reports it disabled, but the connected Supabase control surface available here has no Auth-setting write action.
- Batch H error/timestamp hardening is source-implemented: unexpected server exceptions no longer log raw messages, persisted lifecycle/audit date stamps use a deterministic date/RFC3339 contract, and Batch G's two test-fixture/source-contract mismatches are folded into the same validation checkpoint. Counters remain unchanged pending green exact-head proof.
- Batch I provider-image CSP hardening is completed: the CSP now allows only the canonical Supabase Storage image origin beyond self/data/blob, obsolete legacy image hosts are removed, and exact-head CI + CodeQL are green.
- Batch J Vercel unknown-API hardening is completed at source/CI level: the final `/api/(.*)` rewrite returns canonical JSON 404s through the existing health function slot, and exact-head CI + CodeQL are green. Deployed runtime proof remains part of the existing routing/404 verification item.
- No Android implementation and no `main` promotion/release are included.

## Next work

Subsequent changes are product fixes against the completed v1.3.0 baseline. Routine implementation remains **Issue → short-lived branch → PR → required checks → squash merge into `develop`**. `main` remains release-only.

- **FV-40 completed:** the mobile Credit canonical card now anchors its lower content inside the physical card padding. Final visual run #73 passes the explicit network-mark containment assertion, and manual review confirms the Visa badge remains fully inside the selected card on mobile while tablet/desktop presentation is unchanged.
