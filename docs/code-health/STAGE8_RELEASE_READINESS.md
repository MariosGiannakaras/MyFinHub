# Stage 8 — Release-readiness audit

Status: **final validation only — no release authorization**.

## Baselines recovered on 2026-09-27

- `main@4782fd3c6ab8f56661623cb36b3792a7ee7f7ee6`
- `develop@2646e0e222c334c496df88fe356b464526fa6963`
- merge base: `e31a4b166be825c7ea3eab43435f3c28750a1c74`
- Git comparison: develop is 93 commits ahead and 2 commits behind main.

The two main-only commits are the owner-authorized Phase-6 Android updater bridge and the Vercel 12-function-budget hotfix. Their production semantics are already present on develop:
- `api/data.ts` is byte-identical between main and develop;
- `server/androidUpdateApi.ts` is byte-identical;
- `server/androidUpdates.ts` differs only by the trailing newline;
- `/api/android-update -> /api/data?__myfinhub_route=android-update` remains in `vercel.json`.

Develop adds account/device compatibility rewrites onto the existing auth-session function rather than adding Vercel entrypoints.

## Vercel function budget

Both main and develop contain exactly 12 TypeScript files under `api/`.

Develop deliberately has no:
- `api/android-update.ts`
- `api/auth/account.ts`
- `api/auth/devices.ts`

Compatibility rewrites preserve those public paths through existing functions. `tests/vercel-function-budget.test.ts` locks the 12-function deployment boundary.

## Stage-7 integration evidence

PR #419 final head passed:
- CI `36284784475`
- CodeQL `36284784528`
- Cross-engine `36284784450`
- Performance `36284784480`
- Windows Desktop `36284784500`

The PR merged as `develop@2646e0e222c334c496df88fe356b464526fa6963`. GitHub did not create push runs for that exact merge because the squash body inherited a prior `[skip ci]` marker. This was verified as a scheduling artifact rather than an integration-content delta: the merge tree and the final green PR-head tree are both `413b7a29b82ce9e05a4f071852b8e742d7026c91`.

Fresh CI artifact `10920072516` was inspected manually for representative Stage-7 surfaces:
- Settings profile desktop, mobile and full-page;
- Settings Accounts desktop;
- Settings Data mobile.

No clipping, overlap, missing affordance or obvious shared-control visual regression was observed.

## Live Supabase audit

The connected production project reports healthy status in `eu-central-1`.

Its live migration ledger has 27 applied migrations. Before this Stage-8 batch, the Git repository had 28 migrations but several applied migrations carried different local timestamps and the production-applied `add_financial_provider_assets` migration was absent from Git.

This batch fixes the **repository ledger only**:
- historical migration files are renamed to the exact production-applied version/name pairs with SQL bytes unchanged;
- `20260905004603_add_financial_provider_assets.sql` is back-synced from the live schema shape;
- no production DDL or production data is changed.

After reconciliation, Git contains the 27 production-applied migrations plus two explicit pending migrations.

### Pending migration 1 — device-session registry

`20260904083000_add_device_session_registry.sql` is **not applied in production**.

Live production currently has:
- no `public.myfinhub_device_sessions` table;
- `public.rheomiq_is_owner_aal2()` = owner + AAL2 only.

The pending migration creates the device registry and changes `rheomiq_is_owner_aal2()` to additionally require an active device session.

Release sequencing is therefore security-critical:

1. first promote compatible application/server code that calls `ensureDeviceSessionAccess`;
2. while the migration is absent, that code deliberately tolerates the missing registry so core finance access remains compatible;
3. only after the compatible code is live, apply the device-session migration;
4. verify the current session is registered, finance read/write remains available, device listing works, revoke works, and revoked sessions are denied.

**Do not apply the device-session migration before compatible code is live.** Old main code does not create registry rows, while the migration hardens the finance RLS predicate to require one.

### Pending migration 2 — provider brand-key refresh

`20260905020000_refresh_financial_provider_brand_assets.sql` is also not applied in production.

Production already has:
- the authenticated financial-provider registry with 8 providers;
- the provider-assets registry;
- the public `financial-provider-assets` bucket.

Current production provider rows still use the pre-refresh asset keys. Develop has a local fallback catalog and local image handling, so this is not a core finance availability blocker, but the refresh must be applied and visually verified deliberately during a future authorized release.

## Auth / device / provider differences

Develop keeps account-security mutations owner-only, AAL2-only and same-origin through the existing auth-session function. It does not add a service-role/secret-key runtime dependency.

AAL2 session finalization now checks device access centrally. Missing device-registry schema is handled as a compatibility state until the pending migration is applied; a revoked device remains fail-closed once the registry exists.

Financial-provider reads reuse `/api/account-metadata?resource=financial-providers`, keep publishable-key + user-JWT access, and fall back to the embedded provider catalog if the registry read is unavailable.

## Supabase advisors

Security advisor: **Leaked Password Protection Disabled** (WARN).

This audit records the warning but does not change Auth policy or external project settings because code-health work must not silently change authentication behavior. It must be explicitly resolved or accepted before a separately authorized production release.

Performance advisor currently reports only INFO-level unused-index observations. No index is removed in this audit.

## Release-readiness conclusion

There is no authorization in this stage to merge develop into main, deploy, apply migrations, publish releases or mutate production data.

The code-health implementation is ready for final repository validation after the migration-ledger reconciliation in this branch. A future release authorization must still include:
- explicit review of the 93-ahead / 2-behind main-develop divergence;
- the code-first/device-migration-second sequence above;
- deliberate provider-brand refresh verification;
- a decision on leaked-password protection;
- normal production smoke after any authorized promotion.
