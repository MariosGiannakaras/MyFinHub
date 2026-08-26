# MyFinHub desktop redesign workflow

## Roles

The redesign uses two persistent chats with deliberately separate responsibilities.

### Chat A — UI/UX Design Director

Owns:

- repository-informed UX analysis;
- current screenshot/code inspection;
- desktop design proposals;
- generated high-fidelity target images;
- revisions requested by the owner;
- identification of new shared design-system/pattern decisions.

Does **not** implement production UI code.

### Chat B — UI Implementation Engineer

Owns:

- implementation of an explicitly approved desktop target;
- shared component/token evolution required by that target;
- preservation of functionality and non-desktop regression safety;
- relevant tests/rendered QA;
- target-vs-actual visual verification;
- redesign documentation/status updates;
- issue/branch/commit/PR workflow.

Does **not** independently redesign a page whose target has already been approved.

Both roles must ignore and never mutate META issue #266.

## Per-surface loop

1. **Resolve current baseline**
   - Read `visual-qa/manifest.json` and locate the latest desktop full-page capture for the surface.
   - Inspect the corresponding page/component implementation and directly relevant states/dependencies.

2. **Design**
   - Chat A creates one desktop redesign target using the current implementation, the design-direction references and already approved patterns.
   - The Dashboard direction image is a quality bar, not a universal layout template.

3. **Owner review**
   - The design remains `DESIGNING` until the owner explicitly approves it.
   - Requested revisions should preserve already accepted decisions and change only what is necessary.

4. **Persist approved target**
   - The exact approved image becomes `docs/ui-redesign/references/approved/<surface>/desktop.png`.
   - Do not save rejected iterations as permanent reference files; Git history is sufficient for prior approved revisions.

5. **Implement**
   - Chat B inspects repository state and implements the smallest coherent delta that reproduces the approved target while preserving product behavior.
   - Reuse/evolve shared UI rather than creating page-specific hacks.

6. **Validate**
   - Run narrow relevant tests first.
   - Run broader checks when shared surfaces/tokens/components or repository rules require them.
   - Keep existing mobile/tablet regression checks applicable to changed code, but do not redesign those viewports in Phase 1.

7. **Render and compare**
   - Generate fresh actual screenshots with the existing rendered QA infrastructure.
   - Manually inspect the real desktop render against the approved target for hierarchy, geometry, spacing, typography, controls, data presentation and obvious regressions.
   - Material mismatches must be fixed or explicitly documented as necessary deviations.

8. **Record**
   - Update `DESIGN_SYSTEM.md` only for durable shared decisions actually established.
   - Update `PAGE_PATTERNS.md` only for patterns intended for reuse.
   - Update `REDESIGN_STATUS.md`.
   - Commit/push a coherent checkpoint and return through the repository PR workflow.

## Image rules

### Current screenshots

`visual-qa/` is the single persistent current-state archive. Do not create a duplicate `current/` screenshot tree under `docs/ui-redesign/`.

### Direction references

`references/direction/` contains the two permanent owner-supplied starting references. They are not implementation snapshots and do not define product functionality.

### Approved targets

Only owner-approved desktop targets belong under `references/approved/`.

Recommended canonical path:

```text
docs/ui-redesign/references/approved/<surface>/desktop.png
```

Use stable surface names matching repository/visual-QA naming where practical.

## Design order

Prioritize patterns with high reuse instead of blindly following navigation order:

1. Dashboard + application shell
2. Transactions
3. Quick Entry / transaction-entry patterns
4. Savings
5. Cards
6. Credit
7. Loans
8. Lending
9. Recurring
10. Planning
11. Attention / action center
12. Review
13. Reports
14. Settings
15. Supporting overlays and secondary surfaces (account management, budgets/categories, command palette and other repository-backed UI that still requires explicit redesign review)

The actual repository inventory remains authoritative. Add a surface to `REDESIGN_STATUS.md` when repository inspection shows it deserves its own approval target.

## Completion definition

A surface is `VERIFIED` only when:

- the owner explicitly approved its desktop design;
- the approved target is durably stored;
- implementation preserves existing functionality;
- relevant accessibility and responsive-regression constraints hold;
- relevant tests/checks pass;
- a fresh actual desktop render was manually compared with the approved target;
- material differences are resolved or documented;
- shared redesign docs/status are synchronized;
- the coherent implementation checkpoint is committed/pushed through the repository workflow.
