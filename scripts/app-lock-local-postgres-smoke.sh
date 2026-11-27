#!/usr/bin/env bash
# Only uses the ephemeral PostgreSQL installation on the existing CI runner.
# NEVER use any production or remote database for these security tests.
set -euo pipefail
if env | grep -Eq '^(SUPABASE_URL|DATABASE_URL|PGHOST)='; then
  echo "Refusing an environment configured for a remote database" >&2
  exit 1
fi
command -v psql >/dev/null || { echo "PostgreSQL missing" >&2; exit 1; }
sudo service postgresql start >/dev/null
sudo -u postgres psql --no-psqlrc -X -v ON_ERROR_STOP=1 -d postgres <<'SQL'
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
END $$;
CREATE SCHEMA auth;
CREATE SCHEMA private;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA auth,private,public,extensions TO authenticated;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
INSERT INTO auth.users VALUES ('11111111-1111-4111-8111-111111111111');
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE
 AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
 AS $$ SELECT nullif(auth.jwt()->>'sub','')::uuid $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated;
CREATE TABLE public.rheomiq_owner(user_id uuid PRIMARY KEY);
INSERT INTO public.rheomiq_owner VALUES ('11111111-1111-4111-8111-111111111111');
CREATE FUNCTION public.rheomiq_is_owner() RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
 AS $$ SELECT exists(select 1 from public.rheomiq_owner where user_id=(select auth.uid())) $$;
CREATE FUNCTION public.rheomiq_has_aal2() RETURNS boolean LANGUAGE sql STABLE
 AS $$ SELECT coalesce((select auth.jwt())->>'aal','')='aal2' $$;
CREATE TABLE public.myfinhub_device_sessions(
 session_id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),
 platform text NOT NULL DEFAULT 'web',device_label text NOT NULL DEFAULT 'Web',
 app_version text,first_seen_at timestamptz DEFAULT now(),
 last_seen_at timestamptz DEFAULT now(),revoked_at timestamptz
);
INSERT INTO public.myfinhub_device_sessions(session_id,user_id)
 VALUES('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111'),
 ('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111');
CREATE FUNCTION private.myfinhub_session_is_active() RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
 AS $$ SELECT exists(select 1 from public.myfinhub_device_sessions d
 WHERE d.user_id=(select auth.uid())
 AND d.session_id::text=coalesce((select auth.jwt())->>'session_id','')
 AND d.revoked_at IS NULL) $$;
CREATE FUNCTION public.rheomiq_is_owner_aal2() RETURNS boolean
 LANGUAGE sql STABLE SET search_path=public,auth,private
 AS $$ SELECT public.rheomiq_is_owner() AND public.rheomiq_has_aal2()
 AND private.myfinhub_session_is_active() $$;
CREATE TABLE public.rheomiq_app_state(id int PRIMARY KEY);
INSERT INTO public.rheomiq_app_state VALUES(1);
ALTER TABLE public.rheomiq_app_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_owner ON public.rheomiq_app_state TO authenticated
 USING ((select public.rheomiq_is_owner_aal2()));
GRANT SELECT ON public.rheomiq_app_state TO authenticated;

-- #649: model both historical broad-read provider tables with synthetic rows.
CREATE TABLE public.rheomiq_financial_providers(id text PRIMARY KEY,active boolean NOT NULL DEFAULT true);
INSERT INTO public.rheomiq_financial_providers VALUES ('qa-owner-provider',true);
CREATE TABLE public.rheomiq_financial_provider_assets(
 asset_key text PRIMARY KEY,active boolean NOT NULL DEFAULT true,provider_id text,asset_role text,variant text,
 file_name text,mime_type text,size_bytes bigint,storage_bucket text,storage_path text);
CREATE TABLE public.rheomiq_recurring_service_assets(
 owner_user_id uuid,asset_key text,recurring_id text,active boolean,file_name text,mime_type text,
 size_bytes bigint,storage_bucket text,storage_path text);
ALTER TABLE public.rheomiq_recurring_service_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY recurring_receipt_owner ON public.rheomiq_recurring_service_assets TO authenticated
 USING (owner_user_id=(select auth.uid()) AND (select public.rheomiq_is_owner_aal2()));
GRANT SELECT,INSERT ON public.rheomiq_recurring_service_assets TO authenticated;
CREATE POLICY recurring_receipt_insert ON public.rheomiq_recurring_service_assets FOR INSERT TO authenticated
 WITH CHECK (owner_user_id=(select auth.uid()) AND (select public.rheomiq_is_owner_aal2()));
CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA storage TO authenticated;
CREATE TABLE storage.objects(bucket_id text,name text);
INSERT INTO storage.objects VALUES
 ('financial-provider-assets','providers/qa-bank/qa-bank-asset-000000000003.png');
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY artwork_receipt_owner ON storage.objects TO authenticated
 USING ((select public.rheomiq_is_owner_aal2()));
GRANT SELECT ON storage.objects TO authenticated;
ALTER TABLE public.rheomiq_financial_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rheomiq_financial_provider_assets ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.rheomiq_financial_providers,public.rheomiq_financial_provider_assets TO authenticated;
GRANT INSERT ON public.rheomiq_financial_provider_assets TO authenticated;
CREATE POLICY provider_receipt_insert ON public.rheomiq_financial_provider_assets FOR INSERT TO authenticated
 WITH CHECK ((select public.rheomiq_is_owner_aal2()));
CREATE POLICY rheomiq_financial_providers_authenticated_read ON public.rheomiq_financial_providers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY rheomiq_financial_provider_assets_authenticated_read ON public.rheomiq_financial_provider_assets
  FOR SELECT TO authenticated USING (active = true);

-- Execute the same forward migrations destined for the MyFinHub repository.
\i supabase/migrations/20261024150000_add_device_details_and_nicknames.sql
\i supabase/migrations/20261024160000_shared_owner_app_lock.sql
\i supabase/migrations/20261122080000_restrict_provider_catalog_to_owner_aal2.sql
\i supabase/migrations/20261125090000_add_artwork_upload_intents.sql

SET ROLE authenticated;
SELECT set_config('request.jwt.claims',jsonb_build_object(
 'sub','11111111-1111-4111-8111-111111111111',
 'session_id','22222222-2222-4222-8222-222222222222','aal','aal2',
 'amr',jsonb_build_array(
 jsonb_build_object('method','password','timestamp',floor(extract(epoch from now()))::bigint-500),
 jsonb_build_object('method','totp','timestamp',floor(extract(epoch from now()))::bigint-500)
 ))::text,false);
\i scripts/recovery-fixtures/artwork-upload-intent-owner.sql

DO $$
DECLARE
 result jsonb;
 receipt text;
 found_count integer;
 reject_count integer:=0;
BEGIN
 SELECT count(*) INTO found_count FROM public.rheomiq_app_state;
 IF found_count<>1 THEN RAISE EXCEPTION 'Baseline owner/AAL2 denied'; END IF;
 SELECT count(*) INTO found_count FROM public.rheomiq_financial_providers;
 IF found_count<>1 THEN RAISE EXCEPTION 'Owner AAL2 provider catalog RLS positive control failed'; END IF;
 SELECT count(*) INTO found_count FROM public.rheomiq_financial_provider_assets;
 IF found_count<>1 THEN RAISE EXCEPTION 'Owner AAL2 provider asset RLS positive control failed'; END IF;
 result:=public.myfinhub_app_lock_action('configure',null,'1234',5);
 IF result->>'ok'<>'true' THEN RAISE EXCEPTION 'Configure failed'; END IF;
 SELECT count(*) INTO found_count FROM public.rheomiq_app_state;
 IF found_count<>0 THEN RAISE EXCEPTION 'Direct finance RLS leaked while locked'; END IF;
 SELECT count(*) INTO found_count FROM public.rheomiq_financial_providers;
 IF found_count<>0 THEN RAISE EXCEPTION 'Locked owner read provider catalog'; END IF;
 SELECT count(*) INTO found_count FROM public.rheomiq_financial_provider_assets;
 IF found_count<>0 THEN RAISE EXCEPTION 'Locked owner read provider artwork metadata'; END IF;
 IF (SELECT count(*) FROM public.rheomiq_artwork_upload_intents)<>0 THEN RAISE EXCEPTION 'Locked owner read artwork intents'; END IF;
 FOR i IN 1..5 LOOP
   result:=public.myfinhub_app_lock_action('verify','0000');
   IF result->>'error'<>'APP_LOCK_WRONG_PIN' THEN RAISE EXCEPTION 'Wrong PIN accepted'; END IF;
 END LOOP;
 result:=public.myfinhub_app_lock_action('verify','1234');
 IF result->>'error'<>'APP_LOCK_RATE_LIMITED' THEN RAISE EXCEPTION 'Brute-force limit bypassed'; END IF;
 BEGIN
   PERFORM public.myfinhub_app_lock_recover('5678');
   RAISE EXCEPTION 'Old MFA evidence accepted';
 EXCEPTION WHEN insufficient_privilege THEN reject_count:=reject_count+1;
 END;
 IF reject_count<>1 THEN RAISE EXCEPTION 'Old MFA rejection not observed'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object(
   'sub','11111111-1111-4111-8111-111111111111',
   'session_id','22222222-2222-4222-8222-222222222222','aal','aal2',
   'amr',jsonb_build_array(
     jsonb_build_object('method','password','timestamp',floor(extract(epoch from clock_timestamp()))::bigint),
     jsonb_build_object('method','totp','timestamp',floor(extract(epoch from clock_timestamp()))::bigint)
   ))::text,false);
 result:=public.myfinhub_app_lock_recover('5678');
 IF result->>'ok'<>'true' THEN RAISE EXCEPTION 'Fresh MFA recovery failed'; END IF;
 result:=public.myfinhub_app_lock_action('verify','5678');
 receipt:=result->>'unlockToken';
 IF length(coalesce(receipt,''))<>43 THEN RAISE EXCEPTION 'No random session ticket'; END IF;
 IF public.myfinhub_app_lock_ticket('validate',repeat('a',64)) THEN
   RAISE EXCEPTION 'Forged ticket accepted';
 END IF;
 SELECT count(*) INTO found_count FROM public.rheomiq_app_state;
 IF found_count<>1 THEN RAISE EXCEPTION 'Valid ticket failed finance RLS'; END IF;
 SELECT count(*) INTO found_count FROM public.rheomiq_financial_providers;
 IF found_count<>1 THEN RAISE EXCEPTION 'Owner unlocked provider registry read failed'; END IF;
 SELECT count(*) INTO found_count FROM public.rheomiq_financial_provider_assets;
 IF found_count<>1 THEN RAISE EXCEPTION 'Owner unlocked provider artwork read failed'; END IF;
 IF NOT public.myfinhub_app_lock_ticket('touch',encode(extensions.digest(receipt,'sha256'),'hex')) THEN
   RAISE EXCEPTION 'Ticket refresh failed';
 END IF;
 IF NOT public.myfinhub_app_lock_ticket('revoke',encode(extensions.digest(receipt,'sha256'),'hex')) THEN
   RAISE EXCEPTION 'Ticket revocation failed';
 END IF;
 SELECT count(*) INTO found_count FROM public.rheomiq_app_state;
 IF found_count<>0 THEN RAISE EXCEPTION 'Direct JWT finance access survived lock'; END IF;
 SELECT count(*) INTO found_count FROM public.rheomiq_financial_providers;
 IF found_count<>0 THEN RAISE EXCEPTION 'Provider registry remained visible after PIN lock'; END IF;
 result:=public.myfinhub_app_lock_action('disable','5678');
 IF result->>'enabled'<>'false' OR NOT public.rheomiq_is_owner_aal2() THEN
   RAISE EXCEPTION 'Safe disable failed';
 END IF;
END $$;
-- MFA assurance must remain mandatory irrespective of any configured PIN.
SELECT set_config('request.jwt.claims',jsonb_build_object(
 'sub','11111111-1111-4111-8111-111111111111',
 'session_id','22222222-2222-4222-8222-222222222222','aal','aal1'
)::text,false);
DO $$ BEGIN
 BEGIN
   PERFORM public.myfinhub_app_lock_action('configure',null,'9876',5);
   RAISE EXCEPTION 'AAL1 was allowed to configure PIN';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
-- All three exposed SECURITY DEFINER App Lock RPCs must be unusable by
-- AAL1 users, even when their JWT is otherwise a valid owner/device session.
DO $$
DECLARE rejected integer:=0;
BEGIN
  BEGIN
    PERFORM public.myfinhub_app_lock_ticket('validate',repeat('a',64));
    RAISE EXCEPTION 'AAL1 was allowed to validate an App Lock ticket';
  EXCEPTION WHEN insufficient_privilege THEN rejected:=rejected+1;
  END;
  BEGIN
    PERFORM public.myfinhub_app_lock_recover('9876');
    RAISE EXCEPTION 'AAL1 was allowed to recover an App Lock PIN';
  EXCEPTION WHEN insufficient_privilege THEN rejected:=rejected+1;
  END;
  IF rejected<>2 THEN RAISE EXCEPTION 'AAL1 App Lock denials were incomplete'; END IF;
 IF (SELECT count(*) FROM public.rheomiq_financial_providers)<>0 OR
    (SELECT count(*) FROM public.rheomiq_financial_provider_assets)<>0 THEN
   RAISE EXCEPTION 'AAL1 read the protected provider catalog';
 END IF;
END $$;
\i scripts/recovery-fixtures/artwork-upload-intent-denied.sql
RESET ROLE;

-- Test effective grants on the actual compiled functions, not merely SQL text.
DO $$
DECLARE signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.myfinhub_app_lock_action(text,text,text,integer)',
    'public.myfinhub_app_lock_ticket(text,text)',
    'public.myfinhub_app_lock_recover(text)'
  ] LOOP
    IF NOT has_function_privilege('authenticated',signature,'EXECUTE') THEN
      RAISE EXCEPTION 'Authenticated App Lock grant missing for %',signature;
    END IF;
    IF has_function_privilege('anon',signature,'EXECUTE') THEN
      RAISE EXCEPTION 'Anonymous App Lock RPC execution exposed for %',signature;
    END IF;
  END LOOP;
  IF has_table_privilege('authenticated','public.myfinhub_app_lock','SELECT')
    OR has_table_privilege('authenticated','public.myfinhub_app_lock_tickets','SELECT') THEN
    RAISE EXCEPTION 'Private App Lock verifier/ticket tables exposed to authenticated role';
  END IF;
END $$;

-- A valid AAL2 non-owner with an ACTIVE device still must be denied by all
-- three SECURITY DEFINER entrypoints.
INSERT INTO auth.users VALUES ('33333333-3333-4333-8333-333333333333');
INSERT INTO public.myfinhub_device_sessions(session_id,user_id)
 VALUES('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333');
SET ROLE authenticated;
SELECT set_config('request.jwt.claims',jsonb_build_object(
  'sub','33333333-3333-4333-8333-333333333333',
  'session_id','44444444-4444-4444-8444-444444444444','aal','aal2'
)::text,false);
DO $$
DECLARE rejected integer:=0;
BEGIN
  BEGIN
    PERFORM public.myfinhub_app_lock_action('status');
    RAISE EXCEPTION 'Non-owner AAL2 was allowed to read App Lock status';
  EXCEPTION WHEN insufficient_privilege THEN rejected:=rejected+1;
  END;
  BEGIN
    PERFORM public.myfinhub_app_lock_ticket('validate',repeat('a',64));
    RAISE EXCEPTION 'Non-owner AAL2 was allowed to query App Lock tickets';
  EXCEPTION WHEN insufficient_privilege THEN rejected:=rejected+1;
  END;
  BEGIN
    PERFORM public.myfinhub_app_lock_recover('9876');
    RAISE EXCEPTION 'Non-owner AAL2 was allowed to recover the owner PIN';
  EXCEPTION WHEN insufficient_privilege THEN rejected:=rejected+1;
  END;
  IF rejected<>3 THEN RAISE EXCEPTION 'Non-owner App Lock denials were incomplete'; END IF;
 IF (SELECT count(*) FROM public.rheomiq_financial_providers)<>0 OR
    (SELECT count(*) FROM public.rheomiq_financial_provider_assets)<>0 THEN
   RAISE EXCEPTION 'Non-owner AAL2 read protected provider catalog records';
 END IF;
END $$;
\i scripts/recovery-fixtures/artwork-upload-intent-denied.sql
RESET ROLE;

-- Revocation of an otherwise valid owner AAL2 session must immediately
-- remove its authority for status and ticket RPCs. The separate lost-PIN
-- recovery requires fresh GoTrue password+TOTP proof, not an active device.
UPDATE public.myfinhub_device_sessions
 SET revoked_at=clock_timestamp()
 WHERE session_id='22222222-2222-4222-8222-222222222222';
SET ROLE authenticated;
SELECT set_config('request.jwt.claims',jsonb_build_object(
  'sub','11111111-1111-4111-8111-111111111111',
  'session_id','22222222-2222-4222-8222-222222222222','aal','aal2'
)::text,false);
DO $$
DECLARE rejected integer:=0;
BEGIN
  BEGIN
    PERFORM public.myfinhub_app_lock_action('status');
    RAISE EXCEPTION 'Revoked owner device was allowed to read App Lock status';
  EXCEPTION WHEN insufficient_privilege THEN rejected:=rejected+1;
  END;
  BEGIN
    PERFORM public.myfinhub_app_lock_ticket('validate',repeat('a',64));
    RAISE EXCEPTION 'Revoked owner device was allowed to query App Lock tickets';
  EXCEPTION WHEN insufficient_privilege THEN rejected:=rejected+1;
  END;
  IF rejected<>2 THEN RAISE EXCEPTION 'Revoked device App Lock denials were incomplete'; END IF;
 IF (SELECT count(*) FROM public.rheomiq_financial_providers)<>0 OR
    (SELECT count(*) FROM public.rheomiq_financial_provider_assets)<>0 THEN
   RAISE EXCEPTION 'Revoked owner AAL2 read protected provider catalog records';
 END IF;
END $$;
\i scripts/recovery-fixtures/artwork-upload-intent-denied.sql
RESET ROLE;
DO $$
BEGIN
  IF has_table_privilege('anon','public.rheomiq_artwork_upload_intents','SELECT')
    OR has_any_column_privilege('anon','public.rheomiq_artwork_upload_intents','INSERT')
    OR has_any_column_privilege('anon','public.rheomiq_artwork_upload_intents','UPDATE')
    OR has_table_privilege('authenticated','public.rheomiq_artwork_upload_intents','DELETE')
    OR has_column_privilege('authenticated','public.rheomiq_artwork_upload_intents','owner_user_id','INSERT')
    OR has_column_privilege('authenticated','public.rheomiq_artwork_upload_intents','disposition','INSERT')
    OR has_column_privilege('authenticated','public.rheomiq_artwork_upload_intents','dispatch_claimed','INSERT')
    OR has_column_privilege('authenticated','public.rheomiq_artwork_upload_intents','registration_recorded','INSERT')
    OR has_column_privilege('authenticated','public.rheomiq_artwork_upload_intents','resolved_at','UPDATE') THEN
    RAISE EXCEPTION 'Artwork intent grant boundary expanded';
  END IF;
  IF (SELECT count(*) FROM public.rheomiq_artwork_upload_intents)<>5
    OR (SELECT count(*) FROM public.rheomiq_artwork_upload_intents WHERE disposition='pending')<>1 THEN
    RAISE EXCEPTION 'Denied artwork intent operations changed durable inventory';
  END IF;
END $$;
ROLLBACK;
\echo Local PostgreSQL PIN/RLS/recovery smoke: PASS
SQL