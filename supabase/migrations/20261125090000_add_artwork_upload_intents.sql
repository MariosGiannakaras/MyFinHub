-- #649 I19.04: durable reservation identities for independent artwork writes.
-- Release-pending reservation, dispatch and registration fence. No existing
-- finance/history rows, Storage metadata, or Storage grants are changed.
-- A terminal disposition is journal evidence, never binary/finance success.

create table public.rheomiq_artwork_upload_intents (
  intent_id uuid primary key,
  owner_user_id uuid not null default auth.uid() references auth.users(id),
  kind text not null check (kind in ('provider','recurring')),
  target_id text not null,
  role text not null default '',
  variant text not null default '',
  make_primary boolean not null default false,
  asset_key text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 160 and file_name !~ '[[:cntrl:]]'),
  mime_type text not null check (mime_type in ('image/png','image/jpeg','image/webp','image/svg+xml')),
  size_bytes bigint not null check (size_bytes between 1 and 2097152),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  storage_path text generated always as (
    case kind when 'provider' then 'providers/' || target_id || '/' || asset_key
      else 'services/' || asset_key end ||
    case mime_type when 'image/png' then '.png' when 'image/jpeg' then '.jpg'
      when 'image/webp' then '.webp' when 'image/svg+xml' then '.svg' end
  ) stored,
  dispatch_claimed boolean not null default false,
  registration_recorded boolean not null default false,
  disposition text not null default 'pending' check (disposition in ('pending','acknowledged','abandoned','retired')),
  created_at timestamptz not null default clock_timestamp(),
  resolved_at timestamptz,
  constraint artwork_upload_intent_target check (
    (kind='provider' and target_id ~ '^[a-z][a-z0-9-]{0,63}$'
      and role in ('logo','wordmark','card-mark')
      and variant ~ '^[a-z][a-z0-9-]{0,63}$'
      and (not make_primary or role<>'card-mark')
      and asset_key ~ ('^' || target_id || '-asset-[a-f0-9]{12}$'))
    or
    (kind='recurring' and char_length(btrim(target_id)) between 1 and 200
      and target_id !~ '[[:cntrl:]]' and role='' and variant='' and not make_primary
      and asset_key ~ '^service-asset-[a-f0-9]{24}$')
  ),
  constraint artwork_upload_intent_resolution check (
    (disposition='pending' and resolved_at is null and (not registration_recorded or dispatch_claimed))
    or (disposition='acknowledged' and dispatch_claimed and registration_recorded and resolved_at is not null)
    or (disposition='abandoned' and not dispatch_claimed and not registration_recorded and resolved_at is not null)
    or (disposition='retired' and dispatch_claimed and not registration_recorded and resolved_at is not null)
  )
);

-- Atomic across concurrent connections/instances; unrelated targets are not
-- serialized. A resolved reservation keeps its identity forever, even when
-- its registry row is later purged. It never permits reusing an old key.
create unique index rheomiq_artwork_upload_one_pending_target
  on public.rheomiq_artwork_upload_intents(owner_user_id,kind,target_id,role,variant)
  where disposition='pending';

alter table public.rheomiq_artwork_upload_intents enable row level security;
revoke all on table public.rheomiq_artwork_upload_intents from public,anon,authenticated;
grant select on table public.rheomiq_artwork_upload_intents to authenticated;
-- The owner, timestamps, generated path and initial disposition are database
-- controlled. Monotonic dispatch/registration markers and terminal disposition
-- cannot be reset or combined. The registration marker only advances with
-- matching registry and Storage metadata inside the registration transaction.
grant insert (intent_id,kind,target_id,role,variant,make_primary,asset_key,file_name,mime_type,size_bytes,sha256)
  on public.rheomiq_artwork_upload_intents to authenticated;
grant update (disposition,dispatch_claimed,registration_recorded) on public.rheomiq_artwork_upload_intents to authenticated;

create policy artwork_upload_intents_owner_select on public.rheomiq_artwork_upload_intents
  for select to authenticated
  using (owner_user_id=(select auth.uid()) and (select public.rheomiq_is_owner_aal2()));
create policy artwork_upload_intents_owner_insert on public.rheomiq_artwork_upload_intents
  for insert to authenticated
  with check (owner_user_id=(select auth.uid()) and (select public.rheomiq_is_owner_aal2()));
create policy artwork_upload_intents_owner_update on public.rheomiq_artwork_upload_intents
  for update to authenticated
  using (owner_user_id=(select auth.uid()) and (select public.rheomiq_is_owner_aal2()))
  with check (owner_user_id=(select auth.uid()) and (select public.rheomiq_is_owner_aal2()));

-- Exact metadata proof for the monotonic registration marker and acknowledgement.
-- The API additionally checks actual bytes/hash. SECURITY INVOKER preserves RLS.
create function private.rheomiq_artwork_registration_metadata(p public.rheomiq_artwork_upload_intents)
returns boolean language sql volatile security invoker set search_path='' as $$
  select (
      ((p).kind='provider' and exists(
        select 1 from public.rheomiq_financial_provider_assets a
        where a.asset_key=(p).asset_key and a.provider_id=(p).target_id
          and a.asset_role=(p).role and a.variant=(p).variant and a.active
          and a.file_name=(p).file_name and a.mime_type=(p).mime_type
          and a.size_bytes=(p).size_bytes and a.storage_bucket='financial-provider-assets'
          and a.storage_path=(p).storage_path))
      or ((p).kind='recurring' and exists(
        select 1 from public.rheomiq_recurring_service_assets a
        where a.owner_user_id=(p).owner_user_id and a.asset_key=(p).asset_key
          and a.recurring_id=(p).target_id and a.active
          and a.file_name=(p).file_name and a.mime_type=(p).mime_type
          and a.size_bytes=(p).size_bytes and a.storage_bucket='recurring-service-assets'
          and a.storage_path=(p).storage_path))
    ) and exists(
      select 1 from storage.objects o
      where o.bucket_id=case (p).kind when 'provider' then 'financial-provider-assets' else 'recurring-service-assets' end
        and o.name=(p).storage_path
    );
$$;
revoke all on function private.rheomiq_artwork_registration_metadata(public.rheomiq_artwork_upload_intents) from public,anon,authenticated;
grant execute on function private.rheomiq_artwork_registration_metadata(public.rheomiq_artwork_upload_intents) to authenticated;

create function private.rheomiq_close_artwork_upload_intent()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if old.disposition<>'pending' then
    raise exception using errcode='23514',message='ARTWORK_UPLOAD_INTENT_TERMINAL';
  end if;
  -- Protect provenance even if a future grant unintentionally permits
  -- updates to other columns. Generated columns are not read in BEFORE.
  if row(new.intent_id,new.owner_user_id,new.kind,new.target_id,new.role,new.variant,
      new.make_primary,new.asset_key,new.file_name,new.mime_type,new.size_bytes,new.sha256,new.created_at)
    is distinct from
    row(old.intent_id,old.owner_user_id,old.kind,old.target_id,old.role,old.variant,
      old.make_primary,old.asset_key,old.file_name,old.mime_type,old.size_bytes,old.sha256,old.created_at) then
    raise exception using errcode='23514',message='ARTWORK_UPLOAD_INTENT_IMMUTABLE';
  end if;
  -- Claim and pre-dispatch abandonment race on the same row. Once claimed,
  -- a missing receipt, registry row or elapsed time cannot prove quiescence.
  if new.dispatch_claimed is distinct from old.dispatch_claimed then
    if old.dispatch_claimed or not new.dispatch_claimed or new.disposition<>'pending' or
      new.registration_recorded is distinct from old.registration_recorded then
      raise exception using errcode='23514',message='ARTWORK_UPLOAD_DISPATCH_INVALID';
    end if;
    return new;
  end if;
  if new.registration_recorded is distinct from old.registration_recorded then
    if old.registration_recorded or not new.registration_recorded or not old.dispatch_claimed or
      new.disposition<>'pending' or not private.rheomiq_artwork_registration_metadata(old) then
      raise exception using errcode='23514',message='ARTWORK_UPLOAD_REGISTRATION_INVALID';
    end if;
    return new;
  end if;
  if new.disposition='retired' then
    -- Retirement is a registration fence, NOT a claim that the external
    -- Storage request stopped. Late bytes remain identifiable by tombstone.
    if not old.dispatch_claimed or old.registration_recorded then
      raise exception using errcode='23514',message='ARTWORK_UPLOAD_RETIREMENT_FORBIDDEN';
    end if;
  elsif new.disposition='abandoned' then
    if old.dispatch_claimed then
      raise exception using errcode='23514',message='ARTWORK_UPLOAD_DISPATCH_UNRESOLVED';
    end if;
  elsif new.disposition='acknowledged' then
    -- DB-level minimum receipt: direct owner JWT updates cannot close a
    -- claimed reservation merely by asserting success. The API additionally
    -- verifies actual bytes/hash; metadata alone is not that proof.
    if not old.dispatch_claimed or not old.registration_recorded or not private.rheomiq_artwork_registration_metadata(old) then
      raise exception using errcode='23514',message='ARTWORK_UPLOAD_ACK_UNPROVEN';
    end if;
  else
    raise exception using errcode='23514',message='ARTWORK_UPLOAD_INTENT_TERMINAL';
  end if;
  new.resolved_at:=clock_timestamp();
  return new;
end;
$$;
revoke all on function private.rheomiq_close_artwork_upload_intent() from public,anon,authenticated;
create trigger rheomiq_artwork_upload_intent_close
before update on public.rheomiq_artwork_upload_intents
for each row execute function private.rheomiq_close_artwork_upload_intent();

-- A registration and retirement serialize on the SAME intent row. The marker
-- commits or rolls back with registry INSERT (and any subsequent RPC binding).
-- The permanent tombstone prevents late or replayed registration of a retired
-- key, even if Storage metadata or actual object bytes appear much later.
-- Old unjournaled keys keep their existing invoker/RLS contract.
create function private.rheomiq_record_artwork_registration()
returns trigger language plpgsql security invoker set search_path='' as $$
declare
  intent public.rheomiq_artwork_upload_intents%rowtype;
begin
  if current_user<>'authenticated' then return new; end if;
  select * into intent from public.rheomiq_artwork_upload_intents
    where asset_key=new.asset_key for update;
  if not found then return new; end if;
  if intent.disposition<>'pending' or not intent.dispatch_claimed or intent.registration_recorded or
    intent.owner_user_id is distinct from auth.uid() or
    (tg_table_name='rheomiq_financial_provider_assets' and intent.kind<>'provider') or
    (tg_table_name='rheomiq_recurring_service_assets' and intent.kind<>'recurring') then
    raise exception using errcode='23514',message='ARTWORK_UPLOAD_REGISTRATION_FENCED';
  end if;
  -- The marker's guarded UPDATE checks the exact newly inserted active row,
  -- including kind, target, slot, path and metadata. A failed receipt rolls
  -- back the entire registration transaction, never merely the marker.
  update public.rheomiq_artwork_upload_intents set registration_recorded=true
    where intent_id=intent.intent_id;
  return new;
end;
$$;
revoke all on function private.rheomiq_record_artwork_registration() from public,anon,authenticated;
create trigger rheomiq_provider_artwork_registration_fence
after insert on public.rheomiq_financial_provider_assets
for each row execute function private.rheomiq_record_artwork_registration();
create trigger rheomiq_recurring_artwork_registration_fence
after insert on public.rheomiq_recurring_service_assets
for each row execute function private.rheomiq_record_artwork_registration();
