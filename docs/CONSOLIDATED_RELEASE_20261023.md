# MyFinHub — consolidated 1.6.0 release preparation (not deployed)

## Latest accepted integration checkpoint (2026-10-24; DRAFT release only)
- Merge to protected `develop@c238a9d6537a0b8a4ddea3b6b22e42392c46f4c8` accepted #616 owner-approved Recurring origin, report/credit source navigation, shared savings-pool/disclosure and non-destructive account dependency behavior through [PR #618](https://github.com/MariosGiannakaras/MyFinHub/pull/618). **Implementations 5/5 completed**; no new sub-implementation denominator. Prior #588 12/12 · 24/24 remains complete.
- [Ready exact-head CI #40071928581](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/40071928581) SUCCESS including rendered Chromium, Lighthouse, WebKit, Windows installer/clean launch/first run, CodeQL and Unified gate, plus independent exact-head Real Stack #40071752560 and CodeQL #40071752562 SUCCESS. Responsive screenshots directly inspected.
- Merge reconciled **from the complete accepted develop Git tree**, reapplying only documented release-version metadata and historical README/status/changelog files. This prevents stale release branch package locks from downgrading patched `body-parser@2.4.0`, `electron@43.8.3`, `undici@7.30.1` and `node-gyp/undici@6.29.1`. Existing carefully bounded build-time advisory handling remains unchanged.
- [ ] Verify `develop` postmerge full CI #40073640592 on its exact head, then run fresh release PR #605 Ready exact-head full required matrix/Real Stack, inspect rendered output and compare release-vs-develop exclusively to release metadata before authorizing Production.
- No `main` merge, destructive DB action, production migration, authenticated live taxonomy 20/6 mutation, Windows upload, deployment or tag creation has occurred; **owner go/no-go** is required after verified current recovery point and migrations.

## Scope & branch reconciliation
- Reviewed integration: `develop@a177b92fdbecacf09dee093a04bd7c3b4bdeb382`; existing Production release: `main@5343f0eddaee2641269d3b68b1763ab3cb51cfdc`. The common ancestry diverged across old release commits. The candidate preserves both histories as parents while taking the fully reviewed implementation/security/CI sources from develop and historical v1.5.0 release notes/download links from main. No force-push. Old main-only one-shot v1.5.0 publisher is intentionally **not** revived because the published tag is immutable.
- Release code keeps owner/TOTP AAL2, JWT + RLS, session provenance, immutable finance audit/history and vault ciphertext separation; Android is independent and untouched.
- Current repository #588 feature code 12/12 implementations · 24/24 subitems complete, #601 taxonomy code 4/4 · 8/8. Pre-release cross-feature corrections (#606/#608/#610/#612/#615) were integrated into protected develop through [#614 exact-head CI SUCCESS, attempt 2](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/40012917908). New develop postmerge and this updated release candidate's exact-head checks remain separately required; live taxonomy activation remains open.
- v1.6.0 prepared as **one coherent Web + Windows version** in both package roots and lockfiles; older 1.5.0 download remains the public README link until the new installer is actually published. Never relabel already-released v1.5.0 artifacts.

## Post-audit code reconciliation (not deployed)
- Source: 16 accepted finance implementation/test/audit files from `develop@a177b92fdbecacf09dee093a04bd7c3b4bdeb382` now included while preserving prior release branch and published `main` ancestry as separate merge parents. Existing release-only versions, lockfiles, README and v1.5.0 download metadata remain unchanged.
- [ ] Run new exact-head v1.6.0 full required CI/rendered QA/CodeQL/WebKit/Lighthouse/Windows and inspect the output. Previous release CI is not proof for this new tree.
- [ ] Confirm postmerge develop push CI and release-vs-develop differences remain restricted to intended release metadata and version files.
- #606 source fix accepted; #608/#610/#612/#615 included via merged #614; superseded duplicate PRs #609/#611/#613 closed without double applying their content.

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
