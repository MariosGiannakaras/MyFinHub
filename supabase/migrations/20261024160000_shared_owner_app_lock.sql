-- Shared four-digit application privacy PIN. The low-entropy verifier is never
-- queryable by authenticated/anon clients; only the narrowly reviewed function
-- below may compare it, with a global row-level failed-attempt throttle.
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

-- Security review: SECURITY DEFINER is necessary here because granting SELECT
-- on the verifier of a four-digit PIN permits offline brute force. This function
-- has no dynamic SQL, checks the JWT owner + AAL2 + current active device, locks
-- the single owner row before verification and returns no hash or salt.
-- No service-role key is used by the app.
create or replace function public.myfinhub_app_lock_action(
  p_action text,
  p_pin text default null,
  p_new_pin text default null,
  p_idle_minutes integer default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.myfinhub_app_lock%rowtype;
  v_ok boolean;
  v_retry bigint := 0;
  v_next_failures integer;
  v_idle integer;
begin
  if v_uid is null or not (select public.rheomiq_is_owner_aal2()) then
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
    v_retry := greatest(0,ceil(extract(epoch from (v_row.blocked_until - clock_timestamp()))*1000)::bigint);
    return jsonb_build_object('ok',true,'enabled',true,'idleMinutes',v_row.idle_minutes,'retryAfterMs',v_retry);
  end if;

  select * into v_row from public.myfinhub_app_lock where user_id=v_uid for update;
  if p_action='configure' then
    if found then
      return jsonb_build_object('ok',false,'error','APP_LOCK_ALREADY_CONFIGURED','enabled',true,'idleMinutes',v_row.idle_minutes,'retryAfterMs',0);
    end if;
    if p_new_pin is null or p_new_pin !~ '^[0-9]{4}$' then
      raise exception using errcode='22023', message='APP_LOCK_INVALID_PIN';
    end if;
    v_idle := coalesce(p_idle_minutes,5);
    if v_idle not in (1,5,15,30,60) then raise exception using errcode='22023', message='APP_LOCK_INVALID_TIMEOUT'; end if;
    insert into public.myfinhub_app_lock(user_id,pin_hash,idle_minutes)
      values(v_uid,extensions.crypt(p_new_pin,extensions.gen_salt('bf',12)),v_idle);
    return jsonb_build_object('ok',true,'enabled',true,'idleMinutes',v_idle,'retryAfterMs',0);
  end if;
  if not found then
    return jsonb_build_object('ok',false,'error','APP_LOCK_NOT_CONFIGURED','enabled',false,'idleMinutes',5,'retryAfterMs',0);
  end if;

  v_retry := greatest(0,ceil(extract(epoch from (v_row.blocked_until - clock_timestamp()))*1000)::bigint);
  if v_retry > 0 then
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
    return jsonb_build_object('ok',true,'enabled',true,'idleMinutes',v_row.idle_minutes,'retryAfterMs',0);
  end if;
  if p_action='disable' then
    delete from public.myfinhub_app_lock where user_id=v_uid;
    return jsonb_build_object('ok',true,'enabled',false,'idleMinutes',5,'retryAfterMs',0);
  end if;
  if p_action='change' then
    if p_new_pin is null or p_new_pin !~ '^[0-9]{4}$' or p_new_pin=p_pin then
      raise exception using errcode='22023',message='APP_LOCK_INVALID_NEW_PIN';
    end if;
    update public.myfinhub_app_lock set pin_hash=extensions.crypt(p_new_pin,extensions.gen_salt('bf',12)),updated_at=now() where user_id=v_uid;
  end if;
  if p_action='timeout' then
    if p_idle_minutes not in (1,5,15,30,60) or p_idle_minutes is null then
      raise exception using errcode='22023',message='APP_LOCK_INVALID_TIMEOUT';
    end if;
    update public.myfinhub_app_lock set idle_minutes=p_idle_minutes,updated_at=now() where user_id=v_uid;
    v_row.idle_minutes := p_idle_minutes;
  end if;
  return jsonb_build_object('ok',true,'enabled',true,'idleMinutes',v_row.idle_minutes,'retryAfterMs',0);
end
$$;

revoke all on function public.myfinhub_app_lock_action(text,text,text,integer) from public, anon;
grant execute on function public.myfinhub_app_lock_action(text,text,text,integer) to authenticated;
