-- Back-synced source for the production-applied provider-brand alignment.
-- Production migration ledger already contains this version. This file restores Git
-- as the complete migration source for fresh/local environments.

update public.rheomiq_financial_providers
set
  logo_asset_key = case id
    when 'piraeus' then 'piraeus-logo-green-on-yellow'
    when 'alpha' then 'alpha-logo-white-on-blue'
    when 'national' then 'generic'
    when 'eurobank' then 'generic'
    when 'revolut' then 'revolut-logo-black-on-white'
    when 'viva' then 'viva-logo-navy-on-white'
    when 'payzy' then 'payzy-logo-color'
    when 'paypal' then 'generic'
    else logo_asset_key
  end,
  wordmark_asset_key = case id
    when 'piraeus' then 'piraeus-wordmark-green-on-white'
    when 'alpha' then 'alpha-wordmark-color'
    when 'national' then 'generic'
    when 'eurobank' then 'generic'
    when 'revolut' then 'revolut-wordmark-black-on-white'
    when 'viva' then 'generic'
    when 'payzy' then 'generic'
    when 'paypal' then 'generic'
    else wordmark_asset_key
  end,
  updated_at = now()
where id in ('piraeus','alpha','national','eurobank','revolut','viva','payzy','paypal');
