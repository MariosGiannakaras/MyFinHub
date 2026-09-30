-- #481: owner-managed financial-provider metadata and artwork mutations.
-- Reuses authenticated owner+AAL2 access and keeps all privileged secrets server-side.

grant insert (id,display_name,short_name,provider_kind,country_code,sort_order,active)
  on public.rheomiq_financial_providers to authenticated;
grant update (logo_asset_key,wordmark_asset_key,updated_at)
  on public.rheomiq_financial_providers to authenticated;

grant insert (asset_key,provider_id,asset_role,variant,file_name,mime_type,legacy_content,sha256,width,height,source,active,storage_bucket,storage_path,size_bytes,source_page_url,source_download_url,verified_at,usage_note,updated_at)
  on public.rheomiq_financial_provider_assets to authenticated;
grant update (asset_role,variant,file_name,mime_type,legacy_content,sha256,width,height,source,active,storage_bucket,storage_path,size_bytes,source_page_url,source_download_url,verified_at,usage_note,updated_at)
  on public.rheomiq_financial_provider_assets to authenticated;

drop policy if exists rheomiq_financial_providers_owner_aal2_insert on public.rheomiq_financial_providers;
create policy rheomiq_financial_providers_owner_aal2_insert
on public.rheomiq_financial_providers
for insert to authenticated
with check ((select public.rheomiq_is_owner_aal2()));

drop policy if exists rheomiq_financial_providers_owner_aal2_update on public.rheomiq_financial_providers;
create policy rheomiq_financial_providers_owner_aal2_update
on public.rheomiq_financial_providers
for update to authenticated
using ((select public.rheomiq_is_owner_aal2()))
with check ((select public.rheomiq_is_owner_aal2()));

drop policy if exists rheomiq_financial_provider_assets_owner_aal2_insert on public.rheomiq_financial_provider_assets;
create policy rheomiq_financial_provider_assets_owner_aal2_insert
on public.rheomiq_financial_provider_assets
for insert to authenticated
with check ((select public.rheomiq_is_owner_aal2()));

drop policy if exists rheomiq_financial_provider_assets_owner_aal2_update on public.rheomiq_financial_provider_assets;
create policy rheomiq_financial_provider_assets_owner_aal2_update
on public.rheomiq_financial_provider_assets
for update to authenticated
using ((select public.rheomiq_is_owner_aal2()))
with check ((select public.rheomiq_is_owner_aal2()));

drop policy if exists rheomiq_provider_storage_owner_aal2_insert on storage.objects;
create policy rheomiq_provider_storage_owner_aal2_insert
on storage.objects
for insert to authenticated
with check (
  bucket_id='financial-provider-assets'
  and name ~ '^providers/[a-z][a-z0-9-]{0,63}/[A-Za-z0-9._-]+$'
  and (select public.rheomiq_is_owner_aal2())
);

drop policy if exists rheomiq_provider_storage_owner_aal2_update on storage.objects;
create policy rheomiq_provider_storage_owner_aal2_update
on storage.objects
for update to authenticated
using (
  bucket_id='financial-provider-assets'
  and name ~ '^providers/[a-z][a-z0-9-]{0,63}/[A-Za-z0-9._-]+$'
  and (select public.rheomiq_is_owner_aal2())
)
with check (
  bucket_id='financial-provider-assets'
  and name ~ '^providers/[a-z][a-z0-9-]{0,63}/[A-Za-z0-9._-]+$'
  and (select public.rheomiq_is_owner_aal2())
);

drop policy if exists rheomiq_provider_storage_owner_aal2_delete on storage.objects;
create policy rheomiq_provider_storage_owner_aal2_delete
on storage.objects
for delete to authenticated
using (
  bucket_id='financial-provider-assets'
  and name ~ '^providers/[a-z][a-z0-9-]{0,63}/[A-Za-z0-9._-]+$'
  and (select public.rheomiq_is_owner_aal2())
);

create or replace function public.rheomiq_create_financial_provider(
  p_id text,
  p_display_name text,
  p_short_name text,
  p_provider_kind text,
  p_country_code text,
  p_sort_order integer
)
returns setof public.rheomiq_financial_providers
language plpgsql
security invoker
set search_path=public,auth
as $$
begin
  if not public.rheomiq_is_owner_aal2() then
    raise exception using errcode = '42501', message = 'MFA_REQUIRED';
  end if;

  if exists(select 1 from public.rheomiq_financial_providers p where p.id=p_id) then
    raise exception using errcode = '23505', message = 'PROVIDER_ID_CONFLICT';
  end if;

  insert into public.rheomiq_financial_providers
    (id,display_name,short_name,provider_kind,country_code,sort_order,active)
  values
    (p_id,btrim(p_display_name),btrim(p_short_name),p_provider_kind,nullif(upper(btrim(coalesce(p_country_code,''))),''),p_sort_order,true);

  return query
    select p.* from public.rheomiq_financial_providers p where p.id=p_id;
end;
$$;

revoke all on function public.rheomiq_create_financial_provider(text,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.rheomiq_create_financial_provider(text,text,text,text,text,integer) to authenticated;

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

  if not exists(select 1 from public.rheomiq_financial_providers p where p.id=p_provider_id and p.active) then
    raise exception using errcode = '22023', message = 'INVALID_PROVIDER_ID';
  end if;

  if exists(
    select 1
    from public.rheomiq_financial_provider_assets a
    where a.asset_key=p_asset_key and a.provider_id<>p_provider_id
  ) then
    raise exception using errcode = '23505', message = 'ASSET_KEY_CONFLICT';
  end if;

  if not exists(
    select 1
    from storage.objects o
    where o.bucket_id='financial-provider-assets' and o.name=p_storage_path
  ) then
    raise exception using errcode = '22023', message = 'PROVIDER_ASSET_MISSING_STORAGE_OBJECT';
  end if;

  update public.rheomiq_financial_provider_assets
  set active=false,updated_at=now()
  where provider_id=p_provider_id
    and asset_role=p_asset_role
    and variant=p_variant
    and asset_key<>p_asset_key
    and active;

  insert into public.rheomiq_financial_provider_assets
    (asset_key,provider_id,asset_role,variant,file_name,mime_type,legacy_content,sha256,width,height,source,active,
     storage_bucket,storage_path,size_bytes,source_page_url,source_download_url,verified_at,usage_note,updated_at)
  values
    (p_asset_key,p_provider_id,p_asset_role,p_variant,p_file_name,p_mime_type,null,null,null,null,'user-managed',true,
     'financial-provider-assets',p_storage_path,p_size_bytes,null,null,null,null,now())
  on conflict (asset_key) do update set
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

  if p_make_primary then
    if p_asset_role='logo' then
      update public.rheomiq_financial_providers
      set logo_asset_key=p_asset_key,updated_at=now()
      where id=p_provider_id;
    elsif p_asset_role='wordmark' then
      update public.rheomiq_financial_providers
      set wordmark_asset_key=p_asset_key,updated_at=now()
      where id=p_provider_id;
    end if;
  end if;

  return query
    select a.*
    from public.rheomiq_financial_provider_assets a
    where a.asset_key=p_asset_key;
end;
$$;

revoke all on function public.rheomiq_register_financial_provider_asset(text,text,text,text,text,text,text,bigint,boolean) from public,anon,authenticated;
grant execute on function public.rheomiq_register_financial_provider_asset(text,text,text,text,text,text,text,bigint,boolean) to authenticated;
