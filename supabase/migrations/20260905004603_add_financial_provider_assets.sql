-- Back-synced schema source for the production-applied provider asset registry.
-- This migration version already exists in the production migration ledger; adding it here
-- restores Git as the complete schema source of truth without executing production DDL.

create table if not exists public.rheomiq_financial_provider_assets (
  asset_key text primary key,
  provider_id text not null references public.rheomiq_financial_providers(id) on update cascade on delete restrict,
  asset_role text not null,
  variant text not null default 'default',
  file_name text not null unique,
  mime_type text not null,
  content bytea not null,
  sha256 text not null,
  width integer not null,
  height integer not null,
  source text not null default 'owner-provided',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rheomiq_financial_provider_assets_key_format check (asset_key ~ '^[a-z][a-z0-9-]{0,95}$'),
  constraint rheomiq_financial_provider_assets_role check (asset_role in ('logo','wordmark')),
  constraint rheomiq_financial_provider_assets_variant_format check (variant ~ '^[a-z][a-z0-9-]{0,63}$'),
  constraint rheomiq_financial_provider_assets_mime check (mime_type in ('image/png','image/jpeg','image/webp','image/svg+xml')),
  constraint rheomiq_financial_provider_assets_sha256 check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint rheomiq_financial_provider_assets_dimensions check (width > 0 and height > 0)
);

comment on table public.rheomiq_financial_provider_assets is
  'Owner-provided canonical financial-provider logo and wordmark assets keyed by the existing provider identity registry.';

create index if not exists rheomiq_financial_provider_assets_provider_role_idx
  on public.rheomiq_financial_provider_assets (provider_id, asset_role, active);

alter table public.rheomiq_financial_provider_assets enable row level security;

revoke all on table public.rheomiq_financial_provider_assets from public, anon, authenticated;
grant select on table public.rheomiq_financial_provider_assets to authenticated;

drop policy if exists rheomiq_financial_provider_assets_authenticated_read on public.rheomiq_financial_provider_assets;
create policy rheomiq_financial_provider_assets_authenticated_read
on public.rheomiq_financial_provider_assets
for select
to authenticated
using (active = true);
