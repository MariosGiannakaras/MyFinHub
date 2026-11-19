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
});
