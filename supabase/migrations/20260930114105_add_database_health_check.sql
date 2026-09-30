create or replace function public.rheomiq_database_health()
returns jsonb
language plpgsql
set search_path to 'public','auth'
as $function$
declare
  v_owner uuid;
  v_state jsonb;
  v_revision bigint;
  v_cursor_revision bigint;
  v_cursor_point bigint;
  v_point_revision bigint;
  v_bad_event_legs bigint;
  v_unbalanced_internal bigint;
  v_bad_card_refs bigint;
  v_bad_statement_refs bigint;
  v_duplicate_event_ids bigint;
  v_duplicate_card_ids bigint;
  v_duplicate_statement_ids bigint;
  v_orphan_account_metadata bigint;
  v_inactive_provider_asset_refs bigint;
  v_missing_storage_objects bigint;
  v_ok boolean;
begin
  v_owner := public.rheomiq_history_assert_access();

  select data->'state', revision
  into v_state, v_revision
  from public.rheomiq_app_state
  where id='primary';

  if v_state is null then
    return jsonb_build_object(
      'ok', false,
      'checkedAt', now(),
      'error', 'NO_STATE'
    );
  end if;

  select finance_revision, current_point_id
  into v_cursor_revision, v_cursor_point
  from public.rheomiq_history_cursor
  where owner_user_id=v_owner;

  select finance_revision
  into v_point_revision
  from public.rheomiq_history_points
  where owner_user_id=v_owner and id=v_cursor_point;

  with events as (
    select e
    from jsonb_array_elements(coalesce(v_state->'events','[]'::jsonb)) e
  )
  select count(*) into v_bad_event_legs
  from events
  where jsonb_typeof(e->'legs') <> 'array'
     or exists (
       select 1
       from jsonb_array_elements(coalesce(e->'legs','[]'::jsonb)) l
       where jsonb_typeof(l) <> 'object'
          or jsonb_typeof(l->'accountId') <> 'string'
          or nullif(btrim(l->>'accountId'),'') is null
          or jsonb_typeof(l->'amount') <> 'number'
     );

  with events as (
    select e
    from jsonb_array_elements(coalesce(v_state->'events','[]'::jsonb)) e
    where e->>'kind' in ('transfer','withdrawal','saving_cash_offset','card_payment')
  )
  select count(*) into v_unbalanced_internal
  from events
  where jsonb_array_length(coalesce(e->'legs','[]'::jsonb)) <> 2
     or abs(coalesce((
       select sum((l->>'amount')::numeric)
       from jsonb_array_elements(coalesce(e->'legs','[]'::jsonb)) l
     ),0)) > 0.0001;

  with cards as (
    select c->>'id' id
    from jsonb_array_elements(coalesce(v_state->'cards','[]'::jsonb)) c
  ), events as (
    select e
    from jsonb_array_elements(coalesce(v_state->'events','[]'::jsonb)) e
    where e->>'kind' in ('card_purchase','card_payment')
  )
  select count(*) into v_bad_card_refs
  from events e
  where nullif(e->>'cardId','') is null
     or not exists (select 1 from cards c where c.id=e->>'cardId');

  with statements as (
    select s->>'id' id, s->>'cardId' card_id
    from jsonb_array_elements(coalesce(v_state->'creditStatements','[]'::jsonb)) s
  ), cards as (
    select c->>'id' id
    from jsonb_array_elements(coalesce(v_state->'cards','[]'::jsonb)) c
  ), event_bad as (
    select count(*) n
    from jsonb_array_elements(coalesce(v_state->'events','[]'::jsonb)) e
    where nullif(e->>'statementId','') is not null
      and not exists (select 1 from statements s where s.id=e->>'statementId')
  ), statement_bad as (
    select count(*) n
    from statements s
    where nullif(s.card_id,'') is null
       or not exists (select 1 from cards c where c.id=s.card_id)
  )
  select (select n from event_bad)+(select n from statement_bad)
  into v_bad_statement_refs;

  with ids as (
    select e->>'id' id
    from jsonb_array_elements(coalesce(v_state->'events','[]'::jsonb)) e
  )
  select count(*) into v_duplicate_event_ids
  from (select id from ids group by id having count(*)>1) d;

  with ids as (
    select c->>'id' id
    from jsonb_array_elements(coalesce(v_state->'cards','[]'::jsonb)) c
  )
  select count(*) into v_duplicate_card_ids
  from (select id from ids group by id having count(*)>1) d;

  with ids as (
    select s->>'id' id
    from jsonb_array_elements(coalesce(v_state->'creditStatements','[]'::jsonb)) s
  )
  select count(*) into v_duplicate_statement_ids
  from (select id from ids group by id having count(*)>1) d;

  select count(*) into v_orphan_account_metadata
  from public.rheomiq_account_metadata m
  where m.owner_user_id=v_owner
    and not (coalesce(v_state->'settings'->'accountNames','{}'::jsonb) ? m.account_id);

  select count(*) into v_inactive_provider_asset_refs
  from public.rheomiq_financial_providers p
  where p.active
    and (
      (p.logo_asset_key is not null and not exists (
        select 1 from public.rheomiq_financial_provider_assets a
        where a.asset_key=p.logo_asset_key and a.active
      ))
      or
      (p.wordmark_asset_key is not null and not exists (
        select 1 from public.rheomiq_financial_provider_assets a
        where a.asset_key=p.wordmark_asset_key and a.active
      ))
    );

  select count(*) into v_missing_storage_objects
  from public.rheomiq_financial_provider_assets a
  where a.active
    and not exists (
      select 1
      from storage.objects o
      where o.bucket_id=a.storage_bucket
        and o.name=a.storage_path
    );

  v_ok :=
    v_revision is not null
    and v_cursor_revision = v_revision
    and v_point_revision = v_revision
    and v_bad_event_legs = 0
    and v_unbalanced_internal = 0
    and v_bad_card_refs = 0
    and v_bad_statement_refs = 0
    and v_duplicate_event_ids = 0
    and v_duplicate_card_ids = 0
    and v_duplicate_statement_ids = 0
    and v_orphan_account_metadata = 0
    and v_inactive_provider_asset_refs = 0
    and v_missing_storage_objects = 0;

  return jsonb_build_object(
    'ok', v_ok,
    'checkedAt', now(),
    'revision', v_revision,
    'history', jsonb_build_object(
      'cursorRevision', v_cursor_revision,
      'currentPointRevision', v_point_revision,
      'aligned', v_cursor_revision=v_revision and v_point_revision=v_revision
    ),
    'counts', jsonb_build_object(
      'badEventLegs', v_bad_event_legs,
      'unbalancedInternalEvents', v_unbalanced_internal,
      'badCardRefs', v_bad_card_refs,
      'badStatementRefs', v_bad_statement_refs,
      'duplicateEventIds', v_duplicate_event_ids,
      'duplicateCardIds', v_duplicate_card_ids,
      'duplicateStatementIds', v_duplicate_statement_ids,
      'orphanAccountMetadata', v_orphan_account_metadata,
      'inactiveProviderAssetRefs', v_inactive_provider_asset_refs,
      'missingStorageObjects', v_missing_storage_objects
    )
  );
end;
$function$;

revoke all on function public.rheomiq_database_health() from public, anon, authenticated;
grant execute on function public.rheomiq_database_health() to authenticated;

comment on function public.rheomiq_database_health() is
  'Owner+AAL2 diagnostic summary for MyFinHub finance/history/provider consistency. Returns counts only and does not expose private transaction content.';
