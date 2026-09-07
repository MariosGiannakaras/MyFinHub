update public.rheomiq_financial_providers
set
  logo_asset_key = case id
    when 'piraeus' then 'generic'
    when 'alpha' then 'generic'
    when 'national' then 'generic'
    when 'eurobank' then 'generic'
    when 'viva' then 'generic'
    when 'paypal' then 'generic'
    else logo_asset_key
  end,
  wordmark_asset_key = case id
    when 'piraeus' then 'generic'
    when 'alpha' then 'generic'
    when 'national' then 'generic'
    when 'eurobank' then 'generic'
    when 'viva' then 'viva'
    when 'paypal' then 'paypal'
    else wordmark_asset_key
  end,
  updated_at = now()
where id in ('piraeus','alpha','national','eurobank','viva','paypal');
