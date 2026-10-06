-- Reject seed/custom account ID collisions at the database write boundary.
-- This preserves existing read compatibility while making every future full or
-- mutable state write fail atomically before an ambiguous account identity can
-- enter the canonical finance document.

create or replace function private.rheomiq_reject_account_id_collisions()
returns trigger
language plpgsql
security invoker
set search_path = 'pg_catalog'
as $$
declare
  v_seed_ids text[];
  v_custom_ids text[];
begin
  if new.id <> 'primary' then
    return new;
  end if;

  select coalesce(array_agg(item ->> 'id'), '{}'::text[])
  into v_seed_ids
  from jsonb_array_elements(coalesce(new.data #> '{seed,accounts}', '[]'::jsonb)) item
  where nullif(item ->> 'id', '') is not null;

  select coalesce(array_agg(item ->> 'id'), '{}'::text[])
  into v_custom_ids
  from jsonb_array_elements(coalesce(new.data #> '{state,settings,customAccounts}', '[]'::jsonb)) item
  where nullif(item ->> 'id', '') is not null;

  if exists (
    select 1
    from unnest(v_seed_ids) seed_id
    join unnest(v_custom_ids) custom_id on custom_id = seed_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNT_ID_CONFLICT';
  end if;

  return new;
end;
$$;

drop trigger if exists rheomiq_reject_account_id_collisions on public.rheomiq_app_state;
create trigger rheomiq_reject_account_id_collisions
before insert or update of data on public.rheomiq_app_state
for each row
execute function private.rheomiq_reject_account_id_collisions();

revoke all on function private.rheomiq_reject_account_id_collisions() from public, anon, authenticated;
