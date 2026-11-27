-- #649 I19.04/I22.02: A directly authenticated owner+AAL2 PostgREST
-- write must not assign provider A's artwork to provider B's binding.
-- The invoker binding RPC already checks this, but the earlier table only
-- referenced asset_key, leaving direct INSERT/UPDATE able to bypass that rule.
-- This is a non-destructive invariant: never rewrite/delete old bindings.

-- asset_key is globally unique already. PostgreSQL needs an explicit unique
-- referenced key set to enforce the owner/provider relationship atomically.
create unique index if not exists rheomiq_provider_assets_provider_key_unique_idx
  on public.rheomiq_financial_provider_assets(provider_id,asset_key);

-- Fail closed if historical state violates the invariant. An operator must
-- investigate such state before deploying this migration; never silently
-- reassign provider ownership or change the current artwork.
do $$
begin
  if exists (
    select 1
    from public.rheomiq_financial_provider_asset_bindings b
    left join public.rheomiq_financial_provider_assets a
      on a.asset_key=b.asset_key
    where a.provider_id is distinct from b.provider_id
  ) then
    raise exception using errcode='23514',
      message='EXISTING_PROVIDER_BINDING_CROSS_PROVIDER';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.rheomiq_financial_provider_asset_bindings'::regclass
      and conname='rheomiq_provider_binding_same_provider_fk'
  ) then
    alter table public.rheomiq_financial_provider_asset_bindings
      add constraint rheomiq_provider_binding_same_provider_fk
      foreign key (provider_id,asset_key)
      references public.rheomiq_financial_provider_assets(provider_id,asset_key)
      on update restrict on delete restrict
      not valid;
  end if;
end
$$;

-- NOT VALID blocks new corrupt writes immediately; validation must also
-- prove the previously stored rows without destructive backfill.
alter table public.rheomiq_financial_provider_asset_bindings
  validate constraint rheomiq_provider_binding_same_provider_fk;
