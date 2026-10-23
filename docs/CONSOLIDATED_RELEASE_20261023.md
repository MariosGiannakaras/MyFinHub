# MyFinHub — consolidated 1.6.0 release preparation (not deployed)

## Scope & branch reconciliation
- Reviewed integration: `develop@579ccdb202870ab0a15e896737c23260595003df`; existing Production release: `main@5343f0eddaee2641269d3b68b1763ab3cb51cfdc`. The common ancestry diverged across old release commits. The candidate preserves both histories as parents while taking the fully reviewed implementation/security/CI sources from develop and historical v1.5.0 release notes/download links from main. No force-push. Old main-only one-shot v1.5.0 publisher is intentionally **not** revived because the published tag is immutable.
- Release code keeps owner/TOTP AAL2, JWT + RLS, session provenance, immutable finance audit/history and vault ciphertext separation; Android is independent and untouched.
- Current repository #588 feature code 12/12 implementations · 24/24 subitems complete, accepted full develop-push [CI #39960354101](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/39960354101) PASS. #601 taxonomy code 4/4 · 8/8, live activation remains separately open.
- v1.6.0 prepared as **one coherent Web + Windows version** in both package roots and lockfiles; older 1.5.0 download remains the public README link until the new installer is actually published. Never relabel already-released v1.5.0 artifacts.

## Mandatory last-mile production checklist — not complete
- [ ] This release candidate's **Ready exact-head** full strict Chromium rendered, WebKit, CodeQL, Lighthouse and three Windows lifecycle gates/Unified required gate SUCCESS. Inspect fresh responsive output; do not accept historical branch runs as substitute.
- [ ] **Restore/recovery checkpoint:** verify a recoverable current Production backup before migration. Read-only 2026-10-23 preflight: owner finance revision **465**, backup rows **50** (newest created **2026-10-22 22:33:50 UTC**), state update **2026-10-22 22:47:07 UTC** (after latest recorded backup); history points **39**, audit entries **468**, encrypted vault records **1**. A more recent verified recovery point is needed for exact latest state. Do not download secrets or replace/rotate Card Vault key.
- [ ] Apply only following four additive, reviewed, version-controlled Supabase migrations **in exact order**, each requiring verification and a known recovery path before Production promotion:
  1. `20261019110000_protect_irreversible_history_boundaries.sql` (append-only imported-history and finalized card-secret guards)
  2. `20261021091500_add_lending_writeoff_event_kind.sql` (expand noncash loan/receivable event-kind check)
  3. `20261021211500_allow_noncash_writeoff_health.sql` (update invoker health checks)
  4. `20261022213500_expand_budget_scope_to_subcategories.sql` (subcategory constraint and unique index).
- [ ] Obtain exact live migration-list and schema integrity verification (owner/RLS/immutable events/history, revision) after DDL; preserve existing wallet/revision/audit. **Never use privileged SQL to apply the 20/6 category data.**
- [ ] Deliberately merge the approved release PR to `main` (not a rebase/squash of old main history). Verify Vercel Production deployment matches the merged `main` SHA and event-driven Production Smoke SUCCESS for real `mgfinhub.vercel.app`, /api/health, 401 unauthenticated finance, security headers, 404, CSP/no-store/region, error scan and login/TOTP flows.
- [ ] With an authenticated owner+AAL2 app session, apply approved category taxonomy 20/6 via ordinary optimistic revision + backup/history/audit and re-read saved state; only then close #601. Last read-only database state 18/6, do not falsely mark live activation complete.
- [ ] Tag and publish immutable `myfinhub-v1.6.0` **only after** main ancestry/Windows installer real checks, checksum and optional signing verified. Keep all earlier release artifacts. Coordinate README download link/STATUS update after actual publication.
- [ ] After real release verification, clean up only merged/obsolete branches and truly resolved issues/PRs; keep #266 OPEN, #601 OPEN until verified, and retain protected release history, checks and security/audit files.

## Deployment-only boundary
Everything in this file is preparatory. No Production SQL, finance mutation, public deployment, Windows binary upload, tag overwrite, Android change or `main` update has been performed while constructing the candidate. Perform the checklist as an approved release transaction, never silently auto-merge when a gate is failing/pending.
