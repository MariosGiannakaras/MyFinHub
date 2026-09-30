-- Close the remaining owner+AAL2-only RLS gaps after the active-device registry
-- became canonical. This migration changes authorization only; it does not mutate
-- finance state, card ciphertext, account metadata values, or history.

-- The active-session predicate must be callable from policies on the registry
-- itself without recursive RLS evaluation. It accepts no user input and exposes
-- only a boolean about the current JWT's own session, so SECURITY DEFINER is
-- intentionally narrow here.
create or replace function public.myfinhub_session_is_active()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.myfinhub_device_sessions session_row
    where session_row.session_id::text = coalesce(((select auth.jwt()) ->> 'session_id'), '')
      and session_row.user_id = (select auth.uid())
      and session_row.revoked_at is null
  );
$$;

revoke all on function public.myfinhub_session_is_active() from public, anon;
grant execute on function public.myfinhub_session_is_active() to authenticated, service_role;

-- A new AAL2 session must still be able to bootstrap its own registry row.
-- Reads/updates require the requesting session to already be active. UPDATE's
-- WITH CHECK intentionally omits the active predicate so the current session can
-- revoke itself; the immutable/revoked-at trigger still prevents unrevocation.
drop policy if exists myfinhub_device_sessions_owner_select on public.myfinhub_device_sessions;
drop policy if exists myfinhub_device_sessions_owner_insert on public.myfinhub_device_sessions;
drop policy if exists myfinhub_device_sessions_owner_update on public.myfinhub_device_sessions;

create policy myfinhub_device_sessions_owner_select
on public.myfinhub_device_sessions
for select
to authenticated
using (
  user_id = (select auth.uid())
  and (select public.rheomiq_is_owner())
  and (select public.rheomiq_has_aal2())
  and (select public.myfinhub_session_is_active())
);

create policy myfinhub_device_sessions_owner_insert
on public.myfinhub_device_sessions
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and session_id::text = coalesce(((select auth.jwt()) ->> 'session_id'), '')
  and revoked_at is null
  and (select public.rheomiq_is_owner())
  and (select public.rheomiq_has_aal2())
);

create policy myfinhub_device_sessions_owner_update
on public.myfinhub_device_sessions
for update
to authenticated
using (
  user_id = (select auth.uid())
  and (select public.rheomiq_is_owner())
  and (select public.rheomiq_has_aal2())
  and (select public.myfinhub_session_is_active())
)
with check (
  user_id = (select auth.uid())
  and (select public.rheomiq_is_owner())
  and (select public.rheomiq_has_aal2())
);

-- Card-vault access must follow the same owner + AAL2 + active-device boundary
-- as canonical finance state. The service role retains its table grant and RLS
-- bypass semantics for explicitly privileged server operations.
drop policy if exists rheomiq_card_secrets_owner_aal2_select on public.rheomiq_card_secrets;
drop policy if exists rheomiq_card_secrets_owner_aal2_insert on public.rheomiq_card_secrets;
drop policy if exists rheomiq_card_secrets_owner_aal2_update on public.rheomiq_card_secrets;
drop policy if exists rheomiq_card_secrets_owner_aal2_delete on public.rheomiq_card_secrets;

create policy rheomiq_card_secrets_owner_aal2_select
on public.rheomiq_card_secrets
for select
to authenticated
using (
  owner_user_id = (select auth.uid())
  and (select public.rheomiq_is_owner_aal2())
);

create policy rheomiq_card_secrets_owner_aal2_insert
on public.rheomiq_card_secrets
for insert
to authenticated
with check (
  owner_user_id = (select auth.uid())
  and (select public.rheomiq_is_owner_aal2())
);

create policy rheomiq_card_secrets_owner_aal2_update
on public.rheomiq_card_secrets
for update
to authenticated
using (
  owner_user_id = (select auth.uid())
  and (select public.rheomiq_is_owner_aal2())
)
with check (
  owner_user_id = (select auth.uid())
  and (select public.rheomiq_is_owner_aal2())
);

create policy rheomiq_card_secrets_owner_aal2_delete
on public.rheomiq_card_secrets
for delete
to authenticated
using (
  owner_user_id = (select auth.uid())
  and (select public.rheomiq_is_owner_aal2())
);

-- Account metadata and its optimistic-concurrency RPC are sensitive account
-- data and therefore use the same canonical active-device predicate.
drop policy if exists rheomiq_account_metadata_owner_aal2_select on public.rheomiq_account_metadata;
drop policy if exists rheomiq_account_metadata_owner_aal2_insert on public.rheomiq_account_metadata;
drop policy if exists rheomiq_account_metadata_owner_aal2_update on public.rheomiq_account_metadata;

create policy rheomiq_account_metadata_owner_aal2_select
on public.rheomiq_account_metadata
for select
to authenticated
using (
  owner_user_id = (select auth.uid())
  and (select public.rheomiq_is_owner_aal2())
);

create policy rheomiq_account_metadata_owner_aal2_insert
on public.rheomiq_account_metadata
for insert
to authenticated
with check (
  owner_user_id = (select auth.uid())
  and (select public.rheomiq_is_owner_aal2())
);

create policy rheomiq_account_metadata_owner_aal2_update
on public.rheomiq_account_metadata
for update
to authenticated
using (
  owner_user_id = (select auth.uid())
  and (select public.rheomiq_is_owner_aal2())
)
with check (
  owner_user_id = (select auth.uid())
  and (select public.rheomiq_is_owner_aal2())
);

create or replace function public.rheomiq_upsert_account_metadata(
  p_account_id text,
  p_iban text,
  p_expected_revision bigint
)
returns table(account_id text, iban text, revision bigint, updated_at timestamptz)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_revision bigint;
begin
  if v_uid is null or not (select public.rheomiq_is_owner_aal2()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_account_id is null or p_account_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$' then
    raise exception 'INVALID_ACCOUNT_ID' using errcode = '22023';
  end if;
  if p_iban is not null and p_iban !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' then
    raise exception 'INVALID_IBAN' using errcode = '22023';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'INVALID_EXPECTED_REVISION' using errcode = '22023';
  end if;

  if p_expected_revision = 0 then
    insert into public.rheomiq_account_metadata(owner_user_id, account_id, iban, revision, updated_at)
    values(v_uid, p_account_id, p_iban, 1, now())
    on conflict on constraint rheomiq_account_metadata_pkey do nothing
    returning rheomiq_account_metadata.revision into v_revision;
    if v_revision is null then
      raise exception 'REVISION_CONFLICT' using errcode = '40001';
    end if;
  else
    update public.rheomiq_account_metadata
    set iban = p_iban,
        revision = rheomiq_account_metadata.revision + 1,
        updated_at = now()
    where owner_user_id = v_uid
      and rheomiq_account_metadata.account_id = p_account_id
      and rheomiq_account_metadata.revision = p_expected_revision
    returning rheomiq_account_metadata.revision into v_revision;
    if v_revision is null then
      raise exception 'REVISION_CONFLICT' using errcode = '40001';
    end if;
  end if;

  return query
  select m.account_id, m.iban, m.revision, m.updated_at
  from public.rheomiq_account_metadata m
  where m.owner_user_id = v_uid and m.account_id = p_account_id;
end;
$$;

revoke all on function public.rheomiq_upsert_account_metadata(text, text, bigint)
from public, anon, authenticated;
grant execute on function public.rheomiq_upsert_account_metadata(text, text, bigint)
to authenticated;
