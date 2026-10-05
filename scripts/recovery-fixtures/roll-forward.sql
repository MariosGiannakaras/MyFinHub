-- Forward-only corrective SQL for the synthetic partial-state rehearsal.
-- It is intentionally idempotent so an operator can verify the final state before resuming.
alter table public.myfinhub_migration_recovery_probe
  add column if not exists recovery_status text;

update public.myfinhub_migration_recovery_probe
set recovery_status='ready'
where recovery_status is null;

alter table public.myfinhub_migration_recovery_probe
  alter column recovery_status set default 'ready',
  alter column recovery_status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname='myfinhub_migration_recovery_probe_status_check'
      and conrelid='public.myfinhub_migration_recovery_probe'::regclass
  ) then
    alter table public.myfinhub_migration_recovery_probe
      add constraint myfinhub_migration_recovery_probe_status_check
      check (recovery_status in ('ready'));
  end if;
end
$$;

revoke all on table public.myfinhub_migration_recovery_probe from public, anon, authenticated;
grant select on table public.myfinhub_migration_recovery_probe to authenticated, service_role;

drop policy if exists myfinhub_migration_recovery_probe_owner_select
on public.myfinhub_migration_recovery_probe;

create policy myfinhub_migration_recovery_probe_owner_select
on public.myfinhub_migration_recovery_probe
for select
to authenticated
using (
  owner_user_id=auth.uid()
  and (select public.rheomiq_is_owner_aal2())
);
