-- Disposable PostgreSQL smoke: original active owner reserves an upload,
-- then a different active session sees the same durable reservation.
DO $$
DECLARE
  original_claims text:=current_setting('request.jwt.claims');
  affected integer;
BEGIN
  insert into public.rheomiq_artwork_upload_intents
    (intent_id,kind,target_id,role,variant,asset_key,file_name,mime_type,size_bytes,sha256)
  values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','provider','qa-bank','logo','light',
      'qa-bank-asset-000000000001','logo.png','image/png',8,repeat('a',64));

  if not exists(select 1 from public.rheomiq_artwork_upload_intents
    where intent_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
      and owner_user_id=auth.uid() and disposition='pending' and not dispatch_claimed and resolved_at is null
      and storage_path='providers/qa-bank/qa-bank-asset-000000000001.png') then
    raise exception 'Artwork intent initial receipt missing or malformed';
  end if;
  perform set_config('request.jwt.claims',jsonb_set(original_claims::jsonb,'{session_id}',
    to_jsonb('55555555-5555-4555-8555-555555555555'::text))::text,false);
  if not public.rheomiq_is_owner_aal2() or
    not exists(select 1 from public.rheomiq_artwork_upload_intents
      where intent_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' and disposition='pending') then
    raise exception 'Artwork intent unavailable to independently active owner session';
  end if;

  begin
    insert into public.rheomiq_artwork_upload_intents
      (intent_id,kind,target_id,role,variant,asset_key,file_name,mime_type,size_bytes,sha256)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','provider','qa-bank','logo','light',
      'qa-bank-asset-000000000002','different.png','image/png',9,repeat('b',64));
    raise exception 'Second pending artwork intent for same slot was accepted';
  exception when unique_violation then null;
  end;

  -- Independent provider slot and recurring target are not blocked.
  insert into public.rheomiq_artwork_upload_intents
    (intent_id,kind,target_id,role,variant,asset_key,file_name,mime_type,size_bytes,sha256)
  values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','provider','qa-bank','logo','dark',
      'qa-bank-asset-000000000003','logo.png','image/png',8,repeat('a',64)),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','recurring','qa-service','','',
      'service-asset-000000000000000000000004','logo.png','image/png',8,repeat('a',64));
  if not exists(select 1 from public.rheomiq_artwork_upload_intents
    where intent_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'
      and storage_path='services/service-asset-000000000000000000000004.png') then
    raise exception 'Recurring intent canonical path missing';
  end if;
  begin
    insert into public.rheomiq_artwork_upload_intents
      (intent_id,kind,target_id,role,variant,asset_key,file_name,mime_type,size_bytes,sha256)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5','provider','qa-bank','logo','universal',
      'other-bank-asset-000000000005','logo.png','image/png',8,repeat('a',64));
    raise exception 'Foreign provider intent key was accepted';
  exception when check_violation then null;
  end;

  begin
    update public.rheomiq_artwork_upload_intents set disposition='acknowledged'
      where intent_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
    raise exception 'Undispatched artwork intent acknowledged';
  exception when check_violation then null;
  end;
  begin
    update public.rheomiq_artwork_upload_intents set dispatch_claimed=true,disposition='acknowledged'
      where intent_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
    raise exception 'Artwork claim and terminal transition combined';
  exception when check_violation then null;
  end;
  update public.rheomiq_artwork_upload_intents set dispatch_claimed=true
    where intent_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3' and disposition='pending' and not dispatch_claimed;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Fresh artwork dispatch claim not accepted'; end if;
  update public.rheomiq_artwork_upload_intents set dispatch_claimed=true
    where intent_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3' and disposition='pending' and not dispatch_claimed;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Artwork dispatch claim replay accepted'; end if;
  begin
    update public.rheomiq_artwork_upload_intents set dispatch_claimed=false
      where intent_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
    raise exception 'Artwork dispatch claim reset';
  exception when check_violation then null;
  end;
  begin
    update public.rheomiq_artwork_upload_intents set disposition='abandoned'
      where intent_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
    raise exception 'Claimed artwork intent abandoned';
  exception when check_violation then null;
  end;
  update public.rheomiq_artwork_upload_intents set dispatch_claimed=true
    where intent_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4' and disposition='pending' and not dispatch_claimed;
  begin
    update public.rheomiq_artwork_upload_intents set disposition='acknowledged'
      where intent_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
    raise exception 'Claimed artwork without registry or object acknowledged';
  exception when check_violation then null;
  end;
  update public.rheomiq_artwork_upload_intents set disposition='abandoned'
    where intent_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' and disposition='pending' and not dispatch_claimed;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Exact pending intent could not be closed'; end if;
  if not exists(select 1 from public.rheomiq_artwork_upload_intents
    where intent_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' and disposition='abandoned'
      and resolved_at is not null) then
    raise exception 'Terminal artwork intent receipt missing';
  end if;

  update public.rheomiq_artwork_upload_intents set dispatch_claimed=true
    where intent_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' and disposition='pending' and not dispatch_claimed;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Abandoned artwork intent claimed'; end if;

  begin
    update public.rheomiq_artwork_upload_intents set disposition='pending'
      where intent_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
    raise exception 'Terminal artwork intent reopened';
  exception when check_violation then null;
  end;
  begin
    update public.rheomiq_artwork_upload_intents set disposition='acknowledged'
      where intent_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
    raise exception 'Terminal artwork intent disposition rewritten';
  exception when check_violation then null;
  end;
  begin
    update public.rheomiq_artwork_upload_intents set sha256=repeat('b',64)
      where intent_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
    raise exception 'Artwork intent fingerprint rewritten';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.rheomiq_artwork_upload_intents
      where intent_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
    raise exception 'Owner deleted artwork intent tombstone';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.rheomiq_artwork_upload_intents
      (intent_id,kind,target_id,role,variant,asset_key,file_name,mime_type,size_bytes,sha256)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','provider','qa-bank','logo','light',
      'qa-bank-asset-000000000001','logo.png','image/png',8,repeat('a',64));
    raise exception 'Retired artwork asset key was reused';
  exception when unique_violation then null;
  end;
  begin
    insert into public.rheomiq_artwork_upload_intents
      (intent_id,kind,target_id,role,variant,asset_key,file_name,mime_type,size_bytes,sha256)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','provider','qa-bank','logo','light',
      'qa-bank-asset-000000000002','logo.png','image/png',8,repeat('a',64));
    raise exception 'Retired artwork intent ID was reused';
  exception when unique_violation then null;
  end;
  -- Same bytes/name are intentionally NOT identity: only a fresh ID/key
  -- after explicit terminal disposition can reserve the released slot.
  insert into public.rheomiq_artwork_upload_intents
    (intent_id,kind,target_id,role,variant,asset_key,file_name,mime_type,size_bytes,sha256)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','provider','qa-bank','logo','light',
    'qa-bank-asset-000000000002','logo.png','image/png',8,repeat('a',64));
  update public.rheomiq_artwork_upload_intents set disposition='acknowledged'
    where intent_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3' and disposition='pending';
  get diagnostics affected=row_count;
  if affected<>1 or (select count(*) from public.rheomiq_artwork_upload_intents)<>4
    or (select count(*) from public.rheomiq_artwork_upload_intents where disposition='pending')<>2 then
    raise exception 'Artwork intent disposition/independent-target inventory mismatch';
  end if;
  perform set_config('request.jwt.claims',original_claims,false);
END $$;
\echo Local PostgreSQL durable artwork reservation/terminal-key smoke: PASS
