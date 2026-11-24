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
)
select jsonb_build_object(
  'entries',coalesce((select jsonb_agg(to_jsonb(i) order by i.bucket,i.name) from inventory i),'[]'::jsonb),
  'incompleteProviderPointers',(select count(*) from public.rheomiq_financial_provider_assets
    where (storage_bucket is null) <> (storage_path is null))
)::text;
commit;
