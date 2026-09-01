# MyFinHub desktop UI redesign workspace

This directory is the durable coordination layer for the Phase-1 desktop redesign.

## Implementation Engineer startup

For implementation/resume work, read in this order:

1. repository `AGENTS.md`;
2. `IMPLEMENTATION_RULES.md`;
3. `PROJECT_SCOPE.md`;
4. `WORKFLOW.md`;
5. `APPROVED_ACTUAL_PROTOCOL.md`;
6. `DESIGN_SYSTEM.md`;
7. `PAGE_PATTERNS.md`;
8. `REDESIGN_STATUS.md`;
9. `MASTER_PROMPT.md`;
10. `docs/UX_STANDARDS.md`, `visual-qa/README.md` and `visual-qa/manifest.json`.

Current repository/PR/check state is authoritative over stale tracking text. Recover an existing implementation before starting new work.

## Visual sources

- Current implementation evidence: `visual-qa/manifest.json` and the corresponding latest screenshots/artifacts.
- Approved targets: `references/approved/<surface>/desktop.png` when the exact owner-approved binary is technically persisted.
- When an approved attachment cannot be stored without reconstruction, record its exact identity/hash in the active PR and continue to treat the owner-supplied pixels as the visual source of truth.

Approved targets govern structure and presentation, not literal fixture values or replacement branding. See `APPROVED_ACTUAL_PROTOCOL.md`.

## Protected exclusion

GitHub issue #266 is outside this workflow. Do not open, inspect or use it. All redesign operating rules required by the Implementation Engineer must be checked in here or in applicable `AGENTS.md` files.