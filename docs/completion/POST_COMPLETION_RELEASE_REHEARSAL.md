# Post-completion release rehearsal

Tracker: #490  
Production promotion: **not authorized by this document**

## Baselines

- Canonical post-completion product tree: `develop@ffc94cd4dce08137c380391fe2e935d088a8434c` after #492.
- Current production Git baseline: `main@3333b73330c5431c052edcb6e4d1b792a89445a7`.
- Current Vercel production deployment: `dpl_DkzkTVutzEmD4W4fPpqANRP6tsQU`, READY, sourced from that `main` SHA.
- Git merge base: `e31a4b166be825c7ea3eab43435f3c28750a1c74`.
- Current branch relationship at rehearsal time: `develop` is 124 commits ahead and 5 commits behind `main`. A future release therefore requires explicit semantic reconciliation; it must not blindly merge or cherry-pick stale main history.

## Main-only reconciliation boundary

The five main-only commits are the two September Android updater/API hotfix commits, the prior production promotion, and the two v1.3.0 release-metadata commits.

- `server/androidUpdateApi.ts` on current `develop` is byte-identical to the final function-budget hotfix.
- `api/data.ts`, `server/androidUpdates.ts`, updater tests and `vercel.json` have newer `develop` state and must remain authoritative.
- v1.3.0 README/STATUS/release-history edits are historical release metadata. Preserve released history and current download identity, but do not overwrite newer completion/status/documentation state with those old blobs.
- Android product code remains outside this repository; only the already-approved MyFinHub API/update compatibility boundary is relevant here.

## Database and Supabase rehearsal

Production Supabase is healthy and the repository/live migration ledger is exactly **48/48** through:

`20261001220945_reject_cross_account_id_collisions`.

No migration is pending between canonical `develop` and production at this checkpoint.

The project is currently on PostgreSQL 17.6 and has `pgcrypto 1.3` installed. Supabase has announced a PostgreSQL 17.11 minor upgrade with potential `pgcrypto`, `ltree`, `btree_gist` and custom-operator compatibility actions. MyFinHub repository code does not use `pgcrypto` for the card vault; card secrets remain application-encrypted with AES-GCM. Re-check the Supabase upgrade/advisors at actual release time rather than assuming today's 17.6 state.

The live public-schema grant inventory contains explicit `authenticated` grants for the intended Data API tables and no observed `anon` table grants. This is compatible with Supabase's transition to explicit Data API exposure, but any new migration introduced before release must continue to declare intentional grants/RLS instead of relying on automatic exposure.

Current Supabase advisor disposition:

- security: leaked-password protection warning remains; this feature requires a paid Supabase plan and is not a Free-plan release blocker for this single-owner app. Mandatory TOTP/AAL2 and the existing owner/session/RLS boundaries remain required;
- performance: unused-index notices are informational and are not grounds for speculative index removal without representative workload evidence.

## Reused exact-candidate validation

No product/runtime code changed after the canonical #477 product closeout, so #490 reuses the exact-head gates instead of rerunning expensive validation for ceremony.

Final review head `05f97721f2a430f1ce00cd19b35face38f3cf104` passed:

- CI `37234768780`;
- CodeQL `37234768772`;
- Real Stack `37234768785`;
- Cross-engine `37234768912`;
- Performance `37234768805`;
- Windows Desktop `37234768757`;
- Windows First Run `37234768837`;
- Windows Clean Launch `37234768809`.

Canonical merge SHA `6c89d9231ec30df5e580d982b926f838eb29a828` has the same Git tree and subsequently passed Final Visual `37237421596`, CI/rendered `37237421591`, CodeQL `37237421651`, Windows Desktop `37237421553`, Windows First Run `37237421621` and Windows Clean Launch `37237421567`.

Final Visual produced 216/216 captures and direct review covered all 36 distinct surface/state groups.

## Recovery, ordering and artifact contracts

- Migration recovery is forward-only. `scripts/migration-recovery-e2e.ts` rehearses a partial state, roll-forward, idempotent rerun, RLS/grant preservation and an unchanged Supabase migration ledger.
- Database migration files remain strictly ordered and production currently matches the full repository ledger.
- Windows release tags must match `desktop/package.json` and must already point to a commit on `main`.
- The Windows workflow enforces installer size bounds, optional Authenticode integrity, SHA-256 generation/format, install/launch/uninstall lifecycle and publication of the installer plus matching `.sha256` asset.
- The in-app updater accepts only the controlled GitHub release shape and verifies the downloaded installer against SHA-256 before installation.
- #490 found that Production Smoke did not enforce the repository's deployed-SHA identity rule. The branch now adds a fail-closed event-driven check comparing `github.event.deployment.sha` with the current `main` ref plus source regression coverage. Manual `workflow_dispatch` remains a public-surface smoke and is not represented as release-identity proof.

## Go / no-go

**NO-GO for a production promotion at this checkpoint.**

The implemented product tree has strong release evidence, but promotion remains blocked until all applicable items below are resolved or explicitly waived by the owner:

1. merge the #490 production-SHA guard only after its exact-head CI/CodeQL is green;
2. finish the already-owned documentation sequence #491 → #465 so current product identity and Unreleased notes are canonical;
3. resolve the `develop` branch-protection/admin dependency tracked in #487;
4. retain the three #476 independent-manual-browser cells as explicit BLOCKED items unless a direct interactive browser/DevTools/DOM session becomes available or the owner explicitly changes that completion requirement;
5. reconcile the five main-only commits semantically in the future `develop -> main` release path without overwriting newer migrations, workflows, tracking or UI/backend work.

The 49 stale `audit/476-*` branches and closed #479/#482 source branches have no open integration PR. Their physical deletion is desirable repository hygiene but is currently unavailable through the connected GitHub toolset; they must not be used as release authorities.

## Future authorized release sequence

When the owner separately authorizes production promotion:

1. start from the then-current canonical `develop`, not from this rehearsal SHA;
2. reconcile main-only semantics and current documentation/release metadata into one release candidate;
3. confirm migration parity/advisors and re-check any Supabase platform upgrade that has occurred;
4. run only the final candidate gates invalidated by changes since the proven #477 tree, plus all repository-required release gates;
5. require all review threads/checks green before `develop -> main`;
6. after merge, require the Vercel production deployment event and Production Smoke to prove that the deployed SHA equals the new `main` release head;
7. verify privacy-safe production health/integrity;
8. only then create a matching `myfinhub-v<version>` Windows tag/release and verify the published installer checksum/artifact identity.

No production deployment, tag, database mutation or Android publication is performed by this rehearsal.
