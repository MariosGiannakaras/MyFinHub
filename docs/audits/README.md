# UI audit evidence and remediation authority

This directory contains the latest independent interactive-image audits.

## Raw independent evidence

- gemini/ — first independent visual + technical audit and the captured screenshots.
- gpt/ — second independent visual + technical audit over the same latest screenshot set.

Do not edit either audit merely to make the reports agree. They are evidence snapshots.

## Canonical reconciliation

- RECONCILIATION_AND_REMEDIATION_PLAN.md — single authoritative finding matrix and implementation/acceptance plan for issue #503.
- IMPLEMENTATION_PROMPT.md — ready-to-use execution prompt for the remediation agent.

Where the raw audits disagree, the reconciliation file records whether the observation is confirmed or reproduce-before-fix.

Previous Final Visual matrices are regression evidence only. The newer interactive evidence reopened UI closeout where it exposed owner-intent/readability defects not caught by the earlier acceptance method.
