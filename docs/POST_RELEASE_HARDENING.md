# Post-v1.3.0 hardening record

This record captures the non-product cleanup reviewed immediately after the v1.3.0 release.

## Supabase RLS advisor

The Supabase performance advisor reports `auth_rls_initplan` for
`public.myfinhub_device_sessions` policy
`myfinhub_device_sessions_owner_insert`.

The live policy already wraps every request-stable authorization function in a scalar subquery:

- `(select auth.uid())`
- `(select auth.jwt() ->> 'session_id')`
- `(select public.rheomiq_is_owner())`
- `(select public.rheomiq_has_aal2())`

A production-safe `EXPLAIN (VERBOSE, COSTS OFF)` of a plan-only INSERT under the authenticated role showed four separate `InitPlan` nodes for those expressions. No row was inserted. The warning is therefore treated as an advisor false-positive; changing the authorization policy only to silence the warning would add risk without improving its execution plan.

## Unused-index advisor notices

The four reported indexes are retained:

- `rheomiq_history_owner_expiry_idx` — supports owner-scoped history expiry/pruning.
- `rheomiq_history_cursor_owner_point_idx` — deliberately covers the composite cursor/point relationship and is asserted by source tests.
- `rheomiq_financial_provider_assets_provider_role_idx` — covers canonical provider/role/active lookup as that registry grows.
- `rheomiq_audit_log_created_at_idx` — preserves chronological audit access.

At review time each index was 16 kB and the associated tables were small (9 history points, 1 cursor, 10 provider assets, 378 audit rows). A zero scan count at that scale is not evidence that these indexes should be removed.

## Remaining dashboard-only security setting

Supabase Auth leaked-password protection remains enabled/disabled outside the repository schema and cannot be changed by the connected Supabase actions available to this project. It must be enabled in the Supabase Auth password-security settings by the owner. This is operational hardening, not a database migration.
