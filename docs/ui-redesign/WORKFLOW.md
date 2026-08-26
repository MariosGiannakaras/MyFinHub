# MyFinHub desktop redesign workflow

## Owner interaction contract

The owner should operate the redesign through the two persistent chats only. Routine GitHub navigation/maintenance is not an owner task.

The owner is expected to:

- attach the OLD and NEW direction references once when starting Chat A;
- review generated desktop redesign images;
- request visual corrections in normal language;
- explicitly say `Approved` when a target is accepted;
- pass the exact approved target image to Chat B for implementation.

The owner should not need to browse GitHub to discover the next page, retrieve current QA screenshots, create issues/branches/PRs, inspect Actions, merge routine implementation PRs, or update redesign tracking.

## Roles

The redesign uses two persistent chats with deliberately separate responsibilities.

### Chat A — UI/UX Design Director

Owns:

- repository-informed UX analysis;
- autonomous retrieval/inspection of the latest current desktop screenshot;
- current code/state inspection;
- desktop design proposals;
- generated high-fidelity target images;
- revisions requested by the owner;
- the ordered design queue and automatic progression after approval;
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
- the complete routine issue/branch/commit/PR/check/merge-to-`develop` workflow when repository rules and available permissions allow it.

Does **not** independently redesign a page whose target has already been approved.

Both roles must ignore and never mutate META issue #266.

## Autonomous design queue

The primary design order is defined in `REDESIGN_STATUS.md` and this document.

Chat A must own progression through that queue. The owner does **not** need to name the next page after every approval.

When the owner explicitly approves the current target, Chat A must, in the same continuing workflow:

1. lock the current target as approved in its design-session state;
2. provide only the concise implementation handoff needed for Chat B;
3. determine the next eligible redesign surface from the ordered queue;
4. resolve that surface's latest current desktop evidence itself;
5. inspect the relevant repository implementation and already approved design decisions;
6. generate the next high-fidelity desktop redesign image without waiting for the owner to say `next`, `continue`, or name the page.

Chat A stops automatic progression only when:

- all Phase-1 design-approval surfaces are approved;
- a genuine product/design decision requires owner input before a valid target can be produced;
- a required source is unavailable because of an actual tool/permission failure that Chat A cannot recover from.

A routine repository lookup, screenshot retrieval, Actions artifact lookup or page-order decision is not a reason to hand work back to the owner.

### Design and implementation may progress independently

After approval, Chat A may immediately design the next surface while Chat B implements previously approved targets.

Chat A must carry forward all owner-approved visual decisions from the persistent design conversation even if Chat B has not yet completed implementation of the previous target.

If later implementation reveals a real functional/accessibility conflict in an approved target, that specific design decision may be returned to Chat A/owner for correction without resetting unrelated approved work.

## Per-surface design loop — Chat A

1. **Select surface automatically**
   - Start with the first unapproved eligible surface in the ordered queue.
   - After each explicit approval, advance automatically to the next surface.

2. **Resolve current baseline autonomously**
   - Read `visual-qa/manifest.json` and locate the latest desktop full-page capture for the selected surface.
   - Retrieve/consume the exact latest screenshot through the available repository/Actions/file tooling.
   - If the current baseline needs to be regenerated, use the existing Visual QA workflow/tooling rather than asking the owner to browse GitHub.
   - Never substitute an older screenshot merely because it is easier to access.

3. **Inspect implementation**
   - Inspect the corresponding page/component implementation and directly relevant states/dependencies.
   - Read applicable approved design decisions/patterns.

4. **Design**
   - Create one desktop redesign target using the current implementation, the owner-supplied OLD/NEW direction attachments and already approved patterns.
   - The NEW Dashboard direction image is a quality bar, not a universal layout template and not a source of product functionality.

5. **Owner review**
   - The design remains `DESIGNING` until the owner explicitly approves it.
   - Requested revisions should preserve already accepted decisions and change only what is necessary.

6. **Approval and automatic continuation**
   - On explicit `Approved`, emit the concise implementation handoff.
   - Immediately select, inspect and generate the next design target in the queue in the same ongoing chat workflow.
   - Do not ask `Which page next?` and do not wait for a separate `Continue` instruction.

## Per-surface implementation loop — Chat B

1. **Receive approved target**
   - The owner supplies the exact approved generated image from Chat A.
   - Chat B persists that exact binary as `docs/ui-redesign/references/approved/<surface>/desktop.png` when its workspace exposes the attachment bytes.
   - Never redraw, recompress, regenerate or approximate an approved target merely to create the repository file.
   - If the implementation environment cannot access the approved attachment bytes, report that storage limitation rather than fabricate a substitute; the exact attached image still remains the implementation target.

2. **Implement**
   - Inspect repository state and implement the smallest coherent delta that reproduces the approved target while preserving product behavior.
   - Reuse/evolve shared UI rather than creating page-specific hacks.

3. **Validate**
   - Run narrow relevant tests first.
   - Run broader checks when shared surfaces/tokens/components or repository rules require them.
   - Keep existing mobile/tablet regression checks applicable to changed code, but do not redesign those viewports in Phase 1.

4. **Render and compare**
   - Generate fresh actual screenshots with the existing rendered QA infrastructure.
   - Manually inspect the real desktop render against the approved target for hierarchy, geometry, spacing, typography, controls, data presentation and obvious regressions.
   - Material mismatches must be fixed or explicitly documented as necessary deviations.

5. **Record and deliver autonomously**
   - Update `DESIGN_SYSTEM.md` only for durable shared decisions actually established.
   - Update `PAGE_PATTERNS.md` only for patterns intended for reuse.
   - Update `REDESIGN_STATUS.md`.
   - Perform the routine issue/branch/commit/push/PR/check/merge-to-`develop` lifecycle itself when allowed by repository policy and available permissions.
   - Do not ask the owner to operate GitHub for routine delivery steps.

## Image rules

### Current screenshots

`visual-qa/` is the single persistent current-state archive. Do not create a duplicate `current/` screenshot tree under `docs/ui-redesign/`.

Resolve the exact latest desktop screenshot through `visual-qa/manifest.json` and obtain it autonomously through repository/Actions/file tooling. The owner should not need to browse GitHub to download current screenshots.

### Direction references

The exact OLD and NEW owner-supplied images remain conversation attachments. Their expected dimensions and SHA-256 identities are recorded in `references/direction/README.md`.

Attach both originals once when starting the long-lived Design Director chat. That chat should reuse them throughout Phase 1. Do not replace them with a reconstructed repository derivative.

### Approved targets

Only owner-approved desktop targets belong under `references/approved/`.

Canonical path:

```text
docs/ui-redesign/references/approved/<surface>/desktop.png
```

Use stable surface names matching repository/visual-QA naming where practical. Do not save rejected drafts or numbered `final` variants; Git history preserves prior approved revisions.

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

The actual repository inventory remains authoritative. Add/split a supporting surface only when repository evidence shows it needs a distinct owner-approved desktop target. Chat A decides that from repository evidence; the owner does not need to inventory pages manually.

## Completion definition

A surface is `VERIFIED` only when:

- the owner explicitly approved its desktop design;
- the exact approved target is available to the implementation workflow and is persisted when technically possible without reconstruction;
- implementation preserves existing functionality;
- relevant accessibility and responsive-regression constraints hold;
- relevant tests/checks pass;
- a fresh actual desktop render was manually compared with the approved target;
- material differences are resolved or documented;
- shared redesign docs/status are synchronized;
- the coherent implementation checkpoint has completed the repository delivery workflow into `develop` when policy/permissions allow it.

Phase-1 design work is complete only when Chat A has automatically exhausted the entire repository-backed desktop approval queue and no distinct supporting surface remains unreviewed.
