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
 VALUES('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111');
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

-- Execute the same forward migrations destined for the MyFinHub repository.
\i supabase/migrations/20261024150000_add_device_details_and_nicknames.sql
\i supabase/migrations/20261024160000_shared_owner_app_lock.sql

SET ROLE authenticated;
SELECT set_config('request.jwt.claims',jsonb_build_object(
 'sub','11111111-1111-4111-8111-111111111111',
 'session_id','22222222-2222-4222-8222-222222222222','aal','aal2',
 'amr',jsonb_build_array(
 jsonb_build_object('method','password','timestamp',floor(extract(epoch from now()))::bigint-500),
 jsonb_build_object('method','totp','timestamp',floor(extract(epoch from now()))::bigint-500)
 ))::text,false);

DO $$
DECLARE
 result jsonb;
 receipt text;
 found_count integer;
 reject_count integer:=0;
BEGIN
 SELECT count(*) INTO found_count FROM public.rheomiq_app_state;
 IF found_count<>1 THEN RAISE EXCEPTION 'Baseline owner/AAL2 denied'; END IF;
 result:=public.myfinhub_app_lock_action('configure',null,'1234',5);
 IF result->>'ok'<>'true' THEN RAISE EXCEPTION 'Configure failed'; END IF;
 SELECT count(*) INTO found_count FROM public.rheomiq_app_state;
 IF found_count<>0 THEN RAISE EXCEPTION 'Direct finance RLS leaked while locked'; END IF;
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
 IF NOT public.myfinhub_app_lock_ticket('touch',encode(extensions.digest(receipt,'sha256'),'hex')) THEN
   RAISE EXCEPTION 'Ticket refresh failed';
 END IF;
 IF NOT public.myfinhub_app_lock_ticket('revoke',encode(extensions.digest(receipt,'sha256'),'hex')) THEN
   RAISE EXCEPTION 'Ticket revocation failed';
 END IF;
 SELECT count(*) INTO found_count FROM public.rheomiq_app_state;
 IF found_count<>0 THEN RAISE EXCEPTION 'Direct JWT finance access survived lock'; END IF;
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
RESET ROLE;
ROLLBACK;
\echo Local PostgreSQL PIN/RLS/recovery smoke: PASS
SQL