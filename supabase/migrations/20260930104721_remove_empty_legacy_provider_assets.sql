delete from public.rheomiq_financial_provider_assets
where active = false
  and legacy_content is not null
  and octet_length(legacy_content) = 0;
