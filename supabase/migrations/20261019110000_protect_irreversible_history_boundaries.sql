-- Owner decision 2026-10-19: import and final card-secret deletion are
-- non-Undoable. This additive security migration keeps every finance history
-- state point, ledger revision, encrypted vault record and backup intact.
-- NEVER apply directly to Production without the normal migration/release gates.

-- Historical import snapshots are labelled by a server-owned fixed string.
-- A durable column marks subsequent import inserts; the helper also recognizes
-- older same-label points without rewriting existing history.
alter table public.rheomiq_history_points
  add column if not exists is_import_boundary boolean not null default false;

create or replace function private.rheomiq_mark_import_history_boundary()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if new.label='Εισαγωγή δεδομένων' then
    new.is_import_boundary:=true;
  end if;
  return new;
end;
$$;

drop trigger if exists rheomiq_mark_import_history_boundary on public.rheomiq_history_points;
create trigger rheomiq_mark_import_history_boundary
before insert on public.rheomiq_history_points
for each row execute function private.rheomiq_mark_import_history_boundary();

revoke all on function private.rheomiq_mark_import_history_boundary() from public,anon,authenticated;

-- Store only irreversible deletion IDs, never PAN, expiry, CVV, encrypted
-- payloads or finance snapshots. No UPDATE/DELETE privilege: no secret retention.
create table if not exists private.rheomiq_final_card_secret_deletions(
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null check(card_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'),
  completed_at timestamptz not null default now(),
  primary key(owner_user_id,card_id)
);
alter table private.rheomiq_final_card_secret_deletions enable row level security;
revoke all on private.rheomiq_final_card_secret_deletions from public,anon,authenticated;
grant select,insert on private.rheomiq_final_card_secret_deletions to authenticated,service_role;

drop policy if exists rheomiq_final_card_secret_deletions_read on private.rheomiq_final_card_secret_deletions;
create policy rheomiq_final_card_secret_deletions_read
on private.rheomiq_final_card_secret_deletions for select to authenticated
using(owner_user_id=auth.uid() and (select public.rheomiq_is_owner_aal2()));

drop policy if exists rheomiq_final_card_secret_deletions_insert on private.rheomiq_final_card_secret_deletions;
create policy rheomiq_final_card_secret_deletions_insert
on private.rheomiq_final_card_secret_deletions for insert to authenticated
with check(owner_user_id=auth.uid() and (select public.rheomiq_is_owner_aal2()));

-- One shared authoritative predicate serves both the read-only UI availability
-- counts and the locked move_history RPC. ID-only tombstones cover all new
-- finalized deletes. For legacy deletions with no tombstone, reject a missing
-- encrypted secret only when the historical card actually had a vaultRef.
-- Metadata-only cards without vault secrets remain ordinarily reversible.
create or replace function private.rheomiq_history_move_blocked(
  p_owner uuid,p_current_id bigint,p_target_id bigint,p_direction text
)
returns boolean
language sql
stable
security invoker
set search_path=''
as $$
  select
    exists (
      select 1 from public.rheomiq_history_points point
      where point.owner_user_id=p_owner and point.id=p_current_id
        and p_direction='undo'
        and (point.is_import_boundary or point.label='Εισαγωγή δεδομένων')
    )
    or exists (
      select 1 from public.rheomiq_history_points point
      where point.owner_user_id=p_owner and point.id=p_target_id
        and p_direction='redo'
        and (point.is_import_boundary or point.label='Εισαγωγή δεδομένων')
    )
    or exists (
      select 1
      from public.rheomiq_history_points target
      cross join lateral jsonb_array_elements(coalesce(target.state->'cards','[]'::jsonb)) as old_card(card)
      where target.owner_user_id=p_owner and target.id=p_target_id
        and (
          exists(
            select 1 from private.rheomiq_final_card_secret_deletions tombstone
            where tombstone.owner_user_id=p_owner and tombstone.card_id=old_card.card->>'id'
          )
          or (
            nullif(old_card.card->>'vaultRef','') is not null
            and not exists(
              select 1 from private.rheomiq_cards active_card
              where active_card.owner_user_id=p_owner
                and active_card.card_id=old_card.card->>'id'
                and not active_card.is_deleted
            )
            and not exists(
              select 1 from public.rheomiq_card_secrets vault
              where vault.owner_user_id=p_owner and vault.card_id=old_card.card->>'id'
            )
          )
        )
    );
$$;

revoke all on function private.rheomiq_history_move_blocked(uuid,bigint,bigint,text) from public,anon;
grant execute on function private.rheomiq_history_move_blocked(uuid,bigint,bigint,text) to authenticated,service_role;

-- Lock the canonical finance row, confirm durable profile deletion and remove
-- ciphertext and save tombstone atomically. Archived cards are still active
-- metadata in relational storage and CANNOT pass the original deletion guard.
create or replace function public.rheomiq_delete_committed_card_secret(p_card_id text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_state jsonb;
begin
  if v_owner is null or not public.rheomiq_is_owner_aal2() then
    raise exception using errcode='42501',message='MFA_REQUIRED';
  end if;
  if p_card_id is null or p_card_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$' then
    raise exception using errcode='22023',message='INVALID_CARD_ID';
  end if;

  select s.data->'state' into v_state
    from public.rheomiq_app_state s
    where s.id='primary'
    for update;

  if not found
    or jsonb_typeof(v_state->'pendingCardSecretDeletes') is distinct from 'array'
    or not ((v_state->'pendingCardSecretDeletes') ? p_card_id)
    or exists (
      select 1 from private.rheomiq_cards c
      where c.owner_user_id=v_owner and c.card_id=p_card_id and not c.is_deleted
    )
  then
    raise exception using errcode='P0001',message='CARD_SECRET_DELETE_NOT_COMMITTED';
  end if;

  delete from public.rheomiq_card_secrets
    where owner_user_id=v_owner and card_id=p_card_id;

  -- Same canonical finance-row lock and database transaction as the ciphertext
  -- DELETE. The permanent ID-only tombstone survives history pruning and
  -- prevents historical metadata from recreating a dead vault reference.
  insert into private.rheomiq_final_card_secret_deletions(owner_user_id,card_id)
  values(v_owner,p_card_id)
  on conflict (owner_user_id,card_id) do nothing;
  return true;
end;
$$;

-- Prevent any direct authenticated RPC caller from crossing an irreversible
-- boundary; return stable public 409 without advancing revision or audit.
create or replace function public.rheomiq_move_history(
  p_direction text,
  p_expected_revision bigint,
  p_expected_history_generation bigint,
  p_updated_at text
)
returns table(data jsonb, revision bigint, updated_at timestamptz, history jsonb)
language plpgsql
security invoker
set search_path = public, auth, private
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
  if p_direction not in ('undo','redo') then raise exception using errcode='22023',message='INVALID_HISTORY_DIRECTION'; end if;
  if p_expected_revision is null or p_expected_revision<0 then raise exception using errcode='22023',message='EXPECTED_REVISION_REQUIRED'; end if;
  if p_expected_history_generation is null or p_expected_history_generation<0 then raise exception using errcode='22023',message='EXPECTED_HISTORY_GENERATION_REQUIRED'; end if;
  if p_updated_at is null or length(p_updated_at)<1 or length(p_updated_at)>64 then raise exception using errcode='22023',message='INVALID_DATA'; end if;

  select * into v_current from public.rheomiq_app_state where id='primary' for update;
  if not found then raise exception using errcode='P0002',message='NO_STATE'; end if;
  if p_expected_revision<>v_current.revision then raise exception using errcode='40001',message='REVISION_CONFLICT'; end if;

  perform public.rheomiq_history_ensure_cursor();
  select * into v_cursor from public.rheomiq_history_cursor where owner_user_id=v_owner for update;
  if p_expected_history_generation<>v_cursor.generation or v_cursor.finance_revision<>v_current.revision then
    raise exception using errcode='40001',message='HISTORY_CURSOR_CONFLICT';
  end if;

  perform public.rheomiq_prune_history(v_owner);

  if p_direction='undo' then
    select target.* into v_target
    from public.rheomiq_history_points current_point
    join public.rheomiq_history_points target
      on target.owner_user_id=current_point.owner_user_id and target.id=current_point.parent_point_id
    where current_point.owner_user_id=v_owner
      and current_point.id=v_cursor.current_point_id
      and target.expires_at>now();
  else
    select * into v_target
    from public.rheomiq_history_points
    where owner_user_id=v_owner
      and parent_point_id=v_cursor.current_point_id
      and expires_at>now()
    order by id asc
    limit 1;
  end if;

  if v_target.id is null then raise exception using errcode='22023',message='HISTORY_UNAVAILABLE'; end if;

  -- Trusted snapshot cursor cannot cross an import boundary or revive a card
  -- whose vault ciphertext was permanently destroyed.
  if private.rheomiq_history_move_blocked(v_owner,v_cursor.current_point_id,v_target.id,p_direction) then
    raise exception using errcode='P0001',message='HISTORY_IRREVERSIBLE_BOUNDARY';
  end if;

  perform private.rheomiq_ledger_apply_state(v_owner,v_target.state);

  v_result_revision := v_current.revision+1;
  v_next_data := jsonb_set(v_current.data,'{state}',private.rheomiq_ledger_strip_state(v_target.state),true);
  v_next_data := jsonb_set(v_next_data,'{updatedAt}',to_jsonb(p_updated_at),true);

  update public.rheomiq_app_state
  set data=v_next_data,finance_storage_mode='relational_v1',revision=v_result_revision,updated_at=now()
  where id='primary';

  update public.rheomiq_history_cursor
  set current_point_id=v_target.id,generation=generation+1,finance_revision=v_result_revision,updated_at=now()
  where owner_user_id=v_owner;

  insert into public.rheomiq_audit_log(actor_user_id,action,revision)
  values(auth.uid(),p_direction,v_result_revision);

  perform public.rheomiq_prune_history(v_owner);

  return query
  select private.rheomiq_effective_data(v_owner,s.data),s.revision,s.updated_at,public.rheomiq_history_payload(v_owner)
  from public.rheomiq_app_state s where s.id='primary';
end;
$$;

-- Client-facing Undo/Redo availability must stop at exactly the same barrier.
create or replace function public.rheomiq_history_payload(p_owner uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = 'public', 'auth'
as $$
declare
  v_cursor public.rheomiq_history_cursor%rowtype;
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

  -- Count only actually traversable history points. Historical imports
  -- remain visible but the cursor cannot move across their full-data boundary.
  with recursive ancestors as (
    select p.id,p.parent_point_id,0::integer as depth
    from public.rheomiq_history_points p
    where p.owner_user_id=p_owner and p.id=v_cursor.current_point_id
    union all
    select p.id,p.parent_point_id,a.depth+1
    from ancestors a
    join public.rheomiq_history_points p on p.owner_user_id=p_owner and p.id=a.parent_point_id
    where not private.rheomiq_history_move_blocked(p_owner,a.id,p.id,'undo')
  )
  select coalesce(max(depth),0)::integer into v_undo_depth from ancestors;

  with recursive future as (
    select p.id,0::integer as depth
    from public.rheomiq_history_points p
    where p.owner_user_id=p_owner and p.id=v_cursor.current_point_id
    union all
    select p.id,f.depth+1
    from future f
    join public.rheomiq_history_points p on p.owner_user_id=p_owner and p.parent_point_id=f.id
    where not private.rheomiq_history_move_blocked(p_owner,f.id,p.id,'redo')
  )
  select coalesce(max(depth),0)::integer into v_redo_depth from future;

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
    'canUndo', coalesce(v_undo_depth,0)>0,
    'canRedo', coalesce(v_redo_depth,0)>0,
    'undoDepth', coalesce(v_undo_depth, 0),
    'redoDepth', coalesce(v_redo_depth, 0),
    'points', v_points
  );
end;
$$;
