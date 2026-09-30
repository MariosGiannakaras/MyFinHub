-- Align the provider asset registry with the exact canonical PNG files bundled by MyFinHub.
-- The binary payloads below come from the repository .b64 companions and are hash-verified
-- before any row is updated. No asset is synthesized or fetched from a third party.

do $$
declare
  v_payzy bytea := decode('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','base64');
  v_viva bytea := decode('iVBORw0KGgoAAAANSUhEUgAAARsAAAAqCAYAAACDfP+dAAADYklEQVR42u1c27LjIAyLmPz/L3tfz3a2Zwn4IhNppi+dJNjGUm1KgJldG/h5M644ZI0jCEIQbgfyZ8MkOoLQD2OB6JYsQLZgiyAITSsbZlKr0hGEA8TGFojvSXpbvFbCIwgNxOaE1qRLtfMZa4nk+fjGL2xeS4/x4ZgFBrPiOczrOnao0AvC18pmJcFRSI6VsdkqHYmK8DqMBaJjopyzBDJCbYcg9KpsMEFuFlJjo9KRMAlCTFU+xa0xQVAsktgcnVmpupgh4RNOF6CvYhPVDmUTtNNaCCRCwiGYytvbcbBv/66gSzBklyDEYQS2Q57lmEgpCIe0UeWGSKhok8i6JvdLYsHgg2sbNdMOYdMRZrF42g7OXL/i78p+oRXbf/sOTvO10mKbw/2MscgW5Sev9tjGOH+NcTsLhmdiVQuV514hBPk3e9+MLZYQF9vIi901QbZYsFR+GRte7bouDGcHQCQW3pNlCffOlr1W5FtV62OJzz2hVaJsTccBaxwnr9WAXAROGF9Ck+T/SCTI00O30HAyOxCnKq5oTMI3CE047l8Sg3nfTDShvNeuEOR79FoQCBLaAmOBZrHwzD8LzKt/jn8HOjcjVvq7Okb4LCA5f37vTTS7+m28rDz54Ml8YzOvZkR2+90o9lcYqoTKyOPi9UseUamBNE9ObbOy3mss39T3P0es+URlPidT+Du0yUyxUBXutKmvYu3mtBcu31LxebfY2WL1plwowUhIrMwgoMh+rT1x/JJaUZ4ITmLz1hL+NIKpQhOOrmwikkNJ2D82GcKpPCHD/SA5ovts5r8+f/M9M6m77H/KWGt4Syw6cGoq5qOZ0/q14iC6FeUEDo1Fpf2UbRTIEo+57GfdTzJroxUmsCkW6XljGfN5NwuKqpq4Y0DYiQTFYiknvh0hsXPcx4ooY7xkMtSzcwo1FIs0/+zjk87jQZIcq29Tg5AYaEbS00n2plhkcHH5zKqRZKQqH24SgtxOvCQWDGIZNh+jyKEngsS0VsNUiqPweWx+viUWs/aA0G/AzDyF4dMI23TYSCfZHOwxJ58sIC478+u5yIjGsYDDvEflmWeMpp+/KjbVrZF6a0FohlFEeImFIEhs0qqSTgcwCYJQLDbYvB7B4wmCQAKPHcSzZ7HunOUqkRGE5vgDYlwPZD1CbOMAAAAASUVORK5CYII=','base64');
  v_updated integer;
begin
  if encode(digest(v_payzy,'sha256'),'hex') <> '0a22f6d45422e0086b018c5bbe8f6d6c1cfbd6f80ffd014dda699c8cdb2e74f1' then
    raise exception 'PROVIDER_ASSET_HASH_MISMATCH: payzy';
  end if;
  if encode(digest(v_viva,'sha256'),'hex') <> 'c7aed8524a3d980dded8cb121371397208b13cf9bb21b362d176550fd10aea8e' then
    raise exception 'PROVIDER_ASSET_HASH_MISMATCH: viva';
  end if;

  update public.rheomiq_financial_provider_assets
     set file_name='payzy-logo-color.png',
         mime_type='image/png',
         content=v_payzy,
         sha256='0a22f6d45422e0086b018c5bbe8f6d6c1cfbd6f80ffd014dda699c8cdb2e74f1',
         width=127,
         height=54,
         source='repository-canonical',
         updated_at=now()
   where asset_key='payzy-logo-color'
     and provider_id='payzy'
     and asset_role='logo'
     and octet_length(content)=0;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'PROVIDER_ASSET_BACKFILL_TARGET_MISMATCH: payzy updated % rows',v_updated;
  end if;

  update public.rheomiq_financial_provider_assets
     set file_name='viva-logo-navy-on-white.png',
         mime_type='image/png',
         content=v_viva,
         sha256='c7aed8524a3d980dded8cb121371397208b13cf9bb21b362d176550fd10aea8e',
         width=283,
         height=42,
         source='repository-canonical',
         updated_at=now()
   where asset_key='viva-logo-navy-on-white'
     and provider_id='viva'
     and asset_role='logo'
     and octet_length(content)=0;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'PROVIDER_ASSET_BACKFILL_TARGET_MISMATCH: viva updated % rows',v_updated;
  end if;
end $$;
