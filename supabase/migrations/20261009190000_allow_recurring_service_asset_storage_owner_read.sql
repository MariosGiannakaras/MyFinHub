-- #519 DV-FB04/06/08: allow the owner's AAL2 Storage object read needed
-- by rheomiq_register_recurring_service_asset (SECURITY INVOKER).
-- The initial bucket migration granted write/delete but no matching SELECT.
-- Without this owner-limited read, the registration RPC cannot see the just
-- uploaded object and incorrectly raises RECURRING_SERVICE_ASSET_MISSING_STORAGE_OBJECT.
-- Never grant this lookup to anon, other accounts or other buckets.

drop policy if exists rheomiq_recurring_service_storage_owner_aal2_select on storage.objects;
create policy rheomiq_recurring_service_storage_owner_aal2_select
on storage.objects
for select to authenticated
using (
  bucket_id='recurring-service-assets'
  and name ~ '^services/service-asset-[a-f0-9]{24}\.(png|jpg|webp|svg)$'
  and owner_id=(select auth.uid())::text
  and (select public.rheomiq_is_owner_aal2())
);
