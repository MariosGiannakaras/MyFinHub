-- Require both the configured single owner identity and an AAL2 (MFA-verified) session
-- for all finance data access. The owner identity row remains readable at AAL1 so the
-- login flow can determine whether the signed-in account is the configured owner.

create or replace function public.rheomiq_has_aal2()
returns boolean
language sql
stable
security invoker
set search_path = public, auth
as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2';
$$;

create or replace function public.rheomiq_is_owner_aal2()
returns boolean
language sql
stable
security invoker
set search_path = public, auth
as $$
  select public.rheomiq_is_owner() and public.rheomiq_has_aal2();
$$;

drop policy if exists rheomiq_state_owner_select on public.rheomiq_app_state;
drop policy if exists rheomiq_state_owner_insert on public.rheomiq_app_state;
drop policy if exists rheomiq_state_owner_update on public.rheomiq_app_state;
create policy rheomiq_state_owner_select on public.rheomiq_app_state for select to authenticated using ((select public.rheomiq_is_owner_aal2()));
create policy rheomiq_state_owner_insert on public.rheomiq_app_state for insert to authenticated with check ((select public.rheomiq_is_owner_aal2()));
create policy rheomiq_state_owner_update on public.rheomiq_app_state for update to authenticated using ((select public.rheomiq_is_owner_aal2())) with check ((select public.rheomiq_is_owner_aal2()));

drop policy if exists rheomiq_backups_owner_select on public.rheomiq_backups;
drop policy if exists rheomiq_backups_owner_insert on public.rheomiq_backups;
drop policy if exists rheomiq_backups_owner_delete on public.rheomiq_backups;
create policy rheomiq_backups_owner_select on public.rheomiq_backups for select to authenticated using ((select public.rheomiq_is_owner_aal2()));
create policy rheomiq_backups_owner_insert on public.rheomiq_backups for insert to authenticated with check ((select public.rheomiq_is_owner_aal2()));
create policy rheomiq_backups_owner_delete on public.rheomiq_backups for delete to authenticated using ((select public.rheomiq_is_owner_aal2()));

drop policy if exists rheomiq_audit_owner_insert on public.rheomiq_audit_log;
create policy rheomiq_audit_owner_insert on public.rheomiq_audit_log for insert to authenticated
with check ((select public.rheomiq_is_owner_aal2()) and actor_user_id = (select auth.uid()));

create or replace function public.rheomiq_read_state()
returns table(data jsonb, revision bigint, updated_at timestamptz)
language plpgsql security invoker set search_path = public, auth
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.rheomiq_is_owner_aal2() then
    raise exception using errcode = '42501', message = 'MFA_REQUIRED';
  end if;
  return query select s.data, s.revision, s.updated_at from public.rheomiq_app_state s where s.id = 'primary';
end;
$$;

create or replace function public.rheomiq_save_state(p_data jsonb, p_expected_revision bigint)
returns table(data jsonb, revision bigint, updated_at timestamptz)
language plpgsql security invoker set search_path = public, auth
as $$
declare
  v_current public.rheomiq_app_state%rowtype;
  v_schema_version integer;
  v_result_revision bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.rheomiq_is_owner_aal2() then raise exception using errcode = '42501', message = 'MFA_REQUIRED'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception using errcode = '22023', message = 'INVALID_DATA'; end if;
  v_schema_version := coalesce(nullif(p_data ->> 'schemaVersion', '')::integer, 3);
  if v_schema_version < 1 or v_schema_version > 100 then raise exception using errcode = '22023', message = 'INVALID_SCHEMA_VERSION'; end if;
  select * into v_current from public.rheomiq_app_state where id = 'primary' for update;
  if not found then
    if p_expected_revision is not null and p_expected_revision <> 0 then raise exception using errcode = '40001', message = 'REVISION_CONFLICT'; end if;
    insert into public.rheomiq_app_state (id, data, schema_version, revision, updated_at) values ('primary', p_data, v_schema_version, 1, now());
    v_result_revision := 1;
  else
    if p_expected_revision is not null and p_expected_revision <> v_current.revision then raise exception using errcode = '40001', message = 'REVISION_CONFLICT'; end if;
    if not exists (select 1 from public.rheomiq_backups where reason = 'automatic' and created_at >= now() - interval '6 hours') then
      insert into public.rheomiq_backups (data, schema_version, revision, reason) values (v_current.data, v_current.schema_version, v_current.revision, 'automatic');
    end if;
    v_result_revision := v_current.revision + 1;
    update public.rheomiq_app_state set data = p_data, schema_version = v_schema_version, revision = v_result_revision, updated_at = now() where id = 'primary';
  end if;
  insert into public.rheomiq_audit_log (actor_user_id, action, revision) values (auth.uid(), 'save', v_result_revision);
  perform public.rheomiq_prune_backups();
  return query select s.data, s.revision, s.updated_at from public.rheomiq_app_state s where s.id = 'primary';
end;
$$;

create or replace function public.rheomiq_import_state(p_data jsonb)
returns table(data jsonb, revision bigint, updated_at timestamptz)
language plpgsql security invoker set search_path = public, auth
as $$
declare
  v_current public.rheomiq_app_state%rowtype;
  v_schema_version integer;
  v_next_revision bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.rheomiq_is_owner_aal2() then raise exception using errcode = '42501', message = 'MFA_REQUIRED'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception using errcode = '22023', message = 'INVALID_DATA'; end if;
  v_schema_version := coalesce(nullif(p_data ->> 'schemaVersion', '')::integer, 3);
  if v_schema_version < 1 or v_schema_version > 100 then raise exception using errcode = '22023', message = 'INVALID_SCHEMA_VERSION'; end if;
  select * into v_current from public.rheomiq_app_state where id = 'primary' for update;
  if found then
    insert into public.rheomiq_backups (data, schema_version, revision, reason) values (v_current.data, v_current.schema_version, v_current.revision, 'pre-import');
    v_next_revision := v_current.revision + 1;
  else
    v_next_revision := 1;
  end if;
  insert into public.rheomiq_app_state (id, data, schema_version, revision, updated_at) values ('primary', p_data, v_schema_version, v_next_revision, now())
  on conflict (id) do update set data = excluded.data, schema_version = excluded.schema_version, revision = excluded.revision, updated_at = excluded.updated_at;
  insert into public.rheomiq_audit_log (actor_user_id, action, revision) values (auth.uid(), 'import', v_next_revision);
  perform public.rheomiq_prune_backups();
  return query select s.data, s.revision, s.updated_at from public.rheomiq_app_state s where s.id = 'primary';
end;
$$;

create or replace function public.rheomiq_create_backup(p_reason text default 'manual')
returns table(id bigint, created_at timestamptz)
language plpgsql security invoker set search_path = public, auth
as $$
declare v_id bigint; v_created_at timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.rheomiq_is_owner_aal2() then raise exception using errcode = '42501', message = 'MFA_REQUIRED'; end if;
  insert into public.rheomiq_backups (data, schema_version, revision, reason)
  select s.data, s.schema_version, s.revision, case when p_reason in ('manual', 'pre-import', 'automatic') then p_reason else 'manual' end
  from public.rheomiq_app_state s where s.id = 'primary'
  returning rheomiq_backups.id, rheomiq_backups.created_at into v_id, v_created_at;
  if v_id is null then raise exception using errcode = 'P0002', message = 'NO_STATE'; end if;
  insert into public.rheomiq_audit_log (actor_user_id, action, revision) select auth.uid(), 'backup', s.revision from public.rheomiq_app_state s where s.id = 'primary';
  perform public.rheomiq_prune_backups();
  return query select v_id, v_created_at;
end;
$$;

revoke all on function public.rheomiq_has_aal2() from public, anon;
revoke all on function public.rheomiq_is_owner_aal2() from public, anon;
grant execute on function public.rheomiq_has_aal2() to authenticated, service_role;
grant execute on function public.rheomiq_is_owner_aal2() to authenticated, service_role;
