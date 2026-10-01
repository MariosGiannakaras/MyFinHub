create index if not exists rheomiq_financial_providers_logo_asset_idx
  on public.rheomiq_financial_providers(logo_asset_key)
  where logo_asset_key is not null;

create index if not exists rheomiq_financial_providers_wordmark_asset_idx
  on public.rheomiq_financial_providers(wordmark_asset_key)
  where wordmark_asset_key is not null;
