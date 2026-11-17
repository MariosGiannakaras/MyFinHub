import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { ApiError } from '../server/http.js';
import { parseRecurringServiceAssetKey, parseRecurringServiceAssetUpload, validateProviderAssetContent } from '../server/accountMetadataHandler.js';
import { deleteRecurringServiceAsset, uploadRecurringServiceAsset } from '../server/accountMetadataStore.js';

const migration=readFileSync('supabase/migrations/20261008165700_add_recurring_service_assets.sql','utf8');
const types=readFileSync('src/types.ts','utf8');
const validation=readFileSync('server/validation.ts','utf8');
const handler=readFileSync('server/accountMetadataHandler.ts','utf8');
const store=readFileSync('server/accountMetadataStore.ts','utf8');
const ledger=readFileSync('tests/production-migration-ledger-source.test.ts','utf8');
const storageReadMigration=readFileSync('supabase/migrations/20261009190000_allow_recurring_service_asset_storage_owner_read.sql','utf8');
const recurringPage=readFileSync('src/pages/RecurringPage.tsx','utf8');
const financeHook=readFileSync('src/hooks/useFinance.ts','utf8');
const app=readFileSync('src/App.tsx','utf8');
const recurringRendered=readFileSync('scripts/recurring-service-brand-qa.mjs','utf8');
const qaFixture=readFileSync('src/qa.tsx','utf8');

afterEach(()=>{
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
});

describe('recurring service asset foundation',()=>{
  it('adds only a stable optional reference to the recurring finance contract',()=>{
    expect(types).toContain('logoAssetKey?: string | null;');
    expect(validation).toContain('value.logoAssetKey');
    expect(validation).toContain('/^service-asset-[a-f0-9]{24}$/');
    expect(validation).not.toContain('/^[a-z][a-z0-9-]{0,95}$/');
    expect(types).not.toContain('logoData');
    expect(types).not.toContain('base64');
  });

  it('requires durable finance acceptance before logo cleanup and reports cleanup distinctly',()=>{
    expect(financeHook).toContain('coordinator.enqueueWithReceipt(mutation)');
    expect(financeHook).toContain('updateDurably');
    expect(app).toContain('finance.updateDurably(current=>withRecurring(current,item))');
    expect(recurringPage).toContain('await onUpsertDurably(normalized)');
    expect(recurringPage).toContain('if(uploaded&&!persisted)');
    expect(recurringPage).toContain('oldKeyStillShared');
    expect(recurringPage).toContain('if(oldKey&&oldKey!==normalized.logoAssetKey&&!oldKeyStillShared)');
    expect(recurringPage).not.toContain('onUpsert(normalized)');
    expect(recurringRendered).toContain('failed finance write retains old logo reference and deletes only newly uploaded asset');
    expect(qaFixture).toContain("logoAssetKey:'service-asset-cccccccccccccccccccccccc'");
    expect(recurringRendered).toContain("recurringId:'qa-service-paused'");
    expect(recurringRendered).toContain('current.writes===1&&current.deletes===2');
  });

  it('uses a separate owner+AAL2 Storage and metadata domain instead of financial providers',()=>{
    expect(migration).toContain("'recurring-service-assets'");
    expect(migration).toContain('public.rheomiq_recurring_service_assets');
    expect(migration).toContain('rheomiq_is_owner_aal2()');
    expect(migration).toContain("bucket_id='recurring-service-assets'");
    expect(migration).toContain('service-asset-[a-f0-9]{24}');
    expect(migration).not.toContain('rheomiq_financial_providers');
    expect(migration).not.toContain('financial-provider-assets');
  });

  it('syncs the relational recurring reference from payload without replacing the ledger/history RPC',()=>{
    expect(migration).toContain('alter table private.rheomiq_recurring');
    expect(migration).toContain('logo_asset_key text');
    expect(migration).toContain('rheomiq_recurring_logo_asset_fk');
    expect(migration).toContain("new.payload->>'logoAssetKey'");
    expect(migration).toContain('rheomiq_sync_recurring_logo_asset');
    expect(migration).not.toContain('create or replace function private.rheomiq_ledger_apply_state');
  });

  it('keeps asset release reference-aware across relational custom items and seeded overrides',()=>{
    expect(migration).toContain('rheomiq_release_recurring_service_asset');
    expect(migration).toContain('r.logo_asset_key=p_asset_key');
    expect(migration).toContain("'{state,recurringOverrides}'");
    expect(migration).toContain('RECURRING_SERVICE_ASSET_IN_USE');
    expect(migration).toContain('rheomiq_purge_recurring_service_asset');
  });

  it('reuses the existing bounded signature and active-SVG validation at the API boundary',()=>{
    expect(parseRecurringServiceAssetUpload({query:{recurringId:'rec-netflix',fileName:'netflix.svg'},headers:{'content-type':'image/svg+xml'}}))
      .toEqual({recurringId:'rec-netflix',mimeType:'image/svg+xml',fileName:'netflix.svg'});
    expect(()=>parseRecurringServiceAssetUpload({query:{recurringId:'',fileName:'x.png'},headers:{'content-type':'image/png'}})).toThrow(ApiError);
    expect(()=>parseRecurringServiceAssetUpload({query:{recurringId:'rec',fileName:'x.pdf'},headers:{'content-type':'application/pdf'}})).toThrow(ApiError);
    expect(parseRecurringServiceAssetKey({query:{assetKey:'service-asset-1234567890abcdef12345678'}})).toBe('service-asset-1234567890abcdef12345678');
    expect(()=>parseRecurringServiceAssetKey({query:{assetKey:'../escape'}})).toThrow(ApiError);
    expect(()=>parseRecurringServiceAssetKey({query:{assetKey:'unrelated-provider-key'}})).toThrow(ApiError);
    expect(()=>parseRecurringServiceAssetKey({query:{assetKey:'service-asset-1234'}})).toThrow(ApiError);
    expect(()=>parseRecurringServiceAssetKey({query:{assetKey:'service-asset-1234567890ABCDEF12345678'}})).toThrow(ApiError);
    expect(()=>validateProviderAssetContent('image/svg+xml',Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>'))).not.toThrow();
    expect(()=>validateProviderAssetContent('image/svg+xml',Buffer.from('<svg><script>alert(1)</script></svg>'))).toThrow(ApiError);
  });

  it('exposes a dedicated account-metadata resource without provider-registry coupling',()=>{
    expect(handler).toContain("resource==='recurring-service-assets'");
    expect(handler).toContain('MAX_RECURRING_SERVICE_ASSET_BYTES');
    expect(store).toContain("const RECURRING_SERVICE_ASSET_BUCKET='recurring-service-assets'");
    expect(store).toContain('rheomiq_register_recurring_service_asset');
  });

  it('tracks the new migration as release-pending rather than production-applied history',()=>{
    expect(ledger).toContain('"20261008165700_add_recurring_service_assets.sql"');
    expect(ledger).toContain('"20261009190000_allow_recurring_service_asset_storage_owner_read.sql"');
    expect(storageReadMigration).toContain('rheomiq_recurring_service_storage_owner_aal2_select');
    expect(storageReadMigration).toContain('for select to authenticated');
    expect(storageReadMigration).toContain("bucket_id='recurring-service-assets'");
    expect(storageReadMigration).toContain('owner_id=(select auth.uid())::text');
    expect(storageReadMigration).toContain('(select public.rheomiq_is_owner_aal2())');
    expect(storageReadMigration).not.toMatch(/for\s+select\s+to\s+anon\b/i);
    const appliedBlock=ledger.slice(ledger.indexOf('const productionApplied=['),ledger.indexOf('const releasePending='));
    expect(appliedBlock).not.toContain('20261008165700_add_recurring_service_assets.sql');
  });

  const uploadInput=()=>{
    const bytes=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>');
    return {recurringId:'rec-netflix',mimeType:'image/svg+xml',fileName:'netflix.svg',content:bytes};
  };
  const recurringAssetRow=(requestBody:Record<string,unknown>)=>({
    asset_key:requestBody.p_asset_key,recurring_id:requestBody.p_recurring_id,
    file_name:requestBody.p_file_name,mime_type:requestBody.p_mime_type,
    storage_bucket:'recurring-service-assets',storage_path:requestBody.p_storage_path,
    size_bytes:requestBody.p_size_bytes,updated_at:'2026-11-17T12:00:00.000Z',active:true,
  });

  it('reconciles a committed recurring logo registration despite a 503 without deleting its Storage object',async()=>{
    process.env.SUPABASE_URL='https://project.example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
    const calls:Array<{url:string;method:string}>=[];
    let body:Record<string,unknown>={};
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input),method=String(init?.method||'GET');calls.push({url,method});
      if(calls.length===1)return new Response('{}',{status:200});
      if(calls.length===2){
        body=JSON.parse(String(init?.body)) as Record<string,unknown>;
        return new Response(JSON.stringify({message:'COMMIT accepted, reply lost'}),{status:503});
      }
      if(calls.length===3)return new Response(JSON.stringify([recurringAssetRow(body)]),{status:200});
      throw new Error('No repeated Storage upload or destructive cleanup after a committed logo');
    }));
    const result=await uploadRecurringServiceAsset(uploadInput(),'access-token');
    expect(result.assetKey).toBe(body.p_asset_key);
    expect(result.recurringId).toBe('rec-netflix');
    expect(result.url).toContain('recurring-service-assets/services/');
    expect(calls.map(item=>item.method)).toEqual(['POST','POST','GET']);
    expect(calls[2].url).toContain('/rest/v1/rheomiq_recurring_service_assets?select=');
    expect(calls[2].url).toContain('asset_key=eq.'+body.p_asset_key);
  });

  it('never deletes a recurring logo after an ambiguous registration 503 and an initially empty read-back',async()=>{
    process.env.SUPABASE_URL='https://project.example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
    const calls:Array<{url:string;method:string}>=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input),method=String(init?.method||'GET');calls.push({url,method});
      if(calls.length===1)return new Response('{}',{status:200});
      if(calls.length===2)return new Response(JSON.stringify({message:'Registration status uncertain'}),{status:503});
      if(calls.length===3)return new Response('[]',{status:200});
      throw new Error('An empty read during a late COMMIT is not permission to delete Storage');
    }));
    await expect(uploadRecurringServiceAsset(uploadInput(),'access-token'))
      .rejects.toMatchObject({status:503,code:'RECURRING_SERVICE_ASSET_REGISTRATION_UNVERIFIED'});
    expect(calls.map(item=>item.method)).toEqual(['POST','POST','GET']);
  });

  it('fails closed without Storage deletion when recurring registration read-back cannot be trusted',async()=>{
    process.env.SUPABASE_URL='https://project.example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
    const calls:Array<{url:string;method:string}>=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input),method=String(init?.method||'GET');calls.push({url,method});
      if(calls.length===1)return new Response('{}',{status:200});
      if(calls.length===2)return new Response(JSON.stringify({message:'RPC failed'}),{status:503});
      if(calls.length===3)return new Response('{}',{status:503});
      throw new Error('Unverified registry does not authorize Storage deletion');
    }));
    await expect(uploadRecurringServiceAsset(uploadInput(),'access-token'))
      .rejects.toMatchObject({status:503,code:'RECURRING_SERVICE_ASSET_REGISTRATION_UNVERIFIED'});
    expect(calls.map(item=>item.method)).toEqual(['POST','POST','GET']);
  });

  it('rejects mismatched committed recurring metadata without deleting a possibly referenced object',async()=>{
    process.env.SUPABASE_URL='https://project.example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
    const calls:string[]=[];
    let body:Record<string,unknown>={};
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const method=String(init?.method||'GET');calls.push(method);
      if(calls.length===1)return new Response('{}',{status:200});
      if(calls.length===2){body=JSON.parse(String(init?.body)) as Record<string,unknown>;return new Response('{}',{status:503})}
      if(calls.length===3)return new Response(JSON.stringify([{...recurringAssetRow(body),recurring_id:'different-recurring'}]),{status:200});
      throw new Error('Do not delete foreign or mismatched recurring asset');
    }));
    await expect(uploadRecurringServiceAsset(uploadInput(),'access-token'))
      .rejects.toMatchObject({status:503,code:'RECURRING_SERVICE_ASSET_REGISTRATION_UNVERIFIED'});
    expect(calls).toEqual(['POST','POST','GET']);
  });

  it('cleans up only a newly uploaded unregistered object after definite validation rejection and confirmed absence',async()=>{
    process.env.SUPABASE_URL='https://project.example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
    const calls:Array<{url:string;method:string}>=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input),method=String(init?.method||'GET');calls.push({url,method});
      if(calls.length===1)return new Response('{}',{status:200});
      if(calls.length===2)return new Response(JSON.stringify({code:'22023',message:'INVALID_RECURRING_SERVICE_ASSET'}),{status:400});
      if(calls.length===3)return new Response('[]',{status:200});
      if(calls.length===4)return new Response('{}',{status:200});
      throw new Error('Only verified unregistered asset may be cleaned up');
    }));
    await expect(uploadRecurringServiceAsset(uploadInput(),'access-token'))
      .rejects.toMatchObject({status:400,code:'INVALID_RECURRING_SERVICE_ASSET'});
    expect(calls.map(item=>item.method)).toEqual(['POST','POST','GET','DELETE']);
    expect(calls[3].url).toBe(calls[0].url);
  });

  it('stops recurring cleanup after two failures and preserves a truthful pending-recovery error',async()=>{
    process.env.SUPABASE_URL='https://project.example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
    const calls:Array<{url:string;method:string}>=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input),method=String(init?.method||'GET');calls.push({url,method});
      if(calls.length===1)return new Response('{}',{status:200});
      if(calls.length===2)return new Response(JSON.stringify({code:'22023',message:'INVALID_RECURRING_SERVICE_ASSET'}),{status:400});
      if(calls.length===3)return new Response('[]',{status:200});
      if(calls.length===4||calls.length===5)return new Response('{}',{status:503});
      throw new Error('No third destructive cleanup attempt');
    }));
    await expect(uploadRecurringServiceAsset(uploadInput(),'access-token'))
      .rejects.toMatchObject({status:503,code:'RECURRING_SERVICE_ASSET_CLEANUP_PENDING'});
    expect(calls.map(item=>item.method)).toEqual(['POST','POST','GET','DELETE','DELETE']);
    expect(calls[3].url).toBe(calls[0].url);
    expect(calls[4].url).toBe(calls[0].url);
  });

  it.each([
    ['different asset key','services/service-asset-aaaaaaaaaaaaaaaaaaaaaaaa.svg'],
    ['unsafe relative path','services/../outside.svg'],
    ['unrelated nested path','services/other/service-asset-1234567890abcdef12345678.svg'],
  ])('never deletes Storage after a release response with %s',async(_label,badPath)=>{
    process.env.SUPABASE_URL='https://project.example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
    const requests:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      requests.push((init?.method||'GET')+' '+String(input));
      if(requests.length===1)return new Response(JSON.stringify([{
        storage_bucket:'recurring-service-assets',storage_path:badPath,
      }]),{status:200});
      throw new Error('Unverified release path must never authorize Storage deletion');
    }));
    await expect(deleteRecurringServiceAsset('service-asset-1234567890abcdef12345678','access-token'))
      .rejects.toMatchObject({status:500,code:'RECURRING_SERVICE_ASSET_INVALID_RESPONSE'});
    expect(requests).toHaveLength(1);
    expect(requests[0]).toContain('rpc/rheomiq_release_recurring_service_asset');
  });

  it('rejects an ambiguous multi-row release receipt before deleting a recurring asset',async()=>{
    process.env.SUPABASE_URL='https://project.example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
    const path='services/service-asset-1234567890abcdef12345678.svg';
    const calls:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      calls.push((init?.method||'GET')+' '+String(input));
      if(calls.length===1)return new Response(JSON.stringify([
        {storage_bucket:'recurring-service-assets',storage_path:path},
        {storage_bucket:'recurring-service-assets',storage_path:path},
      ]),{status:200});
      throw new Error('Duplicate release records must not authorize deletion');
    }));
    await expect(deleteRecurringServiceAsset('service-asset-1234567890abcdef12345678','access-token'))
      .rejects.toMatchObject({status:500,code:'RECURRING_SERVICE_ASSET_INVALID_RESPONSE'});
    expect(calls).toHaveLength(1);
  });

  it('can retry a partially released recurring asset without purging before Storage confirms deletion',async()=>{
    process.env.SUPABASE_URL='https://project.example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
    const key='service-asset-1234567890abcdef12345678';
    const path='services/'+key+'.svg';
    const calls:Array<{method:string;url:string}>=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input),method=String(init?.method||'GET');calls.push({url,method});
      if(calls.length===1||calls.length===3)return new Response(JSON.stringify([
        {storage_bucket:'recurring-service-assets',storage_path:path},
      ]),{status:200});
      if(calls.length===2)return new Response('{}',{status:503});
      if(calls.length===4)return new Response('{}',{status:404});
      if(calls.length===5)return new Response('null',{status:200});
      throw new Error('No speculative extra delete or purge');
    }));
    await expect(deleteRecurringServiceAsset(key,'access-token')).rejects.toMatchObject({
      status:503,code:'RECURRING_SERVICE_ASSET_STORAGE_UNAVAILABLE',
    });
    expect(calls.map(x=>x.method)).toEqual(['POST','DELETE']);
    await expect(deleteRecurringServiceAsset(key,'access-token')).resolves.toBeUndefined();
    expect(calls.map(x=>x.method)).toEqual(['POST','DELETE','POST','DELETE','POST']);
    expect(calls[1].url).toBe(calls[3].url);
    expect(calls[4].url).toContain('rpc/rheomiq_purge_recurring_service_asset');
  });

  it('releases metadata before Storage deletion and purges only after Storage succeeds',async()=>{
    process.env.SUPABASE_URL='https://project.example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
    const calls:Array<{url:string;method:string}>=[];
    const path='services/service-asset-1234567890abcdef12345678.svg';
    const fetchMock=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input);const method=String(init?.method||'GET');calls.push({url,method});
      if(calls.length===1)return new Response(JSON.stringify([{storage_bucket:'recurring-service-assets',storage_path:path}]),{status:200,headers:{'content-type':'application/json'}});
      if(calls.length===2)return new Response('{}',{status:200,headers:{'content-type':'application/json'}});
      if(calls.length===3)return new Response('null',{status:200,headers:{'content-type':'application/json'}});
      throw new Error('unexpected recurring service asset delete request');
    });
    vi.stubGlobal('fetch',fetchMock);

    await deleteRecurringServiceAsset('service-asset-1234567890abcdef12345678','access-token');
    expect(calls.map(call=>call.method)).toEqual(['POST','DELETE','POST']);
    expect(calls[0].url).toContain('/rest/v1/rpc/rheomiq_release_recurring_service_asset');
    expect(calls[1].url).toContain('/storage/v1/object/recurring-service-assets/'+path);
    expect(calls[2].url).toContain('/rest/v1/rpc/rheomiq_purge_recurring_service_asset');
  });
});
