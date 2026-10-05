create or replace function public.rheomiq_save_state(
  p_data jsonb,
  p_expected_revision bigint
)
returns table(data jsonb, revision bigint, updated_at timestamptz)
language plpgsql
security invoker
set search_path = 'public', 'auth'
as $$
declare
  v_owner uuid;
  v_current public.rheomiq_app_state%rowtype;
  v_schema_version integer;
  v_generation bigint;
  v_updated_at text;
begin
  v_owner := public.rheomiq_history_assert_access();

  if p_data is null or jsonb_typeof(p_data) <> 'object'
     or jsonb_typeof(p_data->'state') <> 'object' then
    raise exception using errcode = '22023', message = 'INVALID_DATA';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception using errcode = '22023', message = 'EXPECTED_REVISION_REQUIRED';
  end if;

  v_schema_version := coalesce(nullif(p_data->>'schemaVersion','')::integer, 3);
  if v_schema_version < 1 or v_schema_version > 100 then
    raise exception using errcode = '22023', message = 'INVALID_SCHEMA_VERSION';
  end if;
  v_updated_at := coalesce(nullif(p_data->>'updatedAt',''), now()::text);
  if length(v_updated_at) > 64 then
    raise exception using errcode = '22023', message = 'INVALID_DATA';
  end if;

  select * into v_current from public.rheomiq_app_state where id='primary' for update;

  if not found then
    if p_expected_revision <> 0 then raise exception using errcode = '40001', message = 'REVISION_CONFLICT'; end if;
    insert into public.rheomiq_app_state(id,data,schema_version,revision,updated_at)
    values('primary',p_data,v_schema_version,1,now());
    perform public.rheomiq_history_ensure_cursor();
    insert into public.rheomiq_audit_log(actor_user_id,action,revision) values(auth.uid(),'save',1);
    return query select s.data,s.revision,s.updated_at from public.rheomiq_app_state s where s.id='primary';
    return;
  end if;

  if p_expected_revision <> v_current.revision then
    raise exception using errcode = '40001', message = 'REVISION_CONFLICT';
  end if;

  if v_schema_version <> v_current.schema_version
     or (p_data - array['state','updatedAt']) is distinct from (v_current.data - array['state','updatedAt']) then
    raise exception using errcode = '22023', message = 'FULL_STATE_SAVE_REQUIRES_IMPORT';
  end if;

  perform public.rheomiq_history_ensure_cursor();
  select generation into v_generation
  from public.rheomiq_history_cursor where owner_user_id=v_owner for update;

  perform 1
  from public.rheomiq_save_mutable_state_history(
    p_data->'state',
    p_expected_revision,
    v_generation,
    v_updated_at,
    'Οικονομική αλλαγή'
  );

  return query select s.data,s.revision,s.updated_at from public.rheomiq_app_state s where s.id='primary';
end;
$$;

create or replace function public.rheomiq_import_state(p_data jsonb)
returns table(data jsonb, revision bigint, updated_at timestamptz)
language plpgsql
security invoker
set search_path = 'public', 'auth'
as $$
declare
  v_owner uuid;
  v_current public.rheomiq_app_state%rowtype;
  v_cursor public.rheomiq_history_cursor%rowtype;
  v_schema_version integer;
  v_next_revision bigint;
  v_parent_point bigint;
  v_bridge_point bigint;
  v_import_point bigint;
  v_current_expired boolean;
begin
  v_owner := public.rheomiq_history_assert_access();

  if p_data is null or jsonb_typeof(p_data) <> 'object'
     or jsonb_typeof(p_data->'state') <> 'object' then
    raise exception using errcode = '22023', message = 'INVALID_DATA';
  end if;

  v_schema_version := coalesce(nullif(p_data->>'schemaVersion','')::integer,3);
  if v_schema_version < 1 or v_schema_version > 100 then
    raise exception using errcode = '22023', message = 'INVALID_SCHEMA_VERSION';
  end if;

  select * into v_current from public.rheomiq_app_state where id='primary' for update;

  if not found then
    insert into public.rheomiq_app_state(id,data,schema_version,revision,updated_at)
    values('primary',p_data,v_schema_version,1,now());
    perform public.rheomiq_history_ensure_cursor();
    insert into public.rheomiq_audit_log(actor_user_id,action,revision) values(auth.uid(),'import',1);
    return query select s.data,s.revision,s.updated_at from public.rheomiq_app_state s where s.id='primary';
    return;
  end if;

  perform public.rheomiq_history_ensure_cursor();
  select * into v_cursor from public.rheomiq_history_cursor where owner_user_id=v_owner for update;

  with recursive descendants as (
    select p.id from public.rheomiq_history_points p
    where p.owner_user_id=v_owner and p.parent_point_id=v_cursor.current_point_id
    union all
    select p.id from public.rheomiq_history_points p
    join descendants d on p.parent_point_id=d.id
    where p.owner_user_id=v_owner
  )
  delete from public.rheomiq_history_points p
  using descendants d
  where p.owner_user_id=v_owner and p.id=d.id;

  select expires_at <= now() into v_current_expired
  from public.rheomiq_history_points
  where owner_user_id=v_owner and id=v_cursor.current_point_id;

  v_parent_point := v_cursor.current_point_id;

  if coalesce(v_current_expired,false) or v_cursor.finance_revision <> v_current.revision then
    insert into public.rheomiq_history_points(
      owner_user_id,parent_point_id,state,label,is_baseline,finance_revision
    )
    values(
      v_owner,
      case when coalesce(v_current_expired,false) then null else v_cursor.current_point_id end,
      v_current.data->'state',
      'Προ-εισαγωγής κατάσταση',
      coalesce(v_current_expired,false),
      v_current.revision
    )
    returning id into v_bridge_point;
    v_parent_point := v_bridge_point;
  end if;

  insert into public.rheomiq_backups(data,schema_version,revision,reason)
  values(v_current.data,v_current.schema_version,v_current.revision,'pre-import');

  v_next_revision := v_current.revision + 1;

  update public.rheomiq_app_state
  set data=p_data,schema_version=v_schema_version,revision=v_next_revision,updated_at=now()
  where id='primary';

  insert into public.rheomiq_history_points(
    owner_user_id,parent_point_id,state,label,is_baseline,finance_revision
  )
  values(v_owner,v_parent_point,p_data->'state','Εισαγωγή δεδομένων',false,v_next_revision)
  returning id into v_import_point;

  update public.rheomiq_history_cursor
  set current_point_id=v_import_point,generation=generation+1,finance_revision=v_next_revision,updated_at=now()
  where owner_user_id=v_owner;

  insert into public.rheomiq_audit_log(actor_user_id,action,revision)
  values(auth.uid(),'import',v_next_revision);

  perform public.rheomiq_prune_backups();
  perform public.rheomiq_prune_history(v_owner);

  return query select s.data,s.revision,s.updated_at from public.rheomiq_app_state s where s.id='primary';
end;
$$;

revoke all on function public.rheomiq_save_state(jsonb,bigint) from public, anon;
grant execute on function public.rheomiq_save_state(jsonb,bigint) to authenticated, service_role;
revoke all on function public.rheomiq_import_state(jsonb) from public, anon;
grant execute on function public.rheomiq_import_state(jsonb) to authenticated, service_role;
