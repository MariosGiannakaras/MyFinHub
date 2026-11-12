-- #649 I22.05: reject new or worsened dated receivable deficits in the
-- authoritative revision-locked mutable-state RPC. This additive migration
-- changes no stored financial rows, past history, seed, import or undo/redo.
-- Apply only through normal reviewed deployment/migration gates.
begin;

-- BEGIN I22.05 ISOLATED LOCAL POSTGRES HELPERS
create or replace function private.rheomiq_chronology_date(p_value text)
returns date language plpgsql immutable security invoker set search_path='' as $$
declare v_day date;
begin
  if p_value is null or p_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return null; end if;
  begin
    v_day:=p_value::date;
    if to_char(v_day,'YYYY-MM-DD')=p_value then return v_day; end if;
  exception when invalid_datetime_format or datetime_field_overflow then
    return null;
  end;
  return null;
end;
$$;

-- Match the canonical legacy snapshot rule: reconstruct only complete,
-- cent-exact, nonnegative histories whose total equals the imported balance.
-- Incomplete or malformed legacy histories retain their original snapshot.
create or replace function private.rheomiq_legacy_receivable_cents_asof(
  p_seed jsonb,p_person text,p_day date
) returns numeric language plpgsql stable security invoker set search_path='' as $$
declare
  v_legacy jsonb;
  v_entry jsonb;
  v_row record;
  v_rows jsonb;
  v_kind text;
  v_raw text;
  v_person text;
  v_day date;
  v_opening numeric;
  v_amount numeric;
  v_part numeric;
  v_delta numeric;
  v_running numeric;
  v_at numeric;
  v_total numeric:=0;
  v_valid boolean;
begin
  for v_legacy in select j.value from jsonb_array_elements(
    case when jsonb_typeof(p_seed->'lending')='array' then p_seed->'lending' else '[]'::jsonb end
  ) as j(value) loop
    v_person:=btrim(coalesce(v_legacy->>'person',''));
    if v_person='' or v_person<>p_person then continue; end if;
    begin
      v_opening:=coalesce(nullif(v_legacy->>'outstanding','')::numeric,0);
      if v_opening::text in ('NaN','Infinity','-Infinity') then v_opening:=0; end if;
    exception when invalid_text_representation or numeric_value_out_of_range then
      v_opening:=0;
    end;
    v_valid:=v_opening>=0 and abs(v_opening*100-round(v_opening*100))<=0.000001
      and abs(v_opening*100)<=9007199254740991;
    v_rows:='[]'::jsonb;
    if jsonb_typeof(v_legacy->'entries')='array' and
       jsonb_array_length(v_legacy->'entries')>0 and v_valid then
      for v_entry in select j.value from jsonb_array_elements(v_legacy->'entries') as j(value) loop
        v_day:=private.rheomiq_chronology_date(v_entry->>'date');
        if v_day is null then v_valid:=false; exit; end if;
        v_delta:=0;
        foreach v_kind in array array['lent','repaid','haircut'] loop
          if not (v_entry ? v_kind) or jsonb_typeof(v_entry->v_kind)='null' then continue; end if;
          v_raw:=v_entry->>v_kind;
          if jsonb_typeof(v_entry->v_kind) not in ('number','string') or
             btrim(coalesce(v_raw,''))='' or
             v_raw !~ '^[+]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$' then
            v_valid:=false; exit;
          end if;
          begin
            v_amount:=v_raw::numeric;
          exception when invalid_text_representation or numeric_value_out_of_range then
            v_valid:=false; exit;
          end;
          if v_amount::text in ('NaN','Infinity','-Infinity') or v_amount<0 or
             abs(v_amount*100-round(v_amount*100))>0.000001 or
             abs(v_amount*100)>9007199254740991 then
            v_valid:=false; exit;
          end if;
          v_part:=round(v_amount*100);
          if v_kind='lent' then v_delta:=v_delta+v_part; else v_delta:=v_delta-v_part; end if;
        end loop;
        if not v_valid or abs(v_delta)>9007199254740991 then v_valid:=false; exit; end if;
        v_rows:=v_rows||jsonb_build_array(jsonb_build_object('date',v_day,'delta',v_delta));
      end loop;
      if v_valid then
        v_running:=0;v_at:=0;
        for v_row in
          select (r.item->>'date')::date as event_day,
                 (r.item->>'delta')::numeric as delta
          from jsonb_array_elements(v_rows) with ordinality as r(item,position)
          order by (r.item->>'date')::date,r.position
        loop
          v_running:=v_running+v_row.delta;
          if v_running<0 or abs(v_running)>9007199254740991 then v_valid:=false; exit; end if;
          if v_row.event_day<=p_day then v_at:=v_running; end if;
        end loop;
        if v_valid and v_running=round(v_opening*100) then
          v_total:=v_total+v_at;
          continue;
        end if;
      end if;
    end if;
    v_total:=v_total+round(v_opening*100);
  end loop;
  return v_total;
end;
$$;

-- Compare daily end-of-day balance for the *proposed* state against the
-- current database state under the caller's row lock. A known older imported
-- deficit is left intact unless this mutation makes it worse. An intermediate
-- deficit cannot be concealed by a future lending replenishment.
create or replace function private.rheomiq_guard_mutable_receivable_chronology(
  p_seed jsonb,p_previous_state jsonb,p_next_state jsonb
) returns void language plpgsql volatile security invoker set search_path='' as $$
declare
  v_event jsonb;
  v_prior jsonb;
  v_kind text;
  v_amount numeric;
  v_delta numeric;
  v_violation boolean;
begin
  if jsonb_typeof(p_previous_state)<>'object' or jsonb_typeof(p_next_state)<>'object' then
    raise exception using errcode='22023',message='INVALID_DATA';
  end if;
  -- Direct PostgREST RPC callers do not pass through Node's semantic checks.
  -- Enforce shape/delta for new or changed receivable events while allowing
  -- unchanged imported historical entries with legacy metadata.
  for v_event in select e.value from jsonb_array_elements(
    case when jsonb_typeof(p_next_state->'events')='array' then p_next_state->'events' else '[]'::jsonb end
  ) e(value) loop
    select old.value into v_prior
    from jsonb_array_elements(
      case when jsonb_typeof(p_previous_state->'events')='array' then p_previous_state->'events' else '[]'::jsonb end
    ) old(value)
    where old.value->>'id'=v_event->>'id' and old.value=v_event
    limit 1;
    if found then continue; end if;
    v_kind:=v_event->>'kind';
    if v_kind in ('lending','repayment','lending_writeoff') then
      if nullif(btrim(coalesce(v_event->>'person','')),'') is null or
         private.rheomiq_chronology_date(v_event->>'date') is null or
         v_event->>'amount' is null or v_event->>'receivableDelta' is null then
        raise exception using errcode='22023',message='INVALID_RECEIVABLE_EVENT';
      end if;
      begin
        v_amount:=(v_event->>'amount')::numeric;
        v_delta:=(v_event->>'receivableDelta')::numeric;
      exception when invalid_text_representation or numeric_value_out_of_range then
        raise exception using errcode='22023',message='INVALID_RECEIVABLE_EVENT';
      end;
      if v_amount::text in ('NaN','Infinity','-Infinity') or
         v_delta::text in ('NaN','Infinity','-Infinity') or
         v_amount<=0 or abs(v_amount*100-round(v_amount*100))>0.000001 or
         abs(v_amount*100)>9007199254740991 or
         round(v_delta*100)<>case when v_kind='lending' then round(v_amount*100) else -round(v_amount*100) end or
         abs(v_delta*100-round(v_delta*100))>0.000001 then
        raise exception using errcode='22023',message='INVALID_RECEIVABLE_EVENT';
      end if;
    elsif v_event ? 'receivableDelta' and v_event->>'receivableDelta' is not null then
      -- A non-receivable event must never secretly offset a repayment.
      begin
        v_delta:=(v_event->>'receivableDelta')::numeric;
      exception when invalid_text_representation or numeric_value_out_of_range then
        raise exception using errcode='22023',message='INVALID_RECEIVABLE_EVENT';
      end;
      if v_delta<>0 then raise exception using errcode='22023',message='INVALID_RECEIVABLE_EVENT'; end if;
    end if;
  end loop;

  with raw as materialized (
    select 'before'::text as version,btrim(e.value->>'person') as person,
           private.rheomiq_chronology_date(e.value->>'date') as event_day,
           case when e.value->>'receivableDelta' ~ '^[+-]?[0-9]+(?:\.[0-9]+)?$'
                then round((e.value->>'receivableDelta')::numeric*100)
                else 0::numeric end as cents
    from jsonb_array_elements(coalesce(p_previous_state->'events','[]'::jsonb)) e(value)
    where nullif(btrim(coalesce(e.value->>'person','')),'') is not null
      and e.value->>'receivableDelta' is not null
    union all
    select 'after',btrim(e.value->>'person'),
           private.rheomiq_chronology_date(e.value->>'date'),
           case when e.value->>'receivableDelta' ~ '^[+-]?[0-9]+(?:\.[0-9]+)?$'
                then round((e.value->>'receivableDelta')::numeric*100)
                else 0::numeric end
    from jsonb_array_elements(coalesce(p_next_state->'events','[]'::jsonb)) e(value)
    where nullif(btrim(coalesce(e.value->>'person','')),'') is not null
      and e.value->>'receivableDelta' is not null
  ),
  checkpoints as materialized (
    select distinct person,event_day from raw where event_day is not null
    union
    select distinct btrim(l.value->>'person'),
           private.rheomiq_chronology_date(entry.value->>'date')
    from jsonb_array_elements(coalesce(p_seed->'lending','[]'::jsonb)) l(value)
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(l.value->'entries')='array' then l.value->'entries' else '[]'::jsonb end
    ) entry(value)
    where nullif(btrim(coalesce(l.value->>'person','')),'') is not null
      and private.rheomiq_chronology_date(entry.value->>'date') is not null
    union
    select distinct person,date '9999-12-31' from raw
    union
    select distinct btrim(l.value->>'person'),date '9999-12-31'
    from jsonb_array_elements(coalesce(p_seed->'lending','[]'::jsonb)) l(value)
    where nullif(btrim(coalesce(l.value->>'person','')),'') is not null
  ),
  dated_movements as (
    select version,person,event_day,sum(cents) as cents
    from raw where event_day is not null group by version,person,event_day
    union all
    select v.version,c.person,c.event_day,0::numeric
    from checkpoints c cross join (values('before'::text),('after'::text)) v(version)
  ),
  daily as (
    select version,person,event_day,sum(cents) as cents
    from dated_movements group by version,person,event_day
  ),
  running as (
    select version,person,event_day,
           sum(cents) over(partition by version,person order by event_day) as event_cents
    from daily
  )
  select exists(
    select 1 from running next
    join running prior on prior.version='before' and next.version='after'
      and prior.person=next.person and prior.event_day=next.event_day
    cross join lateral (
      select private.rheomiq_legacy_receivable_cents_asof(p_seed,next.person,next.event_day) as cents
    ) baseline
    where baseline.cents+next.event_cents<least(baseline.cents+prior.event_cents,0)
  ) into v_violation;
  if v_violation then
    raise exception using errcode='22023',message='RECEIVABLE_CHRONOLOGY_CONFLICT';
  end if;
end;
$$;

revoke all on function private.rheomiq_chronology_date(text) from public,anon;
revoke all on function private.rheomiq_legacy_receivable_cents_asof(jsonb,text,date) from public,anon;
revoke all on function private.rheomiq_guard_mutable_receivable_chronology(jsonb,jsonb,jsonb) from public,anon;
grant execute on function private.rheomiq_chronology_date(text) to authenticated,service_role;
grant execute on function private.rheomiq_legacy_receivable_cents_asof(jsonb,text,date) to authenticated,service_role;
grant execute on function private.rheomiq_guard_mutable_receivable_chronology(jsonb,jsonb,jsonb) to authenticated,service_role;
-- END I22.05 ISOLATED LOCAL POSTGRES HELPERS

-- Preserve the original owner/AAL2, row revision, history-generation, backup,
-- pruning, irreversible-history and audit transaction exactly. Only one
-- validation call is added after the locked full-state composition.
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
