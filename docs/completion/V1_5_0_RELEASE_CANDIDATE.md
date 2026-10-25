# MyFinHub v1.5.0 — Web + Windows release candidate (NOT PUBLISHED)

Tracker: [#558](https://github.com/MariosGiannakaras/MyFinHub/issues/558)  
Owner approval: **prepare and validate only** (2026-10-13).  
Production promotion / GitHub release / installer tag: **not yet approved**.  
Source baseline: `develop@a32c6398ae7ec372e54b0b9ecdd0a6bf0d7aed7a`; production baseline: `main@ea84d3b4e1e0f30c0f9d7c8af396740bf46245aa`.  
Candidate package versions: root `1.5.0`; Windows desktop `1.5.0`.  
Tentative Windows tag **after actual production acceptance only**: `myfinhub-v1.5.0`.

## Semantic reconciliation of production-only ancestry

The 8 `main`-only commits must not be blindly cherry-picked into newer `develop`:
1. `ee929044` — Android updater API bridge; compatibility API belongs to this repository, Android product repository remains out of scope.
2. `4782fd3c` — Vercel function-budget hotfix.
3. `87490189` — v1.3.0 production promotion.
4. `2673ce62` — v1.3.0 release metadata.
5. `3333b733` — v1.3.0 Windows download metadata.
6. `ef305d04` — v1.4.0 production promotion.
7. `78aa5ee2` — v1.4.0 stable download metadata.
8. `ea84d3b4` — immutable v1.4.0 tag/installer identity clarification.

On 2026-10-13, live blob SHAs for `api/data.ts`, `server/androidUpdateApi.ts`, `server/androidUpdates.ts`, `tests/android-update-api.test.ts`, `vercel.json`, `README.md`, `STATUS.md`, `CHANGELOG.md` and `docs/completion/V1_4_0_RELEASE_CANDIDATE.md` were **identical between `main` and `develop`**. The later production-only commits' functional hotfixes and historical release metadata are already present, while the bulk v1.3/v1.4 promotion commits have newer canonical replacements on develop. No stale source files are imported and **no ancestry join or production merge has occurred** in this preparation batch. Validate `main` ancestry explicitly during the final `develop -> main` PR, preserving the reviewed v1.5.0 candidate tree rather than overwriting it with older release history.

## Mandatory Supabase production migration gate — STOP-SHIP until cleared

Read-only live Supabase project inspection on 2026-10-13: **ACTIVE_HEALTHY**, PostgreSQL 17.6.1.155, **48 applied migration entries** ending with `20261001220945_reject_cross_account_id_collisions`. This repository currently has **52 SQL migration files**, including four **not applied in production**:

1. `20261008165700_add_recurring_service_assets.sql` — owner-only/AAL2 registration, Storage bucket and new assets relation plus recurring-asset foreign-key, triggers and RPC.
2. `20261009190000_allow_recurring_service_asset_storage_owner_read.sql` — owner/AAL2 SELECT policy required for Storage registration.
3. `20261010013500_atomic_card_vault_cleanup.sql` — invoker-privileged guarded encrypted card-secret deletion after durable intent.
4. `20261010145500_guard_pending_card_secret_cleanup_intent.sql` — invoker trigger rejects an older writer dropping durable pending secret-cleanup intent.

**Do not ship v1.5.0 runtime before validating/applying the missing ordered migrations with owner-approved non-destructive production migration procedure, dry-run/security review, rollback/recovery and RLS validation.** No migration or live data mutation was performed during this preparation. Preserve mandatory owner+AAL2+RLS, audit, finance revisions/backups, history semantics and encryption boundaries. Current Supabase security advisory: leaked-password protection disabled (paid-tier feature, documented Free-plan constraint), no new database security bypass authorized.

## Version and published-download boundary

- Keep `package.json`, root `package-lock.json`, `desktop/package.json` and desktop `package-lock.json` root/link versions synchronized to `1.5.0` for candidate packaging. In the desktop lock snapshot, the linked root project's Vitest range is aligned with the actual root `^5.0.3`; dependency versions and installed package graph are otherwise unchanged. All `npm ci` and Windows package checks must really pass.
- Do not change public `README.md` v1.4.0 Windows download badge/URL, `STATUS.md`'s truthful production v1.4.0 status, historical CHANGELOG releases, production Vercel, Windows tag or GitHub Release until verified publication.
- No Android repository changes; no credentials, PAN/CVV, financial data or secret keys in generated artifacts.

## Release go/no-go checklist

- [ ] Coherent candidate PR based on latest develop; targeted source/version/lockfile tests, dependency and privacy audits, canonical finance/security regression suite.
- [ ] Exact Ready review head: CI + full primary Chromium rendered desktop/mobile evidence, CodeQL, WebKit cross-engine, Lighthouse/performance, Real Stack E2E and Windows Desktop/First Run/Clean Launch where relevant. Directly inspect actual generated evidence, logs and true status; skipped is not PASS.
- [ ] Database: reviewed 4 pending migrations; no destructive paths, restored backup rehearsal, owner+AAL2/RLS/storage/card-vault negative-path tests; production migration ledger must match 52/52 before app promotion.
- [ ] Verify `develop` integration postmerge CI and candidate tree; prepare deliberate `develop → main` release PR while **keeping it Draft / unmerged pending explicit separate owner approval**.
- [ ] After explicit owner production authorization and complete gates: promote reviewed candidate to `main`; verify Vercel READY exact deployed main SHA and event-driven Production Smoke PASS. Only then tag the same verified `main` release commit `myfinhub-v1.5.0` for Windows installer packaging, install/launch/uninstall, controlled GitHub Release publication and matching SHA-256 asset.
- [ ] After actual public release: update README download URLs, STATUS current-production checkpoint, release history and independent Vercel/installer SHA proofs; preserve v1.4.0 Web/Windows rollback channel and forward-only migration semantics.

**Current decision:** release preparation GO; **production promotion NO-GO**, pending required exact-head validation, the four migration rollout gates and separate owner production approval.
