-- #649 I18.04 — additive, optional revision-checked import path.
-- The legacy one-argument import RPC is preserved for existing native clients.
-- A checked browser import locks the current revision BEFORE invoking the
-- established transactional import (pre-import backup, ledger, history, audit).
-- The FOR UPDATE lock remains held through that call in the same SQL transaction.
create or replace function public.rheomiq_import_state_checked(
  p_data jsonb,
  p_expected_revision bigint
)
returns table(data jsonb, revision bigint, updated_at timestamptz)
language plpgsql
security invoker
set search_path = public, auth, private
as $$
declare
  v_actual_revision bigint;
begin
  perform public.rheomiq_history_assert_access();
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception using errcode='22023',message='EXPECTED_REVISION_REQUIRED';
  end if;

  select s.revision into v_actual_revision
  from public.rheomiq_app_state s
  where s.id='primary'
  for update of s;

  if not found then
    if p_expected_revision <> 0 then
      raise exception using errcode='40001',message='REVISION_CONFLICT';
    end if;
  elsif p_expected_revision <> v_actual_revision then
    raise exception using errcode='40001',message='REVISION_CONFLICT';
  end if;

  -- A backup or state/history/audit failure raises and rolls back this entire
  -- request. No independent import, double commit or read-then-write race.
  return query select imported.data,imported.revision,imported.updated_at
  from public.rheomiq_import_state(p_data) as imported;
end;
$$;

revoke all on function public.rheomiq_import_state_checked(jsonb,bigint) from public, anon;
grant execute on function public.rheomiq_import_state_checked(jsonb,bigint) to authenticated, service_role;
