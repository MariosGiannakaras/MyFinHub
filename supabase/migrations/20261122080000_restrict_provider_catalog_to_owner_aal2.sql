-- #649 I22.02: the legacy authenticated provider-catalog SELECT policies
-- exposed owner-edited provider names and asset metadata to unrelated
-- authenticated users, even though all mutations and slot bindings require
-- the active single-owner/AAL2 session. Close only that read-access gap.
--
-- Preserve existing SELECT grants for the legitimate owner, active-only
-- artwork filtering, provider data, keys and all write/Storage policies.
-- Forward-only, non-destructive; no data rewrite, bucket change or new role.

drop policy if exists rheomiq_financial_providers_authenticated_read
  on public.rheomiq_financial_providers;
drop policy if exists rheomiq_financial_providers_owner_aal2_select
  on public.rheomiq_financial_providers;
create policy rheomiq_financial_providers_owner_aal2_select
  on public.rheomiq_financial_providers
  for select to authenticated
  using ((select public.rheomiq_is_owner_aal2()));

drop policy if exists rheomiq_financial_provider_assets_authenticated_read
  on public.rheomiq_financial_provider_assets;
drop policy if exists rheomiq_financial_provider_assets_owner_aal2_select
  on public.rheomiq_financial_provider_assets;
create policy rheomiq_financial_provider_assets_owner_aal2_select
  on public.rheomiq_financial_provider_assets
  for select to authenticated
  using (active = true and (select public.rheomiq_is_owner_aal2()));
