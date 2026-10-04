-- Move the SECURITY DEFINER active-session helper out of the exposed public API
-- schema while keeping RLS able to verify the caller's own current session.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.myfinhub_session_is_active()
returns boolean
language sql
stable
security definer
set search_path = public, auth, private
as $$
  select exists (
    select 1
    from public.myfinhub_device_sessions session_row
    where session_row.session_id::text = coalesce(((select auth.jwt()) ->> 'session_id'), '')
      and session_row.user_id = (select auth.uid())
      and session_row.revoked_at is null
  );
$$;

revoke all on function private.myfinhub_session_is_active() from public, anon;
grant execute on function private.myfinhub_session_is_active() to authenticated, service_role;

create or replace function public.rheomiq_is_owner_aal2()
returns boolean
language sql
stable
security invoker
set search_path = public, auth, private
as $$
  select public.rheomiq_is_owner()
    and public.rheomiq_has_aal2()
    and private.myfinhub_session_is_active();
$$;

revoke all on function public.rheomiq_is_owner_aal2() from public, anon;
grant execute on function public.rheomiq_is_owner_aal2() to authenticated, service_role;

drop policy if exists myfinhub_device_sessions_owner_select on public.myfinhub_device_sessions;
drop policy if exists myfinhub_device_sessions_owner_update on public.myfinhub_device_sessions;

create policy myfinhub_device_sessions_owner_select
on public.myfinhub_device_sessions
for select
to authenticated
using (
  user_id = (select auth.uid())
  and (select public.rheomiq_is_owner())
  and (select public.rheomiq_has_aal2())
  and (select private.myfinhub_session_is_active())
);

create policy myfinhub_device_sessions_owner_update
on public.myfinhub_device_sessions
for update
to authenticated
using (
  user_id = (select auth.uid())
  and (select public.rheomiq_is_owner())
  and (select public.rheomiq_has_aal2())
  and (select private.myfinhub_session_is_active())
)
with check (
  user_id = (select auth.uid())
  and (select public.rheomiq_is_owner())
  and (select public.rheomiq_has_aal2())
);

drop function if exists public.myfinhub_session_is_active();
