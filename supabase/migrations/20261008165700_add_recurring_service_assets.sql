-- #519 DV-RB01/DV-RB02: owner-managed recurring/service branding assets.
-- Service artwork is intentionally separate from the financial-provider registry.
-- Finance state stores only a stable asset reference; image bytes live in Supabase Storage.

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'recurring-service-assets',
  'recurring-service-assets',
  true,
  2097152,
  array['image/png','image/jpeg','image/webp','image/svg+xml']::text[]
)
on conflict (id) do update
set public=excluded.public,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.rheomiq_recurring_service_assets (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  asset_key text not null,
  recurring_id text not null,
  file_name text not null,
  mime_type text not null check (mime_type in ('image/png','image/jpeg','image/webp','image/svg+xml')),
  storage_bucket text not null default 'recurring-service-assets'
    check (storage_bucket='recurring-service-assets'),
  storage_path text not null,
  size_bytes bigint not null check (size_bytes between 1 and 2097152),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (owner_user_id,asset_key),
  constraint rheomiq_recurring_service_assets_key_format
    check (asset_key ~ '^service-asset-[a-f0-9]{24}$'),
  constraint rheomiq_recurring_service_assets_recurring_id
    check (char_length(btrim(recurring_id)) between 1 and 200),
  constraint rheomiq_recurring_service_assets_storage_path
    check (storage_path ~ '^services/service-asset-[a-f0-9]{24}\.(png|jpg|webp|svg)$'),
  constraint rheomiq_recurring_service_assets_storage_unique
    unique (owner_user_id,storage_path)
);

alter table public.rheomiq_recurring_service_assets enable row level security;
revoke all on table public.rheomiq_recurring_service_assets from public,anon,authenticated;
grant select,insert,update,delete on table public.rheomiq_recurring_service_assets to authenticated,service_role;

drop policy if exists rheomiq_recurring_service_assets_owner_aal2_select on public.rheomiq_recurring_service_assets;
create policy rheomiq_recurring_service_assets_owner_aal2_select
on public.rheomiq_recurring_service_assets
for select to authenticated
using (owner_user_id=(select auth.uid()) and (select public.rheomiq_is_owner_aal2()));

drop policy if exists rheomiq_recurring_service_assets_owner_aal2_insert on public.rheomiq_recurring_service_assets;
create policy rheomiq_recurring_service_assets_owner_aal2_insert
on public.rheomiq_recurring_service_assets
for insert to authenticated
with check (owner_user_id=(select auth.uid()) and (select public.rheomiq_is_owner_aal2()));

drop policy if exists rheomiq_recurring_service_assets_owner_aal2_update on public.rheomiq_recurring_service_assets;
create policy rheomiq_recurring_service_assets_owner_aal2_update
on public.rheomiq_recurring_service_assets
for update to authenticated
using (owner_user_id=(select auth.uid()) and (select public.rheomiq_is_owner_aal2()))
with check (owner_user_id=(select auth.uid()) and (select public.rheomiq_is_owner_aal2()));

drop policy if exists rheomiq_recurring_service_assets_owner_aal2_delete on public.rheomiq_recurring_service_assets;
create policy rheomiq_recurring_service_assets_owner_aal2_delete
on public.rheomiq_recurring_service_assets
for delete to authenticated
using (owner_user_id=(select auth.uid()) and (select public.rheomiq_is_owner_aal2()));

drop policy if exists rheomiq_recurring_service_storage_owner_aal2_insert on storage.objects;
create policy rheomiq_recurring_service_storage_owner_aal2_insert
on storage.objects
for insert to authenticated
with check (
  bucket_id='recurring-service-assets'
  and name ~ '^services/service-asset-[a-f0-9]{24}\.(png|jpg|webp|svg)$'
  and (select public.rheomiq_is_owner_aal2())
);

drop policy if exists rheomiq_recurring_service_storage_owner_aal2_delete on storage.objects;
create policy rheomiq_recurring_service_storage_owner_aal2_delete
on storage.objects
for delete to authenticated
using (
  bucket_id='recurring-service-assets'
  and name ~ '^services/service-asset-[a-f0-9]{24}\.(png|jpg|webp|svg)$'
  and (select public.rheomiq_is_owner_aal2())
);

alter table private.rheomiq_recurring
  add column if not exists logo_asset_key text;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='rheomiq_recurring_logo_asset_key_format') then
    alter table private.rheomiq_recurring
      add constraint rheomiq_recurring_logo_asset_key_format
      check (logo_asset_key is null or logo_asset_key ~ '^service-asset-[a-f0-9]{24}$');
  end if;
  if not exists(select 1 from pg_constraint where conname='rheomiq_recurring_logo_asset_fk') then
    alter table private.rheomiq_recurring
      add constraint rheomiq_recurring_logo_asset_fk
      foreign key (owner_user_id,logo_asset_key)
      references public.rheomiq_recurring_service_assets(owner_user_id,asset_key)
      on update cascade on delete restrict;
  end if;
end
$$;

create index if not exists rheomiq_recurring_owner_logo_asset_idx
  on private.rheomiq_recurring(owner_user_id,logo_asset_key)
  where logo_asset_key is not null;

create or replace function private.rheomiq_sync_recurring_logo_asset()
returns trigger
language plpgsql
security invoker
set search_path=private,public
as $$
begin
  new.logo_asset_key:=nullif(btrim(coalesce(new.payload->>'logoAssetKey','')),'');
  if new.logo_asset_key is not null and not exists(
    select 1
    from public.rheomiq_recurring_service_assets a
    where a.owner_user_id=new.owner_user_id
      and a.asset_key=new.logo_asset_key
      and a.recurring_id=new.recurring_id
      and a.active
  ) then
    raise exception using errcode='22023', message='INVALID_RECURRING_SERVICE_ASSET';
  end if;
  return new;
end;
$$;

drop trigger if exists rheomiq_recurring_logo_asset_sync on private.rheomiq_recurring;
create trigger rheomiq_recurring_logo_asset_sync
before insert or update on private.rheomiq_recurring
for each row execute function private.rheomiq_sync_recurring_logo_asset();

create or replace function public.rheomiq_register_recurring_service_asset(
  p_recurring_id text,
  p_asset_key text,
  p_file_name text,
  p_mime_type text,
  p_storage_path text,
  p_size_bytes bigint
)
returns setof public.rheomiq_recurring_service_assets
language plpgsql
security invoker
set search_path=public,auth,storage
as $$
declare
  v_owner uuid:=auth.uid();
begin
  if not public.rheomiq_is_owner_aal2() then
    raise exception using errcode='42501', message='MFA_REQUIRED';
  end if;
  if v_owner is null
    or char_length(btrim(coalesce(p_recurring_id,''))) not between 1 and 200
    or p_recurring_id ~ '[[:cntrl:]]'
    or p_asset_key !~ '^service-asset-[a-f0-9]{24}$'
    or char_length(coalesce(p_file_name,'')) not between 1 and 160
    or p_file_name ~ '[[:cntrl:]]'
    or p_mime_type not in ('image/png','image/jpeg','image/webp','image/svg+xml')
    or p_storage_path !~ '^services/service-asset-[a-f0-9]{24}\.(png|jpg|webp|svg)$'
    or p_size_bytes not between 1 and 2097152 then
    raise exception using errcode='22023', message='INVALID_RECURRING_SERVICE_ASSET';
  end if;
  if exists(
    select 1 from public.rheomiq_recurring_service_assets a
    where a.owner_user_id=v_owner and a.asset_key=p_asset_key
  ) then
    raise exception using errcode='23505', message='RECURRING_SERVICE_ASSET_KEY_CONFLICT';
  end if;
  if not exists(
    select 1 from storage.objects o
    where o.bucket_id='recurring-service-assets' and o.name=p_storage_path
  ) then
    raise exception using errcode='22023', message='RECURRING_SERVICE_ASSET_MISSING_STORAGE_OBJECT';
  end if;

  insert into public.rheomiq_recurring_service_assets(
    owner_user_id,asset_key,recurring_id,file_name,mime_type,storage_bucket,storage_path,size_bytes,active,updated_at
  )
  values(
    v_owner,p_asset_key,p_recurring_id,p_file_name,p_mime_type,'recurring-service-assets',p_storage_path,p_size_bytes,true,now()
  );

  return query
  select a.*
  from public.rheomiq_recurring_service_assets a
  where a.owner_user_id=v_owner and a.asset_key=p_asset_key;
end;
$$;

revoke all on function public.rheomiq_register_recurring_service_asset(text,text,text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.rheomiq_register_recurring_service_asset(text,text,text,text,text,bigint) to authenticated;

create or replace function public.rheomiq_release_recurring_service_asset(p_asset_key text)
returns table(storage_bucket text,storage_path text)
language plpgsql
security invoker
set search_path=public,private,auth
as $$
declare
  v_owner uuid:=auth.uid();
  v_asset public.rheomiq_recurring_service_assets%rowtype;
begin
  if not public.rheomiq_is_owner_aal2() then
    raise exception using errcode='42501', message='MFA_REQUIRED';
  end if;

  select *
  into v_asset
  from public.rheomiq_recurring_service_assets a
  where a.owner_user_id=v_owner and a.asset_key=p_asset_key
  for update;

  if not found then
    raise exception using errcode='22023', message='INVALID_RECURRING_SERVICE_ASSET';
  end if;

  if exists(
    select 1 from private.rheomiq_recurring r
    where r.owner_user_id=v_owner and r.logo_asset_key=p_asset_key
  ) or exists(
    select 1
    from public.rheomiq_app_state s
    cross join lateral jsonb_each(coalesce(s.data#>'{state,recurringOverrides}','{}'::jsonb)) e
    where s.id='primary' and e.value->>'logoAssetKey'=p_asset_key
  ) or exists(
    select 1
    from public.rheomiq_app_state s
    cross join lateral jsonb_array_elements(coalesce(s.data#>'{state,recurringCustom}','[]'::jsonb)) e(value)
    where s.id='primary' and e.value->>'logoAssetKey'=p_asset_key
  ) or exists(
    select 1
    from public.rheomiq_app_state s
    cross join lateral jsonb_array_elements(coalesce(s.data#>'{seed,recurring}','[]'::jsonb)) e(value)
    where s.id='primary' and e.value->>'logoAssetKey'=p_asset_key
  ) then
    raise exception using errcode='23503', message='RECURRING_SERVICE_ASSET_IN_USE';
  end if;

  update public.rheomiq_recurring_service_assets
  set active=false,updated_at=now()
  where owner_user_id=v_owner and asset_key=p_asset_key;

  return query select v_asset.storage_bucket,v_asset.storage_path;
end;
$$;

revoke all on function public.rheomiq_release_recurring_service_asset(text) from public,anon,authenticated;
grant execute on function public.rheomiq_release_recurring_service_asset(text) to authenticated;

create or replace function public.rheomiq_purge_recurring_service_asset(p_asset_key text)
returns void
language plpgsql
security invoker
set search_path=public,auth
as $$
begin
  if not public.rheomiq_is_owner_aal2() then
    raise exception using errcode='42501', message='MFA_REQUIRED';
  end if;
  delete from public.rheomiq_recurring_service_assets
  where owner_user_id=auth.uid() and asset_key=p_asset_key and not active;
end;
$$;

revoke all on function public.rheomiq_purge_recurring_service_asset(text) from public,anon,authenticated;
grant execute on function public.rheomiq_purge_recurring_service_asset(text) to authenticated;
