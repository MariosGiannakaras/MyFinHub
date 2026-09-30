-- Align provider registry metadata with the owner-provided brand assets that
-- actually exist in the canonical asset registry. Missing roles remain generic;
-- the UI must never infer/fabricate verified branding from a provider name alone.
with desired(provider_id,logo_key,wordmark_key) as (
  values
    ('piraeus','piraeus-logo-green-on-yellow','piraeus-wordmark-green-on-white'),
    ('alpha','alpha-logo-white-on-blue','alpha-wordmark-color'),
    ('national',null,null),
    ('eurobank',null,null),
    ('revolut','revolut-logo-black-on-white','revolut-wordmark-black-on-white'),
    ('viva','viva-logo-navy-on-white',null),
    ('payzy','payzy-logo-color',null),
    ('paypal',null,null)
)
update public.rheomiq_financial_providers provider
set
  logo_asset_key=case
    when desired.logo_key is not null and exists(
      select 1 from public.rheomiq_financial_provider_assets asset
      where asset.asset_key=desired.logo_key
        and asset.provider_id=provider.id
        and asset.asset_role='logo'
        and asset.active
    ) then desired.logo_key
    else 'generic'
  end,
  wordmark_asset_key=case
    when desired.wordmark_key is not null and exists(
      select 1 from public.rheomiq_financial_provider_assets asset
      where asset.asset_key=desired.wordmark_key
        and asset.provider_id=provider.id
        and asset.asset_role='wordmark'
        and asset.active
    ) then desired.wordmark_key
    else 'generic'
  end,
  updated_at=now()
from desired
where provider.id=desired.provider_id;
