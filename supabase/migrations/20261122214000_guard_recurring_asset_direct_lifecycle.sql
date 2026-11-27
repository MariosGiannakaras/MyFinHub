-- #649 I19.04/I22.02: Direct authenticated PostgREST updates must
-- not deactivate/repoint a recurring image that the canonical finance state
-- still references. The public invoker release RPC already checks those
-- references; its table grants otherwise allow a direct owner+AAL2 bypass.
-- No historical data rewrite, privilege expansion or production execution.

create or replace function private.rheomiq_guard_recurring_asset_direct_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  -- Service-role access is reserved for offline recovery and isolated QA,
  -- not a browser session. Keep its explicit emergency cleanup semantics.
  if current_user <> 'authenticated' then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;

  if tg_op='UPDATE' then
    -- Image identity, owner, source reference and Storage provenance are
    -- immutable after registration; the normal release changes ONLY active
    -- and updated_at. This also prevents direct reassignment in finance.
    if row(new.owner_user_id,new.asset_key,new.recurring_id,new.file_name,
           new.mime_type,new.storage_bucket,new.storage_path,new.size_bytes)
       is distinct from
       row(old.owner_user_id,old.asset_key,old.recurring_id,old.file_name,
           old.mime_type,old.storage_bucket,old.storage_path,old.size_bytes) then
      raise exception using errcode='23514',
        message='RECURRING_SERVICE_ASSET_IMMUTABLE_REGISTRATION';
    end if;
    if not old.active and new.active then
      raise exception using errcode='23514',
        message='RECURRING_SERVICE_ASSET_REACTIVATION_FORBIDDEN';
    end if;
    if new.active then return new; end if;
  elsif tg_op='DELETE' then
    -- Purge is only valid after a verified release. An authenticated owner
    -- cannot delete a still-active registration directly.
    if old.active then
      raise exception using errcode='23514',
        message='RECURRING_SERVICE_ASSET_RELEASE_REQUIRED';
    end if;
  end if;

  -- The existing release RPC checks these three finance JSON surfaces and
  -- the relational recurring table. Recheck at the table boundary so a
  -- direct UPDATE active=false or DELETE cannot bypass the finance guard.
  if exists(
    select 1 from private.rheomiq_recurring r
    where r.owner_user_id=old.owner_user_id and r.logo_asset_key=old.asset_key
  ) or exists(
    select 1 from public.rheomiq_app_state s
    cross join lateral jsonb_each(coalesce(s.data#>'{state,recurringOverrides}','{}'::jsonb)) e
    where s.id='primary' and e.value->>'logoAssetKey'=old.asset_key
  ) or exists(
    select 1 from public.rheomiq_app_state s
    cross join lateral jsonb_array_elements(coalesce(s.data#>'{state,recurringCustom}','[]'::jsonb)) e(value)
    where s.id='primary' and e.value->>'logoAssetKey'=old.asset_key
  ) or exists(
    select 1 from public.rheomiq_app_state s
    cross join lateral jsonb_array_elements(coalesce(s.data#>'{seed,recurring}','[]'::jsonb)) e(value)
    where s.id='primary' and e.value->>'logoAssetKey'=old.asset_key
  ) then
    raise exception using errcode='23503',
      message='RECURRING_SERVICE_ASSET_IN_USE';
  end if;

  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.rheomiq_guard_recurring_asset_direct_lifecycle()
  from public,anon;
grant execute on function private.rheomiq_guard_recurring_asset_direct_lifecycle()
  to authenticated;

drop trigger if exists rheomiq_recurring_asset_direct_lifecycle_guard
  on public.rheomiq_recurring_service_assets;
create trigger rheomiq_recurring_asset_direct_lifecycle_guard
before update or delete on public.rheomiq_recurring_service_assets
for each row execute function private.rheomiq_guard_recurring_asset_direct_lifecycle();
