create table if not exists public.rheomiq_card_secrets (
  owner_user_id uuid not null,
  card_id text not null,
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  key_version integer not null default 1 check (key_version > 0),
  updated_at timestamptz not null default now(),
  primary key (owner_user_id, card_id),
  constraint rheomiq_card_secrets_card_id_len check (char_length(card_id) between 1 and 160),
  constraint rheomiq_card_secrets_ciphertext_len check (char_length(ciphertext) between 1 and 8192),
  constraint rheomiq_card_secrets_iv_len check (char_length(iv) between 1 and 256),
  constraint rheomiq_card_secrets_auth_tag_len check (char_length(auth_tag) between 1 and 256)
);

alter table public.rheomiq_card_secrets enable row level security;

revoke all on table public.rheomiq_card_secrets from public;
revoke all on table public.rheomiq_card_secrets from anon;
grant select, insert, update, delete on table public.rheomiq_card_secrets to authenticated;
grant select, insert, update, delete on table public.rheomiq_card_secrets to service_role;

drop policy if exists rheomiq_card_secrets_owner_aal2_select on public.rheomiq_card_secrets;
drop policy if exists rheomiq_card_secrets_owner_aal2_insert on public.rheomiq_card_secrets;
drop policy if exists rheomiq_card_secrets_owner_aal2_update on public.rheomiq_card_secrets;
drop policy if exists rheomiq_card_secrets_owner_aal2_delete on public.rheomiq_card_secrets;

create policy rheomiq_card_secrets_owner_aal2_select
on public.rheomiq_card_secrets
for select
to authenticated
using (
  owner_user_id = auth.uid()
  and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
  and exists (
    select 1
    from public.rheomiq_owner owner_row
    where owner_row.user_id = auth.uid()
  )
);

create policy rheomiq_card_secrets_owner_aal2_insert
on public.rheomiq_card_secrets
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
  and exists (
    select 1
    from public.rheomiq_owner owner_row
    where owner_row.user_id = auth.uid()
  )
);

create policy rheomiq_card_secrets_owner_aal2_update
on public.rheomiq_card_secrets
for update
to authenticated
using (
  owner_user_id = auth.uid()
  and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
  and exists (
    select 1
    from public.rheomiq_owner owner_row
    where owner_row.user_id = auth.uid()
  )
)
with check (
  owner_user_id = auth.uid()
  and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
  and exists (
    select 1
    from public.rheomiq_owner owner_row
    where owner_row.user_id = auth.uid()
  )
);

create policy rheomiq_card_secrets_owner_aal2_delete
on public.rheomiq_card_secrets
for delete
to authenticated
using (
  owner_user_id = auth.uid()
  and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
  and exists (
    select 1
    from public.rheomiq_owner owner_row
    where owner_row.user_id = auth.uid()
  )
);

comment on table public.rheomiq_card_secrets is 'Ciphertext-only payment-card secret storage. Encryption keys are held outside PostgreSQL; plaintext PAN/expiry/CVV must never be stored here.';
