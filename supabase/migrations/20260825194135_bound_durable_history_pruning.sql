-- Keep the durable history table at a strict maximum of 100 points while always
-- preserving the canonical current point. The current point plus at most 99 other
-- points is deterministic even when the current cursor is older than the newest rows.

create or replace function public.rheomiq_prune_history(p_owner uuid)
returns void
language plpgsql
security invoker
set search_path = 'public', 'auth'
as $$
declare
  v_current bigint;
begin
  select current_point_id into v_current
  from public.rheomiq_history_cursor
  where owner_user_id = p_owner;
  if v_current is null then return; end if;

  delete from public.rheomiq_history_points
  where owner_user_id = p_owner
    and id <> v_current
    and expires_at <= now();

  delete from public.rheomiq_history_points
  where owner_user_id = p_owner
    and id <> v_current
    and id not in (
      select id
      from public.rheomiq_history_points
      where owner_user_id = p_owner and id <> v_current
      order by created_at desc, id desc
      limit 99
    );
end;
$$;

revoke all on function public.rheomiq_prune_history(uuid) from public, anon;
grant execute on function public.rheomiq_prune_history(uuid) to authenticated, service_role;
