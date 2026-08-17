-- RheomIQ production hardening: single-owner authorization, authenticated RPCs,
-- bounded backups, and write audit trail. Existing finance data is not modified.

create table if not exists public.rheomiq_owner (
  singleton boolean primary key default true check (singleton is true),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.rheomiq_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid null,
  action text not null check (action in ('save', 'import', 'backup')),
  revision bigint null,
  created_at timestamptz not null default now()
);

create index if not exists rheomiq_audit_log_created_at_idx
  on public.rheomiq_audit_log (created_at desc);

alter table public.rheomiq_owner enable row level security;
alter table public.rheomiq_audit_log enable row level security;

revoke all on public.rheomiq_owner from public, anon, authenticated;
revoke all on public.rheomiq_audit_log from public, anon, authenticated;
revoke all on public.rheomiq_app_state from public, anon, authenticated;
revoke all on public.rheomiq_backups from public, anon, authenticated;

grant select, insert, update, delete on public.rheomiq_owner to service_role;
grant select on public.rheomiq_audit_log to service_role;
grant usage, select on sequence public.rheomiq_audit_log_id_seq to service_role;

create or replace function public.rheomiq_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.rheomiq_owner o
    where o.singleton is true
      and o.user_id = (select auth.uid())
  );
$$;

create or replace function public.rheomiq_read_state()
returns table(data jsonb, revision bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.rheomiq_is_owner() then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  return query
  select s.data, s.revision, s.updated_at
  from public.rheomiq_app_state s
  where s.id = 'primary';
end;
$$;

create or replace function public.rheomiq_prune_backups()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rheomiq_backups
  where id in (
    select id
    from public.rheomiq_backups
    order by created_at desc, id desc
    offset 100
  );
$$;

create or replace function public.rheomiq_save_state(
  p_data jsonb,
  p_expected_revision bigint
)
returns table(data jsonb, revision bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_current public.rheomiq_app_state%rowtype;
  v_schema_version integer;
  v_result_revision bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.rheomiq_is_owner() then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception using errcode = '22023', message = 'INVALID_DATA';
  end if;

  v_schema_version := coalesce(nullif(p_data ->> 'schemaVersion', '')::integer, 3);
  if v_schema_version < 1 or v_schema_version > 100 then
    raise exception using errcode = '22023', message = 'INVALID_SCHEMA_VERSION';
  end if;

  select * into v_current
  from public.rheomiq_app_state
  where id = 'primary'
  for update;

  if not found then
    if p_expected_revision is not null and p_expected_revision <> 0 then
      raise exception using errcode = '40001', message = 'REVISION_CONFLICT';
    end if;

    insert into public.rheomiq_app_state (id, data, schema_version, revision, updated_at)
    values ('primary', p_data, v_schema_version, 1, now());
    v_result_revision := 1;
  else
    if p_expected_revision is not null and p_expected_revision <> v_current.revision then
      raise exception using errcode = '40001', message = 'REVISION_CONFLICT';
    end if;

    if not exists (
      select 1 from public.rheomiq_backups
      where reason = 'automatic'
        and created_at >= now() - interval '6 hours'
    ) then
      insert into public.rheomiq_backups (data, schema_version, revision, reason)
      values (v_current.data, v_current.schema_version, v_current.revision, 'automatic');
    end if;

    v_result_revision := v_current.revision + 1;
    update public.rheomiq_app_state
    set data = p_data,
        schema_version = v_schema_version,
        revision = v_result_revision,
        updated_at = now()
    where id = 'primary';
  end if;

  insert into public.rheomiq_audit_log (actor_user_id, action, revision)
  values (auth.uid(), 'save', v_result_revision);

  perform public.rheomiq_prune_backups();

  return query
  select s.data, s.revision, s.updated_at
  from public.rheomiq_app_state s
  where s.id = 'primary';
end;
$$;

create or replace function public.rheomiq_import_state(p_data jsonb)
returns table(data jsonb, revision bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_current public.rheomiq_app_state%rowtype;
  v_schema_version integer;
  v_next_revision bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.rheomiq_is_owner() then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception using errcode = '22023', message = 'INVALID_DATA';
  end if;

  v_schema_version := coalesce(nullif(p_data ->> 'schemaVersion', '')::integer, 3);
  if v_schema_version < 1 or v_schema_version > 100 then
    raise exception using errcode = '22023', message = 'INVALID_SCHEMA_VERSION';
  end if;

  select * into v_current
  from public.rheomiq_app_state
  where id = 'primary'
  for update;

  if found then
    insert into public.rheomiq_backups (data, schema_version, revision, reason)
    values (v_current.data, v_current.schema_version, v_current.revision, 'pre-import');
    v_next_revision := v_current.revision + 1;
  else
    v_next_revision := 1;
  end if;

  insert into public.rheomiq_app_state (id, data, schema_version, revision, updated_at)
  values ('primary', p_data, v_schema_version, v_next_revision, now())
  on conflict (id) do update
  set data = excluded.data,
      schema_version = excluded.schema_version,
      revision = excluded.revision,
      updated_at = excluded.updated_at;

  insert into public.rheomiq_audit_log (actor_user_id, action, revision)
  values (auth.uid(), 'import', v_next_revision);

  perform public.rheomiq_prune_backups();

  return query
  select s.data, s.revision, s.updated_at
  from public.rheomiq_app_state s
  where s.id = 'primary';
end;
$$;

create or replace function public.rheomiq_create_backup(p_reason text default 'manual')
returns table(id bigint, created_at timestamptz)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id bigint;
  v_created_at timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.rheomiq_is_owner() then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  insert into public.rheomiq_backups (data, schema_version, revision, reason)
  select s.data, s.schema_version, s.revision,
         case when p_reason in ('manual', 'pre-import', 'automatic') then p_reason else 'manual' end
  from public.rheomiq_app_state s
  where s.id = 'primary'
  returning rheomiq_backups.id, rheomiq_backups.created_at
  into v_id, v_created_at;

  if v_id is null then
    raise exception using errcode = 'P0002', message = 'NO_STATE';
  end if;

  insert into public.rheomiq_audit_log (actor_user_id, action, revision)
  select auth.uid(), 'backup', s.revision
  from public.rheomiq_app_state s
  where s.id = 'primary';

  perform public.rheomiq_prune_backups();

  return query select v_id, v_created_at;
end;
$$;

revoke all on function public.rheomiq_is_owner() from public, anon;
revoke all on function public.rheomiq_read_state() from public, anon;
revoke all on function public.rheomiq_save_state(jsonb, bigint) from public, anon;
revoke all on function public.rheomiq_import_state(jsonb) from public, anon;
revoke all on function public.rheomiq_create_backup(text) from public, anon;
revoke all on function public.rheomiq_prune_backups() from public, anon, authenticated, service_role;

grant execute on function public.rheomiq_is_owner() to authenticated, service_role;
grant execute on function public.rheomiq_read_state() to authenticated, service_role;
grant execute on function public.rheomiq_save_state(jsonb, bigint) to authenticated, service_role;
grant execute on function public.rheomiq_import_state(jsonb) to authenticated, service_role;
grant execute on function public.rheomiq_create_backup(text) to authenticated, service_role;
