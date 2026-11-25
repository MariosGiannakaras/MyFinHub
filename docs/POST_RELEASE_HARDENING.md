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

## Supabase leaked-password protection review — #649 I22.04 (2026-11-14)

Supabase's current [Password security documentation](https://supabase.com/docs/guides/auth/password-security) confirms that hosted Auth can reject passwords found in the Have I Been Pwned Pwned Passwords dataset. This feature is **available only on Pro and higher plans**. Supabase's [pricing](https://supabase.com/pricing) independently identifies it as unavailable on Free. The configuration lives in the hosted project's **Authentication password-security settings**, not in `supabase/migrations/` or the MyFinHub client; do not simulate it with a client-only check, weaken MFA, or add a privileged custom Auth path.

**Repository review:** complete. **Hosted enablement:** unverified and pending explicit owner authorization and eligible project plan. Current project entitlement, current toggle state and any operational impact have **not** been read or assumed. The prior advisor mention is not evidence that the setting is currently enabled or still disabled. If the owner approves the change, use the supported hosted Auth configuration workflow, record the actual before/after state and safe negative-path sign-in/password-change evidence without collecting any real credentials. Existing email/password + mandatory TOTP and single-owner authorization must remain unchanged. Do not claim production protection, alter the hosted Auth service or count this operational activation as complete from a source-only review.

**2026-11-25 #649 reconciliation:** I22.04 repository review is complete under the original review/approved-only-config scope and #266 Free-plan requirement. The paid hosted feature is not a required new application dependency; any change to tier, Auth setting or production risk acceptance remains separately owner-authorized. No project toggle state, entitlement or hosted activation is claimed.
