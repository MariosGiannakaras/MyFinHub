# UI audit evidence and remediation authority

This directory contains the latest independent interactive-image audits.

## Raw independent evidence

- gemini/ — first independent visual + technical audit and the captured screenshots.
- gpt/ — second independent visual + technical audit over the same latest screenshot set.

Do not edit either audit merely to make the reports agree. They are evidence snapshots.

## Canonical reconciliation

- RECONCILIATION_AND_REMEDIATION_PLAN.md — single authoritative finding matrix and implementation/acceptance plan for issue #503.

Where the raw audits disagree, the reconciliation file records whether the observation is confirmed or reproduce-before-fix.

Previous Final Visual matrices are regression evidence only. The newer interactive evidence reopened UI closeout where it exposed owner-intent/readability defects not caught by the earlier acceptance method.

## Current #649 whole-app remediation

- [Canonical 23-package / 132-action roadmap](./WHOLE_APP_REMEDIATION_649_PLAN.md) — explicit scope and consolidated implementation order; initial 2026-10-29 checklists are historical, not live counters.
- [Active branch checkpoint](./ISSUE_649_BULK_IMPLEMENTATION_STATUS.md) — authoritative progress and exact next unblocked actions on Draft PR #654.
- [Evidence/disposition registry](./WHOLE_APP_PHASE1_132_DISPOSITIONS_649.md) and [full audit evidence](./WHOLE_APP_AUDIT_649_EVIDENCE.md) — source analysis retained from superseded Draft PR #650; not separate implementation branches.
