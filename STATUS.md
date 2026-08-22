# MyFinHub status

## Current baseline — v1.2.2 released

MyFinHub is a private, single-owner personal finance application. Production deploys from release-only `main` to Vercel and uses Supabase/PostgreSQL as the durable finance store. Compatibility-critical historical identifiers such as `RheomIQ`, `rheomiq_*` and `RHEOMIQ_*` remain intentionally unchanged where they are persistence/protocol contracts.

The Windows startup/first-run incident tracked by #202 is fully released and closed as **MyFinHub v1.2.2**.

- current production release: **v1.2.2**
- production release commit: `main@30a4baece76e70cd83962821cd3e09aadca83497`
- release tree: `67f25b6ce37cab5fe48d43ed1ae0e2386e82ea8b`
- implementation PR: **#203** → `develop@e74db8cd8baaaf2db1b0793925ddf5f443796085`
- release-prep PR: **#219** → `develop@ba43b26fceda46c67a478a3685576d52f712d654`
- production PR: **#220** → `main@30a4baece76e70cd83962821cd3e09aadca83497`
- release tag: **`myfinhub-v1.2.2`** → exact production release commit
- Windows release assets: `MyFinHub-Setup-1.2.2-x64.exe` and `MyFinHub-Setup-1.2.2-x64.exe.sha256`

Before the post-release bookkeeping update tracked by #221, `main` and `develop` were synchronized exactly at the released v1.2.2 commit. `main` remains the immutable release/production snapshot until the next controlled release; active engineering bookkeeping and subsequent routine work continue from `develop`.

## v1.2.2 delivered behavior

The Windows application owns its infrastructure configuration instead of asking a normal user to provision it:

- the release package carries only the public Supabase project URL and `sb_publishable_...` client key;
- `sb_secret_...`, service-role credentials and `CARD_VAULT_KEY` are forbidden from the desktop release boundary;
- Windows PAN/expiry operations proxy through the canonical protected production `/api/card-secrets` endpoint using the already-authenticated owner AAL2 access token, leaving encryption server-side;
- normal first launch goes directly to MyFinHub sign-in/TOTP rather than a Supabase/card-vault setup form;
- failed local-backend startup opens a non-technical recovery UI with retry plus bounded/redacted diagnostics;
- legacy runtime provisioning files are removed on upgrade so stale DPAPI payloads cannot block startup;
- the v1.2.1 Node `createRequire(import.meta.url)` bundle fix and explicit window-load failure handling remain preserved.

## Completed release validation

Implementation PR #203 final head `c8e6e38d3fcfeb5623c04de7286b44795c0ad1a4` passed CI #858, CodeQL #812, Cross-engine/WebKit #141, Performance #135, Windows Desktop #507, Windows First Run #27 and Windows Clean Launch #28 with zero unresolved review threads.

Release-prep PR #219 exact head `6d3da7df1e5eaa17f15a32d65342e4256431cf1a` passed CI #860, CodeQL #814, Cross-engine/WebKit #142, Performance #136, Windows Desktop #509, Windows First Run #29 and Windows Clean Launch #30 with zero unresolved review threads.

Production PR #220 exact candidate `ba43b26fceda46c67a478a3685576d52f712d654` passed CI #862 on an unchanged-head rerun, CodeQL #816, Cross-engine/WebKit #143, Windows Desktop #511, Windows First Run #31 and Windows Clean Launch #32. Performance #136 applies to the byte-identical release-prep tree. The PR had zero unresolved review threads before squash merge.

Post-merge production verification completed successfully:

- Vercel production reached `READY` with GitHub provenance exactly `main@30a4baece76e70cd83962821cd3e09aadca83497`;
- `/api/health` returned `200` with the MyFinHub identity;
- unauthenticated `/api/data` returned `401 AUTH_REQUIRED` with no-store/security headers intact;
- `myfinhub-v1.2.2` resolves exactly to the released production commit;
- the published Windows installer and SHA-256 asset were verified before the one-time publication helper cleaned itself up;
- temporary v1.2.2 release branches were removed and `develop` was synchronized back to the released baseline.

## Security and finance invariants

- browser/Windows authentication remains owner-only with mandatory TOTP/AAL2;
- the desktop backend remains bound only to `127.0.0.1`;
- Supabase RLS/RPC, optimistic revisions, validation, backups and audit behavior remain authoritative;
- approved native Android bearer routes remain explicitly scoped and fail closed;
- no service-role/secret credential is introduced into web, desktop or native client runtime code;
- PAN/expiry remain in the existing owner+AAL2 encrypted server vault;
- CVV remains encrypted device-local only and is rejected by server persistence;
- receipt capture/OCR remains device-local under the existing local-only OCR contract;
- no database migration, destructive finance-history rewrite or accounting-model change was introduced by v1.2.2.

## Active engineering state

There is no unfinished v1.2.2 release requirement. New MyFinHub web/desktop/backend work starts independently from a tracked issue and a short-lived branch based on current `develop`, returns through a PR to `develop`, and is merged only after applicable exact-head gates and review threads are clean.

Android application implementation belongs to the separate `MyFinHub-Android-App` repository. This repository owns only MyFinHub web/desktop/backend behavior and any explicitly required server/API compatibility work needed by approved native clients.

## Delivery workflow

Implementation work follows **Issue → short-lived branch → PR → required checks → squash merge into `develop`**. `main` remains release-only. Production promotion is a separate deliberate `develop → main` release PR followed by exact production provenance verification and controlled tag/Windows asset publication.
