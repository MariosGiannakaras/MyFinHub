# MyFinHub status

## v1.2.2 Windows no-setup patch

MyFinHub is a private, single-owner personal finance application. Production deploys from `main` to Vercel and uses Supabase/PostgreSQL as the durable finance store. Compatibility-critical historical identifiers such as `RheomIQ`, `rheomiq_*` and `RHEOMIQ_*` remain intentionally unchanged where they are persistence/protocol contracts.

This patch is tracked by issue #202 and completes the Windows startup/first-run incident work after v1.2.1.

- production baseline entering the patch: **v1.2.1**
- production baseline commit: `main@fa9f6c50100f10428dceab259fda024ce18e4912`
- implementation PR: **#203**
- implementation exact head: `c8e6e38d3fcfeb5623c04de7286b44795c0ad1a4`
- implementation integration commit: `develop@e74db8cd8baaaf2db1b0793925ddf5f443796085`
- release target: **v1.2.2**
- release tracker: **#202**

## v1.2.2 correction

The Windows application now owns its infrastructure configuration instead of asking a normal user to provision it:

- the release package carries only the public Supabase project URL and `sb_publishable_...` client key;
- `sb_secret_...`, service-role credentials and `CARD_VAULT_KEY` are forbidden from the desktop release boundary;
- Windows PAN/expiry operations proxy through the canonical protected production `/api/card-secrets` endpoint using the already-authenticated owner AAL2 access token, leaving encryption server-side;
- the normal first launch goes directly to MyFinHub sign-in/TOTP rather than a Supabase/card-vault setup form;
- failed local-backend startup opens a non-technical recovery UI with retry plus bounded/redacted diagnostics;
- legacy runtime provisioning files are removed on upgrade so stale DPAPI payloads cannot block startup;
- the v1.2.1 Node `createRequire(import.meta.url)` bundle fix and explicit window-load failure handling remain preserved.

## Exact implementation validation

PR #203 final head `c8e6e38d3fcfeb5623c04de7286b44795c0ad1a4` passed:

- CI #858;
- CodeQL #812;
- Cross-engine/WebKit #141;
- Performance #135;
- Windows First Run #27;
- Windows Desktop #507;
- Windows Clean Launch #28;
- unresolved review threads: zero.

## Security and finance invariants

- browser/Windows authentication remains owner-only with mandatory TOTP/AAL2;
- the desktop backend remains bound only to `127.0.0.1`;
- Supabase RLS/RPC, optimistic revisions, validation, backups and audit behavior remain authoritative;
- approved native Android bearer routes remain explicitly scoped and fail closed;
- no service-role/secret credential is introduced into web, desktop or native client runtime code;
- PAN/expiry remain in the existing owner+AAL2 encrypted server vault;
- CVV remains encrypted device-local only and is rejected by server persistence;
- receipt capture/OCR remains device-local under the existing local-only OCR contract;
- no database migration, destructive finance-history rewrite or accounting-model change is part of v1.2.2.

## Release gates

Implementation evidence is supporting evidence only. The v1.2.2 release-prep head must independently pass the current applicable CI, CodeQL, cross-engine, performance and Windows package/clean-launch gates with zero unresolved review threads. A separate controlled `develop → main` promotion then validates the production candidate. The release is complete only after production provenance is verified, `myfinhub-v1.2.2` resolves to the final `main` commit, the Windows installer/checksum are published, and `main`/`develop` are synchronized.

## Delivery workflow

Implementation work follows **Issue → short-lived branch → PR → required checks → squash merge into `develop`**. Production release is a separate deliberate `develop → main` PR followed by production verification and controlled tag/Windows asset publication.
