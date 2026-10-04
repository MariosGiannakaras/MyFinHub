alter table public.rheomiq_financial_providers
  alter column logo_asset_key drop not null,
  alter column wordmark_asset_key drop not null;

update public.rheomiq_financial_providers
set logo_asset_key = null,
    wordmark_asset_key = null,
    updated_at = now();

alter table public.rheomiq_financial_provider_assets
  rename column content to legacy_content;

alter table public.rheomiq_financial_provider_assets
  add column storage_bucket text,
  add column storage_path text,
  add column size_bytes bigint,
  add column source_page_url text,
  add column source_download_url text,
  add column verified_at timestamptz,
  add column usage_note text;

update public.rheomiq_financial_provider_assets
set active = false,
    updated_at = now();

alter table public.rheomiq_financial_provider_assets
  alter column source set default 'official-provider',
  alter column active set default false;

alter table public.rheomiq_financial_provider_assets
  add constraint rheomiq_financial_provider_assets_storage_bucket
    check (storage_bucket is null or storage_bucket = 'financial-provider-assets'),
  add constraint rheomiq_financial_provider_assets_storage_path
    check (
      storage_path is null or (
        char_length(storage_path) between 1 and 240
        and storage_path !~ '(^/|\.\.|\\|[?#])'
        and storage_path ~ '^providers/[a-z][a-z0-9-]{0,63}/[A-Za-z0-9._/-]+$'
      )
    ),
  add constraint rheomiq_financial_provider_assets_size_bytes
    check (size_bytes is null or size_bytes between 1 and 2097152),
  add constraint rheomiq_financial_provider_assets_source_page_https
    check (
      source_page_url is null or (
        char_length(source_page_url) between 8 and 2048
        and source_page_url ~ '^https://'
      )
    ),
  add constraint rheomiq_financial_provider_assets_source_download_https
    check (
      source_download_url is null or (
        char_length(source_download_url) between 8 and 2048
        and source_download_url ~ '^https://'
      )
    ),
  add constraint rheomiq_financial_provider_assets_usage_note_len
    check (usage_note is null or char_length(usage_note) <= 1000),
  add constraint rheomiq_financial_provider_assets_active_storage_verified
    check (
      not active or (
        source = 'official-provider'
        and legacy_content is null
        and storage_bucket = 'financial-provider-assets'
        and storage_path is not null
        and size_bytes is not null
        and source_page_url is not null
        and source_download_url is not null
        and verified_at is not null
      )
    );

create unique index rheomiq_financial_provider_assets_storage_location_idx
  on public.rheomiq_financial_provider_assets(storage_bucket, storage_path)
  where storage_path is not null;

alter table public.rheomiq_financial_providers
  add constraint rheomiq_financial_providers_logo_asset_fk
    foreign key (logo_asset_key)
    references public.rheomiq_financial_provider_assets(asset_key)
    on update cascade on delete set null,
  add constraint rheomiq_financial_providers_wordmark_asset_fk
    foreign key (wordmark_asset_key)
    references public.rheomiq_financial_provider_assets(asset_key)
    on update cascade on delete set null;

comment on table public.rheomiq_financial_provider_assets is
  'Financial-provider brand asset registry. Active binaries live only in Supabase Storage. legacy_content is retained only for inactive historical migration compatibility and must be NULL for active assets.';

comment on column public.rheomiq_financial_provider_assets.legacy_content is
  'Inactive legacy binary retained for migration rollback/history. Never authoritative and forbidden on active assets.';

comment on column public.rheomiq_financial_provider_assets.source_page_url is
  'Official provider page or official brand/media resource documenting the asset.';

comment on column public.rheomiq_financial_provider_assets.source_download_url is
  'Exact official-provider or official-provider-CDN URL used to obtain the binary.';

update storage.buckets
set public = true,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/png','image/jpeg','image/webp','image/svg+xml']::text[]
where id = 'financial-provider-assets';

drop policy if exists rheomiq_provider_storage_owner_aal2_read on storage.objects;
create policy rheomiq_provider_storage_owner_aal2_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'financial-provider-assets'
  and (select public.rheomiq_is_owner_aal2())
);
