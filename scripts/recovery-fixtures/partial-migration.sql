-- Synthetic local-only partial migration state for the MyFinHub roll-forward rehearsal.
-- This probe deliberately stops before the final column, grants and RLS policy exist.
create table public.myfinhub_migration_recovery_probe (
  id text primary key,
  owner_user_id uuid not null,
  payload text not null
);

alter table public.myfinhub_migration_recovery_probe enable row level security;
revoke all on table public.myfinhub_migration_recovery_probe from public, anon, authenticated;

insert into public.myfinhub_migration_recovery_probe(id,owner_user_id,payload)
select 'sentinel',user_id,'preserve-me'
from public.rheomiq_owner
where singleton=true;
