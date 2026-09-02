# MyFinHub desktop redesign status

Phase: **1 — Desktop web UI/UX redesign**

Design states: `NOT STARTED` · `DESIGNING` · `DESIGN APPROVED`  
Implementation states: `NOT STARTED` · `IMPLEMENTING` · `VALIDATING` · `VERIFIED`

Current full-page baselines are resolved from `visual-qa/manifest.json`. Current GitHub issue/branch/PR/check state overrides stale status text.

| Order | Surface | Design | Implementation | Active delivery |
| ---: | --- | --- | --- | --- |
| 1 | Dashboard + application shell | DESIGN APPROVED | VERIFIED | merged to `develop` via #304 |
| 2 | Transactions | DESIGN APPROVED | VERIFIED | merged to `develop` via #310 |
| 3 | Quick Entry / transaction-entry patterns | DESIGN APPROVED | VERIFIED | merged to `develop` via #312 |
| 4 | Savings | DESIGN APPROVED | VERIFIED | merged to `develop` via #314 |
| 5 | Cards | DESIGN APPROVED | VERIFIED | merged to `develop` via #319 |
| 6 | Credit Card | DESIGN APPROVED | VERIFIED | merged via #323; navigation follow-up #327 |
| 7 | Loans | DESIGN APPROVED | VERIFIED | merged to `develop` via #321 |
| 8 | Lending / receivables | DESIGN APPROVED | VERIFIED | merged to `develop` via #328 |
| 9 | Recurring | DESIGN APPROVED | VERIFIED | merged to `develop` via #331 |
| 10 | Planning / forecast | DESIGN APPROVED | VERIFIED | merged to `develop` via #336 |
| 11 | Needs Attention | NOT STARTED | NOT STARTED | — |
| 12 | Review | NOT STARTED | NOT STARTED | — |
| 13 | Reports | NOT STARTED | NOT STARTED | — |
| 14 | Settings | NOT STARTED | NOT STARTED | — |

## Verified delivery history

Transactions uses the owner-approved 1536×1064 reference tracked by SHA-256 `41fff086d1fd8e19e2eff597c2aeae6d368dec9d0256b870b6e11b759d478b5d` and was merged to `develop` via #310 after functional-parity, CI and fresh Approved ↔ Actual verification.

Quick Entry / transaction-entry patterns uses the owner-approved 1536×1066 reference tracked by SHA-256 `df8dca7c0047981f027e3d799374aed4ee9e7cb3ce9ba3140b6f4a53af38ae49`. Product head `36c7b96` passed `npm run check`, API validation, rendered frontend QA, CodeQL, cross-engine smoke, performance smoke and Windows Desktop. Fresh final Approved ↔ Actual inspection passed for modal position/proportions, 4×2 intent hierarchy, frequent presets, form composition and footer action hierarchy while preserving the existing canonical QuickAdd engine, receipt/OCR flow, shared category icons and responsive behavior. It was squash-merged to `develop` via #312 as product commit `e03c7bd`.

Savings uses the owner-approved 1536×1067 reference tracked by SHA-256 `511ab3ed38496c709b376f1a1b199bae0379e93a66399b9a7643b300034168fc`. Product head `b63aec2` passed `npm run check`, API validation, rendered frontend QA, CodeQL, cross-engine smoke, performance smoke and Windows Desktop. Fresh final Approved ↔ Actual inspection passed for the heading/action-card geometry, three-column monthly KPI + cumulative trend + sources/recent composition, truthful supported-target presentation, goals-area density and complex-savings explanatory bar while preserving canonical Savings handlers/accounting semantics and mobile regression safety. It was squash-merged to `develop` via #314 as product commit `2f31e13`.

Cards uses the owner-approved 1536×1024 reference tracked by SHA-256 `0d653b8bf040d453cda2b2b04636698b8e2abef4aac8008a467aff6648e01072`. Per explicit owner scope, the existing bank-by-bank card container, card visuals and all create/edit/archive/restore/delete/vault behavior were preserved unchanged. Product head `c17989c` passed `npm run check`, API validation, rendered frontend QA, CodeQL, cross-engine smoke, performance smoke and Windows Desktop. Fresh final Approved ↔ Actual inspection passed for the surrounding heading, truthful vault KPIs and recent canonical account activity. It was squash-merged to `develop` via #319 as product commit `e875df6`.

Credit Card uses the owner-approved 1536×1067 reference tracked by SHA-256 `d3c480982cac07e1acab519fb9cf3861b70c157dbb510a7b6e55c9be1d880bd6`. Per explicit owner scope, the canonical credit-card artwork, PAN/expiry/CVV reveal/copy/archive behavior, vault boundaries and finance/statement semantics remain unchanged. The base redesign was squash-merged via #323 as `1162b0b`. Follow-up #327 removed the redundant desktop host previous/next and Οριζόντια / Στοίβα navigation layer so the canonical drag/restack card interaction is again the sole rendered card-switching mechanism; mobile behavior remains unchanged. Follow-up product head `fa0cdabc` passed CI (`npm run check`, API check and rendered frontend QA), CodeQL, cross-engine smoke, performance smoke and Windows Desktop, and fresh desktop/mobile Actual evidence was visually inspected before squash merge as `137f245`.

Loans uses the owner-approved 1536×1067 reference tracked by SHA-256 `4a058633da08e66f32d5958eae364cf602cc0a10258e28bc00900c58f4ea8f59`, with the owner-requested completion-driven segmented blue→violet→green progress treatment. Final clean product head `ff9c5ca` passed `npm run check`, API validation, rendered frontend QA, CodeQL, cross-engine smoke, performance smoke and Windows Desktop. Fresh final Approved ↔ Actual inspection passed for heading/actions, sort toolbar, active obligation cards, truthful canonical metadata/actions, completed summary, progress explanation and the corrected segmented gradient coverage while preserving all canonical Loans accounting/payment/edit/self-loan/forgiveness semantics. It was squash-merged to `develop` via #321 as product commit `cd71411`.

Lending / receivables uses the owner-approved 1536×1064 reference tracked by SHA-256 `5845fc650bf0d2ed48b076989ac18e168572d9db68d53762135961f52772a58b`. Exact product head `8813424` passed `npm run check`, API validation, rendered frontend QA, CodeQL, cross-engine smoke, performance smoke and Windows Desktop. Fresh final desktop/mobile Approved ↔ Actual inspection passed for the people navigator/search, selected-person receivable metrics and privacy state, canonical lending/repayment quick actions, selected-person movement hierarchy and mobile regression protection while preserving canonical receivable accounting, event creation, validation and quick-add semantics. It was squash-merged to `develop` via #328 as product commit `7a1c837`.

Recurring uses the owner-approved 1536×1067 reference tracked by SHA-256 `e0d6faab90eacd9602b62a4eb034cbb5229a8da2e8ee84ca7eef5f794506fdc2`. Exact validated implementation passed application/API checks, rendered frontend QA, CodeQL, cross-engine smoke, performance smoke and Windows Desktop. Fresh desktop/mobile Approved ↔ Actual inspection passed after the mobile-preservation correction for the concise heading, two summary cards, category-grouped recurring workspace, canonical linked-loan payment path and compact inactive history while preserving recurrence cadence/editor/payment/lifecycle semantics. It was squash-merged to `develop` via #331.

Planning / forecast uses the owner-approved 1536×1024 reference tracked by SHA-256 `d6090e0b8f532a71839d63542891d1f8d7f8118fd7fed06bd849cf4e34869079`. The implementation preserves canonical `cashFlowForecast`, scheduled creation/completion to real FinanceEvents, skip/cancel audit history, account/category primitives and established mobile behavior. Validated product ancestor `03eef5f0fb1ee85286bba74ca0e19b84af7d30a0` passed application/API checks, rendered frontend QA, CodeQL, cross-engine smoke, performance smoke and Windows Desktop. Fresh final desktop/mobile Approved ↔ Actual inspection passed after correcting the initial desktop heading/subtitle/CTA presentation, raising scheduled/forecast scanability and aligning account cards to the approved four-column desktop rhythm without hiding canonical accounts. The clean replacement was squash-merged to `develop` via #336 as product commit `3dfa381`.

## Protected exclusion

Issue #266 is not a redesign tracker or source and must not be opened or used by this workflow.
