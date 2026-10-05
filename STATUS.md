# MyFinHub status

## Current production

MyFinHub v1.3.0 remains the current production/web and Windows release baseline.

- `main` is release-only; no production promotion is authorized by the current post-completion work.
- Current production Vercel remains on the v1.3.0 release line.
- Windows release tag: `myfinhub-v1.3.0`.
- Exact tagged release commit: `2673ce626c0e3db6c30fea04a46b6cf1ce9517df`.
- Published installer: `MyFinHub-Setup-1.3.0-x64.exe`.
- Published installer SHA-256: `a405189e016ddd03e31ab1ba92979b3991a64516edfa2a657eb7b9928fadc556`.
- Release-closeout tracker #288 is complete.

## Canonical integration state

Current canonical integration baseline is the live `develop` branch. This file intentionally does not embed its own volatile merge SHA; use the live branch head for the exact commit.

- #477 is integrated and its final product tree passed the required source/rendered/security/cross-engine/performance/Windows validation.
- #492 records the canonical post-merge completion closeout.
- #493 is integrated and Production Smoke now fails closed when an event-driven production deployment SHA does not match current `main`.
- #491/#472 is complete: current repository-facing product documentation uses the MyFinHub identity while compatibility-critical historical/protocol identifiers remain untouched.
- #465/#464 is complete: post-v1.3.0 `[Unreleased]` coverage is reconciled; released history is unchanged.
- Final Visual produced 216/216 Light/Dark × desktop/tablet/mobile captures, with direct review of all 36 distinct surface/state groups.
- The code-level UI reuse/orphan/consistency audit is complete.

Detailed completion authority remains `docs/completion/APP_COMPLETION_AUDIT_AND_PLAN.md`; live post-completion hardening counters and blockers are owned by issue #490 rather than duplicated here.

### Completion tracker #476

**Implementations 19/24 completed · Sub-implementations 189/197 completed**

Remaining non-release evidence gaps are limited to three independent direct-interactive browser protocol cells:

- hands-on navigation of the canonical running app for the high-risk flows;
- direct DevTools console/network inspection;
- direct rendered DOM/accessibility-tree inspection.

Those cells remain BLOCKED when no direct interactive browser/computer session is attached to the exact canonical QA runtime and are not inferred from automation.

Release-only cells also remain open: explicit `develop -> main` release-candidate validation, production deployed-SHA/smoke/integrity verification, and end-to-end release identity/rollback metadata. No production promotion is authorized.

## Active post-completion hardening — #490

Issue #490 is the live 4-implementation / 16-sub-implementation authority for this workstream. Do not copy its changing counters into this file.

Completed work includes:

- stale stacked integration cleanup and reconciliation of #478/#481/#479/#482/#486;
- reuse of exact canonical rendered/accessibility/error-state evidence for the bounded residual UX sweep;
- bounded architecture/debt review with no speculative cleanup;
- release rehearsal, 48/48 repository/live Supabase migration parity, and the documented current NO-GO release handoff in `docs/completion/POST_COMPLETION_RELEASE_REHEARSAL.md`;
- Production Smoke release-identity hardening through #493;
- repository-facing documentation identity alignment through #491/#472;
- Unreleased changelog convergence through #465/#464.

Remaining repository-hygiene dependencies are explicit:

- exactly **48** `audit/476-*` branches are identified; physical deletion is not claimed because the connected GitHub toolset exposes no branch/ref deletion action;
- `develop` repository protection and canonical homepage metadata remain tracked exclusively by #487 and require repository-admin write capability unavailable in the current integration.

No stale implementation PR is an integration authority. No open `audit/476-*` branch may overwrite newer migrations, workflow rules, tracking, or validated unrelated work.

## Repository administration — #487

#487 is the single canonical tracker for repository-admin settings:

- protect `develop` against deletion and force-push/non-fast-forward updates;
- require pull requests, resolved review threads, strict `validate`, and CodeQL at the established security threshold;
- align the repository homepage to `https://mgfinhub.vercel.app`.

These settings are currently blocked on repository-admin write capability. Older overlapping #485 is closed as superseded.

## Durable security and finance invariants

- MyFinHub remains single-owner.
- Production authentication is email/password + mandatory TOTP/AAL2.
- Finance access remains API-authorized and PostgreSQL RLS-backed with active-device/session enforcement.
- PAN/expiry/CVV remain outside FinanceData/backups and only in the encrypted server card vault.
- `CARD_VAULT_KEY`, service-role credentials and other privileged secrets are never distributed in browser, Windows or Android clients.
- Optimistic revisions, backups, audit/history, non-destructive financial history and the single canonical finance/accounting engine remain authoritative.
- No destructive production database action, release promotion or Android modification is authorized by #490.

## Workflow

Routine changes remain:

**Issue → short-lived branch from current `develop` → coherent validation → PR → squash merge to `develop`.**

`main` remains release-only. Production promotion requires a separate explicit owner decision.
