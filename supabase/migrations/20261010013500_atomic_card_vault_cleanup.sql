-- DV-FB04/06/07/08: atomic, recoverable card-vault cleanup.
-- Only the original owner with TOTP/AAL2 can erase a card's encrypted secret
-- after FinanceData has durably removed the card profile and recorded a pending
-- cleanup intent. Lock the canonical finance row to serialize with undo/redo,
-- restores and all revisioned finance saves. No secret plaintext is touched.
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
  return true;
end;
$$;

revoke all on function public.rheomiq_delete_committed_card_secret(text) from public,anon;
grant execute on function public.rheomiq_delete_committed_card_secret(text) to authenticated,service_role;
