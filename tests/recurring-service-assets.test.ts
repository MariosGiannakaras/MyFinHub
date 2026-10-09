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
    expect(ledger).toContain('const releasePending=["20261008165700_add_recurring_service_assets.sql"] as const;');
    const appliedBlock=ledger.slice(ledger.indexOf('const productionApplied=['),ledger.indexOf('const releasePending='));
    expect(appliedBlock).not.toContain('20261008165700_add_recurring_service_assets.sql');
  });

  it('cleans up Storage when recurring-service metadata registration fails',async()=>{
    process.env.SUPABASE_URL='https://project.example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
    const calls:Array<{url:string;method:string}>=[];
    const fetchMock=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input);const method=String(init?.method||'GET');calls.push({url,method});
      if(calls.length===1)return new Response('{}',{status:200,headers:{'content-type':'application/json'}});
      if(calls.length===2)return new Response(JSON.stringify({message:'temporary registration failure'}),{status:503,headers:{'content-type':'application/json'}});
      if(calls.length===3)return new Response('{}',{status:200,headers:{'content-type':'application/json'}});
      throw new Error('unexpected recurring service asset request');
    });
    vi.stubGlobal('fetch',fetchMock);

    const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>');
    await expect(uploadRecurringServiceAsset({
      recurringId:'rec-netflix',mimeType:'image/svg+xml',fileName:'netflix.svg',content:svg,
    },'access-token')).rejects.toMatchObject({status:503,code:'ACCOUNT_METADATA_UNAVAILABLE'});

    expect(calls).toHaveLength(3);
    expect(calls[0]).toMatchObject({method:'POST'});
    expect(calls[0].url).toContain('/storage/v1/object/recurring-service-assets/services/service-asset-');
    expect(calls[1].url).toContain('/rest/v1/rpc/rheomiq_register_recurring_service_asset');
    expect(calls[2]).toMatchObject({method:'DELETE'});
    expect(calls[2].url).toBe(calls[0].url);
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
