-- #649 I19.04/I22.02. Bind the immutable image key and MIME extension
-- at PostgreSQL, including direct authenticated invoker RPC and table writes.
-- No destructive cleanup, privilege changes, history rewrite or application to production.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.rheomiq_recurring_service_assets'::regclass
      and conname='rheomiq_recurring_asset_exact_storage_path'
  ) then
    alter table public.rheomiq_recurring_service_assets
      add constraint rheomiq_recurring_asset_exact_storage_path
      check (
        storage_path = 'services/' || asset_key || '.' ||
          (case mime_type
            when 'image/png' then 'png'
            when 'image/jpeg' then 'jpg'
            when 'image/webp' then 'webp'
            when 'image/svg+xml' then 'svg'
            else ''
          end)
      ) not valid;
  end if;
end
$$;

-- An inconsistent legacy row blocks validation rather than being rewritten
-- or deleted. Fresh writes are checked even before VALIDATE completes.
alter table public.rheomiq_recurring_service_assets
  validate constraint rheomiq_recurring_asset_exact_storage_path;
