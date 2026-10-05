# Implementation prompt — latest UI audit reconciliation

Work only in MariosGiannakaras/MyFinHub. Do not modify MyFinHub-Android-App and do not perform any production deployment, develop → main promotion, production database mutation or destructive migration.

Your task is to execute issue #503 using docs/audits/RECONCILIATION_AND_REMEDIATION_PLAN.md as the single implementation authority.

Before editing:

1. Read PROJECT_RULES.md and AGENTS.md from the active baseline.
2. Read issue #266, especially the Product / UX consistency decisions and the exact Dashboard account hierarchy.
3. Read issue #503 completely.
4. Read all four independent audit reports:
   - docs/audits/gemini/ui_ux_visual_audit.md
   - docs/audits/gemini/technical_code_audit.md
   - docs/audits/gpt/ui_ux_visual_audit.md
   - docs/audits/gpt/technical_code_audit.md
5. Inspect the latest evidence screenshots under docs/audits/gemini/screenshots at useful resolution. Do not rely only on the prose reports.
6. Read the current shared design-system/UX docs and the source files implicated by each confirmed finding.
7. Inspect live open PRs/branches/CI and avoid overwriting unrelated concurrent work.

Core owner contract:

The Dashboard primary account order is exactly:

**Μετρητά → Μισθοδοσίας → Αποταμιευτικός**

Implement this by account semantics, not by matching visible names. Where those account types exist, resolve daily cash first, a bank account with bankAccountCategory=payroll second, and a savings account/category third. Do not silently replace payroll with a generic operating/current account. Update deterministic fixtures and regression tests so they prove this exact contract.

Implementation discipline:

- Treat R-01 through R-16 in the reconciliation plan as confirmed required work.
- Treat C-01 through C-04 as reproduce-before-fix. Do not add speculative CSS for a conditional observation that cannot be reproduced.
- Technical audit root causes are hypotheses until current source/computed behavior confirms them.
- Fix systemic causes at shared tokens/primitives/components when appropriate. Do not create a new page-local button/input/panel/typography system.
- The repeated 7.5–10px operational typography is a system defect. Establish a readable dense floor through the shared typography contract, then update affected pages to consume it without destroying legitimate data density.
- Replace hardcoded light-theme finance text/status colors with semantic theme tokens instead of adding broad dark-mode override patches.
- Preserve intentional provider branding; inspect actual asset alpha/background and computed rules before correcting provider-mark glow/rectangles.
- In dedicated detail views, reveal full information. Do not use table-cell ellipsis semantics for the transaction details panel.
- Build deliberate empty states for Dashboard and Transactions; avoid large blank regions that look like failed rendering.
- Fix bright payment-card contrast through deterministic card-theme variable ownership/precedence and verify each light card design.
- Replace Cards desktop clipping with an explicit overflow/navigation contract.
- Rebalance Savings, Loans and Recurring based on information hierarchy and available width, not merely by adding gaps.
- Preserve useful autocomplete/password-manager semantics while normalizing autofill visuals.
- Localize visible Settings theme labels consistently with the Greek UI.

Validation cadence:

1. Work in coherent batches from #503; use narrow checks while iterating.
2. After shared-system changes, rerun the UI reuse/orphan/duplicate audit and fix any unjustified divergence introduced.
3. Generate focused rendered evidence for the affected surfaces after each coherent batch and inspect it directly.
4. Do not mark a visual item complete from source/tests alone.
5. On the final coherent review head, run the repository-required full source/unit/rendered/accessibility/security/cross-engine/performance/Windows gates.
6. Generate fresh desktop/tablet/mobile × Light/Dark evidence for the final corrected head.
7. Directly inspect every distinct route/state/component context. Deduplicate repeated identical shared-component instances only after proving they really share implementation/state geometry.
8. Explicitly compare the rendered result against owner intent, especially Dashboard hierarchy and information readability. A technically contained page can still fail UX acceptance.
9. If the final visual review finds a defect, fix it, rerun only invalidated evidence, then perform one bounded overall visual sweep.
10. Merge only to develop after all required gates and the direct post-fix visual review are green. Do not promote to production.

Progress tracking:

The #503 plan starts at:

**Implementations 1/5 completed · Sub-implementations 5/30 completed**

Update issue #503 and docs/audits/RECONCILIATION_AND_REMEDIATION_PLAN.md whenever a planned item becomes completed, partial, blocked, removed/replaced, or new required work is discovered. Count only fully proven items.

End state:

- all R-01..R-16 are fixed and directly verified;
- every C-* observation is either reproduced+fixed or explicitly closed as not reproduced with evidence;
- owner account hierarchy is protected by semantic tests/fixtures;
- shared design-system consistency remains intact;
- fresh exact-head visual evidence passes desktop/tablet/mobile and Light/Dark;
- final required repository gates are green;
- remediation is merged to develop;
- exact merged develop receives the bounded final verification;
- production remains untouched.
