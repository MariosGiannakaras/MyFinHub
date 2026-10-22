-- #588 Batch B3. Reconcile relational database health with the canonical
-- noncash receivable-writeoff event, without dropping health gates.
-- No rows are altered; owner/AAL2/SECURITY INVOKER, RLS and finance revisions
-- remain identical to the relational cutover contract.
begin;
create or replace function public.rheomiq_database_health()
returns jsonb
language plpgsql
security invoker
set search_path = public, auth, storage, private
as $$
declare
  v_owner uuid;
  v_state jsonb;
  v_raw_state jsonb;
  v_revision bigint;
  v_cursor_revision bigint;
  v_current_point bigint;
  v_current_point_state jsonb;
  v_checks jsonb;
  v_warnings jsonb;
  v_ok boolean;
  v_ready boolean;
begin
  v_owner := public.rheomiq_history_assert_access();

  select private.rheomiq_ledger_compose_state(v_owner,data->'state'),data->'state',revision
  into v_state,v_raw_state,v_revision
  from public.rheomiq_app_state
  where id='primary';

  select finance_revision,current_point_id
  into v_cursor_revision,v_current_point
  from public.rheomiq_history_cursor
  where owner_user_id=v_owner;

  select state into v_current_point_state
  from public.rheomiq_history_points
  where owner_user_id=v_owner and id=v_current_point;

  with
  events as (select value j from jsonb_array_elements(coalesce(v_state->'events','[]'::jsonb))),
  cards as (select value j from jsonb_array_elements(coalesce(v_state->'cards','[]'::jsonb))),
  deleted_cards as (select value j from jsonb_array_elements(coalesce(v_state->'deletedCards','[]'::jsonb))),
  statements as (select value j from jsonb_array_elements(coalesce(v_state->'creditStatements','[]'::jsonb))),
  legs as (
    select e.j,l.value leg
    from events e
    cross join lateral jsonb_array_elements(case when jsonb_typeof(e.j->'legs')='array' then e.j->'legs' else '[]'::jsonb end) l(value)
  ),
  account_names as (
    select key account_id from jsonb_object_keys(coalesce(v_state#>'{settings,accountNames}','{}'::jsonb)) key
  )
  select jsonb_build_object(
    'app_state_rows',(select count(*) from public.rheomiq_app_state where id='primary'),
    'owner_rows',(select count(*) from public.rheomiq_owner where singleton=true),
    'history_cursor_rows',(select count(*) from public.rheomiq_history_cursor where owner_user_id=v_owner),
    'history_revision_mismatches',case when v_revision is distinct from v_cursor_revision then 1 else 0 end,
    'history_current_point_missing',case when v_current_point is null or v_current_point_state is null then 1 else 0 end,
    'history_current_point_state_mismatches',case when v_state is distinct from v_current_point_state then 1 else 0 end,
    'raw_state_ledger_keys',(
      select count(*) from unnest(array['events','cards','deletedCards','creditStatements','budgets','recurringCustom','scheduled']) k
      where v_raw_state ? k
    ),
    'duplicate_event_ids',(select count(*) from (select j->>'id' id from events group by 1 having count(*)>1) q),
    'duplicate_card_ids',(select count(*) from (select j->>'id' id from cards group by 1 having count(*)>1) q),
    'duplicate_statement_ids',(select count(*) from (select j->>'id' id from statements group by 1 having count(*)>1) q),
    'events_missing_id',(select count(*) from events where coalesce(j->>'id','')=''),
    'events_missing_date',(select count(*) from events where coalesce(j->>'date','')=''),
    'events_nonpositive_amount',(select count(*) from events where jsonb_typeof(j->'amount')<>'number' or (j->>'amount')::numeric<=0),
    -- Noncash receivable write-offs must have exactly zero bank-account legs.
    -- Every other event still requires at least one ledger leg.
    'events_without_legs',(
      select count(*) from events
      where coalesce(j->>'kind','')<>'lending_writeoff'
        and (jsonb_typeof(j->'legs')<>'array'
          or jsonb_array_length(case when jsonb_typeof(j->'legs')='array'
            then j->'legs' else '[]'::jsonb end)=0)
    ),
    'invalid_writeoff_legs',(
      select count(*) from events
      where j->>'kind'='lending_writeoff'
        and (jsonb_typeof(j->'legs') is distinct from 'array'
          or jsonb_array_length(case when jsonb_typeof(j->'legs')='array'
            then j->'legs' else '[]'::jsonb end)<>0)
    ),
    'unbalanced_internal_events',(
      select count(*)
      from events e
      where e.j->>'kind' in ('transfer','withdrawal','saving_cash_offset','card_payment')
        and (
          jsonb_typeof(e.j->'legs')<>'array'
          or jsonb_array_length(case when jsonb_typeof(e.j->'legs')='array' then e.j->'legs' else '[]'::jsonb end)<>2
          or abs(coalesce((
            select sum((l.value->>'amount')::numeric)
            from jsonb_array_elements(case when jsonb_typeof(e.j->'legs')='array' then e.j->'legs' else '[]'::jsonb end) l(value)
            where jsonb_typeof(l.value->'amount')='number'
          ),0))>0.0001
        )
    ),
    'unknown_leg_accounts',(
      select count(*) from legs
      where coalesce(leg->>'accountId','')=''
        or not exists(
          select 1 from private.rheomiq_accounts a
          where a.owner_user_id=v_owner and a.account_id=leg->>'accountId'
        )
    ),
    'orphan_card_event_refs',(
      select count(*) from events e
      where e.j->>'kind' in ('card_purchase','card_payment')
        and coalesce(e.j->>'cardId','')<>''
        and not exists(select 1 from cards c where c.j->>'id'=e.j->>'cardId')
        and not exists(select 1 from deleted_cards d where d.j->>'id'=e.j->>'cardId')
    ),
    'orphan_statement_event_refs',(
      select count(*) from events e
      where coalesce(e.j->>'statementId','')<>''
        and not exists(select 1 from statements s where s.j->>'id'=e.j->>'statementId')
    ),
    'stale_account_metadata',(
      select count(*) from public.rheomiq_account_metadata m
      where m.owner_user_id=v_owner
        and not exists(select 1 from private.rheomiq_accounts a where a.owner_user_id=v_owner and a.account_id=m.account_id)
    ),
    'provider_invalid_active_refs',(
      select count(*)
      from public.rheomiq_financial_providers p
      left join public.rheomiq_financial_provider_assets la on la.asset_key=p.logo_asset_key
      left join public.rheomiq_financial_provider_assets wa on wa.asset_key=p.wordmark_asset_key
      where p.active and (
        (p.logo_asset_key is not null and coalesce(la.active,false)=false)
        or (p.wordmark_asset_key is not null and coalesce(wa.active,false)=false)
      )
    ),
    'active_assets_missing_storage_object',(
      select count(*)
      from public.rheomiq_financial_provider_assets a
      left join storage.objects o on o.bucket_id=a.storage_bucket and o.name=a.storage_path
      where a.active and o.id is null
    )
  ) into v_checks;

  v_warnings := jsonb_build_object(
    'providers_missing_logo',(select count(*) from public.rheomiq_financial_providers where active and logo_asset_key is null),
    'providers_missing_wordmark',(select count(*) from public.rheomiq_financial_providers where active and wordmark_asset_key is null),
    'inactive_legacy_asset_rows',(select count(*) from public.rheomiq_financial_provider_assets where not active)
  );

  v_ok :=
    coalesce((v_checks->>'app_state_rows')::int,0)=1
    and coalesce((v_checks->>'owner_rows')::int,0)=1
    and coalesce((v_checks->>'history_cursor_rows')::int,0)=1
    and coalesce((v_checks->>'history_revision_mismatches')::int,0)=0
    and coalesce((v_checks->>'history_current_point_missing')::int,0)=0
    and coalesce((v_checks->>'history_current_point_state_mismatches')::int,0)=0
    and coalesce((v_checks->>'raw_state_ledger_keys')::int,0)=0
    and coalesce((v_checks->>'duplicate_event_ids')::int,0)=0
    and coalesce((v_checks->>'duplicate_card_ids')::int,0)=0
    and coalesce((v_checks->>'duplicate_statement_ids')::int,0)=0
    and coalesce((v_checks->>'events_missing_id')::int,0)=0
    and coalesce((v_checks->>'events_missing_date')::int,0)=0
    and coalesce((v_checks->>'events_nonpositive_amount')::int,0)=0
    and coalesce((v_checks->>'events_without_legs')::int,0)=0
    and coalesce((v_checks->>'invalid_writeoff_legs')::int,0)=0
    and coalesce((v_checks->>'unbalanced_internal_events')::int,0)=0
    and coalesce((v_checks->>'unknown_leg_accounts')::int,0)=0
    and coalesce((v_checks->>'orphan_card_event_refs')::int,0)=0
    and coalesce((v_checks->>'orphan_statement_event_refs')::int,0)=0
    and coalesce((v_checks->>'stale_account_metadata')::int,0)=0
    and coalesce((v_checks->>'provider_invalid_active_refs')::int,0)=0
    and coalesce((v_checks->>'active_assets_missing_storage_object')::int,0)=0;

  v_ready := v_ok
    and coalesce((v_warnings->>'providers_missing_logo')::int,0)=0
    and coalesce((v_warnings->>'providers_missing_wordmark')::int,0)=0;

  return jsonb_build_object(
    'ok',v_ok,
    'productionReady',v_ready,
    'storageMode','relational_v1',
    'revision',v_revision,
    'checks',v_checks,
    'warnings',v_warnings,
    'checkedAt',now()
  );
end;
$$;

comment on function public.rheomiq_database_health() is
  'Privacy-safe owner/AAL2 relational integrity counts; noncash lending writeoffs have empty account legs, all other kinds require them.';
commit;
