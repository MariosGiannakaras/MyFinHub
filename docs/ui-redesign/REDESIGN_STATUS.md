# MyFinHub desktop redesign status

Phase: **1 — Desktop web UI/UX redesign**

Design states: `NOT STARTED` · `DESIGNING` · `DESIGN APPROVED`  
Implementation states: `NOT STARTED` · `IMPLEMENTING` · `VALIDATING` · `VERIFIED`

Current full-page baselines are resolved from `visual-qa/manifest.json`. Current GitHub issue/branch/PR/check state overrides stale status text.

| Order | Surface | Design | Implementation | Active delivery |
| ---: | --- | --- | --- | --- |
| 1 | Dashboard + application shell | DESIGN APPROVED | VERIFIED | merged to `develop` via #304 |
| 2 | Transactions | DESIGN APPROVED | VALIDATING | issue #305 · PR #308 · `feat/305-transactions-approved-target` |
| 3 | Quick Entry / transaction-entry patterns | NOT STARTED | NOT STARTED | — |
| 4 | Savings | NOT STARTED | NOT STARTED | — |
| 5 | Cards | NOT STARTED | NOT STARTED | — |
| 6 | Credit Card | NOT STARTED | NOT STARTED | — |
| 7 | Loans | NOT STARTED | NOT STARTED | — |
| 8 | Lending / receivables | NOT STARTED | NOT STARTED | — |
| 9 | Recurring | NOT STARTED | NOT STARTED | — |
| 10 | Planning / forecast | NOT STARTED | NOT STARTED | — |
| 11 | Needs Attention | NOT STARTED | NOT STARTED | — |
| 12 | Review | NOT STARTED | NOT STARTED | — |
| 13 | Reports | NOT STARTED | NOT STARTED | — |
| 14 | Settings | NOT STARTED | NOT STARTED | — |

## Transactions continuation

The exact owner-approved Transactions reference is tracked in PR #308 by SHA-256 `41fff086d1fd8e19e2eff597c2aeae6d368dec9d0256b870b6e11b759d478b5d`. Implementation has reached final functional-parity/visual-validation correction. Do not start another surface until Transactions is verified and merged or the owner supplies another approved target for an explicitly independent workflow.

## Protected exclusion

Issue #266 is not a redesign tracker or source and must not be opened or used by this workflow.
