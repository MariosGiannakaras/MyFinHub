import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFinancialProviders } from '../server/accountMetadataStore.js';

const previousUrl=process.env.SUPABASE_URL;
const previousKey=process.env.SUPABASE_PUBLISHABLE_KEY;
afterEach(()=>{
  vi.unstubAllGlobals();
  if(previousUrl===undefined)delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL=previousUrl;
  if(previousKey===undefined)delete process.env.SUPABASE_PUBLISHABLE_KEY;
  else process.env.SUPABASE_PUBLISHABLE_KEY=previousKey;
});

describe('#649 I19.04 server provider asset ownership readback',()=>{
  it.each(['foreign-primary','foreign-binding','wrong-primary-role','wrong-binding-role','valid-own-asset'] as const)(
    'handles %s through actual three-table GET without foreign image association',async scenario=>{
      process.env.SUPABASE_URL='https://example.supabase.co';
      process.env.SUPABASE_PUBLISHABLE_KEY='public-test-key';
      const ownKey='owner-a-asset-123456abcdef';
      const foreignKey='owner-b-asset-abcdef123456';
      const provider={
        id:'owner-a',display_name:'Owner A',short_name:'A',provider_kind:'bank',
        country_code:'GR',logo_asset_key:scenario==='foreign-primary'?foreignKey:ownKey,
        wordmark_asset_key:null,sort_order:10,
      };
      const assets=[['owner-a',ownKey],['owner-b',foreignKey]].map(([providerId,key])=>({
        asset_key:key,provider_id:providerId,
        asset_role:scenario==='wrong-primary-role'&&providerId==='owner-a'?'wordmark':'logo',
        variant:'universal',
        file_name:'logo.png',mime_type:'image/png',storage_bucket:'financial-provider-assets',
        storage_path:`providers/${providerId}/${key}.png`,
        size_bytes:12,updated_at:'2026-11-19T12:00:00Z',active:true,
      }));
      const bindings=scenario==='wrong-primary-role'?[]:[{
        provider_id:'owner-a',
        asset_role:scenario==='wrong-binding-role'?'wordmark':'logo',
        variant:'universal',
        asset_key:scenario==='foreign-binding'?foreignKey:ownKey,
      }];
      const observed:string[]=[];
      vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
        const url=String(input);
        observed.push((init?.method??'GET')+' '+url);
        const rows=url.includes('/rheomiq_financial_provider_assets?')?assets:
          url.includes('/rheomiq_financial_provider_asset_bindings?')?bindings:
          url.includes('/rheomiq_financial_providers?')?[provider]:null;
        if(!rows)throw new Error('Unexpected metadata request');
        return new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json'}});
      }));
      if(scenario==='valid-own-asset'){
        const result=await readFinancialProviders('owner-jwt');
        expect(result).toHaveLength(1);
        expect(result[0]?.logoUrl).toContain('/providers/owner-a/');
        expect(result[0]?.bindings?.[0]?.assetKey).toBe(ownKey);
        expect(result[0]?.assets?.map(row=>row.assetKey)).toEqual([ownKey]);
      }else{
        await expect(readFinancialProviders('owner-jwt')).rejects.toMatchObject({
          code:'FINANCIAL_PROVIDER_INVALID_RESPONSE',status:500,
        });
      }
      expect(observed).toHaveLength(3);
      expect(observed.every(call=>call.startsWith('GET '))).toBe(true);
    }
  );
  it.each([
    'cross-provider-storage-path','traversal-storage-path','same-provider-wrong-key',
    'duplicate-provider-id','duplicate-asset-key','duplicate-binding-slot',
  ] as const)('rejects %s instead of returning an ambiguous provider catalog',async scenario=>{
    process.env.SUPABASE_URL='https://example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='public-test-key';
    const key='owner-a-asset-123456abcdef';
    const provider={
      id:'owner-a',display_name:'Owner A',short_name:'A',provider_kind:'bank',
      country_code:'GR',logo_asset_key:key,wordmark_asset_key:null,sort_order:10,
    };
    const asset={
      asset_key:key,provider_id:'owner-a',asset_role:'logo',variant:'universal',
      file_name:'logo.png',mime_type:'image/png',storage_bucket:'financial-provider-assets',
      storage_path:scenario==='cross-provider-storage-path'?'providers/owner-b/other-logo.png'
        :scenario==='traversal-storage-path'?'providers/owner-a/../owner-b/other-logo.png'
          :scenario==='same-provider-wrong-key'?'providers/owner-a/owner-a-asset-abcdef123456.png'
            :`providers/owner-a/${key}.png`,
      size_bytes:12,updated_at:'2026-11-19T12:00:00Z',active:true,
    };
    const binding={provider_id:'owner-a',asset_role:'logo',variant:'universal',asset_key:key};
    const providers=scenario==='duplicate-provider-id'?[provider,{...provider}]:[provider];
    const assets=scenario==='duplicate-asset-key'?[asset,{...asset}]:[asset];
    const bindings=scenario==='duplicate-binding-slot'?[binding,{...binding}]:[binding];
    const observed:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input);
      observed.push((init?.method??'GET')+' '+url);
      const rows=url.includes('/rheomiq_financial_provider_assets?')?assets:
        url.includes('/rheomiq_financial_provider_asset_bindings?')?bindings:
          url.includes('/rheomiq_financial_providers?')?providers:null;
      if(!rows)throw new Error('Unexpected metadata request');
      return new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json'}});
    }));
    await expect(readFinancialProviders('owner-jwt')).rejects.toMatchObject({
      status:500,code:scenario==='cross-provider-storage-path'||scenario==='traversal-storage-path'||scenario==='same-provider-wrong-key'
        ?'FINANCIAL_PROVIDER_ASSET_INVALID_ROW':'FINANCIAL_PROVIDER_INVALID_RESPONSE',
    });
    expect(observed).toHaveLength(3);
    expect(observed.every(call=>call.startsWith('GET '))).toBe(true);
  });

  it.each([
    'text-size-bytes','fractional-size-bytes','negative-size-bytes',
    'unsafe-size-bytes','text-sort-order','negative-sort-order',
    'too-large-sort-order','legacy-null-size-bytes',
  ] as const)('requires explicit safe numeric provider fields for %s',async scenario=>{
    process.env.SUPABASE_URL='https://example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='public-test-key';
    const key='owner-a-asset-123456abcdef';
    const provider:Record<string,unknown>={
      id:'owner-a',display_name:'Owner A',short_name:'A',provider_kind:'bank',
      country_code:'GR',logo_asset_key:key,wordmark_asset_key:null,sort_order:10,
    };
    const asset:Record<string,unknown>={
      asset_key:key,provider_id:'owner-a',asset_role:'logo',variant:'universal',
      file_name:'logo.png',mime_type:'image/png',storage_bucket:'financial-provider-assets',
      storage_path:`providers/owner-a/${key}.png`,size_bytes:12,
      updated_at:'2026-11-19T12:00:00Z',active:true,
    };
    if(scenario==='text-size-bytes')asset.size_bytes='12';
    if(scenario==='fractional-size-bytes')asset.size_bytes=12.5;
    if(scenario==='negative-size-bytes')asset.size_bytes=-1;
    if(scenario==='unsafe-size-bytes')asset.size_bytes=Number.MAX_SAFE_INTEGER+1;
    if(scenario==='legacy-null-size-bytes')asset.size_bytes=null;
    if(scenario==='text-sort-order')provider.sort_order='10';
    if(scenario==='negative-sort-order')provider.sort_order=-1;
    if(scenario==='too-large-sort-order')provider.sort_order=100001;
    const binding={provider_id:'owner-a',asset_role:'logo',variant:'universal',asset_key:key};
    const observed:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input);
      observed.push((init?.method??'GET')+' '+url);
      const rows=url.includes('/rheomiq_financial_provider_assets?')?[asset]:
        url.includes('/rheomiq_financial_provider_asset_bindings?')?[binding]:
          url.includes('/rheomiq_financial_providers?')?[provider]:null;
      if(!rows)throw new Error('Unexpected provider readback');
      return new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json'}});
    }));
    if(scenario==='legacy-null-size-bytes'){
      const verified=await readFinancialProviders('owner-jwt');
      expect(verified).toHaveLength(1);
      expect(verified[0]?.assets?.[0]?.sizeBytes).toBeNull();
      expect(verified[0]?.logoUrl).toContain('/providers/owner-a/');
    }else{
      await expect(readFinancialProviders('owner-jwt')).rejects.toMatchObject({
        status:500,
        code:scenario.includes('sort-order')?'FINANCIAL_PROVIDER_INVALID_ROW':'FINANCIAL_PROVIDER_ASSET_INVALID_ROW',
      });
    }
    expect(observed).toHaveLength(3);
    expect(observed.every(call=>call.startsWith('GET '))).toBe(true);
  });

  it.each([
    'invalid-provider-id','blank-display','long-display','blank-short',
    'long-short','lowercase-country','bad-country-length',
    'invalid-asset-key','invalid-asset-provider-id',
    'unsupported-asset-mime','mismatched-asset-extension',
  ] as const)('rejects %s from real catalog GET rather than publishing untrusted branding',async scenario=>{
    process.env.SUPABASE_URL='https://example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='public-test-key';
    const key='owner-a-asset-123456abcdef';
    const provider:Record<string,unknown>={
      id:'owner-a',display_name:'Owner A',short_name:'A',provider_kind:'bank',
      country_code:'GR',logo_asset_key:key,wordmark_asset_key:null,sort_order:10,
    };
    const asset:Record<string,unknown>={
      asset_key:key,provider_id:'owner-a',asset_role:'logo',variant:'universal',
      file_name:'logo.png',mime_type:'image/png',storage_bucket:'financial-provider-assets',
      storage_path:`providers/owner-a/${key}.png`,size_bytes:12,
      updated_at:'2026-11-19T12:00:00Z',active:true,
    };
    if(scenario==='invalid-provider-id')provider.id='../owner-a';
    if(scenario==='blank-display')provider.display_name='   ';
    if(scenario==='long-display')provider.display_name='A'.repeat(121);
    if(scenario==='blank-short')provider.short_name=' ';
    if(scenario==='long-short')provider.short_name='A'.repeat(81);
    if(scenario==='lowercase-country')provider.country_code='gr';
    if(scenario==='bad-country-length')provider.country_code='GRC';
    if(scenario==='invalid-asset-key')asset.asset_key='../bad';
    if(scenario==='invalid-asset-provider-id')asset.provider_id='invalid/owner';
    if(scenario==='unsupported-asset-mime')asset.mime_type='text/html';
    if(scenario==='mismatched-asset-extension')asset.mime_type='image/jpeg';
    const observed:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input);
      observed.push((init?.method??'GET')+' '+url);
      const rows=url.includes('/rheomiq_financial_provider_assets?')?[asset]:
        url.includes('/rheomiq_financial_provider_asset_bindings?')?[]:
          url.includes('/rheomiq_financial_providers?')?[provider]:null;
      if(!rows)throw new Error('Unexpected provider GET');
      return new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json'}});
    }));
    const invalidAsset=scenario.startsWith('invalid-asset')||scenario==='unsupported-asset-mime'||scenario==='mismatched-asset-extension';
    await expect(readFinancialProviders('owner-jwt')).rejects.toMatchObject({
      status:500,code:invalidAsset?'FINANCIAL_PROVIDER_ASSET_INVALID_ROW':'FINANCIAL_PROVIDER_INVALID_ROW',
    });
    expect(observed).toHaveLength(3);
    expect(observed.every(call=>call.startsWith('GET '))).toBe(true);
  });

  it('still serves curated legacy provider artwork with independent safe filenames',async()=>{
    process.env.SUPABASE_URL='https://example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='public-test-key';
    const provider={
      id:'owner-a',display_name:'Owner A',short_name:'A',provider_kind:'bank',
      country_code:'GR',logo_asset_key:'curated-logo',wordmark_asset_key:null,sort_order:10,
    };
    const asset={
      asset_key:'curated-logo',provider_id:'owner-a',asset_role:'logo',variant:'universal',
      file_name:'logo.svg',mime_type:'image/svg+xml',storage_bucket:'financial-provider-assets',
      storage_path:'providers/owner-a/curated-mark.svg',
      size_bytes:null,updated_at:'2026-11-19T12:00:00Z',active:true,
    };
    const methods:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input);methods.push(String(init?.method??'GET'));
      const rows=url.includes('/rheomiq_financial_provider_assets?')?[asset]:
        url.includes('/rheomiq_financial_provider_asset_bindings?')?[]:
          url.includes('/rheomiq_financial_providers?')?[provider]:null;
      if(!rows)throw new Error('Unexpected GET');
      return new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json'}});
    }));
    const rows=await readFinancialProviders('owner-jwt');
    expect(rows[0]?.logoUrl).toContain('/providers/owner-a/curated-mark.svg');
    expect(rows[0]?.assets?.[0]?.sizeBytes).toBeNull();
    expect(methods).toEqual(['GET','GET','GET']);
  });

});
