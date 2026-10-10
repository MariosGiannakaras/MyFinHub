-- DV-FB08/09: older FinanceData writers must not erase a durable pending
-- card-secret deletion intent by omitting the additive state field.
-- Explicit completion is allowed only after the encrypted vault secret is
-- absent. History undo/import that restores an active card is also allowed.
-- All checks run inside the existing revisioned finance-write transaction.
create or replace function private.rheomiq_guard_pending_card_secret_cleanup_intent()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_card_id text;
  v_next_markers jsonb;
  v_owner uuid := auth.uid();
begin
  if old.id <> 'primary' or new.id <> 'primary' then return new; end if;
  if jsonb_typeof(old.data#>'{state,pendingCardSecretDeletes}') is distinct from 'array' then
    return new;
  end if;

  v_next_markers := new.data#>'{state,pendingCardSecretDeletes}';
  for v_card_id in
    select jsonb_array_elements_text(old.data#>'{state,pendingCardSecretDeletes}')
  loop
    if coalesce(v_next_markers ? v_card_id,false) then continue; end if;

    -- Undo/restore can legitimately cancel cleanup by restoring a card
    -- profile; its original encrypted secret must not be deleted.
    if exists (
      select 1 from private.rheomiq_cards c
      where c.owner_user_id=v_owner and c.card_id=v_card_id and not c.is_deleted
    ) then continue; end if;

    -- A modern client may explicitly clear the marker only after the vault
    -- RPC succeeded (and its local CVV cleanup completed). The database also
    -- verifies that ciphertext is absent; omission by an older writer is
    -- never treated as an explicit acknowledgement.
    if jsonb_typeof(v_next_markers)='array'
      and not exists (
        select 1 from public.rheomiq_card_secrets s
        where s.owner_user_id=v_owner and s.card_id=v_card_id
      )
    then continue; end if;

    raise exception using
      errcode='P0001',
      message='CARD_CLEANUP_INTENT_REQUIRED';
  end loop;
  return new;
end;
$$;

drop trigger if exists rheomiq_guard_pending_card_secret_cleanup_intent on public.rheomiq_app_state;
create trigger rheomiq_guard_pending_card_secret_cleanup_intent
before update of data on public.rheomiq_app_state
for each row
execute function private.rheomiq_guard_pending_card_secret_cleanup_intent();

revoke all on function private.rheomiq_guard_pending_card_secret_cleanup_intent()
  from public,anon,authenticated;
