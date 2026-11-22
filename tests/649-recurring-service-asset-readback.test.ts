import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readRecurringServiceAssets } from '../server/accountMetadataStore.js';

const previousUrl=process.env.SUPABASE_URL;
const previousKey=process.env.SUPABASE_PUBLISHABLE_KEY;
afterEach(()=>{
  vi.unstubAllGlobals();
  if(previousUrl===undefined)delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL=previousUrl;
  if(previousKey===undefined)delete process.env.SUPABASE_PUBLISHABLE_KEY;
  else process.env.SUPABASE_PUBLISHABLE_KEY=previousKey;
});

describe('#649 I19.04 recurring-service public asset readback',()=>{
  it('guards direct owner+AAL2 recurring asset UPDATE/DELETE without bypassing the release RPC or rewriting finance',()=>{
    const sql=readFileSync('supabase/migrations/20261122214000_guard_recurring_asset_direct_lifecycle.sql','utf8');
    const real=readFileSync('scripts/real-stack-e2e.ts','utf8');
    expect(sql).toContain('security invoker');
    expect(sql).toContain("current_user <> 'authenticated'");
    expect(sql).toContain("new.recurring_id,new.file_name");
    expect(sql).toContain('RECURRING_SERVICE_ASSET_IMMUTABLE_REGISTRATION');
    expect(sql).toContain('RECURRING_SERVICE_ASSET_REACTIVATION_FORBIDDEN');
    expect(sql).toContain('RECURRING_SERVICE_ASSET_RELEASE_REQUIRED');
    expect(sql).toContain('RECURRING_SERVICE_ASSET_IN_USE');
    for(const part of ["private.rheomiq_recurring r","{state,recurringOverrides}",
      "{state,recurringCustom}","{seed,recurring}"])expect(sql).toContain(part);
    expect(sql).toContain('before update or delete on public.rheomiq_recurring_service_assets');
    expect(sql).not.toMatch(/security definer|delete from|truncate table|drop table|drop schema/i);
    expect(real).toContain('const beforeDirectLifecycle=await upstreamJson(');
    expect(real).toContain("const deniedDirectDeactivate=await directRequest('PATCH'");
    expect(real).toContain("deniedDirectDeactivate.status===409&&deniedDirectDeactivate.body?.code==='23503'");
    expect(real).toContain("const deniedDirectRepoint=await directRequest('PATCH'");
    expect(real).toContain("deniedDirectRepoint.status===400&&deniedDirectRepoint.body?.code==='23514'");
    expect(real).toContain("method:'DELETE',headers:{");
    expect(real).toContain("deniedDirectDeleteResponse.status===400&&deniedDirectDeleteBody?.code==='23514'");
    expect(real).toContain('JSON.stringify(afterDirectLifecycle)===JSON.stringify(beforeDirectLifecycle)');
    expect(real.indexOf('const deniedDirectDeactivate=await directRequest('))
      .toBeGreaterThan(real.indexOf('const firstServiceSave=await primary.request('));
    expect(real.indexOf("const deniedDirectDeactivate=await directRequest("))
      .toBeLessThan(real.indexOf("expect(await primary.request(assetPath(serviceAssetKey)"));
    expect(real).toContain("expect(await primary.request(assetPath(serviceAssetKey),{method:'DELETE'}),200");
  });

  it.each([
    'valid','foreign-storage-key','text-bytes','fractional-bytes',
    'negative-bytes','zero-bytes','unsafe-bytes','duplicate-registration',
    'unsupported-mime','extension-mismatch',
  ] as const)('treats %s consistently with confirmed Storage and DB registration',async scenario=>{
    process.env.SUPABASE_URL='https://example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='public-test-key';
    const key='service-asset-1234567890abcdef12345678';
    const otherKey='service-asset-abcdef1234567890abcdef12';
    const asset:Record<string,unknown>={
      asset_key:key,recurring_id:'service-one',file_name:'brand.png',
      mime_type:'image/png',storage_bucket:'recurring-service-assets',
      storage_path:`services/${scenario==='foreign-storage-key'?otherKey:key}.png`,
      size_bytes:32,updated_at:'2026-11-19T15:00:00Z',active:true,
    };
    if(scenario==='text-bytes')asset.size_bytes='32';
    if(scenario==='fractional-bytes')asset.size_bytes=31.5;
    if(scenario==='negative-bytes')asset.size_bytes=-2;
    if(scenario==='zero-bytes')asset.size_bytes=0;
    if(scenario==='unsafe-bytes')asset.size_bytes=Number.MAX_SAFE_INTEGER+1;
    if(scenario==='unsupported-mime')asset.mime_type='text/html';
    if(scenario==='extension-mismatch')asset.mime_type='image/jpeg';
    const rows=scenario==='duplicate-registration'?[asset,{...asset}]:[asset];
    const observed:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input);
      observed.push((init?.method??'GET')+' '+url);
      if(!url.includes('/rheomiq_recurring_service_assets?'))throw new Error('Unexpected asset request');
      return new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json'}});
    }));
    if(scenario==='valid'){
      const result=await readRecurringServiceAssets('owner-jwt');
      expect(result).toHaveLength(1);
      expect(result[0]?.assetKey).toBe(key);
      expect(result[0]?.sizeBytes).toBe(32);
      expect(result[0]?.url).toContain(`/recurring-service-assets/services/${key}.png`);
    }else{
      await expect(readRecurringServiceAssets('owner-jwt')).rejects.toMatchObject({
        status:500,code:scenario==='duplicate-registration'
          ?'RECURRING_SERVICE_ASSET_INVALID_RESPONSE'
          :'RECURRING_SERVICE_ASSET_INVALID_ROW',
      });
    }
    expect(observed).toHaveLength(1);
    expect(observed[0]?.startsWith('GET ')).toBe(true);
  });
});
