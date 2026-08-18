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
  and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
  and exists (
    select 1
    from public.rheomiq_owner owner_row
    where owner_row.user_id = (select auth.uid())
  )
);

create policy rheomiq_card_secrets_owner_aal2_insert
on public.rheomiq_card_secrets
for insert
to authenticated
with check (
  owner_user_id = (select auth.uid())
  and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
  and exists (
    select 1
    from public.rheomiq_owner owner_row
    where owner_row.user_id = (select auth.uid())
  )
);

create policy rheomiq_card_secrets_owner_aal2_update
on public.rheomiq_card_secrets
for update
to authenticated
using (
  owner_user_id = (select auth.uid())
  and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
  and exists (
    select 1
    from public.rheomiq_owner owner_row
    where owner_row.user_id = (select auth.uid())
  )
)
with check (
  owner_user_id = (select auth.uid())
  and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
  and exists (
    select 1
    from public.rheomiq_owner owner_row
    where owner_row.user_id = (select auth.uid())
  )
);

create policy rheomiq_card_secrets_owner_aal2_delete
on public.rheomiq_card_secrets
for delete
to authenticated
using (
  owner_user_id = (select auth.uid())
  and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
  and exists (
    select 1
    from public.rheomiq_owner owner_row
    where owner_row.user_id = (select auth.uid())
  )
);
