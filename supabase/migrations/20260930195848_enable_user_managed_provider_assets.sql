-- Back-synced source for the production-applied user-managed provider asset migration.
-- Provider artwork is owner-managed application data. Source/provenance metadata is optional.
-- Storage location is the authoritative binary reference for active assets.

alter table public.rheomiq_financial_provider_assets
  alter column legacy_content drop not null,
  alter column sha256 drop not null,
  alter column width drop not null,
  alter column height drop not null,
  alter column source set default 'user-managed';

alter table public.rheomiq_financial_provider_assets
  drop constraint if exists rheomiq_financial_provider_assets_active_storage_verified,
  drop constraint if exists rheomiq_financial_provider_assets_file_name_key,
  drop constraint if exists rheomiq_financial_provider_assets_role;

alter table public.rheomiq_financial_provider_assets
  add constraint rheomiq_financial_provider_assets_role
    check (asset_role = any (array['logo'::text,'wordmark'::text,'card-mark'::text])),
  add constraint rheomiq_financial_provider_assets_active_storage_link
    check (
      not active or (
        legacy_content is null
        and storage_bucket = 'financial-provider-assets'
        and storage_path is not null
      )
    );

comment on table public.rheomiq_financial_provider_assets is
  'User-managed financial-provider image registry. Active binaries live in Supabase Storage; source/provenance metadata is optional.';
comment on column public.rheomiq_financial_provider_assets.source is
  'Optional origin label. User-managed assets do not require source URLs or verification metadata.';
comment on column public.rheomiq_financial_provider_assets.source_page_url is
  'Optional source/reference page.';
comment on column public.rheomiq_financial_provider_assets.source_download_url is
  'Optional original download URL. Not required for user-managed assets.';

with uploaded as (
  select
    name as storage_path,
    split_part(name,'/',2) as provider_id,
    regexp_replace(name,'^.*/','') as file_name,
    regexp_replace(regexp_replace(name,'^.*/',''),'\.[^.]+$','') as asset_key,
    metadata->>'mimetype' as mime_type,
    nullif(metadata->>'size','')::bigint as size_bytes
  from storage.objects
  where bucket_id='financial-provider-assets'
    and name ~ '^providers/(piraeus|alpha|national|eurobank|revolut|viva|payzy|paypal)/[A-Za-z0-9._-]+$'
), normalized as (
  select *,
    case
      when asset_key like '%-card-mark-%' then 'card-mark'
      when asset_key like '%-wordmark-%' then 'wordmark'
      else 'logo'
    end as asset_role,
    case
      when asset_key like '%-dark-stacked' then 'dark-stacked'
      when asset_key like '%-light-stacked' then 'light-stacked'
      when asset_key like '%-universal' then 'universal'
      when asset_key like '%-dark' then 'dark'
      when asset_key like '%-light' then 'light'
      when asset_key like '%-telekom-t' then 'telekom-t'
      else 'default'
    end as variant
  from uploaded
)
insert into public.rheomiq_financial_provider_assets
  (asset_key,provider_id,asset_role,variant,file_name,mime_type,legacy_content,sha256,width,height,
   source,active,storage_bucket,storage_path,size_bytes,source_page_url,source_download_url,verified_at,usage_note,updated_at)
select
  asset_key,provider_id,asset_role,variant,file_name,mime_type,null,null,null,null,
  'user-managed',true,'financial-provider-assets',storage_path,size_bytes,null,null,null,null,now()
from normalized
on conflict (asset_key) do update set
  provider_id=excluded.provider_id,
  asset_role=excluded.asset_role,
  variant=excluded.variant,
  file_name=excluded.file_name,
  mime_type=excluded.mime_type,
  legacy_content=null,
  sha256=null,
  width=null,
  height=null,
  source='user-managed',
  active=true,
  storage_bucket='financial-provider-assets',
  storage_path=excluded.storage_path,
  size_bytes=excluded.size_bytes,
  source_page_url=null,
  source_download_url=null,
  verified_at=null,
  usage_note=null,
  updated_at=now();

update public.rheomiq_financial_providers p
set
  logo_asset_key = case p.id
    when 'piraeus' then case when exists(select 1 from public.rheomiq_financial_provider_assets a where a.asset_key='piraeus-logo-universal') then 'piraeus-logo-universal' else p.logo_asset_key end
    when 'alpha' then case when exists(select 1 from public.rheomiq_financial_provider_assets a where a.asset_key='alpha-logo-universal') then 'alpha-logo-universal' else p.logo_asset_key end
    when 'national' then case when exists(select 1 from public.rheomiq_financial_provider_assets a where a.asset_key='national-logo-universal') then 'national-logo-universal' else p.logo_asset_key end
    when 'eurobank' then case when exists(select 1 from public.rheomiq_financial_provider_assets a where a.asset_key='eurobank-logo-universal') then 'eurobank-logo-universal' else p.logo_asset_key end
    when 'revolut' then case when exists(select 1 from public.rheomiq_financial_provider_assets a where a.asset_key='revolut-logo-light') then 'revolut-logo-light' else p.logo_asset_key end
    when 'viva' then case when exists(select 1 from public.rheomiq_financial_provider_assets a where a.asset_key='viva-logo-universal') then 'viva-logo-universal' else p.logo_asset_key end
    when 'payzy' then case when exists(select 1 from public.rheomiq_financial_provider_assets a where a.asset_key='magenta-pay-logo-universal') then 'magenta-pay-logo-universal' else p.logo_asset_key end
    when 'paypal' then case when exists(select 1 from public.rheomiq_financial_provider_assets a where a.asset_key='paypal-logo-universal') then 'paypal-logo-universal' else p.logo_asset_key end
    else p.logo_asset_key end,
  wordmark_asset_key = case p.id
    when 'piraeus' then case when exists(select 1 from public.rheomiq_financial_provider_assets a where a.asset_key='piraeus-wordmark-light') then 'piraeus-wordmark-light' else p.wordmark_asset_key end
    when 'alpha' then case when exists(select 1 from public.rheomiq_financial_provider_assets a where a.asset_key='alpha-wordmark-light') then 'alpha-wordmark-light' else p.wordmark_asset_key end
    when 'national' then case when exists(select 1 from public.rheomiq_financial_provider_assets a where a.asset_key='national-wordmark-light-stacked') then 'national-wordmark-light-stacked' else p.wordmark_asset_key end
    when 'eurobank' then case when exists(select 1 from public.rheomiq_financial_provider_assets a where a.asset_key='eurobank-wordmark-light') then 'eurobank-wordmark-light' else p.wordmark_asset_key end
    when 'revolut' then case when exists(select 1 from public.rheomiq_financial_provider_assets a where a.asset_key='revolut-wordmark-light') then 'revolut-wordmark-light' else p.wordmark_asset_key end
    when 'viva' then case when exists(select 1 from public.rheomiq_financial_provider_assets a where a.asset_key='viva-logo-universal') then 'viva-logo-universal' else p.wordmark_asset_key end
    when 'payzy' then case when exists(select 1 from public.rheomiq_financial_provider_assets a where a.asset_key='magenta-pay-logo-universal') then 'magenta-pay-logo-universal' else p.wordmark_asset_key end
    when 'paypal' then case when exists(select 1 from public.rheomiq_financial_provider_assets a where a.asset_key='paypal-wordmark-light') then 'paypal-wordmark-light' else p.wordmark_asset_key end
    else p.wordmark_asset_key end,
  updated_at=now()
where p.id in ('piraeus','alpha','national','eurobank','revolut','viva','payzy','paypal');
