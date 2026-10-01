-- #481: owner-managed provider metadata, reusable artwork library and slot bindings.
-- All writes remain owner+AAL2 and use the authenticated user's JWT.

grant insert (id,display_name,short_name,provider_kind,country_code,sort_order,active)
  on public.rheomiq_financial_providers to authenticated;
grant update (display_name,short_name,provider_kind,country_code,sort_order,active,logo_asset_key,wordmark_asset_key,updated_at)
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

create table if not exists public.rheomiq_financial_provider_asset_bindings (
  provider_id text not null references public.rheomiq_financial_providers(id) on delete cascade,
  asset_role text not null check (asset_role in ('logo','wordmark','card-mark')),
  variant text not null check (variant in ('universal','light','dark')),
  asset_key text not null references public.rheomiq_financial_provider_assets(asset_key) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (provider_id,asset_role,variant)
);

alter table public.rheomiq_financial_provider_asset_bindings enable row level security;
revoke all on table public.rheomiq_financial_provider_asset_bindings from public,anon,authenticated;
grant select,insert,update,delete on public.rheomiq_financial_provider_asset_bindings to authenticated;
create index if not exists rheomiq_financial_provider_asset_bindings_asset_key_idx
  on public.rheomiq_financial_provider_asset_bindings(asset_key);

drop policy if exists rheomiq_financial_provider_asset_bindings_owner_aal2_select on public.rheomiq_financial_provider_asset_bindings;
create policy rheomiq_financial_provider_asset_bindings_owner_aal2_select
on public.rheomiq_financial_provider_asset_bindings
for select to authenticated
using ((select public.rheomiq_is_owner_aal2()));

drop policy if exists rheomiq_financial_provider_asset_bindings_owner_aal2_insert on public.rheomiq_financial_provider_asset_bindings;
create policy rheomiq_financial_provider_asset_bindings_owner_aal2_insert
on public.rheomiq_financial_provider_asset_bindings
for insert to authenticated
with check ((select public.rheomiq_is_owner_aal2()));

drop policy if exists rheomiq_financial_provider_asset_bindings_owner_aal2_update on public.rheomiq_financial_provider_asset_bindings;
create policy rheomiq_financial_provider_asset_bindings_owner_aal2_update
on public.rheomiq_financial_provider_asset_bindings
for update to authenticated
using ((select public.rheomiq_is_owner_aal2()))
with check ((select public.rheomiq_is_owner_aal2()));

drop policy if exists rheomiq_financial_provider_asset_bindings_owner_aal2_delete on public.rheomiq_financial_provider_asset_bindings;
create policy rheomiq_financial_provider_asset_bindings_owner_aal2_delete
on public.rheomiq_financial_provider_asset_bindings
for delete to authenticated
using ((select public.rheomiq_is_owner_aal2()));

-- Backfill semantic slots from the existing provider asset registry.
with mapped as (
  select
    a.provider_id,
    a.asset_role,
    case
      when a.variant='universal' then 'universal'
      when a.variant like 'light%' then 'light'
      when a.variant like 'dark%' then 'dark'
      else 'universal'
    end as slot_variant,
    a.asset_key,
    a.updated_at,
    case
      when a.variant in ('universal','light','dark') then 0
      else 1
    end as preference
  from public.rheomiq_financial_provider_assets a
  where a.active
), ranked as (
  select *,
    row_number() over (
      partition by provider_id,asset_role,slot_variant
      order by preference asc,updated_at desc,asset_key asc
    ) as rn
  from mapped
)
insert into public.rheomiq_financial_provider_asset_bindings(provider_id,asset_role,variant,asset_key)
select provider_id,asset_role,slot_variant,asset_key
from ranked
where rn=1
on conflict (provider_id,asset_role,variant) do nothing;

-- Preserve the current primary provider identity as the Default binding even when
-- the underlying legacy asset carried a light/dark-specific variant.
insert into public.rheomiq_financial_provider_asset_bindings(provider_id,asset_role,variant,asset_key)
select p.id,'logo','universal',p.logo_asset_key
from public.rheomiq_financial_providers p
join public.rheomiq_financial_provider_assets a
  on a.asset_key=p.logo_asset_key and a.provider_id=p.id and a.active
where p.logo_asset_key is not null
on conflict (provider_id,asset_role,variant)
do update set asset_key=excluded.asset_key,updated_at=now();

insert into public.rheomiq_financial_provider_asset_bindings(provider_id,asset_role,variant,asset_key)
select p.id,'wordmark','universal',p.wordmark_asset_key
from public.rheomiq_financial_providers p
join public.rheomiq_financial_provider_assets a
  on a.asset_key=p.wordmark_asset_key and a.provider_id=p.id and a.active
where p.wordmark_asset_key is not null
on conflict (provider_id,asset_role,variant)
do update set asset_key=excluded.asset_key,updated_at=now();

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

  return query select p.* from public.rheomiq_financial_providers p where p.id=p_id;
end;
$$;

revoke all on function public.rheomiq_create_financial_provider(text,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.rheomiq_create_financial_provider(text,text,text,text,text,integer) to authenticated;

create or replace function public.rheomiq_update_financial_provider(
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

  update public.rheomiq_financial_providers
  set display_name=btrim(p_display_name),
      short_name=btrim(p_short_name),
      provider_kind=p_provider_kind,
      country_code=nullif(upper(btrim(coalesce(p_country_code,''))),''),
      sort_order=p_sort_order,
      updated_at=now()
  where id=p_id and active;

  if not found then
    raise exception using errcode = '22023', message = 'INVALID_PROVIDER_ID';
  end if;

  return query select p.* from public.rheomiq_financial_providers p where p.id=p_id;
end;
$$;

revoke all on function public.rheomiq_update_financial_provider(text,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.rheomiq_update_financial_provider(text,text,text,text,text,integer) to authenticated;

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

revoke all on function public.rheomiq_register_financial_provider_asset(text,text,text,text,text,text,text,bigint,boolean) from public,anon,authenticated;
grant execute on function public.rheomiq_register_financial_provider_asset(text,text,text,text,text,text,text,bigint,boolean) to authenticated;

create or replace function public.rheomiq_set_financial_provider_asset_binding(
  p_provider_id text,
  p_asset_role text,
  p_variant text,
  p_asset_key text
)
returns void
language plpgsql
security invoker
set search_path=public,auth
as $$
begin
  if not public.rheomiq_is_owner_aal2() then
    raise exception using errcode = '42501', message = 'MFA_REQUIRED';
  end if;
  if p_asset_role not in ('logo','wordmark','card-mark') or p_variant not in ('universal','light','dark') then
    raise exception using errcode = '22023', message = 'INVALID_PROVIDER_ASSET_BINDING';
  end if;
  if not exists(select 1 from public.rheomiq_financial_providers p where p.id=p_provider_id and p.active) then
    raise exception using errcode = '22023', message = 'INVALID_PROVIDER_ID';
  end if;

  if p_asset_key is null then
    delete from public.rheomiq_financial_provider_asset_bindings
    where provider_id=p_provider_id and asset_role=p_asset_role and variant=p_variant;

    if p_variant='universal' and p_asset_role='logo' then
      update public.rheomiq_financial_providers set logo_asset_key=null,updated_at=now() where id=p_provider_id;
    elsif p_variant='universal' and p_asset_role='wordmark' then
      update public.rheomiq_financial_providers set wordmark_asset_key=null,updated_at=now() where id=p_provider_id;
    end if;
    return;
  end if;

  if not exists(
    select 1
    from public.rheomiq_financial_provider_assets a
    where a.asset_key=p_asset_key and a.provider_id=p_provider_id and a.active
  ) then
    raise exception using errcode = '22023', message = 'INVALID_PROVIDER_ASSET';
  end if;

  insert into public.rheomiq_financial_provider_asset_bindings(provider_id,asset_role,variant,asset_key,updated_at)
  values(p_provider_id,p_asset_role,p_variant,p_asset_key,now())
  on conflict (provider_id,asset_role,variant)
  do update set asset_key=excluded.asset_key,updated_at=now();

  if p_variant='universal' and p_asset_role='logo' then
    update public.rheomiq_financial_providers set logo_asset_key=p_asset_key,updated_at=now() where id=p_provider_id;
  elsif p_variant='universal' and p_asset_role='wordmark' then
    update public.rheomiq_financial_providers set wordmark_asset_key=p_asset_key,updated_at=now() where id=p_provider_id;
  end if;
end;
$$;

revoke all on function public.rheomiq_set_financial_provider_asset_binding(text,text,text,text) from public,anon,authenticated;
grant execute on function public.rheomiq_set_financial_provider_asset_binding(text,text,text,text) to authenticated;
