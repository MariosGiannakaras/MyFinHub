-- #649 I22.02: Existing direct owner+AAL2 PostgREST table UPDATE
-- can deactivate a provider asset still referenced by a provider binding.
-- The asset-key foreign keys constrain existence, not active=true. Block
-- only in-use deactivation, preserving direct owner edits to unbound assets.
-- This migration never rewrites/deletes historical assets or broadens RLS.

create or replace function private.rheomiq_guard_bound_provider_artwork_active()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  -- Trusted offline recovery and disposable local service-role cleanup do
  -- not impersonate a browser-authenticated user.
  if current_user <> 'authenticated'
     or old.active is not true or new.active is not false then
    return new;
  end if;

  if exists (
    select 1
    from public.rheomiq_financial_provider_asset_bindings b
    where b.asset_key=old.asset_key
  ) or exists (
    select 1
    from public.rheomiq_financial_providers p
    where p.active
      and (p.logo_asset_key=old.asset_key or p.wordmark_asset_key=old.asset_key)
  ) then
    raise exception using errcode='23503',
      message='FINANCIAL_PROVIDER_ASSET_IN_USE';
  end if;
  return new;
end;
$$;

revoke all on function private.rheomiq_guard_bound_provider_artwork_active()
  from public,anon;
grant execute on function private.rheomiq_guard_bound_provider_artwork_active()
  to authenticated;

drop trigger if exists rheomiq_bound_provider_artwork_active_guard
  on public.rheomiq_financial_provider_assets;
create trigger rheomiq_bound_provider_artwork_active_guard
before update of active on public.rheomiq_financial_provider_assets
for each row execute function private.rheomiq_guard_bound_provider_artwork_active();
