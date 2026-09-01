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
| 6 | Credit Card | DESIGN APPROVED | VERIFIED | merged to `develop` via #323 |
| 7 | Loans | DESIGN APPROVED | VERIFIED | merged to `develop` via #321 |
| 8 | Lending / receivables | NOT STARTED | NOT STARTED | — |
| 9 | Recurring | NOT STARTED | NOT STARTED | — |
| 10 | Planning / forecast | NOT STARTED | NOT STARTED | — |
| 11 | Needs Attention | NOT STARTED | NOT STARTED | — |
| 12 | Review | NOT STARTED | NOT STARTED | — |
| 13 | Reports | NOT STARTED | NOT STARTED | — |
| 14 | Settings | NOT STARTED | NOT STARTED | — |

## Verified delivery history

Transactions uses the owner-approved 1536×1064 reference tracked by SHA-256 `41fff086d1fd8e19e2eff597c2aeae6d368dec9d0256b870b6e11b759d478b5d` and was merged to `develop` via #310 after functional-parity, CI and fresh Approved ↔ Actual verification.

Quick Entry / transaction-entry patterns uses the owner-approved 1536×1066 reference tracked by SHA-256 `df8dca7c0047981f027e3d799374aed4ee9e7cb3ce9ba3140b6f4a53af38ae49`. Product head `36c7b96` passed `npm run check`, API validation, rendered frontend QA, CodeQL, cross-engine smoke, performance smoke and Windows Desktop. Fresh final Approved ↔ Actual inspection passed for modal position/proportions, 4×2 intent hierarchy, frequent presets, form composition and footer action hierarchy while preserving the existing canonical QuickAdd engine, receipt/OCR flow, shared category icons and responsive behavior. It was squash-merged to `develop` via #312 as product commit `e03c7bd`.

Savings uses the owner-approved 1536×1067 reference tracked by SHA-256 `511ab3ed38496c709b376f1a1b199bae0379e93a66399b9a7643b300034168fc`. Product head `b63aec2` passed `npm run check`, API validation, rendered frontend QA, CodeQL, cross-engine smoke, performance smoke and Windows Desktop. Fresh final Approved ↔ Actual inspection passed for the heading/action-card geometry, three-column monthly KPI + cumulative trend + sources/recent composition, truthful supported-target presentation, goals-area density and complex-savings explanatory bar while preserving canonical Savings handlers/accounting semantics and mobile regression safety. It was squash-merged to `develop` via #314 as product commit `2f31e13`.

Cards uses the owner-approved 1536×1024 reference tracked by SHA-256 `0d653b8bf040d453cda2b2b04636698b8e2abef4aac8008a467aff6648e01072`. Per explicit owner scope, the existing bank-by-bank card container, card visuals and all create/edit/archive/restore/delete/vault behavior were preserved unchanged. Product head `c17989c` passed `npm run check`, API validation, rendered frontend QA, CodeQL, cross-engine smoke, performance smoke and Windows Desktop. Fresh final Approved ↔ Actual inspection passed for the surrounding heading, truthful vault KPIs and recent canonical account activity. It was squash-merged to `develop` via #319 as product commit `e875df6`.

Credit Card uses the owner-approved 1536×1067 reference tracked by SHA-256 `d3c480982cac07e1acab519fb9cf3861b70c157dbb510a7b6e55c9be1d880bd6`. Per explicit owner scope, the canonical credit-card artwork, PAN/expiry/CVV reveal/copy/archive behavior, vault boundaries and finance/statement semantics were preserved unchanged. Desktop adds an optional host-level Οριζόντια / Στοίβα card-navigation mode over the existing `selectedCardId`, while mobile keeps the original canonical card stack and card-switching behavior unchanged. Clean product head `37c0f6f` passed `npm run check`, API validation, rendered frontend QA, CodeQL, cross-engine smoke, performance smoke and Windows Desktop. Fresh final desktop/mobile Approved ↔ Actual inspection passed for the target-like card/limit hero, truthful summary, primary credit-activity hierarchy and mobile regression protection. It was squash-merged to `develop` via #323 as product commit `1162b0b`.

Loans uses the owner-approved 1536×1067 reference tracked by SHA-256 `4a058633da08e66f32d5958eae364cf602cc0a10258e28bc00900c58f4ea8f59`, with the owner-requested completion-driven segmented blue→violet→green progress treatment. Final clean product head `ff9c5ca` passed `npm run check`, API validation, rendered frontend QA, CodeQL, cross-engine smoke, performance smoke and Windows Desktop. Fresh final Approved ↔ Actual inspection passed for heading/actions, sort toolbar, active obligation cards, truthful canonical metadata/actions, completed summary, progress explanation and the corrected segmented gradient coverage while preserving all canonical Loans accounting/payment/edit/self-loan/forgiveness semantics. It was squash-merged to `develop` via #321 as product commit `cd71411`.

## Protected exclusion

Issue #266 is not a redesign tracker or source and must not be opened or used by this workflow.
