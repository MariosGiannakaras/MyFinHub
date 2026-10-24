-- Owner-selected shared four-digit privacy PIN. A client never receives its
-- low-entropy hash; the authenticated role has no direct SELECT or DML grants.
create table if not exists public.myfinhub_app_lock (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text not null,
  idle_minutes integer not null default 5 check (idle_minutes in (1,5,15,30,60)),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.myfinhub_app_lock enable row level security;
revoke all on public.myfinhub_app_lock from public, anon, authenticated;

-- Only SHA-256 hashes of 256-bit random PIN-unlock tickets are stored.
-- These tickets are scoped to the owner and the original Supabase Auth session.
create table if not exists public.myfinhub_app_lock_tickets (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  expires_at timestamptz not null
);
create index if not exists myfinhub_app_lock_tickets_session_idx
  on public.myfinhub_app_lock_tickets(user_id,session_id);
alter table public.myfinhub_app_lock_tickets enable row level security;
revoke all on public.myfinhub_app_lock_tickets from public, anon, authenticated;

-- Extra finance RLS defense: a copied Supabase JWT cannot directly query the
-- underlying finance tables when its Auth session has no live PIN ticket.
-- This private helper cannot reveal PIN hashes, tickets or balances.
create or replace function private.myfinhub_app_lock_session_unlocked()
returns boolean language sql stable security definer set search_path=''
as $$
  select not exists(
    select 1 from public.myfinhub_app_lock l where l.user_id=(select auth.uid())
  ) or exists(
    select 1 from public.myfinhub_app_lock_tickets t
    where t.user_id=(select auth.uid())
      and t.session_id::text=coalesce((select auth.jwt())->>'session_id','')
      and t.expires_at>now()
  );
$$;
revoke all on function private.myfinhub_app_lock_session_unlocked() from public, anon;
grant execute on function private.myfinhub_app_lock_session_unlocked() to authenticated;

-- Preserve the established canonical owner + MFA + active-device predicates.
-- The PIN predicate is added, never substituted for the existing checks.
create or replace function public.rheomiq_is_owner_aal2()
returns boolean language sql stable
set search_path=public,auth,private
as $$
  select public.rheomiq_is_owner()
    and public.rheomiq_has_aal2()
    and private.myfinhub_session_is_active()
    and private.myfinhub_app_lock_session_unlocked();
$$;

-- SECURITY DEFINER is narrowly required because exposing a four-digit hash
-- would enable offline brute force. This publicly exposed RPC has no dynamic
-- SQL and explicitly checks owner + AAL2 + an ACTIVE device without consulting
-- the finance PIN grant (otherwise the owner could not unlock).
create or replace function public.myfinhub_app_lock_action(
  p_action text,
  p_pin text default null,
  p_new_pin text default null,
  p_idle_minutes integer default null
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.myfinhub_app_lock%rowtype;
  v_ok boolean;
  v_retry bigint := 0;
  v_next_failures integer;
  v_idle integer;
  v_ticket text;
  v_session uuid;
begin
  if v_uid is null or not (select public.rheomiq_is_owner() and public.rheomiq_has_aal2() and private.myfinhub_session_is_active()) then
    raise exception using errcode='42501', message='APP_LOCK_FORBIDDEN';
  end if;
  if p_action not in ('status','configure','verify','change','timeout','disable') then
    raise exception using errcode='22023', message='APP_LOCK_INVALID_ACTION';
  end if;
  if p_action='status' then
    select * into v_row from public.myfinhub_app_lock where user_id=v_uid;
    if not found then
      return jsonb_build_object('ok',true,'enabled',false,'idleMinutes',5,'retryAfterMs',0);
    end if;
    v_retry := greatest(0,coalesce(ceil(extract(epoch from (v_row.blocked_until-clock_timestamp()))*1000)::bigint,0));
    return jsonb_build_object('ok',true,'enabled',true,'idleMinutes',v_row.idle_minutes,'retryAfterMs',v_retry);
  end if;

  select * into v_row from public.myfinhub_app_lock where user_id=v_uid for update;
  if p_action='configure' then
    if found then
      return jsonb_build_object('ok',false,'error','APP_LOCK_ALREADY_CONFIGURED','enabled',true,'idleMinutes',v_row.idle_minutes,'retryAfterMs',0);
    end if;
    if p_new_pin is null or p_new_pin !~ '^[0-9]{4}$' then
      raise exception using errcode='22023',message='APP_LOCK_INVALID_PIN';
    end if;
    v_idle := coalesce(p_idle_minutes,5);
    if v_idle not in (1,5,15,30,60) then
      raise exception using errcode='22023',message='APP_LOCK_INVALID_TIMEOUT';
    end if;
    insert into public.myfinhub_app_lock(user_id,pin_hash,idle_minutes)
      values(v_uid,extensions.crypt(p_new_pin,extensions.gen_salt('bf',12)),v_idle);
    return jsonb_build_object('ok',true,'enabled',true,'idleMinutes',v_idle,'retryAfterMs',0);
  end if;
  if not found then
    return jsonb_build_object('ok',false,'error','APP_LOCK_NOT_CONFIGURED','enabled',false,'idleMinutes',5,'retryAfterMs',0);
  end if;

  v_retry := greatest(0,coalesce(ceil(extract(epoch from (v_row.blocked_until-clock_timestamp()))*1000)::bigint,0));
  if v_retry>0 then
    return jsonb_build_object('ok',false,'error','APP_LOCK_RATE_LIMITED','enabled',true,'idleMinutes',v_row.idle_minutes,'retryAfterMs',v_retry);
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    raise exception using errcode='22023',message='APP_LOCK_INVALID_PIN';
  end if;
  v_ok := extensions.crypt(p_pin,v_row.pin_hash)=v_row.pin_hash;
  if not v_ok then
    v_next_failures := least(v_row.failed_attempts+1,100000);
    update public.myfinhub_app_lock
      set failed_attempts=v_next_failures,
          blocked_until=case when v_next_failures>=5 then clock_timestamp()+interval '30 seconds' else null end
      where user_id=v_uid;
    return jsonb_build_object('ok',false,'error','APP_LOCK_WRONG_PIN','enabled',true,'idleMinutes',v_row.idle_minutes,'retryAfterMs',case when v_next_failures>=5 then 30000 else 0 end);
  end if;

  update public.myfinhub_app_lock set failed_attempts=0,blocked_until=null where user_id=v_uid;
  if p_action='verify' then
    v_session := nullif((select auth.jwt())->>'session_id','')::uuid;
    if v_session is null then
      raise exception using errcode='42501',message='APP_LOCK_SESSION_REQUIRED';
    end if;
    v_ticket := translate(trim(trailing '=' from encode(extensions.gen_random_bytes(32),'base64')), '+/', '-_');
    insert into public.myfinhub_app_lock_tickets(token_hash,user_id,session_id,expires_at)
      values(encode(extensions.digest(v_ticket,'sha256'),'hex'),v_uid,v_session,
        clock_timestamp()+make_interval(mins=>v_row.idle_minutes));
    return jsonb_build_object('ok',true,'enabled',true,'idleMinutes',v_row.idle_minutes,'retryAfterMs',0,'unlockToken',v_ticket);
  end if;
  if p_action='disable' then
    delete from public.myfinhub_app_lock_tickets where user_id=v_uid;
    delete from public.myfinhub_app_lock where user_id=v_uid;
    return jsonb_build_object('ok',true,'enabled',false,'idleMinutes',5,'retryAfterMs',0);
  end if;
  if p_action='change' then
    if p_new_pin is null or p_new_pin !~ '^[0-9]{4}$' or p_new_pin=p_pin then
      raise exception using errcode='22023',message='APP_LOCK_INVALID_NEW_PIN';
    end if;
    update public.myfinhub_app_lock
      set pin_hash=extensions.crypt(p_new_pin,extensions.gen_salt('bf',12)),updated_at=now()
      where user_id=v_uid;
    delete from public.myfinhub_app_lock_tickets where user_id=v_uid;
  end if;
  if p_action='timeout' then
    if p_idle_minutes is null or p_idle_minutes not in (1,5,15,30,60) then
      raise exception using errcode='22023',message='APP_LOCK_INVALID_TIMEOUT';
    end if;
    update public.myfinhub_app_lock set idle_minutes=p_idle_minutes,updated_at=now() where user_id=v_uid;
    delete from public.myfinhub_app_lock_tickets where user_id=v_uid;
    v_row.idle_minutes := p_idle_minutes;
  end if;
  return jsonb_build_object('ok',true,'enabled',true,'idleMinutes',v_row.idle_minutes,'retryAfterMs',0);
end
$$;
revoke all on function public.myfinhub_app_lock_action(text,text,text,integer) from public, anon;
grant execute on function public.myfinhub_app_lock_action(text,text,text,integer) to authenticated;

-- Each ticket operation requires the existing owner/AAL2/active-device policy.
-- Locking one tab revokes ALL tickets for its Auth session to avoid a second-tab
-- bearer/JWT bypass. Separate devices have distinct Supabase session IDs.
create or replace function public.myfinhub_app_lock_ticket(p_action text,p_token_hash text)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_session uuid;
begin
  if v_uid is null or not (select public.rheomiq_is_owner() and public.rheomiq_has_aal2() and private.myfinhub_session_is_active()) then
    raise exception using errcode='42501',message='APP_LOCK_FORBIDDEN';
  end if;
  v_session := nullif((select auth.jwt())->>'session_id','')::uuid;
  if v_session is null then return false; end if;
  if p_action='validate' and not exists(select 1 from public.myfinhub_app_lock where user_id=v_uid) then return true; end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return false; end if;

  if p_action='validate' then
    return exists(select 1 from public.myfinhub_app_lock_tickets
      where user_id=v_uid and session_id=v_session and token_hash=p_token_hash and expires_at>clock_timestamp());
  end if;
  if p_action='touch' then
    update public.myfinhub_app_lock_tickets ticket
      set expires_at=clock_timestamp()+make_interval(mins=>pin_state.idle_minutes)
      from public.myfinhub_app_lock pin_state
      where ticket.user_id=v_uid and ticket.session_id=v_session
        and ticket.token_hash=p_token_hash and ticket.expires_at>clock_timestamp()
        and pin_state.user_id=v_uid;
    return found;
  end if;
  if p_action='revoke' then
    if not exists(select 1 from public.myfinhub_app_lock_tickets
      where user_id=v_uid and session_id=v_session and token_hash=p_token_hash) then return false; end if;
    delete from public.myfinhub_app_lock_tickets where user_id=v_uid and session_id=v_session;
    return true;
  end if;
  return false;
end
$$;
revoke all on function public.myfinhub_app_lock_ticket(text,text) from public, anon;
grant execute on function public.myfinhub_app_lock_ticket(text,text) to authenticated;
