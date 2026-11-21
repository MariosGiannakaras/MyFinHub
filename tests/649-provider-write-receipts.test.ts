import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  writeFinancialProvider, updateFinancialProvider, setFinancialProviderAssetBinding,
} from '../server/accountMetadataStore.js';

const oldUrl=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_PUBLISHABLE_KEY;
afterEach(()=>{
  vi.unstubAllGlobals();
  if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;
  if(oldKey===undefined)delete process.env.SUPABASE_PUBLISHABLE_KEY;else process.env.SUPABASE_PUBLISHABLE_KEY=oldKey;
});
function config(){
  process.env.SUPABASE_URL='https://example.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY='test-public-key';
}
const input=()=>({
  id:'owner-bank',displayName:'Owner Bank',shortName:'Owner',
  providerKind:'bank' as const,countryCode:'GR',sortOrder:42,
});
const row=()=>({
  id:'owner-bank',display_name:'Owner Bank',short_name:'Owner',
  provider_kind:'bank',country_code:'GR',sort_order:42,
  logo_asset_key:null,wordmark_asset_key:null,
});
describe('#649 I19.04 exact provider write and binding receipts',()=>{
  it.each([
    'valid-create','valid-update','empty-receipt','duplicate-receipt',
    'wrong-id','wrong-display','wrong-short','wrong-kind','wrong-country',
    'wrong-order','malformed-row',
  ] as const)('does not accept a false-green provider RPC for %s',async scenario=>{
    config();
    const receipt:Record<string,unknown>={...row()};
    if(scenario==='wrong-id')receipt.id='other-bank';
    if(scenario==='wrong-display')receipt.display_name='Other Bank';
    if(scenario==='wrong-short')receipt.short_name='Wrong';
    if(scenario==='wrong-kind')receipt.provider_kind='wallet';
    if(scenario==='wrong-country')receipt.country_code='US';
    if(scenario==='wrong-order')receipt.sort_order=43;
    if(scenario==='malformed-row')receipt.sort_order='42';
    const data=scenario==='empty-receipt'?[]:scenario==='duplicate-receipt'?[receipt,{...receipt}]:[receipt];
    const calls:Array<{url:string;method:string;body:string}>=[];
    vi.stubGlobal('fetch',vi.fn(async(request:RequestInfo|URL,init?:RequestInit)=>{
      calls.push({url:String(request),method:String(init?.method??'GET'),body:String(init?.body??'')});
      return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
    }));
    const act=scenario==='valid-update'?updateFinancialProvider:writeFinancialProvider;
    if(scenario.startsWith('valid')){
      await expect(act(input(),'owner-jwt')).resolves.toMatchObject({
        id:'owner-bank',displayName:'Owner Bank',shortName:'Owner',providerKind:'bank',
        countryCode:'GR',sortOrder:42,
      });
    }else{
      await expect(act(input(),'owner-jwt')).rejects.toMatchObject({
        status:scenario==='malformed-row'?500:503,
        code:scenario==='malformed-row'?'FINANCIAL_PROVIDER_INVALID_ROW':'FINANCIAL_PROVIDER_WRITE_UNVERIFIED',
      });
    }
    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url).toContain('/rpc/rheomiq_'+(scenario==='valid-update'?'update':'create')+'_financial_provider');
    expect(JSON.parse(calls[0]?.body??'{}')).toMatchObject({
      p_id:'owner-bank',p_display_name:'Owner Bank',p_short_name:'Owner',
      p_provider_kind:'bank',p_country_code:'GR',p_sort_order:42,
    });
  });

  it.each([
    'valid-assign','valid-clear','missing-assignment','stale-key',
    'extra-row','unexpected-clear-row','malformed-response','readback-unavailable',
  ] as const)('verifies idempotent provider image binding for %s with one GET after RPC',async scenario=>{
    config();
    const key='owner-bank-asset-aabbccddeeff';
    const binding={provider_id:'owner-bank',asset_role:'logo',variant:'light',asset_key:key};
    const clear=scenario==='valid-clear'||scenario==='unexpected-clear-row';
    const rows=scenario==='valid-assign'||scenario==='unexpected-clear-row'?[binding]:
      scenario==='extra-row'?[binding,{...binding}]:
        scenario==='stale-key'?[{...binding,asset_key:'old-key'}]:
          scenario==='malformed-response'?{}:scenario==='readback-unavailable'?
            []:[];
    const calls:Array<{url:string;method:string;body:string}>=[];
    vi.stubGlobal('fetch',vi.fn(async(request:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(request),method=String(init?.method??'GET');
      calls.push({url,method,body:String(init?.body??'')});
      if(url.includes('/rpc/rheomiq_set_financial_provider_asset_binding'))
        return new Response('null',{status:200,headers:{'content-type':'application/json'}});
      if(!url.includes('/rheomiq_financial_provider_asset_bindings?'))
        throw new Error('Unexpected binding request');
      if(scenario==='readback-unavailable')
        return new Response('{}',{status:503,headers:{'content-type':'application/json'}});
      return new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json'}});
    }));
    const call=setFinancialProviderAssetBinding({
      providerId:'owner-bank',role:'logo',variant:'light',assetKey:clear?null:key,
    },'owner-jwt');
    if(scenario==='valid-assign'||scenario==='valid-clear')
      await expect(call).resolves.toBeUndefined();
    else
      await expect(call).rejects.toMatchObject({
        status:503,code:scenario==='readback-unavailable'
          ?'ACCOUNT_METADATA_UNAVAILABLE':'FINANCIAL_PROVIDER_BINDING_UNVERIFIED',
      });
    expect(calls.map(x=>x.method)).toEqual(['POST','GET']);
    expect(calls[1]?.url).toContain('provider_id=eq.owner-bank');
    expect(calls[1]?.url).toContain('asset_role=eq.logo');
    expect(calls[1]?.url).toContain('variant=eq.light');
    expect(JSON.parse(calls[0]?.body??'{}')).toMatchObject({
      p_provider_id:'owner-bank',p_asset_role:'logo',p_variant:'light',p_asset_key:clear?null:key,
    });
  });

  it.each([
    'lost-503-assignment','lost-network-clear','missing-assignment',
    'stale-binding','malformed-readback','readback-unavailable',
    'revoked-owner','owner-check-unavailable','definite-forbidden',
  ] as const)('reconciles an uncertain provider binding $scenario without replaying its RPC',async scenario=>{
    config();
    const key='owner-bank-asset-aabbccddeeff';
    const clear=scenario==='lost-network-clear'||scenario==='stale-binding';
    const binding={provider_id:'owner-bank',asset_role:'logo',variant:'light',asset_key:key};
    const calls:Array<{url:string;method:string;body:string}>=[];
    vi.stubGlobal('fetch',vi.fn(async(req:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(req),method=String(init?.method??'GET');
      calls.push({url,method,body:String(init?.body??'')});
      if(url.includes('/rpc/rheomiq_set_financial_provider_asset_binding')){
        if(scenario==='lost-network-clear')throw new TypeError('Synthetic lost postcommit acknowledgement');
        if(scenario==='definite-forbidden')
          return new Response(JSON.stringify({code:'42501',message:'FORBIDDEN'}),{status:403});
        return new Response(JSON.stringify({message:'Write receipt lost'}),{status:503});
      }
      if(url.includes('/rpc/rheomiq_is_owner_aal2')){
        if(scenario==='owner-check-unavailable')return new Response('{}',{status:503});
        return new Response(scenario==='revoked-owner'?'false':'true',{status:200});
      }
      if(url.includes('/rheomiq_financial_provider_asset_bindings?')){
        if(scenario==='readback-unavailable')return new Response('{}',{status:503});
        const rows=scenario==='missing-assignment'?[]:
          scenario==='stale-binding'?[binding]:
            scenario==='malformed-readback'?{}:
              clear?[]:[binding];
        return new Response(JSON.stringify(rows),{status:200});
      }
      throw new Error('Unexpected call '+method+' '+url);
    }));
    const action=setFinancialProviderAssetBinding({
      providerId:'owner-bank',role:'logo',variant:'light',assetKey:clear?null:key,
    },'owner-jwt');
    if(scenario==='lost-503-assignment'||scenario==='lost-network-clear')
      await expect(action).resolves.toBeUndefined();
    else await expect(action).rejects.toMatchObject({
      status:scenario==='definite-forbidden'?403:503,
      code:scenario==='definite-forbidden'?'FORBIDDEN':'FINANCIAL_PROVIDER_BINDING_UNVERIFIED',
    });
    const expected=scenario==='definite-forbidden'?['POST']:
      scenario==='revoked-owner'||scenario==='owner-check-unavailable'?['POST','POST']:
        ['POST','POST','GET'];
    expect(calls.map(x=>x.method)).toEqual(expected);
    expect(calls.filter(x=>x.url.includes('/rpc/rheomiq_set_financial_provider_asset_binding'))).toHaveLength(1);
    if(calls.length>1)expect(calls[1]?.url).toContain('/rpc/rheomiq_is_owner_aal2');
    if(calls.length>2){
      expect(calls[2]?.url).toContain('provider_id=eq.owner-bank');
      expect(calls[2]?.url).toContain('asset_role=eq.logo');
      expect(calls[2]?.url).toContain('variant=eq.light');
    }
    expect(JSON.parse(calls[0]?.body??'{}')).toMatchObject({
      p_provider_id:'owner-bank',p_asset_role:'logo',p_variant:'light',p_asset_key:clear?null:key,
    });
  });
});
