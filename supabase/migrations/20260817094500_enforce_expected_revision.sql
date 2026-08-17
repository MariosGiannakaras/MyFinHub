create or replace function public.rheomiq_save_state(
  p_data jsonb,
  p_expected_revision bigint
)
returns table(data jsonb, revision bigint, updated_at timestamptz)
language plpgsql
set search_path = 'public', 'auth'
as $$
declare
  v_current public.rheomiq_app_state%rowtype;
  v_schema_version integer;
  v_result_revision bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.rheomiq_is_owner_aal2() then
    raise exception using errcode = '42501', message = 'MFA_REQUIRED';
  end if;

  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception using errcode = '22023', message = 'INVALID_DATA';
  end if;

  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception using errcode = '22023', message = 'EXPECTED_REVISION_REQUIRED';
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
    if p_expected_revision <> 0 then
      raise exception using errcode = '40001', message = 'REVISION_CONFLICT';
    end if;

    insert into public.rheomiq_app_state (id, data, schema_version, revision, updated_at)
    values ('primary', p_data, v_schema_version, 1, now());
    v_result_revision := 1;
  else
    if p_expected_revision <> v_current.revision then
      raise exception using errcode = '40001', message = 'REVISION_CONFLICT';
    end if;

    if not exists (
      select 1
      from public.rheomiq_backups
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
