create or replace function public.rheomiq_save_mutable_state(
  p_state jsonb,
  p_expected_revision bigint,
  p_updated_at text
)
returns table(revision bigint, updated_at timestamptz)
language plpgsql
security invoker
set search_path = 'public', 'auth'
as $$
declare
  v_current public.rheomiq_app_state%rowtype;
  v_result_revision bigint;
  v_next_data jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.rheomiq_is_owner_aal2() then
    raise exception using errcode = '42501', message = 'MFA_REQUIRED';
  end if;

  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception using errcode = '22023', message = 'INVALID_DATA';
  end if;

  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception using errcode = '22023', message = 'EXPECTED_REVISION_REQUIRED';
  end if;

  if p_updated_at is null or length(p_updated_at) < 1 or length(p_updated_at) > 64 then
    raise exception using errcode = '22023', message = 'INVALID_DATA';
  end if;

  select * into v_current
  from public.rheomiq_app_state
  where id = 'primary'
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'NO_STATE';
  end if;

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
  v_next_data := jsonb_set(v_current.data, '{state}', p_state, true);
  v_next_data := jsonb_set(v_next_data, '{updatedAt}', to_jsonb(p_updated_at), true);

  update public.rheomiq_app_state
  set data = v_next_data,
      revision = v_result_revision,
      updated_at = now()
  where id = 'primary';

  insert into public.rheomiq_audit_log (actor_user_id, action, revision)
  values (auth.uid(), 'save', v_result_revision);

  perform public.rheomiq_prune_backups();

  return query
  select s.revision, s.updated_at
  from public.rheomiq_app_state s
  where s.id = 'primary';
end;
$$;

revoke all on function public.rheomiq_save_mutable_state(jsonb, bigint, text) from public, anon;
grant execute on function public.rheomiq_save_mutable_state(jsonb, bigint, text) to authenticated, service_role;
