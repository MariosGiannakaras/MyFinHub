-- Harden durable Undo/Redo retention and cross-device revision coupling.
-- This follows the initial durable-history migration so fresh and upgraded installs
-- get identical behavior without rewriting finance data or import semantics.

create or replace function public.rheomiq_history_payload(p_owner uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = 'public', 'auth'
as $$
declare
  v_cursor public.rheomiq_history_cursor%rowtype;
  v_current_parent bigint;
  v_can_redo boolean;
  v_undo_depth integer;
  v_redo_depth integer;
  v_points jsonb;
begin
  select * into v_cursor from public.rheomiq_history_cursor where owner_user_id = p_owner;
  if not found then
    return jsonb_build_object(
      'available', false,
      'generation', '0',
      'financeRevision', '0',
      'currentPointId', null,
      'canUndo', false,
      'canRedo', false,
      'undoDepth', 0,
      'redoDepth', 0,
      'points', '[]'::jsonb
    );
  end if;

  select parent_point_id into v_current_parent
  from public.rheomiq_history_points
  where owner_user_id = p_owner and id = v_cursor.current_point_id;

  select exists(
    select 1 from public.rheomiq_history_points
    where owner_user_id = p_owner and parent_point_id = v_cursor.current_point_id
  ) into v_can_redo;

  with recursive ancestors as (
    select p.id, p.parent_point_id
    from public.rheomiq_history_points p
    where p.owner_user_id = p_owner and p.id = v_cursor.current_point_id
    union all
    select p.id, p.parent_point_id
    from public.rheomiq_history_points p
    join ancestors a on a.parent_point_id = p.id
    where p.owner_user_id = p_owner
  )
  select greatest(count(*) - 1, 0)::integer into v_undo_depth from ancestors;

  with recursive future as (
    select p.id
    from public.rheomiq_history_points p
    where p.owner_user_id = p_owner and p.parent_point_id = v_cursor.current_point_id
    union all
    select p.id
    from public.rheomiq_history_points p
    join future f on p.parent_point_id = f.id
    where p.owner_user_id = p_owner
  )
  select count(*)::integer into v_redo_depth from future;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id::text,
    'parentId', case when q.parent_point_id is null then null else q.parent_point_id::text end,
    'label', q.label,
    'createdAt', q.created_at,
    'current', q.id = v_cursor.current_point_id
  ) order by q.created_at desc, q.id desc), '[]'::jsonb)
  into v_points
  from (
    select id, parent_point_id, label, created_at
    from public.rheomiq_history_points
    where owner_user_id = p_owner and not is_baseline
    order by created_at desc, id desc
    limit 100
  ) q;

  return jsonb_build_object(
    'available', true,
    'generation', v_cursor.generation::text,
    'financeRevision', v_cursor.finance_revision::text,
    'currentPointId', v_cursor.current_point_id::text,
    'canUndo', v_current_parent is not null,
    'canRedo', v_can_redo,
    'undoDepth', coalesce(v_undo_depth, 0),
    'redoDepth', coalesce(v_redo_depth, 0),
    'points', v_points
  );
end;
$$;

create or replace function public.rheomiq_read_history()
returns jsonb
language plpgsql
security invoker
set search_path = 'public', 'auth'
as $$
declare
  v_owner uuid;
  v_cursor public.rheomiq_history_cursor%rowtype;
  v_state_revision bigint;
begin
  v_owner := public.rheomiq_history_assert_access();
  perform public.rheomiq_history_ensure_cursor();
  select * into v_cursor from public.rheomiq_history_cursor where owner_user_id = v_owner;
  select revision into v_state_revision from public.rheomiq_app_state where id = 'primary';
  if v_cursor.finance_revision <> v_state_revision then
    return jsonb_build_object(
      'available', false,
      'generation', v_cursor.generation::text,
      'financeRevision', v_cursor.finance_revision::text,
      'currentPointId', v_cursor.current_point_id::text,
      'canUndo', false,
      'canRedo', false,
      'undoDepth', 0,
      'redoDepth', 0,
      'points', '[]'::jsonb
    );
  end if;
  perform public.rheomiq_prune_history(v_owner);
  return public.rheomiq_history_payload(v_owner);
end;
$$;

create or replace function public.rheomiq_save_mutable_state_history(
  p_state jsonb,
  p_expected_revision bigint,
  p_expected_history_generation bigint,
  p_updated_at text,
  p_history_label text
)
returns table(revision bigint, updated_at timestamptz, history jsonb)
language plpgsql
security invoker
set search_path = 'public', 'auth'
as $$
declare
  v_owner uuid;
  v_current public.rheomiq_app_state%rowtype;
  v_cursor public.rheomiq_history_cursor%rowtype;
  v_result_revision bigint;
  v_next_data jsonb;
  v_new_point bigint;
  v_parent_point bigint;
  v_current_expired boolean;
  v_label text;
begin
  v_owner := public.rheomiq_history_assert_access();
  if p_state is null or jsonb_typeof(p_state) <> 'object' then raise exception using errcode = '22023', message = 'INVALID_DATA'; end if;
  if p_expected_revision is null or p_expected_revision < 0 then raise exception using errcode = '22023', message = 'EXPECTED_REVISION_REQUIRED'; end if;
  if p_expected_history_generation is null or p_expected_history_generation < 0 then raise exception using errcode = '22023', message = 'EXPECTED_HISTORY_GENERATION_REQUIRED'; end if;
  if p_updated_at is null or length(p_updated_at) < 1 or length(p_updated_at) > 64 then raise exception using errcode = '22023', message = 'INVALID_DATA'; end if;
  v_label := coalesce(nullif(btrim(p_history_label), ''), 'Οικονομική αλλαγή');
  if char_length(v_label) > 180 then raise exception using errcode = '22023', message = 'INVALID_HISTORY_LABEL'; end if;

  select * into v_current from public.rheomiq_app_state where id = 'primary' for update;
  if not found then raise exception using errcode = 'P0002', message = 'NO_STATE'; end if;
  if p_expected_revision <> v_current.revision then raise exception using errcode = '40001', message = 'REVISION_CONFLICT'; end if;

  perform public.rheomiq_history_ensure_cursor();
  select * into v_cursor from public.rheomiq_history_cursor where owner_user_id = v_owner for update;
  if p_expected_history_generation <> v_cursor.generation or v_cursor.finance_revision <> v_current.revision then
    raise exception using errcode = '40001', message = 'HISTORY_CURSOR_CONFLICT';
  end if;

  -- A new mutation after Undo invalidates the complete redo branch before one new point is appended.
  with recursive descendants as (
    select p.id from public.rheomiq_history_points p
    where p.owner_user_id = v_owner and p.parent_point_id = v_cursor.current_point_id
    union all
    select p.id from public.rheomiq_history_points p
    join descendants d on p.parent_point_id = d.id
    where p.owner_user_id = v_owner
  )
  delete from public.rheomiq_history_points p
  using descendants d
  where p.owner_user_id = v_owner and p.id = d.id;

  -- If the canonical current point itself aged past the 10-day recovery window,
  -- refresh a hidden baseline from the still-current finance state. The new user
  -- mutation can therefore always be undone once without resurrecting expired history.
  select expires_at <= now() into v_current_expired
  from public.rheomiq_history_points
  where owner_user_id = v_owner and id = v_cursor.current_point_id;

  v_parent_point := v_cursor.current_point_id;
  if coalesce(v_current_expired, false) then
    insert into public.rheomiq_history_points(
      owner_user_id, parent_point_id, state, label, is_baseline, finance_revision
    ) values (
      v_owner, null, v_current.data -> 'state', 'Αρχική κατάσταση ιστορικού', true, v_current.revision
    ) returning id into v_parent_point;
  end if;

  if not exists (
    select 1 from public.rheomiq_backups
    where reason = 'automatic' and created_at >= now() - interval '6 hours'
  ) then
    insert into public.rheomiq_backups (data, schema_version, revision, reason)
    values (v_current.data, v_current.schema_version, v_current.revision, 'automatic');
  end if;

  v_result_revision := v_current.revision + 1;
  v_next_data := jsonb_set(v_current.data, '{state}', p_state, true);
  v_next_data := jsonb_set(v_next_data, '{updatedAt}', to_jsonb(p_updated_at), true);

  insert into public.rheomiq_history_points(owner_user_id, parent_point_id, state, label, finance_revision)
  values(v_owner, v_parent_point, p_state, v_label, v_result_revision)
  returning id into v_new_point;

  update public.rheomiq_app_state
  set data = v_next_data, revision = v_result_revision, updated_at = now()
  where id = 'primary';

  update public.rheomiq_history_cursor
  set current_point_id = v_new_point,
      generation = generation + 1,
      finance_revision = v_result_revision,
      updated_at = now()
  where owner_user_id = v_owner;

  insert into public.rheomiq_audit_log(actor_user_id, action, revision)
  values(auth.uid(), 'save', v_result_revision);

  perform public.rheomiq_prune_backups();
  perform public.rheomiq_prune_history(v_owner);
  return query select s.revision, s.updated_at, public.rheomiq_history_payload(v_owner)
  from public.rheomiq_app_state s where s.id = 'primary';
end;
$$;

create or replace function public.rheomiq_move_history(
  p_direction text,
  p_expected_revision bigint,
  p_expected_history_generation bigint,
  p_updated_at text
)
returns table(data jsonb, revision bigint, updated_at timestamptz, history jsonb)
language plpgsql
security invoker
set search_path = 'public', 'auth'
as $$
declare
  v_owner uuid;
  v_current public.rheomiq_app_state%rowtype;
  v_cursor public.rheomiq_history_cursor%rowtype;
  v_target public.rheomiq_history_points%rowtype;
  v_result_revision bigint;
  v_next_data jsonb;
begin
  v_owner := public.rheomiq_history_assert_access();
  if p_direction not in ('undo', 'redo') then raise exception using errcode = '22023', message = 'INVALID_HISTORY_DIRECTION'; end if;
  if p_expected_revision is null or p_expected_revision < 0 then raise exception using errcode = '22023', message = 'EXPECTED_REVISION_REQUIRED'; end if;
  if p_expected_history_generation is null or p_expected_history_generation < 0 then raise exception using errcode = '22023', message = 'EXPECTED_HISTORY_GENERATION_REQUIRED'; end if;
  if p_updated_at is null or length(p_updated_at) < 1 or length(p_updated_at) > 64 then raise exception using errcode = '22023', message = 'INVALID_DATA'; end if;

  select * into v_current from public.rheomiq_app_state where id = 'primary' for update;
  if not found then raise exception using errcode = 'P0002', message = 'NO_STATE'; end if;
  if p_expected_revision <> v_current.revision then raise exception using errcode = '40001', message = 'REVISION_CONFLICT'; end if;

  perform public.rheomiq_history_ensure_cursor();
  select * into v_cursor from public.rheomiq_history_cursor where owner_user_id = v_owner for update;
  if p_expected_history_generation <> v_cursor.generation or v_cursor.finance_revision <> v_current.revision then
    raise exception using errcode = '40001', message = 'HISTORY_CURSOR_CONFLICT';
  end if;

  -- Enforce the recovery window before target selection. Expired non-current points
  -- are removed and can never be resurrected by a direct Undo/Redo API call.
  perform public.rheomiq_prune_history(v_owner);

  if p_direction = 'undo' then
    select target.* into v_target
    from public.rheomiq_history_points current_point
    join public.rheomiq_history_points target
      on target.owner_user_id = current_point.owner_user_id and target.id = current_point.parent_point_id
    where current_point.owner_user_id = v_owner
      and current_point.id = v_cursor.current_point_id
      and target.expires_at > now();
  else
    select * into v_target
    from public.rheomiq_history_points
    where owner_user_id = v_owner
      and parent_point_id = v_cursor.current_point_id
      and expires_at > now()
    order by id asc
    limit 1;
  end if;

  if v_target.id is null then raise exception using errcode = '22023', message = 'HISTORY_UNAVAILABLE'; end if;

  v_result_revision := v_current.revision + 1;
  v_next_data := jsonb_set(v_current.data, '{state}', v_target.state, true);
  v_next_data := jsonb_set(v_next_data, '{updatedAt}', to_jsonb(p_updated_at), true);

  update public.rheomiq_app_state
  set data = v_next_data, revision = v_result_revision, updated_at = now()
  where id = 'primary';

  update public.rheomiq_history_cursor
  set current_point_id = v_target.id,
      generation = generation + 1,
      finance_revision = v_result_revision,
      updated_at = now()
  where owner_user_id = v_owner;

  insert into public.rheomiq_audit_log(actor_user_id, action, revision)
  values(auth.uid(), p_direction, v_result_revision);

  perform public.rheomiq_prune_history(v_owner);
  return query select s.data, s.revision, s.updated_at, public.rheomiq_history_payload(v_owner)
  from public.rheomiq_app_state s where s.id = 'primary';
end;
$$;

revoke all on function public.rheomiq_history_payload(uuid) from public, anon;
revoke all on function public.rheomiq_read_history() from public, anon;
revoke all on function public.rheomiq_save_mutable_state_history(jsonb, bigint, bigint, text, text) from public, anon;
revoke all on function public.rheomiq_move_history(text, bigint, bigint, text) from public, anon;
grant execute on function public.rheomiq_history_payload(uuid) to authenticated, service_role;
grant execute on function public.rheomiq_read_history() to authenticated, service_role;
grant execute on function public.rheomiq_save_mutable_state_history(jsonb, bigint, bigint, text, text) to authenticated, service_role;
grant execute on function public.rheomiq_move_history(text, bigint, bigint, text) to authenticated, service_role;
