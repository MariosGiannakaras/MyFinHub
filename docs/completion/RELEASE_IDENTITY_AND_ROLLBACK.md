# MyFinHub release identity, stop-ship and rollback runbook

This runbook is the operational contract for promoting a completion candidate from `develop` to release-only `main`. It does not authorize a release by itself. The exact candidate must still satisfy the completion plan and all required exact-head gates.

## Release identity record

Before promotion, record one coherent release identity:

- application version from `package.json`;
- exact accepted Git commit SHA;
- `develop -> main` release PR and resulting `main` SHA;
- Vercel production deployment SHA and deployment id/url;
- Supabase production migration ledger tail and proof that repository/live migration sets match;
- Windows installer filename, exact byte size and SHA-256 checksum;
- matching `myfinhub-v<version>` tag and GitHub Release id;
- Windows artifact version/product identity;
- date/time of final production smoke.

A release is not coherent if any of these refer to different source commits or versions.

## Stop-ship conditions

Do not merge/promote/publish when any of the following is true:

1. required CI, CodeQL, rendered Chromium, WebKit/cross-engine, Performance, Windows Desktop, Windows First Run or Windows Clean Launch is red, cancelled, stale or belongs to a different code-bearing SHA;
2. the completion plan contains an unresolved critical/high security, data-integrity or destructive-flow defect;
3. repository migrations differ from the production ledger without an explicit pending-migration plan;
4. the final visual/manual review ledger contains an unresolved material layout, accessibility or privacy defect;
5. production smoke cannot prove the deployed Vercel SHA is the intended release SHA;
6. Windows installer checksum/size/product version does not match the release metadata;
7. a migration needs destructive rollback to recover safely;
8. a finance mutation or import/restore test indicates possible data loss, duplicate write or secret exposure.

## Database recovery rule

Production finance migrations are recovered by **roll-forward**, not by destructive schema rollback.

- Rehearse each pending migration on an isolated production-like branch first.
- If a migration fails before commit, fix the migration and re-run on the isolated branch before production.
- If an additive migration commits but application promotion is stopped, keep the newer compatible schema and roll the application code back/forward independently.
- Never drop production finance columns/tables/functions or delete finance rows merely to make an older application build work.
- If compatibility is uncertain, stop the release and preserve the database state until a forward-compatible patch is validated.

## Web rollback

If the new production deployment is unhealthy after promotion:

1. stop additional release actions;
2. identify the last known-good `main` deployment SHA;
3. verify the current database schema is backward-compatible with that build;
4. redeploy/restore the last known-good application deployment without rolling back finance data;
5. verify `/api/health`, unauthenticated API protection, security headers and the deployed SHA;
6. run privacy-safe production smoke and bounded log review;
7. keep the failed release commit available for diagnosis and fix-forward.

## Windows rollback

Windows releases are immutable tagged artifacts.

- Never replace an installer under an existing release tag/version.
- If a published installer is bad, stop distribution and publish a new patch version after validation.
- The client update channel must continue to require the installer + matching SHA-256 asset.
- If the web/backend remains compatible, an older installed Desktop client may continue to operate; if compatibility is not proven, stop the release and issue a corrected patch before encouraging update.

## Evidence record template

Fill this section on the final candidate; do not infer values.

| Field | Final value |
| --- | --- |
| App version | PENDING |
| Accepted candidate SHA | PENDING |
| Release PR / main SHA | PENDING |
| Vercel deployment SHA/id | PENDING |
| Production migration tail | PENDING |
| Migration drift | PENDING |
| Windows installer | PENDING |
| Installer bytes | PENDING |
| Installer SHA-256 | PENDING |
| Release tag / Release id | PENDING |
| Final production smoke | PENDING |

## Completion rule

The release-identity audit item closes only when every `PENDING` field is replaced with directly observed evidence for one release candidate and the rollback/stop-ship procedure has been exercised or dry-run against that candidate without mutating production finance data.
