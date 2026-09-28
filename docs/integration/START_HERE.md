# START HERE — develop → production integration

Issue: **#429 — Integration: make develop canonical and prepare production promotion**

## Purpose

This folder is the complete handoff package for the integration work. It is intentionally written so a different chat/agent can continue with **no access to prior conversation memory**.

The repository is the source of truth. Do not infer missing decisions from old chats.

## Canonical product direction

- `develop` is the application to keep.
- Preserve the redesigned UI, page structure, shared components and new functionality.
- Do not restore legacy `main` UI merely because it is currently deployed.
- If meaningful old functionality was accidentally lost, restore the capability **inside the new design/architecture**, not by reintroducing legacy presentation.
- Backend/API/schema/migrations may be added or changed as needed so the canonical `develop` app works correctly.
- Preserve the code-health cleanup: prefer one canonical component, state flow and finance engine over parallel old/new implementations.
- Historical META material is context, not a strict product specification when it conflicts with newer owner decisions in this folder.
- Security, finance-history, auth/RLS and data-integrity invariants in `AGENTS.md` remain implementation constraints unless the owner explicitly changes them.

## Required reading order for a new chat/agent

1. Read `AGENTS.md`.
2. Read this file.
3. Read `DECISIONS.md`.
4. Read `PROGRESS.md`.
5. Read `IMPLEMENTATION_PLAN.md`.
6. Read `RELEASE_CHECKLIST.md`.
7. Recover the current Git state:
   - issue #429;
   - active integration branch/PR;
   - current `develop` and `main` refs;
   - current diff and CI/check state.
8. Inspect the actual current code for the phase being resumed. Old audit/status docs may be stale.
9. Continue only from the first incomplete item in `PROGRESS.md`.

## Source precedence

When sources disagree, use this order:

1. explicit owner decisions in `DECISIONS.md`;
2. current code + tests + database/release facts recovered live;
3. repository invariants in `AGENTS.md`;
4. this integration plan;
5. older redesign/release-readiness/status documentation.

Do not use old status prose as evidence that current code still behaves the same. Re-verify material facts at implementation time.

## Handoff rule

Before ending any implementation session:

- update the phase/task states in `PROGRESS.md`;
- record the exact branch and last verified commit/PR head;
- list files changed;
- list tests/checks run and their result;
- record any blocker or unresolved decision;
- write the exact next safe action.

A session is not considered cleanly handed off until that update is committed/pushed.

## Scope safety

Creating or updating these planning files does **not** authorize:

- a merge to `main`;
- a production deploy;
- a Supabase production migration;
- a production data mutation;
- a release publication.

Those actions require the release gates in `RELEASE_CHECKLIST.md`.
