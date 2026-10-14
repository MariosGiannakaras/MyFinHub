# MyFinHub v1.5.0 — production release record

## Current verified release state — 2026-10-14

**Owner authorization:** release Web + Windows to production on 2026-10-14; #558 is the release tracker, PR #564 is the production promotion, PR #565 is the post-publication documentation closeout. **Web and Windows release artifacts are verified and published**; the final documentation-only PR merge/production smoke remains the last closeout action.

- **Canonical source:** preparatory #559 was integrated into `develop` and exact Ready head of [#564](https://github.com/MariosGiannakaras/MyFinHub/pull/564) `83aaf59ef5b8a1f07b1f5ed80677eda3fafe6f74` passed CI #38525358313, CodeQL #38525358527, Real Stack E2E #38525358374, WebKit #38525358435, Lighthouse #38525358416, Windows Desktop #38525358692, Windows First Run #38525358369 and Windows Clean Launch #38525358476. CI: 1,298 tests, 615 persisted rendered screenshots, zero npm root/API audit vulnerabilities. Directly reviewed actual desktop/tablet/mobile/dense Reports and privacy screenshots from artifact #11876306322; strict large-data Reports readiness **2,820 ms**, gate unchanged at **5,000 ms**.
- **Production source identity:** repository allows squash only; #564 was merged to `main@0b4e20560908d2378e88ab8746d0bfd9a00e7e01`. The resulting **Git tree `abcedfc2a65fd4b667a1a636bb2946625dcf9cdc` exactly equals the validated PR source tree**. Squash preserved content but did **not** graft develop's historical commit DAG; the ancestry reconciliation and proof remain in the reviewed PR record.
- **Web deployment:** Vercel deployment `dpl_FAJm6XCfPR8rKM4XRjYR17ZW8wvp` READY, tagged `githubCommitRef=main` and `githubCommitSha=0b4e2056...` with accepted public aliases. Event-driven [Production Smoke #38527362224](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/38527362224) **SUCCESS** on exactly that SHA; verifies public app/health, anonymous denial, branded 404, headers/cache and Frankfurt routing. Older v1.4.0 production deployment `dpl_9g9LdWmzVecqhX25uyjJN5ANrTii` remains a verified rollback candidate.
- **Database:** the four additive, forward-only repository SQL migration sources were checked by blob SHA and applied in-order atomically using exact original timestamps. Production Supabase `ahsukppxwaiagampsuzb`: **52/52** migrations ending `20261010145500`; owner/AAL2, RLS/Storage, invoker RPCs, vault cleanup intent trigger and synthetic unauthorized denial verified. No destructive financial-history/database reset, production finance import or private data transfer. Historical v1.4.0 database schema cannot simply be rolled backward; runtime rollback must honor forward-compatible schema.
- **Published Windows release:** automated provenance publisher #38527378877 **SUCCESS** created immutable `myfinhub-v1.5.0`, which resolves directly to the Web release `main` SHA. [Windows Desktop tagged workflow #38527396101](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/38527396101) **both jobs SUCCESS** (actual packaged backend, NSIS installer build, install/launch/uninstall, checksum verification and GitHub publication). Official [GitHub Release #412443281](https://github.com/MariosGiannakaras/MyFinHub/releases/tag/myfinhub-v1.5.0) is **published** and not draft/prerelease: installer `MyFinHub-Setup-1.5.0-x64.exe` (156,577,901 bytes) SHA-256 `0c8f120b29b132f33e675de9f832c672d2cec3d62d71c4cd31f39bb201d40b68`; checksum asset `MyFinHub-Setup-1.5.0-x64.exe.sha256` (96 bytes) SHA-256 `1f0aaa36cadc5547086d39ad9b4db978be6123fbcce000496e5b6c9ed551375e`. Independently recomputed checksum asset digest from the exact release installer digest and canonical CRLF record; match confirmed. Separate pre-publication CI validation build had a different SHA and size (156,577,902 bytes); do not conflate these independent source-identical but not byte-identical Windows builds. Public build is **unsigned** (Windows SmartScreen/Unknown publisher notice explicitly disclosed). Keep v1.4.0 installer/website deployment as rollback artifacts.
- **Security and health:** existing Supabase Free-plan leaked-password-protection WARN persists; a Node 24 `url.parse()` deprecation in Vercel runtime spans v1.4/v1.5, is not an app error or smoke failure and warrants independent dependency review rather than speculative release weakening.
- **Boundary:** Android remains independently owned; versioned financial storage, backups/history/audit and owner+AAL2/RLS remain authoritative. Do not publish a new main metadata commit until the immutable v1.5.0 release tag exists and Windows publication has succeeded.

**Implementation tracker:** Implementations 0/1 completed · Sub-implementations 5/6 completed (final release metadata PR #565 and new exact main production smoke remain pending).

---

## Historical pre-release preparation snapshot — 2026-10-13 (superseded by above)
The following was the accurate contemporaneous **prepare-only** state. It is archived for audit; its NO-GO statements, 48/52 ledger and v1.4.0 labels are not current as of the release above.

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
