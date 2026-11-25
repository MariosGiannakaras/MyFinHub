-- Reused for owner AAL1, nonowner AAL2 and revoked owner AAL2.
DO $$
DECLARE affected integer;
BEGIN
  if (select count(*) from public.rheomiq_artwork_upload_intents)<>0 then
    raise exception 'Unauthorized session read artwork intents';
  end if;
  begin
    insert into public.rheomiq_artwork_upload_intents
      (intent_id,kind,target_id,asset_key,file_name,mime_type,size_bytes,sha256)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','recurring','qa-denied',
      'service-asset-000000000000000000000099','denied.png','image/png',8,repeat('a',64));
    raise exception 'Unauthorized session reserved artwork intent';
  exception when insufficient_privilege then null;
  end;
  update public.rheomiq_artwork_upload_intents set disposition='abandoned'
    where intent_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Unauthorized session closed artwork intent'; end if;
  begin
    delete from public.rheomiq_artwork_upload_intents
      where intent_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
    raise exception 'Unauthorized session deleted artwork intent';
  exception when insufficient_privilege then null;
  end;
END $$;
\echo Local PostgreSQL durable artwork reservation authorization denial: PASS
