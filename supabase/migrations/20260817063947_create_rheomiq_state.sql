-- RheomIQ single-user persistence.
-- The UI/domain contract remains FinanceData JSON while PostgreSQL owns durability,
-- optimistic concurrency, and backups. No browser/client role receives table access.

create table if not exists public.rheomiq_app_state (
  id text primary key default 'primary' check (id = 'primary'),
  data jsonb not null,
  schema_version integer not null default 3 check (schema_version > 0),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.rheomiq_backups (
  id bigint generated always as identity primary key,
  data jsonb not null,
  schema_version integer not null,
  revision bigint not null,
  reason text not null default 'manual',
  created_at timestamptz not null default now()
);

create index if not exists rheomiq_backups_created_at_idx
  on public.rheomiq_backups (created_at desc);

alter table public.rheomiq_app_state enable row level security;
alter table public.rheomiq_backups enable row level security;

revoke all on public.rheomiq_app_state from anon, authenticated;
revoke all on public.rheomiq_backups from anon, authenticated;
grant select, insert, update, delete on public.rheomiq_app_state to service_role;
grant select, insert, update, delete on public.rheomiq_backups to service_role;
grant usage, select on sequence public.rheomiq_backups_id_seq to service_role;

create or replace function public.rheomiq_save_state(
  p_data jsonb,
  p_expected_revision bigint
)
returns table(data jsonb, revision bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.rheomiq_app_state%rowtype;
  v_schema_version integer;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'INVALID_DATA: RheomIQ state must be a JSON object';
  end if;

  v_schema_version := coalesce(nullif(p_data ->> 'schemaVersion', '')::integer, 3);

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
  else
    if p_expected_revision is not null and p_expected_revision <> v_current.revision then
      raise exception using errcode = '40001', message = 'REVISION_CONFLICT';
    end if;

    if not exists (
      select 1 from public.rheomiq_backups
      where created_at >= now() - interval '1 hour'
    ) then
      insert into public.rheomiq_backups (data, schema_version, revision, reason)
      values (v_current.data, v_current.schema_version, v_current.revision, 'automatic');
    end if;

    update public.rheomiq_app_state
    set data = p_data,
        schema_version = v_schema_version,
        revision = v_current.revision + 1,
        updated_at = now()
    where id = 'primary';
  end if;

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
set search_path = public
as $$
declare
  v_current public.rheomiq_app_state%rowtype;
  v_schema_version integer;
  v_next_revision bigint;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'INVALID_DATA: RheomIQ state must be a JSON object';
  end if;

  v_schema_version := coalesce(nullif(p_data ->> 'schemaVersion', '')::integer, 3);

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
set search_path = public
as $$
begin
  return query
  insert into public.rheomiq_backups (data, schema_version, revision, reason)
  select s.data, s.schema_version, s.revision, coalesce(nullif(p_reason, ''), 'manual')
  from public.rheomiq_app_state s
  where s.id = 'primary'
  returning rheomiq_backups.id, rheomiq_backups.created_at;
end;
$$;

revoke all on function public.rheomiq_save_state(jsonb, bigint) from public, anon, authenticated;
revoke all on function public.rheomiq_import_state(jsonb) from public, anon, authenticated;
revoke all on function public.rheomiq_create_backup(text) from public, anon, authenticated;
grant execute on function public.rheomiq_save_state(jsonb, bigint) to service_role;
grant execute on function public.rheomiq_import_state(jsonb) to service_role;
grant execute on function public.rheomiq_create_backup(text) to service_role;
