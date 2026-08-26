# MyFinHub desktop UI redesign workspace

This directory is the durable coordination layer for the **Phase 1 desktop web UI/UX redesign** of MyFinHub.

## Start here

Read these files in order:

1. `PROJECT_SCOPE.md` — current phase, source-of-truth precedence, protected exclusions.
2. `WORKFLOW.md` — two-chat design/implementation workflow and approval gates.
3. `DESIGN_SYSTEM.md` — approved shared visual rules; intentionally minimal at bootstrap.
4. `PAGE_PATTERNS.md` — approved reusable structural patterns; intentionally minimal at bootstrap.
5. `REDESIGN_STATUS.md` — current surface-by-surface progress.
6. `MASTER_PROMPT.md` — broad redesign principles supplied by the owner.

`PROJECT_SCOPE.md` is the current-phase override for any broader responsive instruction in `MASTER_PROMPT.md`.

## Visual sources

- **Current implementation:** use `visual-qa/manifest.json` to locate the latest full-page desktop captures produced from deterministic QA data. Do not duplicate those images under this directory.
- **Design direction:** `references/direction/` contains the owner-supplied OLD and NEW dashboard references.
- **Approved targets:** `references/approved/<surface>/desktop.png` contains only designs explicitly approved by the owner.

Current implementation evidence and approved target images have different purposes and must never be treated as interchangeable.

## Historical UI/UX documentation

Existing files such as `docs/UI_UX_AUDIT_EVIDENCE.md` and `docs/UI_UX_ACTIONS_RECONCILIATION.md` remain historical/implementation evidence. They are not replaced or rewritten merely to make the redesign workspace look cleaner.

`docs/UX_STANDARDS.md` remains an active baseline for accessibility and interaction-quality requirements. Approved visual decisions for this redesign belong here in `DESIGN_SYSTEM.md` and `PAGE_PATTERNS.md`.

## Protected META issue

GitHub issue **#266 — `META: Persistent MyFinHub operating rules — NEVER CLOSE`** is strictly protected and outside the redesign workflow. Do not edit, comment on, relabel, close, supersede, consolidate, copy into redesign tracking, or otherwise mutate it. The redesign chats must ignore it as a project artifact.
