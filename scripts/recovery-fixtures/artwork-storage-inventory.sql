-- Offline inspection of a consistent isolated PostgreSQL+Storage checkpoint.
-- Never run through a browser JWT: RLS-filtered rows can look like orphans.
-- No deletes, grants, schema changes, byte claims or cleanup authorization.
begin transaction isolation level repeatable read read only;
set local row_security = off;

with registry as (
  select storage_bucket as bucket, storage_path as name, active
  from public.rheomiq_financial_provider_assets
  where storage_bucket = 'financial-provider-assets' and storage_path is not null
  union all
  select storage_bucket as bucket, storage_path as name, active
  from public.rheomiq_recurring_service_assets
  where storage_bucket = 'recurring-service-assets' and storage_path is not null
),
registry_counts as (
  select bucket, name, count(*) as registry_count,
    count(*) filter (where active is true) as active_count
  from registry group by bucket, name
),
objects as (
  select bucket_id as bucket, name, count(*) as object_count
  from storage.objects
  where bucket_id in ('financial-provider-assets','recurring-service-assets')
  group by bucket_id, name
),
inventory as (
  select coalesce(o.bucket,r.bucket) as bucket, coalesce(o.name,r.name) as name,
    coalesce(o.object_count,0) as object_count,
    coalesce(r.registry_count,0) as registry_count,
    coalesce(r.active_count,0) as active_count,
    case
      when coalesce(o.object_count,0)>1 or coalesce(r.registry_count,0)>1 then 'ambiguous-identity'
      when r.registry_count is null then 'storage-only-unregistered'
      when o.object_count is null then 'registry-only-missing-object'
      when r.active_count=0 then 'registered-inactive'
      else 'registered-active'
    end as classification
  from objects o full outer join registry_counts r using (bucket,name)
),
-- Keep current relational and JSON surfaces separate from retained snapshots.
-- Extract only canonical logoAssetKey fields, never arbitrary notes or full data.
recurring_documents as (
  select 'current' as scope, data->'state' as state, data->'seed' as seed
  from public.rheomiq_app_state where id='primary'
  union all
  select 'history', state, null::jsonb from public.rheomiq_history_points
  union all
  select 'backup', data->'state', data->'seed' from public.rheomiq_backups
),
recurring_reference_keys as (
  select scope, value#>>'{}' as asset_key
  from recurring_documents
  cross join lateral (
    select jsonb_path_query(state,'$.recurringOverrides.*.logoAssetKey') as value
    union all
    select jsonb_path_query(state,'$.recurringCustom[*].logoAssetKey')
    union all
    select jsonb_path_query(seed,'$.recurring[*].logoAssetKey')
  ) refs
  where jsonb_typeof(value)='string'
  union all
  select 'current-relational', logo_asset_key
  from private.rheomiq_recurring where logo_asset_key is not null
),
recurring_reference_counts as (
  select asset_key,
    bool_or(scope='current' or scope='current-relational') as current_reference,
    bool_or(scope='history') as history_reference,
    bool_or(scope='backup') as backup_reference
  from recurring_reference_keys
  where asset_key ~ '^service-asset-[a-f0-9]{24}$'
  group by asset_key
),
recurring_reference_inventory as (
  select refs.*,
    (select count(*) from public.rheomiq_recurring_service_assets a
      where a.asset_key=refs.asset_key) as registry_count,
    (select count(*) from public.rheomiq_recurring_service_assets a
      where a.asset_key=refs.asset_key and a.active is true) as active_registry_count,
    (select count(*) from storage.objects o
      where o.bucket_id='recurring-service-assets'
        and o.name ~ ('^services/' || refs.asset_key || '[.](png|jpg|webp|svg)$')) as object_count
  from recurring_reference_counts refs
),
provider_reference_keys as (
  select asset_key from public.rheomiq_financial_provider_asset_bindings
  union
  select logo_asset_key from public.rheomiq_financial_providers where logo_asset_key is not null
  union
  select wordmark_asset_key from public.rheomiq_financial_providers where wordmark_asset_key is not null
),
provider_reference_inventory as (
  select k.asset_key,
    (select count(*) from public.rheomiq_financial_provider_assets a
      where a.asset_key=k.asset_key) as registry_count,
    (select count(*) from public.rheomiq_financial_provider_assets a
      where a.asset_key=k.asset_key and a.active is true) as active_registry_count,
    (select count(*) from public.rheomiq_financial_provider_assets a
      join storage.objects o on o.bucket_id=a.storage_bucket and o.name=a.storage_path
      where a.asset_key=k.asset_key) as registered_object_count
  from provider_reference_keys k
)
select jsonb_build_object(
  'entries',coalesce((select jsonb_agg(to_jsonb(i) order by i.bucket,i.name) from inventory i),'[]'::jsonb),
  'recurringReferences',coalesce((select jsonb_agg(to_jsonb(i) order by i.asset_key) from recurring_reference_inventory i),'[]'::jsonb),
  'providerReferences',coalesce((select jsonb_agg(to_jsonb(i) order by i.asset_key) from provider_reference_inventory i),'[]'::jsonb),
  'incompleteProviderPointers',(select count(*) from public.rheomiq_financial_provider_assets
    where (storage_bucket is null) <> (storage_path is null))
)::text;
commit;
