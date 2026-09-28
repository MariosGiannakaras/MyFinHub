create table if not exists public.rheomiq_financial_providers (
  id text primary key,
  display_name text not null,
  short_name text not null,
  provider_kind text not null,
  country_code text,
  logo_asset_key text not null,
  wordmark_asset_key text not null,
  sort_order integer not null default 1000,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rheomiq_financial_providers_id_format
    check (id ~ '^[a-z][a-z0-9-]{0,63}$'),
  constraint rheomiq_financial_providers_display_name_length
    check (char_length(display_name) between 1 and 120),
  constraint rheomiq_financial_providers_short_name_length
    check (char_length(short_name) between 1 and 80),
  constraint rheomiq_financial_providers_kind
    check (provider_kind in ('bank','fintech','wallet','payment')),
  constraint rheomiq_financial_providers_country_code
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint rheomiq_financial_providers_logo_asset_key
    check (logo_asset_key ~ '^[a-z][a-z0-9-]{0,63}$'),
  constraint rheomiq_financial_providers_wordmark_asset_key
    check (wordmark_asset_key ~ '^[a-z][a-z0-9-]{0,63}$')
);

comment on table public.rheomiq_financial_providers is
  'Read-only stable financial-provider identity registry shared by MyFinHub clients. Logo/wordmark columns are local asset keys, not remote executable content.';

alter table public.rheomiq_financial_providers enable row level security;

revoke all on table public.rheomiq_financial_providers from public, anon, authenticated;
grant select on table public.rheomiq_financial_providers to authenticated;

drop policy if exists rheomiq_financial_providers_authenticated_read on public.rheomiq_financial_providers;
create policy rheomiq_financial_providers_authenticated_read
on public.rheomiq_financial_providers
for select
to authenticated
using (true);

insert into public.rheomiq_financial_providers
  (id, display_name, short_name, provider_kind, country_code, logo_asset_key, wordmark_asset_key, sort_order, active)
values
  ('piraeus', 'Τράπεζα Πειραιώς', 'Πειραιώς', 'bank', 'GR', 'piraeus', 'piraeus', 10, true),
  ('alpha', 'Alpha Bank', 'Alpha', 'bank', 'GR', 'alpha', 'alpha', 20, true),
  ('national', 'Εθνική Τράπεζα', 'Εθνική', 'bank', 'GR', 'national', 'national', 30, true),
  ('eurobank', 'Eurobank', 'Eurobank', 'bank', 'GR', 'eurobank', 'eurobank', 40, true),
  ('revolut', 'Revolut', 'Revolut', 'fintech', 'LT', 'revolut', 'revolut', 50, true),
  ('viva', 'Viva.com', 'Viva', 'payment', 'GR', 'viva', 'viva', 60, true),
  ('payzy', 'payzy by COSMOTE', 'payzy', 'wallet', 'GR', 'payzy', 'payzy', 70, true),
  ('paypal', 'PayPal', 'PayPal', 'wallet', 'US', 'paypal', 'paypal', 80, true)
on conflict (id) do update set
  display_name = excluded.display_name,
  short_name = excluded.short_name,
  provider_kind = excluded.provider_kind,
  country_code = excluded.country_code,
  logo_asset_key = excluded.logo_asset_key,
  wordmark_asset_key = excluded.wordmark_asset_key,
  sort_order = excluded.sort_order,
  active = excluded.active,
  updated_at = now();
