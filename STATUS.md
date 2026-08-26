# MyFinHub status

## Production baseline

MyFinHub **v1.3.0** is the current production baseline. `main` and `develop` are synchronized at release commit `e31a4b166be825c7ea3eab43435f3c28750a1c74` (`release: MyFinHub v1.3.0 (#295)`). The production deployment smoke gate for that exact `main` release completed successfully.

MyFinHub remains a private, single-owner personal-finance application. Production deploys from release-only `main` and uses Supabase/PostgreSQL as the durable finance store. Compatibility-critical historical identifiers such as `RheomIQ`, `rheomiq_*` and `RHEOMIQ_*` remain intentionally unchanged where they are persistence/protocol contracts.

The completed v1.3.0 program includes the durable history/account-metadata, cadence-aware recurring, taxonomy/finance-semantics, accessibility/UI-hardening and production-schema/security work tracked through the v1.3.0 release program. Historical release evidence remains in the relevant issues, PRs, Git history and QA archive rather than being duplicated here.

## Active next program — desktop UI/UX redesign

Bootstrap/tracker: **#296**.

The next active product-development program is a controlled, page-by-page **desktop web UI/UX redesign**. Its durable coordination source is `docs/ui-redesign/`.

Phase 1 rules:

- owner design approval is desktop-only;
- canonical review viewport is 1440×1000, with full-page captures for long pages;
- `visual-qa/manifest.json` is the current-rendered-baseline source;
- tablet/mobile web remain regression-protected but are not redesign/approval targets in this phase;
- Android remains a separate native project;
- product behavior, finance/accounting semantics, auth/security and meaningful states remain preserved unless the owner explicitly approves a behavioral change.

## UI/UX evidence and standards

- `visual-qa/` is the bounded latest-only deterministic rendered-evidence archive. Git history provides older visual evidence.
- `docs/UX_STANDARDS.md` remains the active accessibility/interaction-quality baseline.
- `docs/ui-redesign/DESIGN_SYSTEM.md` and `docs/ui-redesign/PAGE_PATTERNS.md` record only shared decisions that are actually established through approved redesigns.
- Historical UI/UX audit/reconciliation documents remain evidence; they are not rewritten merely for cosmetic repository cleanup.

## Protected project-control issue

GitHub issue **#266 — `META: Persistent MyFinHub operating rules — NEVER CLOSE`** is intentionally untouched by the desktop-redesign program. It must not be edited, commented on, relabeled, closed, superseded, consolidated or used for redesign tracking by either redesign chat.

## Delivery workflow

Normal implementation work follows **Issue → short-lived branch from `develop` → PR → required checks → squash merge into `develop`**. `main` remains release-only. Production promotion/release is a separate owner-authorized action.
