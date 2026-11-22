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


  it('reconciles recurring Storage lost 503 only after exact binary readback before registration',async()=>{
    process.env.SUPABASE_URL='https://example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='public-test-key';
    const {uploadRecurringServiceAsset}=await import('../server/accountMetadataStore.js');
    const bytes=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0]);
    const calls:Array<{url:string;method:string}>=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input),method=init?.method||'GET';
      calls.push({url,method});
      if(calls.length===1)return new Response('{}',{status:503});
      if(calls.length===2){
        expect(method).toBe('GET');
        expect(url).toContain('/storage/v1/object/public/recurring-service-assets/services/');
        return new Response(bytes,{status:200});
      }
      if(calls.length===3){
        const path=new URL(calls[0].url).pathname.split('/recurring-service-assets/')[1];
        const key=path.slice('services/'.length).replace(/\.png$/,'');
        return new Response(JSON.stringify([{asset_key:key,recurring_id:'service-one',file_name:'brand.png',
          mime_type:'image/png',storage_bucket:'recurring-service-assets',storage_path:path,
          size_bytes:bytes.byteLength,updated_at:'2026-11-22T20:00:00Z',active:true}]),{status:200});
      }
      throw new Error('Recurring upload may not replay POST or delete after 503');
    }));
    const value=await uploadRecurringServiceAsset({recurringId:'service-one',mimeType:'image/png',
      fileName:'brand.png',content:bytes},'owner-aal2-token');
    expect(value.assetKey).toMatch(/^service-asset-[a-f0-9]{24}$/);
    expect(calls.map(x=>x.method)).toEqual(['POST','GET','POST']);
    expect(calls[2].url).toContain('/rpc/rheomiq_register_recurring_service_asset');
  });

  it('fails closed without registration or deletion if recurring lost-upload byte proof differs',async()=>{
    process.env.SUPABASE_URL='https://example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='public-test-key';
    const {uploadRecurringServiceAsset}=await import('../server/accountMetadataStore.js');
    const bytes=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0]);
    const methods:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(_input:RequestInfo|URL,init?:RequestInit)=>{
      methods.push(init?.method||'GET');
      if(methods.length===1)throw new Error('network response lost');
      if(methods.length===2)return new Response(Buffer.from([...bytes.slice(0,-1),42]),{status:200});
      throw new Error('Recurring asset must not be registered or deleted after unverified bytes');
    }));
    const log=vi.spyOn(console,'error').mockImplementation(()=>{});
    try{
      await expect(uploadRecurringServiceAsset({recurringId:'service-one',mimeType:'image/png',
        fileName:'brand.png',content:bytes},'owner-aal2-token'))
        .rejects.toMatchObject({status:503,code:'RECURRING_SERVICE_ASSET_UPLOAD_UNVERIFIED'});
      expect(methods).toEqual(['POST','GET']);
    }finally{log.mockRestore()}
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
