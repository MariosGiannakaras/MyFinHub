# Latest UI audit reconciliation and remediation plan

Issue: #503 — Reconcile latest UI audits and remediate owner-intent drift

**Implementations 1/5 completed · Sub-implementations 5/30 completed**

## Purpose

The Gemini and GPT audit documents are independent evidence, not competing implementation plans. This file is the single reconciliation authority for the remediation work that follows them.

Inputs:
- docs/audits/gemini/ui_ux_visual_audit.md
- docs/audits/gemini/technical_code_audit.md
- docs/audits/gpt/ui_ux_visual_audit.md
- docs/audits/gpt/technical_code_audit.md
- docs/audits/gemini/screenshots/*
- current owner/product decisions in issue #266
- current develop source and design-system contracts

Previous Final Visual evidence remains useful regression evidence, but it cannot overrule defects visible in newer direct interactive screenshots.

## Product contract restored by owner intent

Dashboard primary account hierarchy is exactly:

**Μετρητά → Μισθοδοσίας → Αποταμιευτικός**

This is semantic ordering, not a label/string rule.

When those account types exist:
1. slot 1 is daily cash;
2. slot 2 is a bank account categorized as payroll;
3. slot 3 is a bank/savings account categorized as savings.

The implementation must not silently substitute a generic current/operating account for the payroll slot. If a required semantic account genuinely does not exist, the UI must use an explicit documented missing/fallback state rather than silently changing the owner-defined hierarchy.

Fixtures and regression tests must encode the exact semantic contract, not the weaker cash → operating → savings approximation.

## Reconciliation rules

1. A defect confirmed independently by both audits is accepted without further debate.
2. A GPT-only defect backed by direct latest-image evidence and a high-confidence source cause is accepted.
3. A Gemini-only observation that the GPT audit did not independently confirm is reproduce-before-fix.
4. Technical root causes are hypotheses until current source/computed behavior supports them; do not patch by filename guess alone.
5. Prefer shared-token/component corrections when the root cause is systemic. Do not create page-specific parallel design rules to make one screenshot pass.
6. Product hierarchy/readability/owner intent are acceptance criteria in addition to clipping, overflow, contrast and accessibility mechanics.

## Canonical finding matrix

| ID | Scope | Disposition | Reconciled finding | Primary technical direction |
| --- | --- | --- | --- | --- |
| R-01 | Dashboard | High / confirmed | Primary cards violate Μετρητά → Μισθοδοσίας → Αποταμιευτικός | Resolve semantic account categories deterministically; fix fixture/tests too |
| R-02 | Cross-app | High / confirmed | Operational desktop text is routinely ~7.5–10px despite large available canvas | Reuse shared readable typography tokens/dense floor |
| R-03 | Dashboard | Medium / confirmed | Empty month/category regions look like missing rendering | Purpose-built empty states; avoid dead chart/table space |
| R-04 | Dashboard | High / confirmed | Secondary accounts/trend text is too dark/faint in dark theme | Replace hardcoded light-theme colors at owner rules with semantic tokens |
| R-05 | Dashboard/Planning | Medium / confirmed, cause verify | Provider marks create harsh white/rectangular treatment | Inspect source asset alpha/variant + computed image rules before fix |
| R-06 | Transactions | Medium / confirmed | Zero-results state is one weak line in a large empty region | Deliberate empty-state composition + contextual reset/action |
| R-07 | Transactions | High / confirmed | Details panel ellipsizes account route/description | Wrap content in details; keep ellipsis only in compact list/table contexts |
| R-08 | Savings | Medium / confirmed | Sparse action containers are oversized while transfer route is micro-copy | Rebalance action geometry; raise route text to readable shared scale |
| R-09 | Cards | High accessibility / confirmed | Bright card designs render insufficient-contrast labels/details | Fix card variable precedence and verify every light-surface theme |
| R-10 | Cards | Medium / confirmed | Desktop provider grid is forced wider than workspace and clipped | Define explicit responsive/scroll/carousel overflow contract |
| R-11 | Credit | Medium / confirmed | Piraeus Credit identity caption is too small/faint | Raise caption size/emphasis using existing card semantic palette |
| R-12 | Loans | Medium / confirmed | Wide row leaves a large empty middle and weak progress/meta grouping | Reallocate progress/meta/actions as coherent wide-screen grid |
| R-13 | Recurring | High / confirmed | Summary is width-capped while operational table/actions are compressed | Use available width; raise table/action readability and spacing |
| R-14 | Reports | High accessibility / confirmed | Dark-theme budget status cards produce light-on-light contrast | Theme-derived semantic status surfaces; add dark-mode contrast regression |
| R-15 | Settings | Low/Medium / confirmed | Mixed localization and faint inactive/supporting labels | Greek visible labels; shared secondary text/readability tokens |
| R-16 | Settings User & Access | Medium / confirmed | Autofill/password/PIN states look inconsistent/faint | Preserve autocomplete; normalize theme-safe autofill/PIN state styles |

## Conditional observations — reproduce before change

Do not create a fix unless the remediation head reproduces the condition:

- C-01 exact Dashboard account-title/balance overlap;
- C-02 exact provider icon/text overlap distinct from R-05 asset/background treatment;
- C-03 exact Savings source→destination arrow vertical misalignment;
- C-04 any Credit foreground-color defect broader than R-11.

If reproduced, add the item to the confirmed matrix and update #503 before implementation.

## Implementation plan

### 1. Reconciliation and owner-contract hardening — 5/5

- [x] Read/cross-map both latest-image visual audits.
- [x] Map both technical audits to current source and separate proven causes from hypotheses.
- [x] Collapse duplicates into this canonical finding matrix.
- [x] Record the exact Dashboard account hierarchy in durable owner decisions.
- [x] Classify disputed observations as reproduce-before-fix.

### 2. Shared readability/theme/system remediation — 0/5

- [ ] Define/enforce a readable dense-text floor through the shared typography system; remove unjustified page-local 7.5–10px operational text.
- [ ] Replace hardcoded light-theme finance text colors with semantic theme tokens at the owning rules.
- [ ] Fix dark-theme semantic status-surface contrast, especially Reports budget summaries.
- [ ] Normalize common autofill/inactive/PIN/form states without removing browser accessibility semantics.
- [ ] Rerun shared primitive/token/orphan/duplicate audit after system changes.

### 3. Product/page remediation — 0/10

- [ ] Dashboard semantic account order + exact tests/fixtures.
- [ ] Dashboard empty states, secondary finance readability and provider-mark correction.
- [ ] Transactions empty state + full details wrapping.
- [ ] Savings whitespace/transfer hierarchy.
- [ ] Cards bright-surface contrast/theme precedence.
- [ ] Cards desktop overflow/navigation contract.
- [ ] Credit identity-caption readability.
- [ ] Loans wide-screen composition.
- [ ] Recurring wide-screen composition/actions/readability.
- [ ] Reports/Settings page-specific polish not already solved at the shared layer.

### 4. Post-fix visual verification — 0/6

- [ ] Generate focused exact-head desktop captures for every changed finding and inspect directly.
- [ ] Reproduce/close every conditional C-* observation with evidence.
- [ ] Generate exact-head desktop/tablet/mobile × Light/Dark coverage for all primary routes and critical changed states.
- [ ] Inspect every distinct visible/interactive pattern; skip repeated identical shared-component instances only after structural equivalence is proven.
- [ ] Explicitly verify owner-intent/product hierarchy in the rendered UI, not merely technical containment.
- [ ] Fix any remaining defect, rerun affected evidence, then do one bounded overall final visual sweep.

### 5. Final integration closeout — 0/4

- [ ] Run required final unit/source/rendered/accessibility/security/performance/Windows gates on the coherent final review head.
- [ ] Reconcile docs/status so historical PASS evidence is correctly scoped and no stale closeout statement contradicts newer evidence.
- [ ] Merge the remediation branch to develop only when required checks and direct visual review are green.
- [ ] Verify exact merged develop with the final bounded visual/regression check.

## Required regression contracts

At minimum add/adjust proof for:

- semantic Dashboard slots: daily cash, payroll bank category, savings bank category in exact order;
- fixture representing those semantics, without relying on account display-name matching;
- dense typography minimum/readability guard where practical;
- dark-theme Dashboard secondary finance text;
- transaction detail wrapping with long Greek account/description content;
- transaction and Dashboard deliberate empty states;
- Piraeus yellow and other bright-card computed foreground contrast;
- Cards desktop overflow containment/navigation;
- Reports budget status surfaces in dark theme;
- recurring action targets/spacing and readable metadata;
- browser autofill normalization without deleting autocomplete semantics.

## Visual acceptance

A page is not accepted merely because:
- there is no overflow;
- CI is green;
- contrast automation passes;
- the same component rendered correctly elsewhere.

It must also have correct product hierarchy, usable information density, readable financial context, coherent empty states and alignment with explicit owner decisions.

The post-fix visual pass is mandatory and uses newly generated evidence from the exact corrected head. Old screenshots are comparison/regression evidence only.

## Guardrails

- No production deployment or develop → main promotion in #503.
- No Android repository changes.
- No production DB mutation/destructive migration.
- Preserve finance semantics, history/revision/conflict protection, owner authorization, AAL2, RLS and session provenance.
- Do not weaken tests/accessibility/security/bundle/performance thresholds.
- Prefer shared-system corrections over local screenshot-specific patches.
