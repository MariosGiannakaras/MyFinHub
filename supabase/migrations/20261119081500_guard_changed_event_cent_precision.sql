-- #649 I22.02: transactionally reject changed fractional-cent event money in the
-- authenticated revision-locked RPC, including direct calls skipping Node API.
-- No stored rows/history/seed are changed by installing this migration.
-- Apply only after disposable PostgreSQL tests and ordinary reviewed gates.
begin;

-- BEGIN I22.02 ISOLATED LOCAL POSTGRES HELPERS
-- Stable composite JSONB keys avoid delimiter collisions between event IDs,
-- account IDs, split part IDs and funding source IDs. Comparing values per
-- stable identity preserves untouched imported legacy money during note edits.
create or replace function private.rheomiq_mutable_event_money_fields(p_state jsonb)
returns table(field_key jsonb, amount jsonb)
language sql stable security invoker set search_path='' as $$
  select jsonb_build_array('event',e.value->>'id',e.value->>'kind','amount'),e.value->'amount'
  from jsonb_array_elements(coalesce(p_state->'events','[]'::jsonb)) e(value)
  union all
  select jsonb_build_array('event',e.value->>'id',e.value->>'kind','leg',l.value->>'accountId'),l.value->'amount'
  from jsonb_array_elements(coalesce(p_state->'events','[]'::jsonb)) e(value)
  cross join lateral jsonb_array_elements(coalesce(e.value->'legs','[]'::jsonb)) l(value)
  union all
  select jsonb_build_array('event',e.value->>'id',e.value->>'kind','split',part.value->>'id'),part.value->'amount'
  from jsonb_array_elements(coalesce(p_state->'events','[]'::jsonb)) e(value)
  cross join lateral jsonb_array_elements(coalesce(e.value->'parts','[]'::jsonb)) part(value)
  union all
  select jsonb_build_array('event',e.value->>'id',e.value->>'kind','funding',part.value->>'kind',part.value->>'sourceId'),part.value->'amount'
  from jsonb_array_elements(coalesce(p_state->'events','[]'::jsonb)) e(value)
  cross join lateral jsonb_array_elements(coalesce(e.value->'funding','[]'::jsonb)) part(value)
  union all
  select jsonb_build_array('event',e.value->>'id',e.value->>'kind',opt.field_name),opt.amount
  from jsonb_array_elements(coalesce(p_state->'events','[]'::jsonb)) e(value)
  cross join lateral (values
    ('savingAmount',e.value->'savingAmount'),
    ('receivableDelta',e.value->'receivableDelta'),
    ('creditDelta',e.value->'creditDelta')
  ) opt(field_name,amount)
  where e.value ? opt.field_name;
$$;

create or replace function private.rheomiq_guard_changed_event_cents(
  p_previous jsonb,p_next jsonb
) returns void language plpgsql security invoker set search_path='' as $$
declare
  v_item record;
  v_numeric numeric;
  v_cents numeric;
begin
  for v_item in
    select n.field_key,n.amount
    from private.rheomiq_mutable_event_money_fields(p_next) n
    left join private.rheomiq_mutable_event_money_fields(p_previous) old
      on old.field_key=n.field_key
    where old.amount is distinct from n.amount
  loop
    if v_item.amount is null or jsonb_typeof(v_item.amount)<>'number' then
      raise exception using errcode='22023',message='INVALID_EVENT_CENT_PRECISION';
    end if;
    begin
      v_numeric:=(v_item.amount::text)::numeric;
      v_cents:=round(v_numeric*100);
    exception when numeric_value_out_of_range or invalid_text_representation then
      raise exception using errcode='22023',message='INVALID_EVENT_CENT_PRECISION';
    end;
    if v_numeric::text in ('NaN','Infinity','-Infinity')
       or abs(v_cents)>9007199254740991
       or abs(v_numeric*100-v_cents)>0.000001 then
      raise exception using errcode='22023',message='INVALID_EVENT_CENT_PRECISION';
    end if;
  end loop;
end;
$$;

revoke all on function private.rheomiq_mutable_event_money_fields(jsonb) from public,anon;
revoke all on function private.rheomiq_guard_changed_event_cents(jsonb,jsonb) from public,anon;
grant execute on function private.rheomiq_mutable_event_money_fields(jsonb) to authenticated,service_role;
grant execute on function private.rheomiq_guard_changed_event_cents(jsonb,jsonb) to authenticated,service_role;
-- END I22.02 ISOLATED LOCAL POSTGRES HELPERS

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
set search_path = public, auth, private
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
  v_current_full_state jsonb;
begin
  v_owner := public.rheomiq_history_assert_access();
  if p_state is null or jsonb_typeof(p_state)<>'object' then raise exception using errcode='22023',message='INVALID_DATA'; end if;
  if p_expected_revision is null or p_expected_revision<0 then raise exception using errcode='22023',message='EXPECTED_REVISION_REQUIRED'; end if;
  if p_expected_history_generation is null or p_expected_history_generation<0 then raise exception using errcode='22023',message='EXPECTED_HISTORY_GENERATION_REQUIRED'; end if;
  if p_updated_at is null or length(p_updated_at)<1 or length(p_updated_at)>64 then raise exception using errcode='22023',message='INVALID_DATA'; end if;
  v_label := coalesce(nullif(btrim(p_history_label),''),'Οικονομική αλλαγή');
  if char_length(v_label)>180 then raise exception using errcode='22023',message='INVALID_HISTORY_LABEL'; end if;

  select * into v_current from public.rheomiq_app_state where id='primary' for update;
  if not found then raise exception using errcode='P0002',message='NO_STATE'; end if;
  if p_expected_revision<>v_current.revision then raise exception using errcode='40001',message='REVISION_CONFLICT'; end if;

  perform public.rheomiq_history_ensure_cursor();
  select * into v_cursor from public.rheomiq_history_cursor where owner_user_id=v_owner for update;
  if p_expected_history_generation<>v_cursor.generation or v_cursor.finance_revision<>v_current.revision then
    raise exception using errcode='40001',message='HISTORY_CURSOR_CONFLICT';
  end if;

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

  v_current_full_state := private.rheomiq_ledger_compose_state(v_owner,v_current.data->'state');
  -- I22.05: same locked owner revision, before backups, history, and ledger writes.
  perform private.rheomiq_guard_mutable_receivable_chronology(v_current.data->'seed',v_current_full_state,p_state);
  -- Same owner/AAL2, revision and history-generation lock: forbid only newly
  -- submitted unrepresentable event money, never rewrite imported history.
  perform private.rheomiq_guard_changed_event_cents(v_current_full_state,p_state);

  select expires_at<=now() into v_current_expired
  from public.rheomiq_history_points
  where owner_user_id=v_owner and id=v_cursor.current_point_id;

  v_parent_point := v_cursor.current_point_id;
  if coalesce(v_current_expired,false) then
    insert into public.rheomiq_history_points(owner_user_id,parent_point_id,state,label,is_baseline,finance_revision)
    values(v_owner,null,v_current_full_state,'Αρχική κατάσταση ιστορικού',true,v_current.revision)
    returning id into v_parent_point;
  end if;

  if not exists(
    select 1 from public.rheomiq_backups
    where reason='automatic' and created_at>=now()-interval '6 hours'
  ) then
    insert into public.rheomiq_backups(data,schema_version,revision,reason)
    values(
      private.rheomiq_effective_data(v_owner,v_current.data),
      v_current.schema_version,
      v_current.revision,
      'automatic'
    );
  end if;

  perform private.rheomiq_ledger_apply_state(v_owner,p_state);

  v_result_revision := v_current.revision+1;
  v_next_data := jsonb_set(v_current.data,'{state}',private.rheomiq_ledger_strip_state(p_state),true);
  v_next_data := jsonb_set(v_next_data,'{updatedAt}',to_jsonb(p_updated_at),true);

  insert into public.rheomiq_history_points(owner_user_id,parent_point_id,state,label,finance_revision)
  values(v_owner,v_parent_point,p_state,v_label,v_result_revision)
  returning id into v_new_point;

  update public.rheomiq_app_state
  set data=v_next_data,finance_storage_mode='relational_v1',revision=v_result_revision,updated_at=now()
  where id='primary';

  update public.rheomiq_history_cursor
  set current_point_id=v_new_point,generation=generation+1,finance_revision=v_result_revision,updated_at=now()
  where owner_user_id=v_owner;

  insert into public.rheomiq_audit_log(actor_user_id,action,revision)
  values(auth.uid(),'save',v_result_revision);

  perform public.rheomiq_prune_backups();
  perform public.rheomiq_prune_history(v_owner);

  return query
  select s.revision,s.updated_at,public.rheomiq_history_payload(v_owner)
  from public.rheomiq_app_state s where s.id='primary';
end;
$$;

revoke all on function public.rheomiq_save_mutable_state_history(jsonb,bigint,bigint,text,text) from public,anon;
grant execute on function public.rheomiq_save_mutable_state_history(jsonb,bigint,bigint,text,text) to authenticated,service_role;
commit;
