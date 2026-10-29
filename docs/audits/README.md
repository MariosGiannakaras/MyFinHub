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

## Whole-app audit and roadmap (issue #649, 2026-10-29)

- [Whole-app evidence matrix](WHOLE_APP_AUDIT_649_EVIDENCE.md) — current 12 routed pages × desktop/mobile, 7 Settings tabs, auth/overlays/desktop and finance/security evidence statuses. This **does not claim** every one of the 786 generated QA states was manually inspected.
- [Full remediation execution plan](WHOLE_APP_REMEDIATION_649_PLAN.md) — 23 proposed implementation packages, 132 scoped sub-implementations, priorities, dependencies, reproducibility and acceptance. This is not a claim of 132 proven defects.

The earlier #503 matrix and the active #646/#648 implementation state remain separate authority layers: do not rewrite completed history or run overlapping branches in parallel merely because the new plan collects related findings.
