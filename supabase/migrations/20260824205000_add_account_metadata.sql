create table if not exists public.rheomiq_account_metadata (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null,
  iban text null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (owner_user_id, account_id),
  constraint rheomiq_account_metadata_account_id_check check (account_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'),
  constraint rheomiq_account_metadata_iban_check check (iban is null or iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$')
);

alter table public.rheomiq_account_metadata enable row level security;

create policy rheomiq_account_metadata_owner_aal2_select
on public.rheomiq_account_metadata
for select
to authenticated
using (
  owner_user_id = (select auth.uid())
  and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
  and exists (
    select 1 from public.rheomiq_owner owner_row
    where owner_row.user_id = (select auth.uid())
  )
);

create policy rheomiq_account_metadata_owner_aal2_insert
on public.rheomiq_account_metadata
for insert
to authenticated
with check (
  owner_user_id = (select auth.uid())
  and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
  and exists (
    select 1 from public.rheomiq_owner owner_row
    where owner_row.user_id = (select auth.uid())
  )
);

create policy rheomiq_account_metadata_owner_aal2_update
on public.rheomiq_account_metadata
for update
to authenticated
using (
  owner_user_id = (select auth.uid())
  and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
  and exists (
    select 1 from public.rheomiq_owner owner_row
    where owner_row.user_id = (select auth.uid())
  )
)
with check (
  owner_user_id = (select auth.uid())
  and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
  and exists (
    select 1 from public.rheomiq_owner owner_row
    where owner_row.user_id = (select auth.uid())
  )
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
  if v_uid is null
     or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'
     or not exists (select 1 from public.rheomiq_owner where user_id = v_uid) then
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
    on conflict (owner_user_id, account_id) do nothing
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

revoke all on table public.rheomiq_account_metadata from anon;
grant select, insert, update on table public.rheomiq_account_metadata to authenticated;
revoke all on function public.rheomiq_upsert_account_metadata(text,text,bigint) from public;
grant execute on function public.rheomiq_upsert_account_metadata(text,text,bigint) to authenticated;
