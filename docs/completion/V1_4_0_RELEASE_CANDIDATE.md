# MyFinHub v1.4.0 release candidate

Tracker: #476  
Owner production authorization: 2026-10-06  
Release version: `1.4.0`  
Production target: `main`  
Windows tag after production verification: `myfinhub-v1.4.0`

## Final release result — 2026-10-07

The owner-authorized v1.4.0 release is complete.

- Production `main`: `ef305d040772b68f77d70595afbe12d6ff38cd80`.
- Canonical release tree: `4c21e5dc2e51265a6ba5171c6860bfcc6e2108ef`.
- Vercel production: `dpl_8TWQfb6uR11xKbJ56Z7eRr3XYDX9`, READY, exact same Git SHA.
- Production Smoke #172 / `37536811558`: SUCCESS.
- Production Supabase: ACTIVE_HEALTHY, PostgreSQL 17.6.1.155, 48/48 migrations through `20261001220945_reject_cross_account_id_collisions`.
- Windows tag: `myfinhub-v1.4.0` -> exact production main SHA.
- Windows Desktop tag workflow #3019 / `37539058589`: SUCCESS.
- GitHub Release: `MyFinHub Desktop myfinhub-v1.4.0`, published and neither draft nor prerelease.
- Installer: `MyFinHub-Setup-1.4.0-x64.exe`, 155,945,414 bytes, GitHub SHA-256 `c670ca3c47c7c2ae72c7be5acdafad7cf86a1a4156a3262b9f6c76b1b44e41a4`.
- Checksum asset: `MyFinHub-Setup-1.4.0-x64.exe.sha256`, 96 bytes; its GitHub digest `e19efc8fd520246c5d81832bdb569a378f6b234437a5c8dde27b9bf4dc0a982a` independently matches the expected CRLF checksum record containing the installer digest and exact filename.
- v1.3.0 is retained as the documented non-destructive rollback baseline; production database history/migrations are not rolled back.

## Release boundary

The release candidate is the then-current canonical `develop` tree after the Node 24/dependency-health reconciliation is integrated. The final candidate SHA is recorded only after that integration settles and the release-prep branch is rebased/recreated from the exact live `develop` head.

Current production baseline before promotion:

- Git `main`: `3333b73330c5431c052edcb6e4d1b792a89445a7`.
- Vercel production deployment: `dpl_DkzkTVutzEmD4W4fPpqANRP6tsQU`, READY, sourced from that exact main SHA.
- Stable Windows release: `myfinhub-v1.3.0`.
- Published installer: `MyFinHub-Setup-1.3.0-x64.exe`.
- Production Supabase project: `ahsukppxwaiagampsuzb`, ACTIVE_HEALTHY, PostgreSQL 17.6.1.155 in `eu-central-1`.
- Production migration ledger: 48/48 through `20261001220945_reject_cross_account_id_collisions`; no release migration is pending at this checkpoint.

The five historical main-only commits are already semantically represented or superseded in newer `develop` code and release metadata. Release reconciliation must preserve the current `develop` tree as product authority while joining Git ancestry with current `main`; it must not reintroduce stale main file contents.

## Pre-promotion acceptance

Before `main` changes:

1. reconcile and merge #505/Node 24 maintenance into `develop`;
2. freeze the exact v1.4.0 candidate from live `develop`;
3. verify root + Windows package versions are both `1.4.0`;
4. verify production migration parity and review current Supabase security/performance advisors;
5. run the required CI/rendered, CodeQL, Real Stack E2E, Cross-engine, Performance, Windows Desktop, Windows First Run and Windows Clean Launch gates on the exact release candidate;
6. require zero unresolved PR review threads.

Any required gate failure, migration drift, security regression, release-version mismatch or unresolved review finding is **STOP-SHIP**.

## Production verification

After the release PR merges to `main`:

1. require the Vercel Production deployment to reach READY;
2. require deployment Git SHA to equal the exact new `main` SHA;
3. require the event-driven Production Smoke workflow to pass (manual smoke is supporting evidence only);
4. verify `/` and `/api/health` are healthy with the expected security/no-store/request-id contract;
5. verify unauthenticated protected finance routes continue to fail closed;
6. rerun migration parity and privacy-safe Supabase/Vercel integrity checks without mutating personal finance data.

A deployed-SHA mismatch, production smoke failure, protected-route authorization regression or unexpected production integrity error is **STOP-SHIP**. Do not create the Windows v1.4.0 release tag while production proof is red or incomplete.

## Rollback / recovery

Web rollback target before promotion is the known READY v1.3.0 Vercel deployment `dpl_DkzkTVutzEmD4W4fPpqANRP6tsQU` sourced from `3333b73330c5431c052edcb6e4d1b792a89445a7`.

This release does not require a new database migration. The current database changes are additive/backward-compatible with the existing v1.3.0 production application, so a web rollback does not require destructive database rollback.

If a post-deploy defect requires rollback:

- stop Windows v1.4.0 publication if the tag has not yet been created;
- restore the known-good Vercel production deployment/main release state using the established release channel;
- do not reset, rewrite or roll back production finance history;
- keep the production Supabase migration ledger intact unless a separately reviewed forward-recovery plan proves a database action is necessary.

Windows v1.4.0 is now the stable desktop release. The verified v1.3.0 web/Windows state is retained as the documented non-destructive rollback baseline.

## Windows release identity

Only after production verification passes:

- create `myfinhub-v1.4.0` on the exact verified `main` release commit;
- require the tag workflow to validate main ancestry and exact package/tag version matching;
- require `MyFinHub-Setup-1.4.0-x64.exe` and its `.sha256` asset;
- independently verify tag SHA, release publication state, installer name/size/digest and checksum metadata;
- then update stable README/STATUS download metadata to v1.4.0 through a final docs-only PR.

The final #476 closeout requires one coherent identity across package version, Git release SHA, Vercel deployment SHA, Windows tag, installer checksum, migration state and durable release metadata.
