# PostgreSQL + Supabase Storage independent checkpoint and recovery

**Status: isolated local rehearsal, NOT production restore authorization.** Owner approval and secure infrastructure credentials are required before any production backup/restore. Finance JSON backups and Windows desktop snapshots are **not** full disaster-recovery images.

## Required scope

An independently recoverable PostgreSQL+Storage checkpoint must pair a **consistent** PostgreSQL archive (schema, finance ledger, history, backups, audit, owner authorization, device sessions, auth state, metadata, migration ledger and RLS) with **every** referenced Supabase Storage binary (not merely `storage.objects` metadata). Include an integrity manifest with SHA-256 hashes, storage bucket/key, object content type, creation timestamp, application/database version and archive hash. Also safeguard separate encryption/recovery keys in an approved secret store, never inside the checkpoint artifact or GitHub logs.

A checkpoint is **not accepted** if Storage bytes are missing, if an archive hash differs, if PostgreSQL changes while Storage capture is in progress without a documented consistency boundary, or if either component cannot be restored into a **different isolated recovery environment**. Do not remove or rewrite original rows, audit, backup history or stored objects when rehearsing a restore.

## Disposable automated proof

The CI-only `npm run qa:isolated-recovery` command explicitly checks `CI=true` and `MYFINHUB_ISOLATED_RECOVERY=1`, verifies the exact running Docker container `supabase_db_rheomiq` and a loopback-only local Supabase Storage API, then:

1. Captures finance/backup/audit, auth, Storage metadata and migration checksums from synthetic **local** state; produces a PostgreSQL custom archive, copies it outside the database container and verifies its SHA-256 on transfer.
2. Takes binary Storage objects into a separate temporary directory, saves per-object checksums and refuses a missing/incomplete or oversized synthetic snapshot.
3. Restores the archive into a newly created **scratch PostgreSQL database** from `template0`. It verifies selected canonical row hashes, migration history and enabled RLS topology against the untouched original.
4. Uploads recovered binary assets into an isolated, temporary local Storage bucket, downloads them again and compares all SHA-256 hashes before removing that namespace.
5. Removes the scratch database and temporary checkpoint bytes. The entire disposable local Supabase service is also stopped without backup by the existing workflow.

This proof does **not** restore Supabase global roles into a distinct physical cluster or reproduce production secrets, provider encryption material, project-level configuration, external auth/Storage infrastructure and point-in-time consistency across a live writing system. Even a successful local run therefore does **not** by itself close an owner production recovery/release gate.

## Production operator protocol (approval-gated, not executed by this repository)

1. Obtain explicit owner approval for an offline **backup** and a separate approval for any production-changing **restore**. Identify the exact project, maintenance/change window, recovery-point and retention objectives, and enforce least-privilege access.
2. Stop or coordinate all writers for a consistent PostgreSQL+Storage snapshot, or use a reviewed versioned manifest/object-generation capture scheme. Record the database revision, schema-migration ledger, app version, object hashes and encrypted archive location. Store all binary objects in separately protected/offsite Storage that does not depend on the original project surviving.
3. Keep PostgreSQL credentials, service-role secrets, MFA recovery and Card Vault key material **out of source control, artifacts and client binaries**. Encrypt the checkpoint at rest and restrict access to the owner/operator.
4. Restore into a distinct, isolated **non-production** Supabase environment. Recreate platform roles/extensions/project configuration using the provider-supported recovery procedure, restore database and Storage binaries, verify every manifest entry, RLS/owner+AAL2, canonical ledger/history/audit, private object permissions, media links, health checks and checksum integrity. Compare the final migration ledger before any application cutover.
5. Require explicit recorded go/no-go after successful independent restore, verified provenance and a rollback path. Never equate a FinanceData JSON import, a schema roll-forward smoke or a local backup catalog with this full recovery process. Do not use destructive database reset, truncate or live production overwrites to test a checkpoint.

**I18.02 remaining boundary:** The local PostgreSQL scratch-database + separate-bucket rehearsal is valuable non-destructive evidence but is not the independently hosted and keyed production-grade restore. Actual full production-equivalent recovery requires a distinct isolated Supabase project/cluster and operator-approved secure credentials/evidence; no such production action is requested or performed here.
