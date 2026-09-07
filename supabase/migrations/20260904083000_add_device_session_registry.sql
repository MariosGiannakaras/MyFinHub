-- Track MyFinHub device sessions without introducing a server-side secret key.
-- Each Supabase Auth session has a stable session_id claim. The registry is owner-only,
-- AAL2-only and becomes part of the canonical finance-access predicate so a revoked
-- device is blocked by both the application API and PostgreSQL RLS.

create table if not exists public.myfinhub_device_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('windows', 'android', 'web', 'unknown')),
  device_label text not null check (char_length(device_label) between 1 and 120),
  app_version text null check (app_version is null or char_length(app_version) <= 40),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz null
);

create index if not exists myfinhub_device_sessions_user_active_idx
  on public.myfinhub_device_sessions (user_id, revoked_at, last_seen_at desc);

alter table public.myfinhub_device_sessions enable row level security;

revoke all on table public.myfinhub_device_sessions from public, anon, authenticated;
grant select, insert on table public.myfinhub_device_sessions to authenticated;
grant update (platform, device_label, app_version, last_seen_at, revoked_at)
  on table public.myfinhub_device_sessions to authenticated;

drop policy if exists myfinhub_device_sessions_owner_select on public.myfinhub_device_sessions;
drop policy if exists myfinhub_device_sessions_owner_insert on public.myfinhub_device_sessions;
drop policy if exists myfinhub_device_sessions_owner_update on public.myfinhub_device_sessions;

create policy myfinhub_device_sessions_owner_select
on public.myfinhub_device_sessions
for select
to authenticated
using (
  user_id = (select auth.uid())
  and (select public.rheomiq_is_owner())
  and (select public.rheomiq_has_aal2())
);

create policy myfinhub_device_sessions_owner_insert
on public.myfinhub_device_sessions
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and session_id::text = coalesce((select auth.jwt() ->> 'session_id'), '')
  and revoked_at is null
  and (select public.rheomiq_is_owner())
  and (select public.rheomiq_has_aal2())
);

create policy myfinhub_device_sessions_owner_update
on public.myfinhub_device_sessions
for update
to authenticated
using (
  user_id = (select auth.uid())
  and (select public.rheomiq_is_owner())
  and (select public.rheomiq_has_aal2())
)
with check (
  user_id = (select auth.uid())
  and (select public.rheomiq_is_owner())
  and (select public.rheomiq_has_aal2())
);

create or replace function public.myfinhub_guard_device_session_update()
returns trigger
language plpgsql
security invoker
set search_path = public, auth
as $$
begin
  if new.session_id is distinct from old.session_id
     or new.user_id is distinct from old.user_id
     or new.first_seen_at is distinct from old.first_seen_at then
    raise exception using errcode = '42501', message = 'DEVICE_SESSION_IDENTITY_IMMUTABLE';
  end if;
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception using errcode = '42501', message = 'DEVICE_SESSION_REVOCATION_IMMUTABLE';
  end if;
  if new.last_seen_at < old.last_seen_at then
    raise exception using errcode = '22023', message = 'DEVICE_SESSION_LAST_SEEN_INVALID';
  end if;
  return new;
end;
$$;

revoke all on function public.myfinhub_guard_device_session_update() from public, anon;
grant execute on function public.myfinhub_guard_device_session_update() to authenticated, service_role;

drop trigger if exists myfinhub_guard_device_session_update on public.myfinhub_device_sessions;
create trigger myfinhub_guard_device_session_update
before update on public.myfinhub_device_sessions
for each row execute function public.myfinhub_guard_device_session_update();

create or replace function public.myfinhub_session_is_active()
returns boolean
language sql
stable
security invoker
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.myfinhub_device_sessions s
    where s.user_id = (select auth.uid())
      and s.session_id::text = coalesce((select auth.jwt() ->> 'session_id'), '')
      and s.revoked_at is null
  );
$$;

revoke all on function public.myfinhub_session_is_active() from public, anon;
grant execute on function public.myfinhub_session_is_active() to authenticated, service_role;

create or replace function public.rheomiq_is_owner_aal2()
returns boolean
language sql
stable
security invoker
set search_path = public, auth
as $$
  select public.rheomiq_is_owner()
    and public.rheomiq_has_aal2()
    and public.myfinhub_session_is_active();
$$;

revoke all on function public.rheomiq_is_owner_aal2() from public, anon;
grant execute on function public.rheomiq_is_owner_aal2() to authenticated, service_role;
