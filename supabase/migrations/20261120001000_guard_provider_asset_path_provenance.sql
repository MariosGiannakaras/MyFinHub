-- #649 I19.04/I22.02: Direct provider asset writes must preserve immutable
-- provider/key/MIME Storage provenance without rewriting curated legacy artwork.
-- Owner+AAL2 RLS and SECURITY INVOKER remain unchanged.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.rheomiq_financial_provider_assets'::regclass
      and conname='rheomiq_provider_server_asset_exact_storage_path'
  ) then
    alter table public.rheomiq_financial_provider_assets
      add constraint rheomiq_provider_server_asset_exact_storage_path
      check (
        case when asset_key ~ '^[a-z][a-z0-9-]{0,63}-asset-[a-f0-9]{12}$'
          then
            asset_key ~ ('^' || provider_id || '-asset-[a-f0-9]{12}$')
            and coalesce(storage_bucket,'') = 'financial-provider-assets'
            and coalesce(storage_path,'') =
              'providers/' || provider_id || '/' || asset_key || '.' ||
              (case mime_type
                when 'image/png' then 'png'
                when 'image/jpeg' then 'jpg'
                when 'image/webp' then 'webp'
                when 'image/svg+xml' then 'svg'
                else ''
              end)
            and coalesce(mime_type,'') in ('image/png','image/jpeg','image/webp','image/svg+xml')
          else true
        end
      ) not valid;
  end if;
end
$$;

-- Do not auto-rewrite or delete inconsistent previously registered images:
-- validation fails closed, while the NOT VALID constraint protects new writes.
alter table public.rheomiq_financial_provider_assets
  validate constraint rheomiq_provider_server_asset_exact_storage_path;

-- Preserve the existing invoker signature, owner+AAL2 guard and grants.
create or replace function public.rheomiq_register_financial_provider_asset(
  p_provider_id text,
  p_asset_key text,
  p_asset_role text,
  p_variant text,
  p_file_name text,
  p_mime_type text,
  p_storage_path text,
  p_size_bytes bigint,
  p_make_primary boolean default false
)
returns setof public.rheomiq_financial_provider_assets
language plpgsql
security invoker
set search_path=public,auth,storage
as $$
begin
  if not public.rheomiq_is_owner_aal2() then
    raise exception using errcode = '42501', message = 'MFA_REQUIRED';
  end if;
  -- Direct owner/AAL2 PostgREST calls must not register someone else's
  -- Storage object or lie about the immutable key and MIME extension.
  -- Existing curated/legacy assets are not re-registered through this RPC.
  if coalesce(p_asset_key,'') !~ ('^' || coalesce(p_provider_id,'') || '-asset-[a-f0-9]{12}$')
     or coalesce(p_mime_type,'') not in ('image/png','image/jpeg','image/webp','image/svg+xml')
     or p_storage_path is distinct from (
       'providers/' || p_provider_id || '/' || p_asset_key || '.' ||
       (case p_mime_type
         when 'image/png' then 'png'
         when 'image/jpeg' then 'jpg'
         when 'image/webp' then 'webp'
         when 'image/svg+xml' then 'svg'
         else ''
       end)
     ) then
    raise exception using errcode = '22023', message = 'INVALID_PROVIDER_ASSET_PROVENANCE';
  end if;
  if not exists(select 1 from public.rheomiq_financial_providers p where p.id=p_provider_id and p.active) then
    raise exception using errcode = '22023', message = 'INVALID_PROVIDER_ID';
  end if;
  if exists(select 1 from public.rheomiq_financial_provider_assets a where a.asset_key=p_asset_key) then
    raise exception using errcode = '23505', message = 'ASSET_KEY_CONFLICT';
  end if;
  if not exists(
    select 1 from storage.objects o
    where o.bucket_id='financial-provider-assets' and o.name=p_storage_path
  ) then
    raise exception using errcode = '22023', message = 'PROVIDER_ASSET_MISSING_STORAGE_OBJECT';
  end if;

  insert into public.rheomiq_financial_provider_assets
    (asset_key,provider_id,asset_role,variant,file_name,mime_type,legacy_content,sha256,width,height,source,active,
     storage_bucket,storage_path,size_bytes,source_page_url,source_download_url,verified_at,usage_note,updated_at)
  values
    (p_asset_key,p_provider_id,p_asset_role,p_variant,p_file_name,p_mime_type,null,null,null,null,'user-managed',true,
     'financial-provider-assets',p_storage_path,p_size_bytes,null,null,null,null,now());

  if p_make_primary then
    if p_asset_role='logo' then
      update public.rheomiq_financial_providers set logo_asset_key=p_asset_key,updated_at=now() where id=p_provider_id;
    elsif p_asset_role='wordmark' then
      update public.rheomiq_financial_providers set wordmark_asset_key=p_asset_key,updated_at=now() where id=p_provider_id;
    end if;
  end if;

  return query select a.* from public.rheomiq_financial_provider_assets a where a.asset_key=p_asset_key;
end;
$$;

